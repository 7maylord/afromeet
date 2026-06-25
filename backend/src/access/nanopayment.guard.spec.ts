import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NanopaymentGuard } from './nanopayment.guard';
import { BlockchainService } from '../blockchain/blockchain.service';

const USDC = '0x3600000000000000000000000000000000000000';
const CREATOR = '0x00000000000000000000000000000000000000c0';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function ctx(headers: Record<string, string | undefined>, tokenId = '1'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, params: { tokenId } }) }),
  } as unknown as ExecutionContext;
}

function usdcTransferReceipt(to: string, amount: bigint, status = 1) {
  return {
    status,
    logs: [
      {
        address: USDC,
        topics: [TRANSFER_TOPIC, ethers.zeroPadValue('0x01', 32), ethers.zeroPadValue(to, 32)],
        data: ethers.toBeHex(amount),
      },
    ],
  };
}

describe('NanopaymentGuard (x402 discovery gate)', () => {
  let getTransactionReceipt: jest.Mock;
  let blockchain: jest.Mocked<Pick<BlockchainService, 'getAccessConfig' | 'getCreator' | 'getProvider'>>;
  let guard: NanopaymentGuard;

  const config = {
    get: jest.fn((k: string) => ({ 'contracts.usdc': USDC, 'arc.chainId': 5042002 } as Record<string, unknown>)[k]),
  } as unknown as ConfigService;

  beforeEach(() => {
    getTransactionReceipt = jest.fn();
    blockchain = {
      getAccessConfig: jest.fn().mockResolvedValue({ discoveryPrice: 1000n } as never),
      getCreator: jest.fn().mockResolvedValue(CREATOR),
      getProvider: jest.fn().mockReturnValue({ getTransactionReceipt }),
    };
    guard = new NanopaymentGuard(blockchain as unknown as BlockchainService, config);
  });

  it('allows free discovery (discoveryPrice 0) with no payment', async () => {
    blockchain.getAccessConfig.mockResolvedValue({ discoveryPrice: 0n } as never);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it('returns 402 with payment instructions when no tx header is present', async () => {
    const err = await guard.canActivate(ctx({})).catch((e) => e as HttpException);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect((err as HttpException).getResponse()).toMatchObject({ recipient: CREATOR, token: USDC });
  });

  it('accepts a tx that pays the creator at least the discovery price', async () => {
    getTransactionReceipt.mockResolvedValue(usdcTransferReceipt(CREATOR, 1500n));
    await expect(guard.canActivate(ctx({ 'x-payment-tx': '0xpaid' }))).resolves.toBe(true);
  });

  it('rejects an underpayment', async () => {
    getTransactionReceipt.mockResolvedValue(usdcTransferReceipt(CREATOR, 999n));
    await expect(guard.canActivate(ctx({ 'x-payment-tx': '0xlow' }))).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects a replayed tx hash (dedup)', async () => {
    getTransactionReceipt.mockResolvedValue(usdcTransferReceipt(CREATOR, 1500n));
    await expect(guard.canActivate(ctx({ 'x-payment-tx': '0xonce' }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ 'x-payment-tx': '0xonce' }))).rejects.toBeInstanceOf(HttpException);
  });
});
