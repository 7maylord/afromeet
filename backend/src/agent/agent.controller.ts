import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { WalletsService } from '../circle/wallets.service';
import { Erc8004Service } from '../circle/erc8004.service';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly wallets: WalletsService,
    private readonly erc8004: Erc8004Service,
  ) {}

  @ApiOperation({ summary: 'Agent wallet address, readiness, and ERC-8004 agent id' })
  @ApiResponse({
    status: 200,
    description: 'wallet: Arc address · ready: Circle SDK initialised · erc8004AgentId: onchain agent NFT id',
    schema: {
      example: { wallet: '0xf993…', ready: true, erc8004AgentId: '839408' },
    },
  })
  @Get('status')
  status() {
    return {
      wallet: this.wallets.getAddress(),
      ready: this.wallets.isReady(),
      erc8004AgentId: this.erc8004.getAgentId()?.toString() ?? null,
    };
  }

  @ApiOperation({ summary: 'Manually trigger one autonomous pass (cron also runs every 30m)' })
  @ApiResponse({ status: 201, description: 'Agent loop result: works visited, payments made, picks recorded' })
  @Post('run')
  run() {
    return this.agent.runOnce();
  }

  @ApiOperation({ summary: "Euterpe's recommendation feed — what she's paying to listen to" })
  @ApiResponse({
    status: 200,
    description: 'agentId + picks array; each pick has tokenId, title, score, note, txHash, timestamp',
  })
  @Get('picks')
  async picks() {
    return {
      agentId: this.erc8004.getAgentId()?.toString() ?? null,
      picks: await this.agent.getPicks(),
    };
  }

  @ApiOperation({ summary: 'One-time: provision the developer-controlled SDK wallet on Arc' })
  @ApiResponse({ status: 201, description: 'walletId and address — save walletId as CIRCLE_WALLET_ID in backend/.env' })
  @Post('wallet/provision')
  provisionWallet() {
    return this.wallets.createWallet();
  }

  @ApiOperation({ summary: "Update Euterpe's ERC-8004 metadata URI (after uploading agent-card.json to IPFS)" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', example: 'ipfs://Qm…', description: 'IPFS URI of the updated agent-card.json' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'ok: true, agentId, uri, txHash' })
  @Post('metadata')
  async updateMetadata(@Body() body: { uri: string }) {
    const txHash = await this.erc8004.updateMetadata(body.uri);
    return { ok: true, agentId: this.erc8004.getAgentId()?.toString(), uri: body.uri, txHash };
  }
}
