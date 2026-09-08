import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOperatingRegionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  kitchenAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fssaiLicenseNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  kitchenImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mapUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  publicDisplayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  centerLatitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  centerLongitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  serviceRadiusKm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  deliveryFeePerKm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAcceptingOrders?: boolean;
}
