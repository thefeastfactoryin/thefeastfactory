import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OperationsModule } from '../operations/operations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [OperationsModule, NotificationsModule, CartModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
