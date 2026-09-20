import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PackageMenuItemRegionAvailabilityDto {
  @ApiProperty()
  @IsUUID()
  packageMenuItemId!: string;

  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;
}

export class UpdatePackageRegionAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;

  @ApiProperty({ type: [PackageMenuItemRegionAvailabilityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageMenuItemRegionAvailabilityDto)
  items!: PackageMenuItemRegionAvailabilityDto[];
}
