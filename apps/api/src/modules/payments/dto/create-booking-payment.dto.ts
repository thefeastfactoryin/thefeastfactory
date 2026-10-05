import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class CreateBookingPaymentDto {
  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Amount to pay toward the remaining booking balance. Omit to pay the full balance.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount?: number;
}
