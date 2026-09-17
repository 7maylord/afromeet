import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  ACCESS_ESCROW_ABI,
  ACCESS_REGISTRY_ABI,
  AFROMEET_NFT_ABI,
  CREATOR_DAO_ABI,
  DAO_TREASURY_ABI,
  ERC20_ABI,
  FRACTIONAL_VAULT_ABI,
  FRACTIONAL_VAULT_FACTORY_ABI,
  MARKETPLACE_ABI,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  SPLIT_RESOLVER_ABI,
} from '../config/contracts';

export interface PaymentEvent {
  tokenId: string;
  amountRaw: string;
  daoCutRaw: string;
  txHash: string;
  timestamp: number;
}

export interface Proposal {
  proposalId: string;
  description: string;
  state: number;
  forVotes: bigint;
  againstVotes: bigint;
  deadline: number;
}

export interface AccessConfig {
  pricePerAccess: bigint;
  discoveryPrice: bigint;
  ratePerSecond: bigint; // TIMED: USDC per second
  mode: number; // 0 = TIMED, 1 = DISCRETE
  minAccessSeconds: bigint;
  daoTreasury: string;
  active: boolean;
}

export interface CatalogueEntry {
  tokenId: string;
  creator: string;
  tokenURI: string;
  mode: number;
  pricePerAccess: bigint;
  discoveryPrice: bigint;
  ratePerSecond: bigint;
  minAccessSeconds: bigint;
  vault: string | null;
}

export interface VaultSaleInfo {
  curator: string;
  pricePerShare: bigint;
  sharesForSale: bigint;
  totalShares: bigint;
}

