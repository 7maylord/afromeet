import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @Get('status')
  status() {
    return {
      wallet: this.wallets.getAddress(),
      ready: this.wallets.isReady(),
      erc8004AgentId: this.erc8004.getAgentId()?.toString() ?? null,
    };
  }

  @ApiOperation({ summary: 'Manually trigger one autonomous pass (cron also runs every 30m)' })
  @Post('run')
  run() {
    return this.agent.runOnce();
  }

  @ApiOperation({ summary: "What the AfroMeet Agent is enjoying — its recommendation feed" })
  @Get('picks')
  async picks() {
    return {
      agentId: this.erc8004.getAgentId()?.toString() ?? null,
      picks: await this.agent.getPicks(),
    };
  }

  /**
   * One-time: provision the developer-controlled SDK wallet on Arc. Run after setting
   * CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET; then put the returned walletId in CIRCLE_WALLET_ID
   * and fund the returned address with testnet USDC.
   */
  @ApiOperation({ summary: 'One-time: provision the developer-controlled SDK wallet on Arc' })
  @Post('wallet/provision')
  provisionWallet() {
    return this.wallets.createWallet();
  }

  @ApiOperation({ summary: "Update the agent's ERC-8004 metadata URI (after uploading to IPFS)" })
  @Post('metadata')
  async updateMetadata(@Body() body: { uri: string }) {
    const txHash = await this.erc8004.updateMetadata(body.uri);
    return { ok: true, agentId: this.erc8004.getAgentId()?.toString(), uri: body.uri, txHash };
  }
}
