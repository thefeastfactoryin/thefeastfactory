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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';
import type { RazorpayWebhookPayload } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('orders/:id/payments/razorpay-order')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  create(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payments.createGatewayOrder(user.sub, id);
  }

  @Post('payments/razorpay/verify')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
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
