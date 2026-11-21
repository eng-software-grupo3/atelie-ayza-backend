import { ApiProperty } from '@nestjs/swagger';

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
