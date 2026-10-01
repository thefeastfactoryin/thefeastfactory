import { Module } from '@nestjs/common';
import { CutleryController } from './cutlery.controller';
import { CutleryService } from './cutlery.service';

@Module({
  controllers: [CutleryController],
  providers: [CutleryService],
  exports: [CutleryService],
})
export class CutleryModule {}
