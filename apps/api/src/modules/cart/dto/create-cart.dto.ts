import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCartDto {
  @ApiProperty()
  @IsUUID()
  packageVersionId!: string;

}
