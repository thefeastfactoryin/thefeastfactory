import { Module } from '@nestjs/common';
import { OperatingRegionsModule } from '../operating-regions/operating-regions.module';
import { OrdersModule } from '../orders/orders.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [OrdersModule, OperatingRegionsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
