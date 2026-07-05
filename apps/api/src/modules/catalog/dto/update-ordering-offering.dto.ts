import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateOrderingOfferingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) ctaLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
