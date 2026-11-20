import { ApiPropertyOptional } from '@nestjs/swagger';
import { ParteModelo } from '../../entities/modelo.entity.js';

export class PatchModeloDto {
  @ApiPropertyOptional({ maxLength: 100 })
  nome?: string;

  @ApiPropertyOptional({ enum: ParteModelo })
  parte?: ParteModelo;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  valor?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0.01,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  metragem_media_m?: number;

  @ApiPropertyOptional()
  svg_url?: string;
}
