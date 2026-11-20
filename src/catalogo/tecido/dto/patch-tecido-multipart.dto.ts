import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchTecidoMultipartDto {
  @ApiPropertyOptional({ maxLength: 100 })
  nome?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  foto?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 })
  preco_metro?: number;
}
