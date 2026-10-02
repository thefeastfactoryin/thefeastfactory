import { PaymentPlan } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutCartDto {
  @ApiProperty({ enum: PaymentPlan, default: PaymentPlan.FULL })
  @IsEnum(PaymentPlan)
  paymentPlan: PaymentPlan = PaymentPlan.FULL;

  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Please keep the food mildly spiced and pack chutney separately.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialNotes?: string;
}
