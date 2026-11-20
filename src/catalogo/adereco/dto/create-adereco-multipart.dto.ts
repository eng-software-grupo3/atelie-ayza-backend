import { ApiProperty } from '@nestjs/swagger';

export class CreateAderecoMultipartDto {
  @ApiProperty({ maxLength: 100 })
  nome!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  foto!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  preco!: number;

  @ApiProperty({ type: Number, format: 'int32', minimum: 0 })
  quantidade!: number;
}
