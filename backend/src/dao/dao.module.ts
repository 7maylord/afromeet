import { Module } from '@nestjs/common';
import { DaoController } from './dao.controller';
import { DaoService } from './dao.service';

@Module({
  controllers: [DaoController],
  providers: [DaoService],
})
export class DaoModule {}
