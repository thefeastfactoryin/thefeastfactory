import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateOperatingRegionDto } from './dto/update-operating-region.dto';
import { ResolveLocationDto } from './dto/resolve-location.dto';
import { OperatingRegionsService } from './operating-regions.service';

@ApiTags('operating-regions')
@Controller()
export class OperatingRegionsController {
  constructor(private readonly regions: OperatingRegionsService) {}

  @Get('operating-regions')
  publicList() {
    return this.regions.list(true);
  }

  @Post('operating-regions/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Body() dto: ResolveLocationDto) {
    return this.regions.resolveLocation(dto.latitude, dto.longitude);
  }

  @Get('admin/operating-regions')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  list(
    @CurrentAdmin() admin: JwtPayload,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.regions.listForAdmin(admin, activeOnly === 'true');
  }

  @Patch('admin/operating-regions/:id')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.OPERATIONS)
  update(
    @CurrentAdmin() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOperatingRegionDto,
  ) {
    return this.regions.updateForAdmin(admin, id, dto);
  }
}
