import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  Max,
  IsDivisibleBy,
  ValidateNested,
} from 'class-validator';
import { SelectedItemRole } from '@prisma/client';

export class CartSelectionItemDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  menuItemId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  replacedMenuItemId?: string | null;

  @ApiProperty({ enum: SelectedItemRole })
  @IsEnum(SelectedItemRole)
  role!: SelectedItemRole;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ type: Number, required: false, nullable: true, minimum: 500, maximum: 100000, multipleOf: 500 })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(100000)
  @IsDivisibleBy(500)
  weightGrams?: number | null;
}

export class ReplaceCartItemsDto {
  @ApiProperty({ type: [CartSelectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartSelectionItemDto)
  items!: CartSelectionItemDto[];
}
