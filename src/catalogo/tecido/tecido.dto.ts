import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTecidoMultipartDto {
  @ApiProperty({ maxLength: 100 })
  nome!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  foto!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  preco_metro!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  quantidade!: number;
}

export class PatchTecidoMultipartDto {
  @ApiPropertyOptional({ maxLength: 100 })
  nome?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  foto?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  preco_metro?: number;
}

export class CreateTecidoBodyDto {
  [key: string]: unknown;
  nome!: string;
  preco_metro!: string | number;
  quantidade!: string | number;
}

export class PatchTecidoBodyDto {
  [key: string]: unknown;
  nome?: string;
  preco_metro?: string | number;
}

export class UpdateTecidoQuantidadeDto {
  [key: string]: unknown;
  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }) quantidade!: number;
}

export class UpdateTecidoDesabilitadoDto {
  [key: string]: unknown;
  @ApiProperty({ type: Boolean }) desabilitado!: boolean;
}

export class TecidoManagementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nome!: string;
  @ApiProperty({ type: String, nullable: true })
  foto!: string | null;
  @ApiProperty({ type: Number })
  preco_metro!: number;
  @ApiProperty({ type: Number })
  quantidade!: number;
  @ApiProperty()
  desabilitado!: boolean;
}

export class TecidoPublicDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nome!: string;
  @ApiProperty({ type: String, nullable: true })
  foto!: string | null;
  @ApiProperty({ type: Number })
  preco_metro!: number;
}
