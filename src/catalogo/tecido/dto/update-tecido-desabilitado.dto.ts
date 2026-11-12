import { ApiProperty } from '@nestjs/swagger';

export class UpdateTecidoDesabilitadoDto {
  [key: string]: unknown;

  @ApiProperty({ type: Boolean })
  desabilitado!: boolean;
}
