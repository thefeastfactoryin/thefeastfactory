import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole, OrderingOfferingCode } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import { UpdateOrderingOfferingDto } from './dto/update-ordering-offering.dto';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('catalog/ordering-offerings')
  offerings() { return this.catalog.listOfferings(true); }

  @Get('catalog/public-settings')
  publicSettings() { return this.catalog.publicSettings(); }

  @Get('admin/catalog/ordering-offerings')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  adminOfferings() { return this.catalog.listOfferings(false); }

  @Patch('admin/catalog/ordering-offerings/:code')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  update(
    @Param('code') code: OrderingOfferingCode,
    @Body() dto: UpdateOrderingOfferingDto,
  ) { return this.catalog.updateOffering(code, dto); }
}
