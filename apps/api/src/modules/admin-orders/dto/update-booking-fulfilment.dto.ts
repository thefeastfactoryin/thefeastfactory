import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingFulfilmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBookingFulfilmentDto {
  @ApiProperty({ enum: BookingFulfilmentStatus })
  @IsEnum(BookingFulfilmentStatus)
  status!: BookingFulfilmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
