import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Blockchain,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

/**
 * Circle Developer-Controlled Wallet for the platform operator / Patron Agent. Holds USDC on Arc,
 * signs and submits contract-execution transactions (settlement, share buys, revenue claims).
 * Ported from the prior Arc/Circle build.
 */
@Injectable()
export class WalletsService implements OnModuleInit {
  private readonly logger = new Logger(WalletsService.name);
  private client!: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
  private walletId: string | null = null;
  private walletAddress: string | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const apiKey = this.config.get<string>('circle.apiKey');
    const entitySecret = this.config.get<string>('circle.entitySecret');
    if (!apiKey || !entitySecret) {
      this.logger.warn('Circle credentials not set — wallet operations disabled');
      return;
    }

    this.client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

    const existingWalletId = this.config.get<string>('circle.walletId');
    if (existingWalletId) {
      this.walletId = existingWalletId;
      await this.loadWalletAddress();
      this.logger.log(`Using wallet ${this.walletId} (${this.walletAddress})`);
    } else {
      this.logger.log('No CIRCLE_WALLET_ID — call createWallet() once to provision');
    }
  }

  /** Provision a wallet set + Arc wallet. Run once, then store CIRCLE_WALLET_ID in .env. */
  async createWallet(): Promise<{ walletId: string; address: string }> {
    if (!this.client) throw new Error('Circle client not initialised');

    const walletSetRes = await this.client.createWalletSet({ name: 'AfroMeet Agent Wallets' });
    const walletSetId = walletSetRes.data?.walletSet?.id;
    if (!walletSetId) throw new Error('Failed to create wallet set');

    const walletRes = await this.client.createWallets({
      walletSetId,
      blockchains: [Blockchain.ArcTestnet],
      count: 1,
    });
    const wallet = walletRes.data?.wallets?.[0];
    if (!wallet?.id || !wallet.address) throw new Error('Failed to create wallet');

    this.walletId = wallet.id;
    this.walletAddress = wallet.address;
    this.logger.log(`Created wallet ${this.walletId} (${this.walletAddress})`);
    this.logger.warn(`Save this in .env: CIRCLE_WALLET_ID=${this.walletId}`);
    return { walletId: this.walletId, address: this.walletAddress };
  }

  /** Submit a contract call from the Circle wallet; returns the Circle transaction id. */
  async sendContractCall(contractAddress: string, calldata: string): Promise<string> {
    if (!this.client || !this.walletId) throw new Error('Wallet not initialised');
    const res = await this.client.createContractExecutionTransaction({
      walletId: this.walletId,
      contractAddress,
      callData: calldata as `0x${string}`,
      fee: { type: 'level', config: { feeLevel: 'HIGH' } },
    });
    const txId = res.data?.id ?? 'unknown';
    this.logger.log(`Tx submitted: ${txId}`);
    return txId;
  }

  /** Poll a Circle transaction to completion and return its on-chain hash. */
  async waitForTransaction(txId: string, maxAttempts = 30, intervalMs = 2000): Promise<string> {
    if (!this.client) throw new Error('Circle client not initialised');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await this.client.getTransaction({ id: txId });
      const tx = res.data?.transaction;
      if (tx) {
        if (tx.state === 'COMPLETE') return tx.txHash as string;
        if (tx.state === 'FAILED' || tx.state === 'CANCELLED') {
          throw new Error(`Transaction ${txId} ended in state ${tx.state}`);
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Transaction ${txId} timed out`);
  }

  getAddress(): string | null {
    return this.walletAddress;
  }

  isReady(): boolean {
    return !!this.client && !!this.walletId;
  }

  private async loadWalletAddress(): Promise<void> {
    if (!this.client || !this.walletId) return;
    try {
      const res = await this.client.getWallet({ id: this.walletId });
      this.walletAddress = res.data?.wallet?.address ?? null;
    } catch (err) {
      this.logger.error(`Failed to load wallet: ${(err as Error).message}`);
    }
  }
}
