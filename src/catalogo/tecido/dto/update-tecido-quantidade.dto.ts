import { ApiProperty } from '@nestjs/swagger';

export class UpdateTecidoQuantidadeDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  quantidade!: number;
}
