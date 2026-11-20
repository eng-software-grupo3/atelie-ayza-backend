import { ApiProperty } from '@nestjs/swagger';

export class UpdateAderecoDesabilitadoDto {
  @ApiProperty({ type: Boolean })
  desabilitado!: boolean;
}
