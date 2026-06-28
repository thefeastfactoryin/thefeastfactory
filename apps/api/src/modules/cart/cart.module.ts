import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PricingModule } from '../pricing/pricing.module';
import { OperatingRegionsModule } from '../operating-regions/operating-regions.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PricingModule, OrdersModule, OperatingRegionsModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
