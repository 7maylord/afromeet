import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from '../blockchain/blockchain.service';

@ApiTags('creator')
@Controller('creator')
export class CreatorController {
  constructor(private readonly blockchain: BlockchainService) {}

  @ApiOperation({ summary: 'Creator earnings — total access revenue + paid-access count, from chain' })
  @Get(':address/earnings')
  async earnings(@Param('address') address: string) {
    const { totalAmount, count } = await this.blockchain.getEarnings(address);
    return {
      totalEarnings: totalAmount.toString(), // raw USDC (6dp)
      accessCount: count,
      secondarySales: '0', // marketplace royalties — not yet indexed
    };
  }
}
