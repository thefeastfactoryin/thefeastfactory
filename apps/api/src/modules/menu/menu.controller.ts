import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MenuItemsQueryDto } from './dto/menu-items-query.dto';
import { MenuService } from './menu.service';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('categories')
  listCategories() {
    return this.menu.listCategories();
  }

  @Get('items')
  listItems(@Query() query: MenuItemsQueryDto) {
    return this.menu.listItems(query);
  }

}
