import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';

@Injectable()
export class AccessService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
    private readonly config: ConfigService,
  ) {}

  /** Public access config for a work (rate, discovery price, mode, creator). */
  async getConfig(tokenId: string) {
    const [cfg, creator] = await Promise.all([
      this.blockchain.getAccessConfig(tokenId),
      this.blockchain.getCreator(tokenId),
    ]);
    return {
      tokenId,
      creator,
      pricePerAccess: cfg.pricePerAccess.toString(),
      discoveryPrice: cfg.discoveryPrice.toString(),
      mode: cfg.mode === 0 ? 'TIMED' : 'DISCRETE',
      minAccessSeconds: Number(cfg.minAccessSeconds),
      daoTreasury: cfg.daoTreasury,
      active: cfg.active,
    };
  }

  /** Content delivered after the x402 discovery payment is verified. */
  async getContent(tokenId: string) {
    const uri = await this.blockchain.getTokenUri(tokenId);
    const gateway = this.config.get<string>('ipfsGateway')!;
    const url = uri.startsWith('ipfs://') ? gateway + uri.slice('ipfs://'.length) : uri;
    return { tokenId, uri, url };
  }

  /** Operator opens a metered session against a listener's pre-authorised USDC. */
  async openSession(tokenId: string, listener: string, authorisedUsdc?: number) {
    const escrow = this.escrowAddress();
    let authorised: bigint;
    if (authorisedUsdc !== undefined) {
      authorised = BigInt(Math.floor(authorisedUsdc * 1e6));
    } else {
      authorised = (await this.blockchain.getAccessConfig(tokenId)).pricePerAccess;
    }

    const sessionId = ethers.hexlify(ethers.randomBytes(32));
    const calldata = this.blockchain.encodeOpenSession(sessionId, listener, tokenId, authorised);
    const txId = await this.wallets.sendContractCall(escrow, calldata);
    const txHash = await this.wallets.waitForTransaction(txId);
    return { sessionId, txHash, authorised: authorised.toString() };
  }

  /** Operator settles a session — distributes the per-access fee per SplitResolver + 1% DAO cut. */
  async settle(sessionId: string) {
    const escrow = this.escrowAddress();
    const calldata = this.blockchain.encodeSettle(sessionId);
    const txId = await this.wallets.sendContractCall(escrow, calldata);
    const txHash = await this.wallets.waitForTransaction(txId);
    return { sessionId, txHash };
  }

  private escrowAddress(): string {
    const escrow = this.config.get<string>('contracts.accessEscrow');
    if (!escrow) throw new BadRequestException('ACCESS_ESCROW_ADDRESS not configured');
    return escrow;
  }
}
