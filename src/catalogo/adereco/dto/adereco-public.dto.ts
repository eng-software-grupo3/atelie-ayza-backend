import { ApiProperty } from '@nestjs/swagger';

export class AderecoPublicDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ type: String, nullable: true })
  foto!: string | null;

  @ApiProperty({ type: Number })
  preco!: number;
}
