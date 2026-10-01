import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartCutlerySelectionDto {
  @ApiProperty() @IsString() @MaxLength(100) itemId!: string;
  @ApiProperty() @IsInt() @Min(0) quantity!: number;
}

export class UpdateCartCutleryDto {
  @ApiProperty({ type: [CartCutlerySelectionDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartCutlerySelectionDto)
  items!: CartCutlerySelectionDto[];
}
