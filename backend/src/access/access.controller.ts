import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';

@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  /** Public access config for a work. */
  @Get('config/:tokenId')
  getConfig(@Param('tokenId') tokenId: string) {
    return this.access.getConfig(tokenId);
  }

  /** Operator opens a metered streaming session. */
  @Post('session/open')
  openSession(@Body() body: { tokenId: string; listener: string; authorisedUsdc?: number }) {
    return this.access.openSession(body.tokenId, body.listener, body.authorisedUsdc);
  }

  /** Operator settles a session (per-access fee → splits + 1% DAO). */
  @Post('session/settle')
  settle(@Body() body: { sessionId: string }) {
    return this.access.settle(body.sessionId);
  }

  /** x402 discovery: pay the per-work discovery price, then receive the content. */
  @UseGuards(NanopaymentGuard)
  @Get(':tokenId')
  getContent(@Param('tokenId') tokenId: string) {
    return this.access.getContent(tokenId);
  }
}
