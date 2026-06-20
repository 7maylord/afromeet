import { Global, Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Erc8004Service } from './erc8004.service';

@Global()
@Module({
  providers: [WalletsService, Erc8004Service],
  exports: [WalletsService, Erc8004Service],
})
export class CircleModule {}
