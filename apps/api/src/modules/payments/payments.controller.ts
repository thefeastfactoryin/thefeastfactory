import {
  Body,
  Controller,
  Get,
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
import { CreateBatchPaymentDto } from './dto/create-batch-payment.dto';

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

  @Get('orders/:id/payment-batch')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  batchSummary(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payments.getPaymentBatchSummary(user.sub, id);
  }

  @Post('payments/razorpay/batch-order')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  createBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBatchPaymentDto,
  ) {
    return this.payments.createBatchGatewayOrder(user.sub, dto.orderIds);
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
