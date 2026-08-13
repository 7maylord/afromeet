import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { AccessService } from './access.service';
import { BlockchainService, AccessConfig, CatalogueEntry, VaultSaleInfo } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { MediaVaultService } from '../media-vault/media-vault.service';

const timedConfig: AccessConfig = {
  pricePerAccess: 0n,
  discoveryPrice: 2000n,
  ratePerSecond: 100n, // $0.0001 / second
  mode: 0, // TIMED
  minAccessSeconds: 30n,
  daoTreasury: '0x00000000000000000000000000000000000000Da',
  active: true,
};

const discreteConfig: AccessConfig = {
  pricePerAccess: 500_000n, // $0.50 flat
  discoveryPrice: 500_000n,
  ratePerSecond: 0n,
  mode: 1, // DISCRETE
  minAccessSeconds: 0n,
  daoTreasury: '0x00000000000000000000000000000000000000Da',
  active: true,
};

const openSession = { listener: '0x00000000000000000000000000000000000000c1', tokenId: 1n, authorisedAmount: 1_000_000n, settled: false };

describe('AccessService', () => {
  let blockchain: jest.Mocked<
    Pick<
      BlockchainService,
      | 'getAccessConfig'
      | 'getCreator'
      | 'encodeSettle'
      | 'getSession'
      | 'getTokenUri'
      | 'getCatalogueRaw'
      | 'getVaultSaleInfoBatch'
    >
  >;
  let wallets: jest.Mocked<Pick<WalletsService, 'sendContractCall' | 'waitForTransaction'>>;
  let vault: jest.Mocked<Pick<MediaVaultService, 'get'>>;
  let svc: AccessService;

  beforeEach(() => {
    blockchain = {
      getAccessConfig: jest.fn().mockResolvedValue(timedConfig),
      getCreator: jest.fn().mockResolvedValue('0x00000000000000000000000000000000000000c0'),
      encodeSettle: jest.fn().mockReturnValue('0xcalldata'),
      getSession: jest.fn().mockResolvedValue(openSession),
      getTokenUri: jest.fn().mockResolvedValue('ipfs://Qmwork'),
      getCatalogueRaw: jest.fn().mockResolvedValue([]),
      getVaultSaleInfoBatch: jest.fn().mockResolvedValue(new Map()),
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
    vault = { get: jest.fn().mockResolvedValue(undefined) };
    svc = new AccessService(
      blockchain as unknown as BlockchainService,
      wallets as unknown as WalletsService,
      config,
      vault as unknown as MediaVaultService,
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

  describe('settleAsListener (signature-authenticated, no operator key)', () => {
    const wallet = new ethers.Wallet('0x' + '11'.repeat(32));
    const otherWallet = new ethers.Wallet('0x' + '22'.repeat(32));

    async function signProof(sessionId: string, listener: string, signer: ethers.Wallet, nonce: string, timestamp: number) {
      return signer.signMessage(`AfroMeet settle ${sessionId} ${listener.toLowerCase()} ${nonce} ${timestamp}`);
    }

    it('settles when the signature matches both the claimed listener and the on-chain session listener', async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, listener: wallet.address });
      const nonce = 'n1';
      const timestamp = Date.now();
      const signature = await signProof('0xsid', wallet.address, wallet, nonce, timestamp);

      const res = await svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45);
      expect(blockchain.encodeSettle).toHaveBeenCalledWith('0xsid', 45);
      expect(wallets.sendContractCall).toHaveBeenCalledWith('0xESCROW', '0xcalldata');
      expect(res.txHash).toBe('0xhash');
    });

    it('rejects when the signer is not the claimed listener', async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, listener: wallet.address });
      const nonce = 'n2';
      const timestamp = Date.now();
      // Signed by a different wallet than the `listener` param supplied.
      const signature = await signProof('0xsid', wallet.address, otherWallet, nonce, timestamp);

      await expect(
        svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45),
      ).rejects.toThrow('settlement signature does not match listener');
      expect(wallets.sendContractCall).not.toHaveBeenCalled();
    });

    it("rejects when the signer isn't the session's actual on-chain listener — can't settle someone else's session", async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, listener: otherWallet.address });
      const nonce = 'n3';
      const timestamp = Date.now();
      const signature = await signProof('0xsid', wallet.address, wallet, nonce, timestamp);

      await expect(
        svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45),
      ).rejects.toThrow('not the listener for this session');
      expect(wallets.sendContractCall).not.toHaveBeenCalled();
    });

    it('rejects a reused nonce (replay protection)', async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, listener: wallet.address });
      const nonce = 'n4';
      const timestamp = Date.now();
      const signature = await signProof('0xsid', wallet.address, wallet, nonce, timestamp);

      await svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45);
      await expect(
        svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45),
      ).rejects.toThrow('invalid or reused settlement proof');
    });

    it('rejects a stale proof (older than the 5-minute window)', async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, listener: wallet.address });
      const nonce = 'n5';
      const timestamp = Date.now() - 400_000; // 6.6 minutes old
      const signature = await signProof('0xsid', wallet.address, wallet, nonce, timestamp);

      await expect(
        svc.settleAsListener('0xsid', wallet.address, signature, nonce, timestamp, 45),
      ).rejects.toThrow('invalid or reused settlement proof');
    });
  });

  describe('sessionContent', () => {
    it('TIMED: releases the key WITHOUT settling — billed later on stop for real elapsed time', async () => {
      await svc.sessionContent('0xsid');
      expect(wallets.sendContractCall).not.toHaveBeenCalled();
      expect(blockchain.encodeSettle).not.toHaveBeenCalled();
    });

    it('DISCRETE: settles the flat price immediately, before releasing the key', async () => {
      blockchain.getAccessConfig.mockResolvedValue(discreteConfig);
      await svc.sessionContent('0xsid');
      expect(blockchain.encodeSettle).toHaveBeenCalledWith('0xsid', 0);
      expect(wallets.sendContractCall).toHaveBeenCalledWith('0xESCROW', '0xcalldata');
    });

    it('rejects a session that is already settled', async () => {
      blockchain.getSession.mockResolvedValue({ ...openSession, settled: true });
      await expect(svc.sessionContent('0xsid')).rejects.toThrow('no open session for this content');
    });

    it('rejects an unopened session (zero listener)', async () => {
      blockchain.getSession.mockResolvedValue({
        ...openSession,
        listener: '0x0000000000000000000000000000000000000000',
      });
      await expect(svc.sessionContent('0xsid')).rejects.toThrow('no open session for this content');
    });
  });

  describe('catalogue (Multicall3-batched)', () => {
    it('joins vault sale info only onto fractionalized works, by vault address — not by array position', async () => {
      // Regression guard: a naive positional join would leak token 1's sale info onto token 2
      // (which has no vault) once a non-fractionalised work sits between two fractionalised ones.
      const entries: CatalogueEntry[] = [
        {
          tokenId: '1',
          creator: '0xc0',
          tokenURI: 'ipfs://Qmwork',
          mode: 0,
          pricePerAccess: 0n,
          discoveryPrice: 2000n,
          ratePerSecond: 100n,
          minAccessSeconds: 30n,
          vault: '0xVAULT1',
        },
        {
          tokenId: '2',
          creator: '0xc1',
          tokenURI: 'ipfs://Qmwork2',
          mode: 1,
          pricePerAccess: 500_000n,
          discoveryPrice: 500_000n,
          ratePerSecond: 0n,
          minAccessSeconds: 0n,
          vault: null,
        },
      ];
      const saleInfo = new Map<string, VaultSaleInfo>([
        ['0xVAULT1', { curator: '0xCURATOR', pricePerShare: 1000n, sharesForSale: 500n, totalShares: 10000n }],
      ]);
      blockchain.getCatalogueRaw.mockResolvedValue(entries);
      blockchain.getVaultSaleInfoBatch.mockResolvedValue(saleInfo);

      const works = (await svc.catalogue()) as Array<Record<string, unknown>>;

      // Only the fractionalised tokenId's vault is batched — not every token.
      expect(blockchain.getVaultSaleInfoBatch).toHaveBeenCalledWith(['0xVAULT1']);
      expect(works.find((w) => w.id === '1')).toMatchObject({
        vault: '0xVAULT1',
        curator: '0xCURATOR',
        sharePriceRaw: '1000',
        sharesForSale: 500,
        totalShares: 10000,
      });
      expect(works.find((w) => w.id === '2')).toMatchObject({
        vault: null,
        curator: null,
        sharePriceRaw: '0',
        sharesForSale: 0,
        totalShares: 0,
      });
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
