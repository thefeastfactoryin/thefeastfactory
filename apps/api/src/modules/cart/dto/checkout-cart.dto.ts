import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutCartDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Please keep the food mildly spiced and pack chutney separately.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialNotes?: string;
}
