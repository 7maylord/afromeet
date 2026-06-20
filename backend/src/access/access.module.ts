import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';

@Module({
  controllers: [AccessController],
  providers: [AccessService, NanopaymentGuard],
})
export class AccessModule {}
