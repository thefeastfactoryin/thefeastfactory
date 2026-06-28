import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class UpdateCartDto {
  @ApiProperty() @IsUUID() packageVersionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) eventName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() eventDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) eventTimeStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) guestCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) specialNotes?: string;
}
