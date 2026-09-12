import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

type ProviderResponse = {
  type?: unknown;
  status?: unknown;
  message?: unknown;
  hasError?: unknown;
  errors?: unknown;
  code?: unknown;
  apiError?: unknown;
};

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async notifyConfirmedOrder(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true, address: true, selectedItems: true },
      });
      if (!order) return;

      const settings = Object.fromEntries(
        (
          await this.prisma.platformSetting.findMany({
            where: {
              key: {
                in: ['business_support_email', 'business_support_phone'],
              },
            },
          })
        ).map((setting) => [setting.key, setting.value]),
      );
      const supportEmail = settings.business_support_email?.trim();
      const supportPhone = settings.business_support_phone?.replace(/\D/g, '');
      const message = this.orderMessage(order);

      const results = await Promise.allSettled([
        supportEmail
          ? this.sendEmail(supportEmail, order.orderNumber, message)
          : Promise.resolve(),
        supportPhone
          ? this.sendWhatsApp(supportPhone, order.orderNumber, message)
          : Promise.resolve(),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            `Order ${order.orderNumber} notification failed: ${String(result.reason)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Order notification could not be prepared: ${String(error)}`);
    }
  }

  private async sendEmail(to: string, orderNumber: string, message: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('ORDER_NOTIFICATION_FROM_EMAIL');
    if (!apiKey || !from) {
      this.logger.warn('Order email notification is not configured');
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `New confirmed order ${orderNumber}`,
        text: message,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend returned HTTP ${response.status}`);
    }
  }

  private async sendWhatsApp(
    phone: string,
    orderNumber: string,
    message: string,
  ) {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const flowId = this.config.get<string>('MSG91_ORDER_FLOW_ID');
    const senderId = this.config.get<string>('MSG91_SENDER_ID');
    if (!authKey || !flowId || !senderId) {
      this.logger.warn('Order WhatsApp notification is not configured');
      return;
    }

    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flow_id: flowId,
        sender: senderId,
        recipients: [{ mobiles: phone, order_number: orderNumber, message }],
      }),
    });
    const result = (await response.json().catch(() => undefined)) as
      | ProviderResponse
      | undefined;
    const succeeded =
      result?.hasError !== true &&
      (result?.type === 'success' || result?.status === 'success');
    if (!response.ok || !succeeded) {
      throw new Error(`MSG91 returned HTTP ${response.status}`);
    }
  }

  private orderMessage(order: {
    orderNumber: string;
    user: { name: string | null; mobileNumber: string; email: string | null };
    eventName: string | null;
    eventDate: Date;
    eventTimeStart: Date | null;
    guestCount: number;
    packageName: string;
    totalAmount: { toFixed: (digits: number) => string };
    address: {
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      state: string;
      pincode: string;
    };
    selectedItems: Array<{ menuItemName: string; quantity: number }>;
  }) {
    const items = order.selectedItems
      .map((item) => `${item.menuItemName} x${item.quantity}`)
      .join(', ');
    const address = [
      order.address.addressLine1,
      order.address.addressLine2,
      order.address.city,
      order.address.state,
      order.address.pincode,
    ]
      .filter(Boolean)
      .join(', ');
    return [
      `New confirmed order: ${order.orderNumber}`,
      `Customer: ${order.user.name || 'Guest'} (${order.user.mobileNumber})`,
      `Email: ${order.user.email || 'Not provided'}`,
      `Event: ${order.eventName || 'Not provided'} on ${order.eventDate.toISOString().slice(0, 10)} at ${order.eventTimeStart ? order.eventTimeStart.toISOString().slice(11, 16) : 'Not provided'}`,
      `Guests: ${order.guestCount}`,
      `Package: ${order.packageName}`,
      `Amount: INR ${order.totalAmount.toFixed(2)}`,
      `Venue: ${address}`,
      `Menu: ${items || 'See order dashboard'}`,
    ].join('\n');
  }
}