import { ApiProperty } from '@nestjs/swagger';

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
