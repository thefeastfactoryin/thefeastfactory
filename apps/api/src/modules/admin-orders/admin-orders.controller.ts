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
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminOrdersService } from './admin-orders.service';

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly service: AdminOrdersService) {}
  @Get('orders') list(
    @CurrentAdmin() admin: JwtPayload,
    @Query() query: AdminOrdersQueryDto,
  ) {
    return this.service.list(admin, query);
  }
  @Get('orders/:id') get(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.get(admin, id);
  }
  @Patch('orders/:id/status') status(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.service.updateStatus(admin, id, dto);
  }
  @Post('orders/:id/cancel') cancel(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    return this.service.cancel(admin, id, dto);
  }
  @Get('payments') payments(
    @CurrentAdmin() admin: JwtPayload,
    @Query('regionId') regionId?: string,
  ) {
    return this.service.listPayments(admin, regionId);
  }
  @Post('payments/:id/full-refund') refund(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.service.refund(admin, id, dto);
  }
}
