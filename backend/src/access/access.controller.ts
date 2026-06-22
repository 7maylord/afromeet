import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @ApiOperation({ summary: 'The public catalogue — every active work on-chain with pricing + URI' })
  @Get('catalogue')
  catalogue() {
    return this.access.catalogue();
  }

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

  @ApiOperation({ summary: 'Live accrued cost after N seconds of playback (the ticking meter)' })
  @Get('session/heartbeat')
  heartbeat(@Query('tokenId') tokenId: string, @Query('elapsed') elapsed: string) {
    return this.access.heartbeat(tokenId, Number(elapsed ?? 0));
  }

  @ApiOperation({
    summary: 'Operator settles a session for metered seconds (TIMED: elapsed × rate, capped)',
  })
  @Post('session/settle')
  settle(@Body() body: { sessionId: string; elapsedSeconds?: number }) {
    return this.access.settle(body.sessionId, body.elapsedSeconds ?? 0);
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
