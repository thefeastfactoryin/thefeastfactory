import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { AdminRegionQueryDto } from '../../common/dto/admin-region-query.dto';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { RecordManualPaymentDto } from './dto/record-manual-payment.dto';
import { UpdateBookingFulfilmentDto } from './dto/update-booking-fulfilment.dto';
import { AdminOrdersService } from './admin-orders.service';

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly service: AdminOrdersService) {}
  @Get('bookings')
  bookings(
    @CurrentAdmin() admin: JwtPayload,
    @Query() query: AdminBookingsQueryDto,
  ) {
    return this.service.listBookings(admin, query);
  }
  @Get('bookings/:id')
  booking(@CurrentAdmin() admin: JwtPayload, @Param('id') id: string) {
    return this.service.getBooking(admin, id);
  }
  @Post('bookings/:id/approve')
  approveBooking(@CurrentAdmin() admin: JwtPayload, @Param('id') id: string) {
    return this.service.approveBooking(admin, id);
  }
  @Post('bookings/:id/decline')
  declineBooking(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DeclineOrderDto,
  ) {
    return this.service.declineBooking(admin, id, dto);
  }
  @Post('bookings/:id/cancel')
  cancelBooking(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    return this.service.cancelBooking(admin, id, dto);
  }
  @Patch('bookings/:id/fulfilment')
  updateBookingFulfilment(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBookingFulfilmentDto,
  ) {
    return this.service.updateBookingFulfilment(admin, id, dto);
  }
  @Post('bookings/:id/payments/manual')
  bookingManualPayment(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RecordManualPaymentDto,
  ) {
    return this.service.recordManualBookingPayment(admin, id, dto);
  }
  @Post('bookings/:id/payments/:paymentId/manual-refund')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.OPERATIONS)
  bookingManualRefund(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.service.recordManualBookingRefund(
      admin,
      id,
      paymentId,
      dto,
    );
  }
  @Get('bookings/:bookingId/orders/:id') getOrder(
    @CurrentAdmin() admin: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.getOrder(admin, bookingId, id);
  }
  @Get('payments') payments(
    @CurrentAdmin() admin: JwtPayload,
    @Query() query: AdminRegionQueryDto,
  ) {
    return this.service.listPayments(admin, query.regionId);
  }
  @Post('payments/:id/full-refund')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.OPERATIONS)
  refund(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.service.refund(admin, id, dto);
  }
}
