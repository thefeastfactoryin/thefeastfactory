import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsDivisibleBy,
  IsInt,
  Max,
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

  @ApiPropertyOptional({
    default: 1000,
    minimum: 500,
    maximum: 100000,
    multipleOf: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(100000)
  @IsDivisibleBy(500)
  kgDefaultWeightGrams?: number;

  @ApiPropertyOptional({
    default: 500,
    minimum: 500,
    maximum: 100000,
    multipleOf: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(100000)
  @IsDivisibleBy(500)
  kgWeightIncrementGrams?: number;

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
