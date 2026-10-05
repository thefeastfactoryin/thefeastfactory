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
import { CreateBookingNoteDto } from './dto/create-booking-note.dto';
import { OperationsCalendarQueryDto } from './dto/operations-calendar-query.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('bookings/:bookingId/documents')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  documents(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
  ) {
    return this.operations.documents(user.sub, bookingId);
  }

  @Get('bookings/:bookingId/documents/:documentId/download')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.operations.documentPdf(
      user.sub,
      bookingId,
      documentId,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.buffer);
  }

  @Get('admin/bookings/:bookingId/notes')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  notes(
    @CurrentAdmin() admin: JwtPayload,
    @Param('bookingId') bookingId: string,
  ) {
    return this.operations.notes(admin, bookingId);
  }

  @Post('admin/bookings/:bookingId/notes')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  addNote(
    @CurrentAdmin() admin: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingNoteDto,
  ) {
    return this.operations.addNote(admin, bookingId, dto);
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

  @Get('admin/bookings/:bookingId/documents')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  adminDocuments(
    @CurrentAdmin() admin: JwtPayload,
    @Param('bookingId') bookingId: string,
  ) {
    return this.operations.documents(admin.sub, bookingId, admin);
  }

  @Get('admin/bookings/:bookingId/documents/:documentId/download')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async adminDownload(
    @CurrentAdmin() admin: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.operations.documentPdf(
      admin.sub,
      bookingId,
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
