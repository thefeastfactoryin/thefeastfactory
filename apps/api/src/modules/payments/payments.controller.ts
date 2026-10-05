import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';
import type { RazorpayWebhookPayload } from './payments.service';
import { CheckoutCartDto } from '../cart/dto/checkout-cart.dto';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/razorpay/cart-order')
  @ApiBearerAuth()
  @RateLimit(
    {
      name: 'pay-later-booking',
      identity: 'user',
      limit: 3,
      windowSeconds: 600,
      when: { bodyField: 'paymentPlan', equals: 'PAY_LATER' },
    },
    {
      name: 'cart-payment-create',
      identity: 'user',
      limit: 5,
      windowSeconds: 60,
    },
    {
      name: 'cart-payment-create-ip',
      identity: 'ip',
      limit: 20,
      windowSeconds: 60,
    },
  )
  @UseGuards(CustomerAuthGuard, RateLimitGuard)
  createFromCart(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckoutCartDto,
  ) {
    return dto.paymentPlan === 'PAY_LATER'
      ? this.payments.createPayLaterBooking(user.sub, dto.specialNotes)
      : this.payments.createCartGatewayOrder(
          user.sub,
          dto.specialNotes,
          dto.paymentPlan,
        );
  }

  @Post('bookings/:id/payments/razorpay-order')
  @ApiBearerAuth()
  @ApiBody({ type: CreateBookingPaymentDto, required: false })
  @RateLimit(
    {
      name: 'booking-payment-create',
      identity: 'user',
      limit: 5,
      windowSeconds: 60,
    },
    {
      name: 'booking-payment-create-ip',
      identity: 'ip',
      limit: 20,
      windowSeconds: 60,
    },
  )
  @UseGuards(CustomerAuthGuard, RateLimitGuard)
  createBookingPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateBookingPaymentDto = new CreateBookingPaymentDto(),
  ) {
    return this.payments.createBookingGatewayOrder(user.sub, id, dto.amount);
  }

  @Post('payments/razorpay/verify')
  @ApiBearerAuth()
  @RateLimit(
    { name: 'payment-verify', identity: 'user', limit: 10, windowSeconds: 60 },
    { name: 'payment-verify-ip', identity: 'ip', limit: 30, windowSeconds: 60 },
  )
  @UseGuards(CustomerAuthGuard, RateLimitGuard)
  verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyPaymentDto) {
    return this.payments.verify(user.sub, dto);
  }

  @Post('payments/razorpay/webhook')
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() payload: RazorpayWebhookPayload,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.payments.webhook(
      request.rawBody ?? Buffer.from(JSON.stringify(payload)),
      payload,
      signature,
      eventId,
    );
  }
}
