import { ApiProperty } from '@nestjs/swagger';

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
