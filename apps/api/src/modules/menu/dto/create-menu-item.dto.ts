import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Paneer Tikka' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '50.00' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  boxPrice!: string;

  @ApiProperty({ example: '120.00' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  generalPrice!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '400.00' })
  @IsOptional()
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d{1,8}(?:\.\d{1,2})?$/)
  pricePerKg?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;
}
