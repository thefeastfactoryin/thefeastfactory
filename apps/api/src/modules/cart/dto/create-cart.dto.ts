import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateCartDto {
  @ApiProperty()
  @IsUUID()
  packageVersionId!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;
}
