import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CircleModule } from './circle/circle.module';
import { AccessModule } from './access/access.module';
import { AgentModule } from './agent/agent.module';
import { ServicesModule } from './services/services.module';
import { WorksModule } from './works/works.module';
import { DaoModule } from './dao/dao.module';
import { CreatorModule } from './creator/creator.module';
import { MediaVaultModule } from './media-vault/media-vault.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot(),
    BlockchainModule,
    CircleModule,
    MediaVaultModule,
    ServicesModule,
    AccessModule,
    AgentModule,
    WorksModule,
    DaoModule,
    CreatorModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
