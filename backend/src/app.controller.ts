import { Controller, Get } from '@nestjs/common';
import { BlockchainService } from './blockchain/blockchain.service';
import { WalletsService } from './circle/wallets.service';

@Controller()
export class AppController {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
  ) {}

  /** Liveness + proof the Arc connection and Circle wallet are wired. */
  @Get('health')
  async health() {
    const provider = this.blockchain.getProvider();
    const [network, blockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
    ]);
    return {
      status: 'ok',
      arc: { chainId: Number(network.chainId), blockNumber },
      agentWallet: this.wallets.getAddress(),
      circleReady: this.wallets.isReady(),
    };
  }
}
