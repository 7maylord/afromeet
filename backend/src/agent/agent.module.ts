import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DecisionEngineService } from './decision-engine.service';
import { OperatorGuard } from '../config/operator.guard';

@Module({
  controllers: [AgentController],
  providers: [AgentService, DecisionEngineService, OperatorGuard],
})
export class AgentModule {}
