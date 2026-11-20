import { ApiProperty } from '@nestjs/swagger';
import { ParteModelo } from '../../entities/modelo.entity.js';

export class ModeloPublicDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ enum: ParteModelo })
  parte!: ParteModelo;

  @ApiProperty({ type: Number })
  valor!: number;

  @ApiProperty({ type: Number })
  metragem_media_m!: number;

  @ApiProperty()
  svg_url!: string;
}
