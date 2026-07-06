import { Global, Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { OperatorGuard } from '../config/operator.guard';

@Global()
@Module({
  controllers: [ServicesController],
  providers: [ServicesService, OperatorGuard],
  exports: [ServicesService],
})
export class ServicesModule {}
