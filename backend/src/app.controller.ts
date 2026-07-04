import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from './blockchain/blockchain.service';
import { WalletsService } from './circle/wallets.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
  ) {}

  @ApiOperation({ summary: 'Root' })
  @ApiResponse({ status: 200, schema: { example: { name: 'AfroMeet API', docs: '/docs' } } })
  @Get()
  root() {
    return { name: 'AfroMeet API', docs: '/docs' };
  }

  @ApiOperation({ summary: 'Liveness — Arc connection + Circle wallet readiness' })
  @ApiResponse({
    status: 200,
    description: 'status: ok · arc: chainId + blockNumber · agentWallet: address · circleReady: boolean',
    schema: {
      example: { status: 'ok', arc: { chainId: 5042002, blockNumber: 123456 }, agentWallet: '0xf993…', circleReady: true },
    },
  })
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

  @ApiOperation({ summary: "An address's USDC balance on Arc (server-side read — no browser CORS)" })
  @ApiParam({ name: 'address', description: 'Wallet address (0x…)', example: '0xAbCd…' })
  @ApiResponse({ status: 200, schema: { example: { address: '0xAbCd…', balanceRaw: '9500000' } } })
  @Get('usdc/:address/balance')
  async usdcBalance(@Param('address') address: string) {
    let balanceRaw = '0';
    try {
      balanceRaw = (await this.blockchain.usdcBalanceOf(address)).toString();
    } catch {
      /* RPC unavailable — report zero rather than fail */
    }
    return { address, balanceRaw };
  }
}
