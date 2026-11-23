import { ApiProperty } from '@nestjs/swagger';
import { ModalidadeFrete } from '../pedidos/entities/enums.js';

export class EnderecoCotacaoDto {
  @ApiProperty({ type: String, nullable: true })
  logradouro!: string | null;
  @ApiProperty({ type: String, nullable: true })
  bairro!: string | null;
  @ApiProperty({ example: 'Floriano' })
  cidade!: string;
  @ApiProperty({ example: 'PI', description: 'UF' })
  estado!: string;
}

export class ModalidadeCotadaDto {
  @ApiProperty({ enum: ModalidadeFrete })
  modalidade!: ModalidadeFrete;
  @ApiProperty({ type: Number, example: 26 })
  preco!: number;
  @ApiProperty({ type: Number, example: 7 })
  prazo_frete_dias!: number;
}

export class CotacaoFreteDto {
  @ApiProperty({ example: '64800000', description: '8 dígitos, sem hífen' })
  cep!: string;
  @ApiProperty({ type: EnderecoCotacaoDto })
  endereco!: EnderecoCotacaoDto;
  @ApiProperty({ type: ModalidadeCotadaDto, isArray: true })
  modalidades!: ModalidadeCotadaDto[];
}