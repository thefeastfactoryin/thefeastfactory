import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateOperatingRegionDto } from './dto/update-operating-region.dto';
import { OperatingRegionsService } from './operating-regions.service';

@ApiTags('operating-regions')
@Controller()
export class OperatingRegionsController {
  constructor(private readonly regions: OperatingRegionsService) {}

  @Get('operating-regions')
  publicList() {
    return this.regions.list(true);
  }

  @Get('admin/operating-regions')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  list(@Query('activeOnly') activeOnly?: string) {
    return this.regions.list(activeOnly === 'true');
  }

  @Patch('admin/operating-regions/:id')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOperatingRegionDto) {
    return this.regions.update(id, dto);
  }
}
