import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SelectedItemRole } from '@prisma/client';

export class OrderSelectedItemDto {
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

  @ApiProperty({ enum: SelectedItemRole, required: false })
  @IsOptional()
  @IsEnum(SelectedItemRole)
  role?: SelectedItemRole;
}

export class OrderSelectionDto {
  @ApiProperty({ type: [OrderSelectedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderSelectedItemDto)
  selectedItems!: OrderSelectedItemDto[];
}
