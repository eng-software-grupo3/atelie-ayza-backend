
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParteModelo } from '../entities/modelo.entity.js';

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

export class ModeloManagementDto {
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

  @ApiProperty()
  atualizado_em!: Date;

  @ApiProperty()
  habilitado!: boolean;
}

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

export class SetModeloHabilitadoDto {
  @ApiProperty({
    description: 'Define se o modelo estará disponível na listagem pública',
    example: false,
    type: Boolean,
  })
  habilitado!: boolean;
}