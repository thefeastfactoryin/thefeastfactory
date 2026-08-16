import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AdminRegionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  regionId?: string;
}
