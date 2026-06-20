import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CircleModule } from './circle/circle.module';
import { AccessModule } from './access/access.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    BlockchainModule,
    CircleModule,
    AccessModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
