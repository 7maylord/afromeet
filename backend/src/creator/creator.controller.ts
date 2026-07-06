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
    description: 'totalEarnings and secondarySales are raw USDC (6 decimals); accessCount is settled sessions',
    schema: {
      example: { totalEarnings: '1250000', accessCount: 12, secondarySales: '0' },
    },
  })
  @Get(':address/earnings')
  async earnings(@Param('address') address: string) {
    const [{ totalAmount, count }, secondarySales] = await Promise.all([
      this.blockchain.getEarnings(address),
      this.blockchain.getSecondaryRoyalties(address),
    ]);
    return {
      totalEarnings: totalAmount.toString(),
      accessCount: count,
      secondarySales: secondarySales.toString(),
    };
  }

  @ApiOperation({ summary: 'Recent payments to a creator (access settlements), newest first' })
  @ApiParam({ name: 'address', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiResponse({
    status: 200,
    description: 'Array of { tokenId, amountRaw (6dp USDC), daoCutRaw, txHash, timestamp (unix secs) }',
  })
  @Get(':address/payments')
  async payments(@Param('address') address: string) {
    return this.blockchain.getPayments(address);
  }
}
