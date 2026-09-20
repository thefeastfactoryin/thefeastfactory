import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PackageRegionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;
}
