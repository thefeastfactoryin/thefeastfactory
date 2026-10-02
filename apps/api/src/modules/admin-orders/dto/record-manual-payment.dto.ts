import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const manualPaymentMethods = [
  'UPI',
  'CASH',
  'CARD_POS',
  'BANK_TRANSFER',
  'OTHER',
] as const;

export class RecordManualPaymentDto {
  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: manualPaymentMethods })
  @IsIn(manualPaymentMethods)
  method!: (typeof manualPaymentMethods)[number];

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
