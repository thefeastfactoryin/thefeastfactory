import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { CreatePackageVersionDto } from './create-package-version.dto';

export class UpdatePackageVersionDto extends PartialType(
  OmitType(CreatePackageVersionDto, ['maxGuestCount'] as const),
) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  maxGuestCount?: number | null;
}
