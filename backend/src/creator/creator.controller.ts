import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from '../blockchain/blockchain.service';

@ApiTags('creator')
@Controller('creator')
export class CreatorController {
  constructor(private readonly blockchain: BlockchainService) {}

  @ApiOperation({ summary: 'Creator earnings — total access revenue + paid-access count, from chain' })
  @ApiParam({ name: 'address', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiResponse({
    status: 200,
    description: 'totalEarnings: raw USDC (6 decimals), accessCount: number of settled sessions, secondarySales: marketplace royalties (not yet indexed)',
    schema: {
      example: { totalEarnings: '1250000', accessCount: 12, secondarySales: '0' },
    },
  })
  @Get(':address/earnings')
  async earnings(@Param('address') address: string) {
    const { totalAmount, count } = await this.blockchain.getEarnings(address);
    return {
      totalEarnings: totalAmount.toString(),
      accessCount: count,
      secondarySales: '0', // marketplace royalties — not yet indexed
    };
  }
}
