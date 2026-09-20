import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryServiceType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCartDto {
  @ApiProperty() @IsUUID() packageVersionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) eventName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) eventTimeStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) guestCount?: number;
  @ApiPropertyOptional({ enum: DeliveryServiceType })
  @IsOptional()
  @IsEnum(DeliveryServiceType)
  deliveryServiceType?: DeliveryServiceType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  helperCount?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) specialNotes?: string;
}
