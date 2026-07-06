import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { NanopaymentGuard } from './nanopayment.guard';
import { OperatorGuard } from '../config/operator.guard';

@Module({
  controllers: [AccessController],
  providers: [AccessService, NanopaymentGuard, OperatorGuard],
})
export class AccessModule {}
