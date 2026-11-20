import { ApiProperty } from '@nestjs/swagger';

export class UpdateTecidoDesabilitadoDto {
  @ApiProperty({ type: Boolean })
  desabilitado!: boolean;
}
