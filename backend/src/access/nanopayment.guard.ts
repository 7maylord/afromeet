import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsedPayment, UsedPaymentDocument } from '../database/schemas/used-payment.schema';

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * x402-style nanopayment gate for discovery access. A non-holder requesting a work gets HTTP 402
 * with payment instructions; they pay the per-work discovery price in USDC directly to the creator
 * on Arc, then retry with the tx hash in the `X-Payment-Tx` header. We verify the USDC Transfer log
 * on-chain and dedup spent hashes. Discovery revenue goes straight to the artist (TRD §12.3).
 */
@Injectable()
export class NanopaymentGuard implements CanActivate {
  private readonly logger = new Logger(NanopaymentGuard.name);
  private readonly usedTxHashes = new Set<string>();

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    @Optional() @InjectModel(UsedPayment.name) private readonly usedPayments?: Model<UsedPaymentDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params: Record<string, string>;
    }>();

    const tokenId = req.params.tokenId;
    const cfg = await this.blockchain.getAccessConfig(tokenId);
    const creator = await this.blockchain.getCreator(tokenId);
    const price = cfg.discoveryPrice;

    // Free discovery — no payment required.
    if (price === 0n) return true;

    const usdc = this.config.get<string>('contracts.usdc')!;
    const chainId = this.config.get<number>('arc.chainId');
    const txHash = req.headers['x-payment-tx'];

    if (!txHash) {
      throw new HttpException(
        {
          error: 'Payment required',
          instructions: `Send ≥ ${this.fmt(price)} USDC to ${creator} on Arc, then retry with the tx hash in the X-Payment-Tx header`,
          recipient: creator,
          minAmount: this.fmt(price),
          minAmountRaw: price.toString(),
          token: usdc,
          chainId,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (this.usedTxHashes.has(txHash) || (this.usedPayments && await this.usedPayments.exists({ txHash }))) {
      throw new HttpException({ error: 'Payment already used' }, HttpStatus.PAYMENT_REQUIRED);
    }

    const ok = await this.verifyPayment(txHash, creator, price);
    if (!ok) {
      throw new HttpException(
        { error: 'Payment not verified', details: `No ≥ ${this.fmt(price)} USDC transfer to ${creator} in ${txHash}` },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    this.usedTxHashes.add(txHash);
    if (this.usedPayments) await this.usedPayments.create({ txHash });
    return true;
  }

  private async verifyPayment(txHash: string, recipient: string, minAmount: bigint): Promise<boolean> {
    try {
      const receipt = await this.blockchain.getProvider().getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) return false;

      const usdc = this.config.get<string>('contracts.usdc')!.toLowerCase();
      const to = recipient.toLowerCase();

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() !== usdc ||
          log.topics[0] !== ERC20_TRANSFER_TOPIC ||
          log.topics.length < 3
        ) {
          continue;
        }
        const logTo = '0x' + log.topics[2].slice(26);
        if (logTo.toLowerCase() !== to) continue;
        if (BigInt(log.data) >= minAmount) return true;
      }
      return false;
    } catch (err) {
      this.logger.error(`verifyPayment error: ${(err as Error).message}`);
      return false;
    }
  }

  /** USDC has 6 decimals. */
  private fmt(raw: bigint): string {
    return (Number(raw) / 1e6).toString();
  }
}
