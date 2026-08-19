import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageMenuItemRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PackageCompositionItemDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  menuItemId!: string;

  @ApiProperty({ enum: PackageMenuItemRole })
  @IsEnum(PackageMenuItemRole)
  role!: PackageMenuItemRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSwappable?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ReplacePackageCompositionDto {
  @ApiProperty({ type: [PackageCompositionItemDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique((item: PackageCompositionItemDto) => item.menuItemId)
  @ValidateNested({ each: true })
  @Type(() => PackageCompositionItemDto)
  items!: PackageCompositionItemDto[];
}
