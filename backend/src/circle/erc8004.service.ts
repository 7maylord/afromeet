import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { WalletsService } from './wallets.service';

const IDENTITY_ABI = [
  'function register(string metadataURI)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 score, uint8 feedbackType, string tag, string context, string evidence, string notes, bytes32 feedbackHash)',
];

/**
 * Registers the Patron Agent with the ERC-8004 IdentityRegistry on Arc and records reputation
 * after patronage decisions resolve. Gives the agent a verifiable on-chain identity + track record
 * — directly strengthening the "agentic sophistication" story. Ported from the prior Arc/Circle build.
 */
@Injectable()
export class Erc8004Service implements OnModuleInit {
  private readonly logger = new Logger(Erc8004Service.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private agentId: bigint | null = null;

  private get identityRegistry(): string {
    return this.config.get<string>('erc8004.identityRegistry')!;
  }
  private get reputationRegistry(): string {
    return this.config.get<string>('erc8004.reputationRegistry')!;
  }

  constructor(
    private readonly config: ConfigService,
    private readonly wallets: WalletsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rpcUrl = this.config.get<string>('arc.rpcUrl');
    if (!rpcUrl) return;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const storedId = this.config.get<string>('erc8004.agentId');
    if (storedId) {
      this.agentId = BigInt(storedId);
      this.logger.log(`ERC-8004 agent ID: ${this.agentId}`);
      return;
    }

    if (this.wallets.isReady()) {
      await this.registerAgent();
    } else {
      this.logger.warn('Circle wallet not ready — ERC-8004 registration deferred');
    }
  }

  /** Register the agent. Auto-runs on boot when the wallet is ready; idempotent via env agentId. */
  async registerAgent(): Promise<void> {
    const metadataUri = this.config.get<string>('erc8004.metadataUri')!;
    try {
      this.logger.log('Registering AfroMeet Patron Agent with ERC-8004 IdentityRegistry...');
      const calldata = new ethers.Interface(IDENTITY_ABI).encodeFunctionData('register', [
        metadataUri,
      ]);
      const txId = await this.wallets.sendContractCall(this.identityRegistry, calldata);
      await this.wallets.waitForTransaction(txId);
      await this.fetchAgentId();
    } catch (err) {
      this.logger.error(`ERC-8004 registration failed: ${(err as Error).message}`);
    }
  }

  private async fetchAgentId(): Promise<void> {
    const walletAddr = this.wallets.getAddress();
    if (!walletAddr || !this.provider) return;

    const iface = new ethers.Interface(IDENTITY_ABI);
    const transferTopic = iface.getEvent('Transfer')!.topicHash;
    const paddedAddr = ethers.zeroPadValue(walletAddr, 32);
    const latestBlock = await this.provider.getBlockNumber();

    const logs = await this.provider.getLogs({
      address: this.identityRegistry,
      topics: [transferTopic, null, paddedAddr],
      fromBlock: Math.max(0, latestBlock - 10000),
      toBlock: latestBlock,
    });
    if (logs.length === 0) {
      this.logger.warn('No Transfer event found — registration may have failed');
      return;
    }

    this.agentId = iface.parseLog(logs[logs.length - 1])!.args.tokenId as bigint;
    this.logger.warn(`Add to .env: ERC8004_AGENT_ID=${this.agentId}`);
  }

  getAgentId(): bigint | null {
    return this.agentId;
  }

  /**
   * Record an on-chain reputation event after a patronage decision plays out — e.g. a backed
   * creator's access revenue grew (positive) or stalled (negative). `score` is 0–100.
   */
  async recordReputation(score: number, tag: string, context: string): Promise<void> {
    if (this.agentId === null || !this.wallets.isReady()) return;
    const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(`afromeet_${context}_${Date.now()}`));
    try {
      const calldata = new ethers.Interface(REPUTATION_ABI).encodeFunctionData('giveFeedback', [
        this.agentId,
        Math.max(0, Math.min(100, Math.round(score))),
        0,
        tag,
        context,
        '',
        '',
        feedbackHash,
      ]);
      const txId = await this.wallets.sendContractCall(this.reputationRegistry, calldata);
      await this.wallets.waitForTransaction(txId);
      this.logger.log(`Reputation recorded — ${tag} (${context}): score=${score}`);
    } catch (err) {
      this.logger.error(`Reputation record failed: ${(err as Error).message}`);
    }
  }
}
