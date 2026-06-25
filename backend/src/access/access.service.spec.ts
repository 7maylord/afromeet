import { ConfigService } from '@nestjs/config';
import { AccessService } from './access.service';
import { BlockchainService, AccessConfig } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';

const timedConfig: AccessConfig = {
  pricePerAccess: 0n,
  discoveryPrice: 2000n,
  ratePerSecond: 100n, // $0.0001 / second
  mode: 0, // TIMED
  minAccessSeconds: 30n,
  daoTreasury: '0x00000000000000000000000000000000000000Da',
  active: true,
};

describe('AccessService', () => {
  let blockchain: jest.Mocked<Pick<BlockchainService, 'getAccessConfig' | 'getCreator' | 'encodeSettle'>>;
  let wallets: jest.Mocked<Pick<WalletsService, 'sendContractCall' | 'waitForTransaction'>>;
  let svc: AccessService;

  beforeEach(() => {
    blockchain = {
      getAccessConfig: jest.fn().mockResolvedValue(timedConfig),
      getCreator: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000c0'),
      encodeSettle: jest.fn().mockReturnValue('0xcalldata'),
    };
    wallets = {
      sendContractCall: jest.fn().mockResolvedValue('circle-tx-id'),
      waitForTransaction: jest.fn().mockResolvedValue('0xhash'),
    };
    const config = {
      get: jest.fn((k: string) =>
        ({ 'contracts.accessEscrow': '0xESCROW', ipfsGateway: 'https://gw/' } as Record<string, string>)[k],
      ),
    } as unknown as ConfigService;
    svc = new AccessService(
      blockchain as unknown as BlockchainService,
      wallets as unknown as WalletsService,
      config,
    );
  });

  describe('heartbeat (the per-second meter)', () => {
    it('accrues elapsed × ratePerSecond and flags below-minimum', async () => {
      const hb = await svc.heartbeat('1', 10);
      expect(hb.accruedUsdc).toBeCloseTo(0.001); // 10 × 100 / 1e6
      expect(hb.ratePerSecondUsdc).toBeCloseTo(0.0001);
      expect(hb.belowMin).toBe(true); // 10 < 30
    });

    it('clears the skip-gate once past the minimum', async () => {
      const hb = await svc.heartbeat('1', 45);
      expect(hb.belowMin).toBe(false);
      expect(hb.accruedUsdc).toBeCloseTo(0.0045);
    });
  });

  describe('settle', () => {
    it('floors elapsedSeconds and settles against the escrow', async () => {
      const res = await svc.settle('0xsid', 12.9);
      expect(blockchain.encodeSettle).toHaveBeenCalledWith('0xsid', 12);
      expect(wallets.sendContractCall).toHaveBeenCalledWith('0xESCROW', '0xcalldata');
      expect(res.txHash).toBe('0xhash');
    });
  });

  describe('getConfig', () => {
    it('maps the on-chain config to a public shape', async () => {
      const c = await svc.getConfig('1');
      expect(c.mode).toBe('TIMED');
      expect(c.ratePerSecond).toBe('100');
      expect(c.minAccessSeconds).toBe(30);
      expect(c.creator).toBe('0x00000000000000000000000000000000000000c0');
    });
  });
});
