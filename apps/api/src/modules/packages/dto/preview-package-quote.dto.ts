import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { PackageSelectionDto } from './package-selection.dto';

export class PreviewPackageQuoteDto extends PackageSelectionDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount!: number;
}
