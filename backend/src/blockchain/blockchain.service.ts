import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  ACCESS_ESCROW_ABI,
  ACCESS_REGISTRY_ABI,
  AFROMEET_NFT_ABI,
  ERC20_ABI,
  FRACTIONAL_VAULT_ABI,
  FRACTIONAL_VAULT_FACTORY_ABI,
  SPLIT_RESOLVER_ABI,
} from '../config/contracts';

export interface AccessConfig {
  pricePerAccess: bigint;
  discoveryPrice: bigint;
  ratePerSecond: bigint; // TIMED: USDC per second
  mode: number; // 0 = TIMED, 1 = DISCRETE
  minAccessSeconds: bigint;
  daoTreasury: string;
  active: boolean;
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
    if (c.accessRegistry)
      this.registry = new ethers.Contract(c.accessRegistry, ACCESS_REGISTRY_ABI, this.provider);
    if (c.accessEscrow)
      this.escrow = new ethers.Contract(c.accessEscrow, ACCESS_ESCROW_ABI, this.provider);
    if (c.splitResolver)
      this.splits = new ethers.Contract(c.splitResolver, SPLIT_RESOLVER_ABI, this.provider);
    if (c.fractionalVaultFactory)
      this.factory = new ethers.Contract(
        c.fractionalVaultFactory,
        FRACTIONAL_VAULT_FACTORY_ABI,
        this.provider,
      );

    this.logger.log('BlockchainService ready (read clients initialised)');
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
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

  async getSplits(
    tokenId: bigint | number | string,
  ): Promise<{ recipient: string; basisPoints: bigint }[]> {
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

  async getSaleInfo(
    vaultAddress: string,
  ): Promise<{ pricePerShare: bigint; sharesForSale: bigint }> {
    const vault = new ethers.Contract(vaultAddress, FRACTIONAL_VAULT_ABI, this.provider);
    const [pricePerShare, sharesForSale] = await Promise.all([
      vault.saleSharePrice(),
      vault.sharesForSale(),
    ]);
    return { pricePerShare, sharesForSale };
  }

  async usdcDecimals(): Promise<number> {
    return Number(await this.usdc.decimals());
  }

  async usdcBalanceOf(address: string): Promise<bigint> {
    return this.usdc.balanceOf(address);
  }

  // --- Calldata encoders (executed via Circle wallets) ----------------------

  encodeOpenSession(
    sessionId: string,
    listener: string,
    tokenId: bigint | number | string,
    authorisedAmount: bigint,
  ): string {
    return new ethers.Interface(ACCESS_ESCROW_ABI).encodeFunctionData('openSession', [
      sessionId,
      listener,
      tokenId,
      authorisedAmount,
    ]);
  }

  encodeSettle(sessionId: string, elapsedSeconds: number): string {
    return new ethers.Interface(ACCESS_ESCROW_ABI).encodeFunctionData('settle', [
      sessionId,
      elapsedSeconds,
    ]);
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
    return new ethers.Interface(FRACTIONAL_VAULT_ABI).encodeFunctionData('configureSale', [
      shares,
      pricePerShare,
    ]);
  }
}
