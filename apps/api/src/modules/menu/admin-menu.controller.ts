import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { MenuItemsQueryDto } from './dto/menu-items-query.dto';
import { ImportMenuItemsDto } from './dto/import-menu-items.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

@ApiTags('admin-menu')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.ADMIN)
@Controller('admin/menu')
export class AdminMenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('categories')
  listCategories() {
    return this.menu.listAdminCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateMenuCategoryDto) {
    return this.menu.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateMenuCategoryDto) {
    return this.menu.updateCategory(id, dto);
  }

  @Get('items')
  listItems(@Query() query: MenuItemsQueryDto) {
    return this.menu.listAdminItems(query);
  }

  @Post('items')
  createItem(@Body() dto: CreateMenuItemDto) {
    return this.menu.createItem(dto);
  }

  @Post('items/import')
  importItems(@Body() dto: ImportMenuItemsDto) {
    return this.menu.importItems(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.updateItem(id, dto);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.menu.deleteItem(id);
  }
}
