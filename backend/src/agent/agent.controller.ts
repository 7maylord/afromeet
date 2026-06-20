import { Controller, Get, Post } from '@nestjs/common';
import { AgentService } from './agent.service';
import { WalletsService } from '../circle/wallets.service';
import { Erc8004Service } from '../circle/erc8004.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly wallets: WalletsService,
    private readonly erc8004: Erc8004Service,
  ) {}

  @Get('status')
  status() {
    return {
      wallet: this.wallets.getAddress(),
      ready: this.wallets.isReady(),
      erc8004AgentId: this.erc8004.getAgentId()?.toString() ?? null,
    };
  }

  /** Manually trigger one autonomous pass (the cron also runs it every 30m). */
  @Post('run')
  run() {
    return this.agent.runOnce();
  }
}
