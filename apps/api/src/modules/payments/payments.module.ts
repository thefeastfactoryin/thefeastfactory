import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OperationsModule } from '../operations/operations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartModule } from '../cart/cart.module';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Module({
  imports: [OperationsModule, NotificationsModule, CartModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RateLimitGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
