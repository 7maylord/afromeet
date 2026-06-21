import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { Erc8004Service } from '../circle/erc8004.service';
import { ServicesService } from '../services/services.service';
import { CandidateBrief, DecisionEngineService } from './decision-engine.service';

export interface RunSummary {
  budgetUsdc: number;
  sampled: number;
  backed: { tokenId: string; allocationUsdc: number; shares: string; reason: string }[];
  skipped: string[];
}

/**
 * The Patron Agent. Autonomously discovers works, samples them with discovery nanopayments,
 * has Claude evaluate each, buys fractional shares of the promising ones, and records reputation.
 * Mirrors the prior Arc/Circle agent-loop pattern.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private running = false;

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
    private readonly erc8004: Erc8004Service,
    private readonly decision: DecisionEngineService,
    private readonly services: ServicesService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledRun(): Promise<void> {
    if (!this.wallets.isReady() || !this.decision.isReady()) return;
    await this.runOnce();
  }

  /** One pass of the discover → sample → evaluate → back loop. Safe to trigger manually. */
  async runOnce(): Promise<RunSummary> {
    if (this.running) throw new Error('Agent run already in progress');
    if (!this.wallets.isReady()) throw new Error('Circle wallet not ready');
    if (!this.decision.isReady()) throw new Error('ANTHROPIC_API_KEY not set');

    this.running = true;
    const summary: RunSummary = { budgetUsdc: 0, sampled: 0, backed: [], skipped: [] };
    try {
      const agent = this.wallets.getAddress()!;
      let budget = Number(await this.blockchain.usdcBalanceOf(agent)) / 1e6;
      summary.budgetUsdc = budget;

      const candidates = await this.discover(agent);
      const limit = this.config.get<number>('agent.sampleLimit')!;
      const minScore = this.config.get<number>('agent.minScore')!;

      for (const c of candidates.slice(0, limit)) {
        await this.sample(c, agent);
        summary.sampled++;

        // RFB-01: autonomously buy external research via an x402 service to inform the decision.
        const research = await this.services.research(`West African creator work ${c.contentUri}`);
        if (research) c.research = JSON.stringify(research).slice(0, 1200);

        const decision = await this.decision.evaluate(c, budget);
        if (!decision.back || decision.score < minScore) {
          summary.skipped.push(`${c.tokenId}: ${decision.reason}`);
          continue;
        }

        const shares = await this.backWork(c, decision.allocationUsdc, agent);
        if (shares === null) {
          summary.skipped.push(`${c.tokenId}: buy failed`);
          continue;
        }
        budget -= decision.allocationUsdc;
        summary.backed.push({
          tokenId: c.tokenId,
          allocationUsdc: decision.allocationUsdc,
          shares: shares.toString(),
          reason: decision.reason,
        });
        await this.erc8004.recordReputation(
          Math.round(decision.score * 100),
          'backed_creator',
          `token_${c.tokenId}`,
        );
      }
    } finally {
      this.running = false;
    }
    return summary;
  }

  /** Enumerate active works the agent does not already hold shares in. */
  private async discover(agent: string): Promise<CandidateBrief[]> {
    const next = Number(await this.blockchain.getNextTokenId());
    const nftAddr = this.blockchain.nftAddress();
    const out: CandidateBrief[] = [];

    for (let id = 1; id <= next; id++) {
      try {
        const cfg = await this.blockchain.getAccessConfig(id);
        if (!cfg.active) continue;

        const [creator, uri, vault] = await Promise.all([
          this.blockchain.getCreator(id),
          this.blockchain.getTokenUri(id),
          this.blockchain.getVaultOf(nftAddr, id),
        ]);

        let sharesAvailable = false;
        let pricePerShareUsdc = 0;
        let accessRevenueUsdc = 0;
        if (vault && vault !== ethers.ZeroAddress) {
          const sale = await this.blockchain.getSaleInfo(vault);
          sharesAvailable = sale.sharesForSale > 0n && sale.pricePerShare > 0n;
          pricePerShareUsdc = Number(sale.pricePerShare) / 1e6;
          accessRevenueUsdc = Number(await this.blockchain.usdcBalanceOf(vault)) / 1e6;
          if (Number(await this.blockchain.getWithdrawableRevenue(vault, agent)) > 0) continue;
        }

        out.push({
          tokenId: id.toString(),
          creator,
          contentUri: uri,
          accessRevenueUsdc,
          sharesAvailable,
          pricePerShareUsdc,
        });
      } catch (err) {
        this.logger.warn(`discover skip token ${id}: ${(err as Error).message}`);
      }
    }
    return out;
  }

  /** Pay the discovery nanopayment straight to the creator (skips if free). */
  private async sample(c: CandidateBrief, agent: string): Promise<void> {
    const cfg = await this.blockchain.getAccessConfig(c.tokenId);
    if (cfg.discoveryPrice === 0n) return;
    if ((await this.blockchain.usdcBalanceOf(agent)) < cfg.discoveryPrice) return;

    const calldata = this.blockchain.encodeUsdcTransfer(c.creator, cfg.discoveryPrice);
    const txId = await this.wallets.sendContractCall(
      this.config.get<string>('contracts.usdc')!,
      calldata,
    );
    await this.wallets.waitForTransaction(txId);
    this.logger.log(`Sampled token ${c.tokenId} (paid $${Number(cfg.discoveryPrice) / 1e6})`);
  }

  /** Approve USDC and buy fractional shares with the allocated budget. Returns shares bought. */
  private async backWork(
    c: CandidateBrief,
    allocationUsdc: number,
    _agent: string,
  ): Promise<bigint | null> {
    const nftAddr = this.blockchain.nftAddress();
    const vault = await this.blockchain.getVaultOf(nftAddr, c.tokenId);
    if (!vault || vault === ethers.ZeroAddress) return null;

    const sale = await this.blockchain.getSaleInfo(vault);
    if (sale.pricePerShare === 0n || sale.sharesForSale === 0n) return null;

    const allocRaw = BigInt(Math.floor(allocationUsdc * 1e6));
    let shares = allocRaw / sale.pricePerShare;
    if (shares > sale.sharesForSale) shares = sale.sharesForSale;
    if (shares === 0n) return null;
    const cost = shares * sale.pricePerShare;

    const approve = this.blockchain.encodeUsdcApprove(vault, cost);
    await this.wallets.waitForTransaction(
      await this.wallets.sendContractCall(this.config.get<string>('contracts.usdc')!, approve),
    );
    const buy = this.blockchain.encodeBuyShares(shares);
    await this.wallets.waitForTransaction(await this.wallets.sendContractCall(vault, buy));

    this.logger.log(`Backed token ${c.tokenId}: bought ${shares} shares for $${allocationUsdc}`);
    return shares;
  }
}
