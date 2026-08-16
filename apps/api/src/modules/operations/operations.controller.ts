import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { AdminRegionQueryDto } from '../../common/dto/admin-region-query.dto';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrderNoteDto } from './dto/create-order-note.dto';
import { OperationsCalendarQueryDto } from './dto/operations-calendar-query.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('orders/:orderId/documents')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  documents(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.operations.documents(user.sub, orderId);
  }

  @Get('orders/:orderId/documents/:documentId/download')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.operations.documentPdf(
      user.sub,
      orderId,
      documentId,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.buffer);
  }

  @Get('admin/orders/:orderId/notes')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  notes(
    @CurrentAdmin() admin: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.operations.notes(admin, orderId);
  }

  @Post('admin/orders/:orderId/notes')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  addNote(
    @CurrentAdmin() admin: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderNoteDto,
  ) {
    return this.operations.addNote(admin, orderId, dto);
  }

  @Get('admin/operations/calendar')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  calendar(
    @CurrentAdmin() admin: JwtPayload,
    @Query() query: OperationsCalendarQueryDto,
  ) {
    return this.operations.calendar(
      admin,
      query.from,
      query.to,
      query.regionId,
      query.city,
    );
  }

  @Get('admin/operations/queue')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  queue(
    @CurrentAdmin() admin: JwtPayload,
    @Query() query: AdminRegionQueryDto,
  ) {
    return this.operations.queue(admin, query.regionId);
  }

  @Get('admin/settings')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  settings() {
    return this.operations.settings();
  }

  @Patch('admin/settings')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.operations.updateSettings(dto);
  }

  @Get('admin/integrations/readiness')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  readiness() {
    return this.operations.readiness();
  }

  @Get('admin/orders/:orderId/documents')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  adminDocuments(
    @CurrentAdmin() admin: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.operations.documents(admin.sub, orderId, admin);
  }

  @Get('admin/orders/:orderId/documents/:documentId/download')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async adminDownload(
    @CurrentAdmin() admin: JwtPayload,
    @Param('orderId') orderId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.operations.documentPdf(
      admin.sub,
      orderId,
      documentId,
      admin,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.buffer);
  }
}
