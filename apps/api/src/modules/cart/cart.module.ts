import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { OperatingRegionsModule } from '../operating-regions/operating-regions.module';
import { CutleryModule } from '../cutlery/cutlery.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PricingModule, OperatingRegionsModule, CutleryModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
