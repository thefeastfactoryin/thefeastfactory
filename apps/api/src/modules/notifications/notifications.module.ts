import { Module } from '@nestjs/common';
import { OrderNotificationService } from './order-notification.service';

@Module({
  providers: [OrderNotificationService],
  exports: [OrderNotificationService],
})
export class NotificationsModule {}