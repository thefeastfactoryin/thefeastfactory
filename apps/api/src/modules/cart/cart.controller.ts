import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { ReplaceCartItemsDto } from './dto/replace-cart-items.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { UpdateCartQuantityDto } from './dto/update-cart-quantity.dto';
import { CartService } from './cart.service';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Get()
  current(@CurrentUser() user: JwtPayload) {
    return this.carts.getActive(user.sub);
  }

  @Get('all')
  all(@CurrentUser() user: JwtPayload) {
    return this.carts.getAllActive(user.sub);
  }

  @Get(':id')
  one(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.carts.getById(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCartDto) {
    return this.carts.create(user.sub, dto);
  }

  @Delete()
  clear(@CurrentUser() user: JwtPayload) {
    return this.carts.clearActive(user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.carts.removeActive(user.sub, id);
  }

  @Put()
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpdateCartDto) {
    return this.carts.upsert(user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCartDto,
  ) {
    return this.carts.update(user.sub, id, dto);
  }

  @Put(':id/quantity')
  updateQuantity(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCartQuantityDto,
  ) {
    return this.carts.updateQuantity(user.sub, id, dto.guestCount);
  }

  @Put(':id/items')
  replaceItems(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReplaceCartItemsDto,
  ) {
    return this.carts.replaceItems(user.sub, id, dto);
  }

  /** @deprecated Use PUT /cart/:id/items so concurrent carts cannot be mixed. */
  @Put('items')
  replaceCurrentItems(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplaceCartItemsDto,
  ) {
    return this.carts.replaceActiveItems(user.sub, dto);
  }

  @Post('quote')
  quoteCurrent(@CurrentUser() user: JwtPayload) {
    return this.carts.quoteActive(user.sub);
  }

  @Post('quote-all')
  quoteAll(@CurrentUser() user: JwtPayload) {
    return this.carts.quoteAll(user.sub);
  }

  @Post('checkout')
  checkoutCurrent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckoutCartDto,
  ) {
    return this.carts.checkoutActive(user.sub, dto.specialNotes);
  }

  @Post('checkout-all')
  checkoutAll(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckoutCartDto,
  ) {
    return this.carts.checkoutAll(user.sub, dto.specialNotes);
  }

}