/**
 * Reads AfroMeet contract state from Arc and encodes calldata for write calls. Writes are not sent
 * from here — they are executed by Circle developer-controlled wallets (see WalletsService), which
 * sign and submit the encoded calldata. This mirrors the prior Arc/Circle build.
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider!: ethers.JsonRpcProvider;

  private nft!: ethers.Contract;
  private registry!: ethers.Contract;
  private escrow!: ethers.Contract;
  private splits!: ethers.Contract;
  private factory!: ethers.Contract;
  private usdc!: ethers.Contract;
  private multicall3!: ethers.Contract;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const rpcUrl = this.config.get<string>('arc.rpcUrl');
    if (!rpcUrl) {
      this.logger.warn('ARC_RPC_URL not set — blockchain reads disabled');
      return;
    }
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const c = this.config.get<Record<string, string>>('contracts')!;
    this.usdc = new ethers.Contract(c.usdc, ERC20_ABI, this.provider);
    if (c.afroMeetNft) this.nft = new ethers.Contract(c.afroMeetNft, AFROMEET_NFT_ABI, this.provider);
    if (c.accessRegistry) this.registry = new ethers.Contract(c.accessRegistry, ACCESS_REGISTRY_ABI, this.provider);
    if (c.accessEscrow) this.escrow = new ethers.Contract(c.accessEscrow, ACCESS_ESCROW_ABI, this.provider);
    if (c.splitResolver) this.splits = new ethers.Contract(c.splitResolver, SPLIT_RESOLVER_ABI, this.provider);
    if (c.fractionalVaultFactory) this.factory = new ethers.Contract(c.fractionalVaultFactory, FRACTIONAL_VAULT_FACTORY_ABI, this.provider);
    this.multicall3 = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);

    this.logger.log('BlockchainService ready (read clients initialised)');
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /** Deploy floor: contracts live above this block, so backfill never starts lower. */
  private static readonly DEPLOY_BLOCK = 50000000;
  /** Arc rejects any eth_getLogs spanning more than 100k blocks. Stay safely under. */
  private static readonly MAX_LOG_RANGE = 90000;

  /** Accumulated logs per (address+topic) filter, with the last block already scanned. */
  private readonly logCache = new Map<string, { logs: ethers.Log[]; cursor: number }>();

  /**
   * Incremental event reader for Arc. First call backfills from DEPLOY_BLOCK in ≤90k-block
   * windows (Arc caps eth_getLogs at a 100k range); every later call only scans the blocks
   * mined since the last poll and appends them. Reads stay cheap and never re-scan history.
   * ponytail: in-memory cache → one backfill per process boot. Persist to Mongo if restarts
   * during judging become costly.
   */
  private async syncLogs(key: string, address: string, topics: (string | string[] | null)[]): Promise<ethers.Log[]> {
    const latest = await this.provider.getBlockNumber();
    const entry = this.logCache.get(key) ?? {
      logs: [] as ethers.Log[],
      cursor: BlockchainService.DEPLOY_BLOCK - 1,
    };

    for (let from = entry.cursor + 1; from <= latest; from += BlockchainService.MAX_LOG_RANGE + 1) {
      const to = Math.min(from + BlockchainService.MAX_LOG_RANGE, latest);
      let logs: ethers.Log[];
      try {
        logs = await this.provider.getLogs({
          address,
          topics,
          fromBlock: from,
          toBlock: to,
        });
      } catch (error) {
        const rpcError = error as { error?: { message?: string } };
        const message = rpcError.error?.message ?? (error instanceof Error ? error.message : String(error));
        this.logger.warn(`Log sync failed for ${address} (${from}-${to}): ${message}`);
        return entry.logs;
      }
      entry.logs.push(...logs);
      entry.cursor = to;
    }
    this.logCache.set(key, entry);
    return entry.logs;
  }

  // --- Reads ----------------------------------------------------------------

  async getAccessConfig(tokenId: bigint | number | string): Promise<AccessConfig> {
    const r = await this.registry.getConfig(tokenId);
    return {
      pricePerAccess: r.pricePerAccess,
      discoveryPrice: r.discoveryPrice,
      ratePerSecond: r.ratePerSecond,
      mode: Number(r.mode),
      minAccessSeconds: r.minAccessSeconds,
      daoTreasury: r.daoTreasury,
      active: r.active,
    };
  }

  async getCreator(tokenId: bigint | number | string): Promise<string> {
    return this.nft.creatorOf(tokenId);
  }

  async getOwner(tokenId: bigint | number | string): Promise<string> {
    return this.nft.ownerOf(tokenId);
  }

  async getTokenUri(tokenId: bigint | number | string): Promise<string> {
    return this.nft.tokenURI(tokenId);
  }

  /** Highest minted tokenId; works are 1..nextTokenId. Used by the agent to enumerate the catalogue. */
  async getNextTokenId(): Promise<bigint> {
    return this.nft.nextTokenId();
  }

  nftAddress(): string {
    return this.config.get<string>('contracts.afroMeetNft')!;
  }

  /** Batch read-only calls into one RPC round trip via the canonical Multicall3 deployment.
   *  Per-call failures (e.g. an unminted tokenId) return '0x' instead of reverting the batch. */
  private async multicall(calls: { target: string; callData: string }[]): Promise<string[]> {
    if (calls.length === 0) return [];
    // aggregate3 is declared `payable`, not `view` — .staticCall forces an eth_call (read) instead
    // of ethers defaulting to a transaction-send, which a read-only Provider can't do anyway.
    const results: { success: boolean; returnData: string }[] = await this.multicall3.aggregate3.staticCall(
      calls.map((c) => ({
        target: c.target,
        allowFailure: true,
        callData: c.callData,
      })),
    );
    return results.map((r) => (r.success ? r.returnData : '0x'));
  }

  /**
   * The full active-work catalogue in a fixed 2 round trips (regardless of how many tokens exist),
   * replacing what used to be an up-to-4-calls-per-token sequential loop. Callers that also need
   * vault sale info should follow up with getVaultSaleInfoBatch() for the vault addresses returned here.
   */
  async getCatalogueRaw(): Promise<CatalogueEntry[]> {
    const next = Number(await this.nft.nextTokenId());
    if (next === 0) return [];
    const nftAddr = this.nftAddress();

    const registryIface = new ethers.Interface(ACCESS_REGISTRY_ABI);
    const nftIface = new ethers.Interface(AFROMEET_NFT_ABI);
    const factoryIface = new ethers.Interface(FRACTIONAL_VAULT_FACTORY_ABI);

    const calls: { target: string; callData: string }[] = [];
    for (let id = 1; id <= next; id++) {
      calls.push(
        {
          target: this.registry.target as string,
          callData: registryIface.encodeFunctionData('getConfig', [id]),
        },
        {
          target: nftAddr,
          callData: nftIface.encodeFunctionData('creatorOf', [id]),
        },
        {
          target: nftAddr,
          callData: nftIface.encodeFunctionData('tokenURI', [id]),
        },
        {
          target: this.factory.target as string,
          callData: factoryIface.encodeFunctionData('vaultOf', [nftAddr, id]),
        },
      );
    }
    const raw = await this.multicall(calls);

    const out: CatalogueEntry[] = [];
    for (let i = 0; i < next; i++) {
      const [cfgData, creatorData, uriData, vaultData] = raw.slice(i * 4, i * 4 + 4);
      if (cfgData === '0x' || creatorData === '0x' || uriData === '0x') continue; // unminted/unreadable token

      const cfg = registryIface.decodeFunctionResult('getConfig', cfgData)[0];
      if (!cfg.active) continue;

      const vault = vaultData !== '0x' ? (factoryIface.decodeFunctionResult('vaultOf', vaultData)[0] as string) : ethers.ZeroAddress;

      out.push({
        tokenId: (i + 1).toString(),
        creator: nftIface.decodeFunctionResult('creatorOf', creatorData)[0] as string,
        tokenURI: nftIface.decodeFunctionResult('tokenURI', uriData)[0] as string,
        mode: Number(cfg.mode),
        pricePerAccess: cfg.pricePerAccess,
        discoveryPrice: cfg.discoveryPrice,
        ratePerSecond: cfg.ratePerSecond,
        minAccessSeconds: cfg.minAccessSeconds,
        vault: vault !== ethers.ZeroAddress ? vault : null,
      });
    }
    return out;
  }

  /** Sale info for many vaults in a single Multicall3 round trip. */
  async getVaultSaleInfoBatch(vaultAddresses: string[]): Promise<Map<string, VaultSaleInfo>> {
    const out = new Map<string, VaultSaleInfo>();
    if (vaultAddresses.length === 0) return out;

    const iface = new ethers.Interface(FRACTIONAL_VAULT_ABI);
    const calls: { target: string; callData: string }[] = [];
    for (const v of vaultAddresses) {
      calls.push(
        { target: v, callData: iface.encodeFunctionData('curator') },
        { target: v, callData: iface.encodeFunctionData('saleSharePrice') },
        { target: v, callData: iface.encodeFunctionData('sharesForSale') },
        { target: v, callData: iface.encodeFunctionData('totalSupply') },
      );
    }
    const raw = await this.multicall(calls);

    vaultAddresses.forEach((v, i) => {
      const [curatorData, priceData, forSaleData, supplyData] = raw.slice(i * 4, i * 4 + 4);
      out.set(v, {
        curator: curatorData !== '0x' ? (iface.decodeFunctionResult('curator', curatorData)[0] as string) : ethers.ZeroAddress,
        pricePerShare: priceData !== '0x' ? (iface.decodeFunctionResult('saleSharePrice', priceData)[0] as bigint) : 0n,
        sharesForSale: forSaleData !== '0x' ? (iface.decodeFunctionResult('sharesForSale', forSaleData)[0] as bigint) : 0n,
        totalShares: supplyData !== '0x' ? (iface.decodeFunctionResult('totalSupply', supplyData)[0] as bigint) : 0n,
      });
    });
    return out;
  }

  // --- Governance + earnings reads ------------------------------------------

  async ecosystemOf(creator: string): Promise<{
    token: string;
    dao: string;
    treasury: string;
    exists: boolean;
  }> {
    const e = await this.nft.ecosystemOf(creator);
    return {
      token: e.token,
      dao: e.dao,
      treasury: e.treasury,
      exists: e.exists,
    };
  }

  /** TokenIds created by `creator` (small catalogues only — linear scan). */
  async getCreatorTokenIds(creator: string): Promise<number[]> {
    const next = Number(await this.nft.nextTokenId());
    const want = creator.toLowerCase();
    const ids: number[] = [];
    for (let id = 1; id <= next; id++) {
      try {
        if ((await this.nft.creatorOf(id)).toLowerCase() === want) ids.push(id);
      } catch {
        /* skip */
      }
    }
    return ids;
  }

  /** Total access revenue settled to a creator's works + the number of paid accesses. */
  async getEarnings(creator: string): Promise<{ totalAmount: bigint; count: number }> {
    const escrowAddr = this.config.get<string>('contracts.accessEscrow');
    const tokenIds = await this.getCreatorTokenIds(creator);
    if (!escrowAddr || tokenIds.length === 0) return { totalAmount: 0n, count: 0 };

    const iface = new ethers.Interface(ACCESS_ESCROW_ABI);
    const settledTopic = iface.getEvent('Settled')!.topicHash;
    const logs = await this.syncLogs(`settled:${escrowAddr}`, escrowAddr, [settledTopic]);
    const want = new Set(tokenIds.map((id) => BigInt(id)));

    let total = 0n;
    let count = 0;
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (!parsed || !want.has(parsed.args.tokenId as bigint)) continue;
      total += parsed.args.amount as bigint;
      count++;
    }
    return { totalAmount: total, count };
  }

  /** USDC royalties actually received by this creator from secondary marketplace sales. */
  async getSecondaryRoyalties(creator: string): Promise<bigint> {
    const marketplace = this.config.get<string>('contracts.marketplace');
    const usdc = this.config.get<string>('contracts.usdc');
    const nft = this.config.get<string>('contracts.afroMeetNft');
    const tokenIds = await this.getCreatorTokenIds(creator);
    if (!marketplace || !usdc || !nft || tokenIds.length === 0) return 0n;

    const marketIface = new ethers.Interface(MARKETPLACE_ABI);
    const nftIface = new ethers.Interface(AFROMEET_NFT_ABI);
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const bought = await this.syncLogs(`bought:${marketplace}`, marketplace, [marketIface.getEvent('Bought')!.topicHash]);
    const wanted = new Set(tokenIds.map(BigInt));
    const recipient = creator.toLowerCase();
    let total = 0n;

    for (const log of bought) {
      const sale = marketIface.parseLog(log);
      if (!sale || !wanted.has(sale.args.tokenId as bigint)) continue;
      const receipt = await this.provider.getTransactionReceipt(log.transactionHash);
      if (!receipt) continue;
      const nftTransfer = receipt.logs.find(
        (entry) => entry.address.toLowerCase() === nft.toLowerCase() && entry.topics[0] === transferTopic,
      );
      if (!nftTransfer) continue;
      const seller = (nftIface.parseLog(nftTransfer)?.args.from as string).toLowerCase();
      if (seller === recipient) continue;

      for (const entry of receipt.logs) {
        if (
          entry.address.toLowerCase() === usdc.toLowerCase() &&
          entry.topics[0] === transferTopic &&
          entry.topics.length >= 3 &&
          `0x${entry.topics[2].slice(26)}`.toLowerCase() === recipient
        )
          total += BigInt(entry.data);
      }
    }
    return total;
  }

  /** Recent access-settlement payments to a creator's works — newest first, with block timestamps. */
  async getPayments(creator: string, limit = 12): Promise<PaymentEvent[]> {
    const escrowAddr = this.config.get<string>('contracts.accessEscrow');
    const tokenIds = await this.getCreatorTokenIds(creator);
    if (!escrowAddr || tokenIds.length === 0) return [];

    const iface = new ethers.Interface(ACCESS_ESCROW_ABI);
    const settledTopic = iface.getEvent('Settled')!.topicHash;
    const logs = await this.syncLogs(`settled:${escrowAddr}`, escrowAddr, [settledTopic]);
    const want = new Set(tokenIds.map((id) => BigInt(id)));

    const mine = logs.filter((log) => {
      const parsed = iface.parseLog(log);
      return parsed && want.has(parsed.args.tokenId as bigint);
    });
    const recent = mine.slice(-limit).reverse(); // newest first, capped

    const tsCache = new Map<number, number>();
    const out: PaymentEvent[] = [];
    for (const log of recent) {
      const parsed = iface.parseLog(log)!;
      let ts = tsCache.get(log.blockNumber);
      if (ts === undefined) {
        const block = await this.provider.getBlock(log.blockNumber);
        ts = block?.timestamp ?? 0;
        tsCache.set(log.blockNumber, ts);
      }
      out.push({
        tokenId: (parsed.args.tokenId as bigint).toString(),
        amountRaw: (parsed.args.amount as bigint).toString(),
        daoCutRaw: (parsed.args.daoCut as bigint).toString(),
        txHash: log.transactionHash,
        timestamp: ts,
      });
    }
    return out;
  }

  /** A creator DAO's proposals, read from ProposalCreated events + on-chain state/votes. */
  async getProposals(dao: string): Promise<Proposal[]> {
    const iface = new ethers.Interface(CREATOR_DAO_ABI);
    const topic = iface.getEvent('ProposalCreated')!.topicHash;
    const logs = await this.syncLogs(`proposals:${dao.toLowerCase()}`, dao, [topic]);
    const daoC = new ethers.Contract(dao, CREATOR_DAO_ABI, this.provider);

    const out: Proposal[] = [];
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      const proposalId = parsed.args.proposalId as bigint;
      const [state, votes, deadline] = await Promise.all([
        daoC.state(proposalId).catch(() => 0),
        daoC.proposalVotes(proposalId).catch(() => [0n, 0n, 0n]),
        daoC.proposalDeadline(proposalId).catch(() => 0n),
      ]);
      out.push({
        proposalId: proposalId.toString(),
        description: parsed.args.description as string,
        state: Number(state),
        againstVotes: votes[0] as bigint,
        forVotes: votes[1] as bigint,
        deadline: Number(deadline),
      });
    }
    return out;
  }

  // --- Governance calldata (signed client-side by the voter/proposer) -------

  encodeCastVote(proposalId: string, support: number): string {
    return new ethers.Interface(CREATOR_DAO_ABI).encodeFunctionData('castVote', [proposalId, support]);
  }

  encodePropose(targets: string[], values: bigint[], calldatas: string[], description: string): string {
    return new ethers.Interface(CREATOR_DAO_ABI).encodeFunctionData('propose', [targets, values, calldatas, description]);
  }

  encodeQueueDisbursement(to: string, amount: bigint): string {
    return new ethers.Interface(DAO_TREASURY_ABI).encodeFunctionData('queueDisbursement', [to, amount]);
  }

  async getSplits(tokenId: bigint | number | string): Promise<{ recipient: string; basisPoints: bigint }[]> {
    const res = await this.splits.getSplits(tokenId);
    return res.map((s: { recipient: string; basisPoints: bigint }) => ({
      recipient: s.recipient,
      basisPoints: s.basisPoints,
    }));
  }

  async getVaultOf(nftAddress: string, tokenId: bigint | number | string): Promise<string> {
    return this.factory.vaultOf(nftAddress, tokenId);
  }

  async getWithdrawableRevenue(vaultAddress: string, holder: string): Promise<bigint> {
    const vault = new ethers.Contract(vaultAddress, FRACTIONAL_VAULT_ABI, this.provider);
    return vault.withdrawableRevenueOf(holder);
  }

  async getSaleInfo(vaultAddress: string): Promise<{
    curator: string;
    pricePerShare: bigint;
    sharesForSale: bigint;
    totalShares: bigint;
  }> {
    const vault = new ethers.Contract(vaultAddress, FRACTIONAL_VAULT_ABI, this.provider);
    const [curator, pricePerShare, sharesForSale, totalShares] = await Promise.all([
      vault.curator(),
      vault.saleSharePrice(),
      vault.sharesForSale(),
      vault.totalSupply(),
    ]);
    return { curator, pricePerShare, sharesForSale, totalShares };
  }

  async getSession(sessionId: string): Promise<{
    listener: string;
    tokenId: bigint;
    authorisedAmount: bigint;
    settled: boolean;
  }> {
    const s = await this.escrow.sessions(sessionId);
    return {
      listener: s.listener,
      tokenId: s.tokenId,
      authorisedAmount: s.authorisedAmount,
      settled: s.settled,
    };
  }

  async usdcDecimals(): Promise<number> {
    return Number(await this.usdc.decimals());
  }

  async usdcBalanceOf(address: string): Promise<bigint> {
    return this.usdc.balanceOf(address);
  }

  async usdcAllowance(owner: string, spender: string): Promise<bigint> {
    return this.usdc.allowance(owner, spender);
  }

  // --- Calldata encoders (executed via Circle wallets) ----------------------

  encodeOpenSession(sessionId: string, listener: string, tokenId: bigint | number | string, authorisedAmount: bigint): string {
    return new ethers.Interface(ACCESS_ESCROW_ABI).encodeFunctionData('openSession', [sessionId, listener, tokenId, authorisedAmount]);
  }

  encodeSettle(sessionId: string, elapsedSeconds: number): string {
    return new ethers.Interface(ACCESS_ESCROW_ABI).encodeFunctionData('settle', [sessionId, elapsedSeconds]);
  }

  encodeUsdcApprove(spender: string, amount: bigint): string {
    return new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [spender, amount]);
  }

  /** USDC transfer — used by the agent to pay a discovery nanopayment straight to a creator. */
  encodeUsdcTransfer(to: string, amount: bigint): string {
    return new ethers.Interface(ERC20_ABI).encodeFunctionData('transfer', [to, amount]);
  }

  encodeFractionalise(
    nftAddress: string,
    tokenId: bigint | number | string,
    revenueToken: string,
    totalShares: bigint,
    name: string,
    symbol: string,
  ): string {
    return new ethers.Interface(FRACTIONAL_VAULT_FACTORY_ABI).encodeFunctionData('fractionalise', [
      nftAddress,
      tokenId,
      revenueToken,
      totalShares,
      name,
      symbol,
    ]);
  }

  encodeClaimRevenue(): string {
    return new ethers.Interface(FRACTIONAL_VAULT_ABI).encodeFunctionData('claimRevenue', []);
  }

  encodeBuyShares(shareAmount: bigint): string {
    return new ethers.Interface(FRACTIONAL_VAULT_ABI).encodeFunctionData('buyShares', [shareAmount]);
  }

  encodeConfigureSale(shares: bigint, pricePerShare: bigint): string {
    return new ethers.Interface(FRACTIONAL_VAULT_ABI).encodeFunctionData('configureSale', [shares, pricePerShare]);
  }
}
