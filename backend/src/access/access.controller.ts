import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';
import { OperatorGuard } from '../config/operator.guard';

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @ApiOperation({ summary: 'The public catalogue — every active work on-chain with pricing + URI' })
  @ApiResponse({ status: 200, description: 'Array of work objects with tokenId, uri, ratePerSecond, discoveryPrice, mode, creator' })
  @Get('catalogue')
  catalogue() {
    return this.access.catalogue();
  }

  @ApiOperation({ summary: 'Public access config for a work (rate, discovery price, mode, creator)' })
  @ApiParam({ name: 'tokenId', description: 'NFT token ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Access config: ratePerSecond, discoveryPrice, mode (TIMED|DISCRETE), creator address' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  @Get('config/:tokenId')
  getConfig(@Param('tokenId') tokenId: string) {
    return this.access.getConfig(tokenId);
  }

  @ApiOperation({ summary: 'Operator opens a metered streaming session' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tokenId', 'listener'],
      properties: {
        tokenId: { type: 'string', example: '1', description: 'NFT token ID to stream' },
        listener: { type: 'string', example: '0xAbCd…', description: 'Listener wallet address' },
        authorisedUsdc: { type: 'number', example: 0.05, description: 'Pre-authorised USDC budget (defaults to 0.05)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Session opened — returns sessionId and expiry' })
  @Post('session/open')
  openSession(@Body() body: { tokenId: string; listener: string; signature: string; nonce: string; timestamp: number; authorisedUsdc?: number }) {
    return this.access.openSession(body.tokenId, body.listener, body.signature, body.nonce, body.timestamp, body.authorisedUsdc);
  }

  @ApiOperation({ summary: 'Live accrued cost after N seconds of playback (the ticking meter)' })
  @ApiQuery({ name: 'tokenId', description: 'NFT token ID', example: '1' })
  @ApiQuery({ name: 'elapsed', description: 'Seconds elapsed so far', example: '30' })
  @ApiResponse({ status: 200, description: 'cost: accrued USDC (6dp string), withinBudget: boolean' })
  @Get('session/heartbeat')
  heartbeat(@Query('tokenId') tokenId: string, @Query('elapsed') elapsed: string) {
    return this.access.heartbeat(tokenId, Number(elapsed ?? 0));
  }

  @ApiOperation({ summary: 'Release the decryption key for a work via a valid open session (streaming)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID returned by session/open', example: 'sess_abc123' })
  @ApiResponse({ status: 200, description: 'AES-GCM key + IV to decrypt the IPFS ciphertext in the browser' })
  @ApiResponse({ status: 403, description: 'Session not found, expired, or budget exceeded' })
  @Get('session/:sessionId/content')
  sessionContent(@Param('sessionId') sessionId: string) {
    return this.access.sessionContent(sessionId);
  }

  @ApiOperation({ summary: 'Operator settles a session for metered seconds (TIMED: elapsed × rate, capped)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', example: 'sess_abc123' },
        elapsedSeconds: { type: 'number', example: 120, description: 'Seconds to settle (defaults to 0)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Settlement tx hash + USDC amount settled' })
  @Post('session/settle')
  @UseGuards(OperatorGuard)
  settle(@Body() body: { sessionId: string; elapsedSeconds?: number }) {
    return this.access.settle(body.sessionId, body.elapsedSeconds ?? 0);
  }

  @ApiOperation({
    summary: 'Listener settles their own session (e.g. on Stop) — signature-authenticated, no operator key',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'listener', 'signature', 'nonce', 'timestamp'],
      properties: {
        sessionId: { type: 'string', example: 'sess_abc123' },
        listener: { type: 'string', example: '0xAbCd…', description: 'Must match the session\'s on-chain listener' },
        signature: { type: 'string', description: 'Signs `AfroMeet settle {sessionId} {listener} {nonce} {timestamp}`' },
        nonce: { type: 'string' },
        timestamp: { type: 'number' },
        elapsedSeconds: { type: 'number', example: 120, description: 'Real seconds played (defaults to 0)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Settlement tx hash + USDC amount settled' })
  @ApiResponse({ status: 403, description: 'Signature does not match the session\'s listener' })
  @Post('session/settle/listener')
  settleAsListener(
    @Body()
    body: {
      sessionId: string;
      listener: string;
      signature: string;
      nonce: string;
      timestamp: number;
      elapsedSeconds?: number;
    },
  ) {
    return this.access.settleAsListener(
      body.sessionId,
      body.listener,
      body.signature,
      body.nonce,
      body.timestamp,
      body.elapsedSeconds ?? 0,
    );
  }

  @ApiOperation({ summary: 'x402 discovery: 402 until USDC is paid to the creator, then returns the content' })
  @ApiParam({ name: 'tokenId', description: 'NFT token ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Decrypted content URL or key after payment verified' })
  @ApiResponse({ status: 402, description: 'Payment required — x402 challenge header included' })
  @UseGuards(NanopaymentGuard)
  @Get(':tokenId')
  getContent(@Param('tokenId') tokenId: string) {
    return this.access.getContent(tokenId);
  }
}
