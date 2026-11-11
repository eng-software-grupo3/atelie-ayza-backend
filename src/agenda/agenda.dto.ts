import { ApiProperty } from '@nestjs/swagger';
import { StatusPedido } from '../pedidos/entities/enums.js';

export class AgendaDiaDto {
  @ApiProperty({ example: '2026-11-20' })
  data!: string;
  @ApiProperty({ enum: ['disponivel', 'com_entrega', 'bloqueada'] })
  estado!: string;
  @ApiProperty({ type: Number })
  qtd_pedidos!: number;
}

export class AgendaMesDto {
  @ApiProperty({ example: '2026-11' })
  mes!: string;
  @ApiProperty({ type: AgendaDiaDto, isArray: true })
  dias!: AgendaDiaDto[];
}

export class AgendaClienteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nome!: string;
}

export class AgendaEnderecoDto {
  @ApiProperty() rua!: string;
  @ApiProperty() numero!: string;
  @ApiProperty({ type: String, nullable: true }) complemento!: string | null;
  @ApiProperty() bairro!: string;
  @ApiProperty() cidade!: string;
  @ApiProperty({ description: 'UF' }) estado!: string;
  @ApiProperty({ description: '8 dígitos, sem hífen' }) cep!: string;
}

export class AgendaEntregaDto {
  @ApiProperty({ enum: ['padrao', 'sedex'] })
  modalidade_frete!: string;
  @ApiProperty({ type: AgendaEnderecoDto })
  endereco!: AgendaEnderecoDto;
}

export class AgendaPedidoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Number })
  num_pedido!: number;
  @ApiProperty({ type: AgendaClienteDto })
  cliente!: AgendaClienteDto;
  @ApiProperty({ enum: StatusPedido })
  status!: StatusPedido;
  @ApiProperty({ type: AgendaEntregaDto })
  entrega!: AgendaEntregaDto;
}

export class UpdateAgendaBloqueadaDto {
  [key: string]: unknown;
  @ApiProperty({ type: Boolean }) bloqueada!: boolean;
}

export class AgendaBloqueioDto {
  @ApiProperty({ example: '2026-11-20' })
  data!: string;
  @ApiProperty({ type: Boolean })
  bloqueada!: boolean;
}