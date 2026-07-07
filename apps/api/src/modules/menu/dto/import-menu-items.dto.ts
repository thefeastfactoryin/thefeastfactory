import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImportMenuItemRowDto {
  @ApiProperty({ example: 'Starters' })
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 'Paneer Tikka' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '120.00' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  boxPrice!: string;

  @ApiProperty({ example: '150.00' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  generalPrice!: string;

  @ApiProperty({ enum: ['VEG', 'NON_VEG'] })
  @IsIn(['VEG', 'NON_VEG'])
  foodType!: 'VEG' | 'NON_VEG';

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

export class ImportMenuItemsDto {
  @ApiProperty({ type: [ImportMenuItemRowDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportMenuItemRowDto)
  rows!: ImportMenuItemRowDto[];

  @ApiProperty({ enum: ['SKIP', 'UPDATE'] })
  @IsIn(['SKIP', 'UPDATE'])
  duplicateStrategy!: 'SKIP' | 'UPDATE';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  createMissingCategories?: boolean;
}
