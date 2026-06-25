import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';
import {
  ACCESS_ESCROW_ABI,
  ERC20_ABI,
  FRACTIONAL_VAULT_ABI,
} from '../config/contracts';

/**
 * The calldata encoders are pure (they build an ethers.Interface and don't touch the provider),
 * so we can test them without any chain connection. We encode, then decode, and assert the args
 * round-trip — this is what guarantees the backend signs the transaction it thinks it is.
 */
describe('BlockchainService encoders', () => {
  const svc = new BlockchainService({ get: () => undefined } as unknown as ConfigService);
  const sessionId = ethers.id('session-1'); // 32-byte id

  it('encodeSettle round-trips sessionId + elapsedSeconds', () => {
    const data = svc.encodeSettle(sessionId, 42);
    const [sid, elapsed] = new ethers.Interface(ACCESS_ESCROW_ABI).decodeFunctionData(
      'settle',
      data,
    );
    expect(sid).toBe(sessionId);
    expect(Number(elapsed)).toBe(42);
  });

  it('encodeOpenSession round-trips all four args', () => {
    const listener = '0x1111111111111111111111111111111111111111';
    const data = svc.encodeOpenSession(sessionId, listener, 7, 5000n);
    const decoded = new ethers.Interface(ACCESS_ESCROW_ABI).decodeFunctionData(
      'openSession',
      data,
    );
    expect(decoded[0]).toBe(sessionId);
    expect(ethers.getAddress(decoded[1])).toBe(ethers.getAddress(listener));
    expect(Number(decoded[2])).toBe(7);
    expect(decoded[3]).toBe(5000n);
  });

  it('encodeUsdcTransfer targets the creator with the exact amount', () => {
    const to = '0x2222222222222222222222222222222222222222';
    const data = svc.encodeUsdcTransfer(to, 1000n);
    const [recipient, amount] = new ethers.Interface(ERC20_ABI).decodeFunctionData(
      'transfer',
      data,
    );
    expect(ethers.getAddress(recipient)).toBe(ethers.getAddress(to));
    expect(amount).toBe(1000n);
  });

  it('encodeBuyShares carries the share amount', () => {
    const data = svc.encodeBuyShares(250n);
    const [shares] = new ethers.Interface(FRACTIONAL_VAULT_ABI).decodeFunctionData(
      'buyShares',
      data,
    );
    expect(shares).toBe(250n);
  });

  it('encodeUsdcApprove sets spender + amount', () => {
    const spender = '0x3333333333333333333333333333333333333333';
    const data = svc.encodeUsdcApprove(spender, 9999n);
    const [s, a] = new ethers.Interface(ERC20_ABI).decodeFunctionData('approve', data);
    expect(ethers.getAddress(s)).toBe(ethers.getAddress(spender));
    expect(a).toBe(9999n);
  });
});
