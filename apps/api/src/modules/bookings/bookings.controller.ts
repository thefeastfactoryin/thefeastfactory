import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { CancelOrderDto } from '../orders/dto/cancel-order.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.bookings.list(user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bookings.get(user.sub, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.bookings.cancel(user.sub, id, dto.reason);
  }
}
