import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreatePackageVersionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  versionNo!: number;

  @ApiProperty({ example: '499.00' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  basePricePerPlate!: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minGuestCount?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxGuestCount?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  publishedAt?: string | null;
}
