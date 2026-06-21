import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @ApiOperation({ summary: 'Public access config for a work (rate, discovery price, mode, creator)' })
  @Get('config/:tokenId')
  getConfig(@Param('tokenId') tokenId: string) {
    return this.access.getConfig(tokenId);
  }

  @ApiOperation({ summary: 'Operator opens a metered streaming session' })
  @Post('session/open')
  openSession(@Body() body: { tokenId: string; listener: string; authorisedUsdc?: number }) {
    return this.access.openSession(body.tokenId, body.listener, body.authorisedUsdc);
  }

  @ApiOperation({ summary: 'Operator settles a session (per-access fee → splits + 1% DAO)' })
  @Post('session/settle')
  settle(@Body() body: { sessionId: string }) {
    return this.access.settle(body.sessionId);
  }

  @ApiOperation({
    summary: 'x402 discovery: 402 until USDC is paid to the creator, then returns the content',
  })
  @UseGuards(NanopaymentGuard)
  @Get(':tokenId')
  getContent(@Param('tokenId') tokenId: string) {
    return this.access.getContent(tokenId);
  }
}
