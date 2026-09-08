import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ResolveLocationDto {
  @ApiProperty({ example: '17.44858350' })
  @IsLatitude()
  latitude!: string;

  @ApiProperty({ example: '78.39080340' })
  @IsLongitude()
  longitude!: string;
}
