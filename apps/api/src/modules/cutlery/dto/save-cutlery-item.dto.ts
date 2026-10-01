import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveCutleryItemDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  extraLabel?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
  @ApiProperty() @IsString() @MaxLength(30) unitLabel!: string;
  @ApiProperty({ example: '10.00' }) @IsNumberString() unitPrice!: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  includedQuantity?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
