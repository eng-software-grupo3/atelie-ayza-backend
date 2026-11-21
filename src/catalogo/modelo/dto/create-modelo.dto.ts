import { ApiProperty } from '@nestjs/swagger';
import { ParteModelo } from '../../entities/modelo.entity.js';

export class CreateModeloDto {
  @ApiProperty({ maxLength: 100 })
  nome!: string;

  @ApiProperty({ enum: ParteModelo })
  parte!: ParteModelo;

  @ApiProperty({
    type: Number,
    minimum: 0,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  valor!: number;

  @ApiProperty({
    type: Number,
    minimum: 0.01,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  metragem_media_m!: number;

  @ApiProperty()
  svg_url!: string;
}
