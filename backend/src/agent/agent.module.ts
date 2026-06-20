import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DecisionEngineService } from './decision-engine.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService, DecisionEngineService],
})
export class AgentModule {}
