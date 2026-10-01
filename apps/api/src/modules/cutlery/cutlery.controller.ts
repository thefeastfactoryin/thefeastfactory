import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CutleryService } from './cutlery.service';
import { SaveCutleryItemDto } from './dto/save-cutlery-item.dto';
import { UpdateCartCutleryDto } from './dto/update-cart-cutlery.dto';

@ApiTags('cutlery')
@Controller()
export class CutleryController {
  constructor(private readonly cutlery: CutleryService) {}

  @Get('cutlery') catalog() {
    return this.cutlery.list(true);
  }

  @Get('admin/cutlery')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  adminCatalog() {
    return this.cutlery.list(false);
  }

  @Post('admin/cutlery')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  create(@Body() dto: SaveCutleryItemDto) {
    return this.cutlery.create(dto);
  }

  @Patch('admin/cutlery/:id')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: SaveCutleryItemDto) {
    return this.cutlery.update(id, dto);
  }

  @Put('cart/:id/cutlery')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  updateCart(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCartCutleryDto,
  ) {
    return this.cutlery.replaceCartSelections(user.sub, id, dto);
  }
}
