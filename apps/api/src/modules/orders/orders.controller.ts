import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('bookings/:bookingId/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get(':id') get(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.orders.get(user.sub, bookingId, id);
  }
}
