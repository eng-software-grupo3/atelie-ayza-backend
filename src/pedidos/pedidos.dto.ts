import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParteModelo } from '../catalogo/entities/modelo.entity.js';
import { ModalidadeFrete, StatusPedido, Tamanho } from './entities/enums.js';

export class AderecoAplicadoDto {
  @ApiProperty({ format: 'uuid' })
  id_adereco!: string;
  @ApiProperty({ type: Number, minimum: 0, maximum: 1, example: 0.25, description: 'Proporção da imagem, até 4 casas' })
  coordenada_x!: number;
  @ApiProperty({ type: Number, minimum: 0, maximum: 1, example: 0.4, description: 'Proporção da imagem, até 4 casas' })
  coordenada_y!: number;
}

export class PecaPedidoDto {
  @ApiProperty({ format: 'uuid' })
  id_modelo!: string;
  @ApiProperty({ enum: Tamanho })
  tamanho!: Tamanho;
  @ApiPropertyOptional({ type: AderecoAplicadoDto, isArray: true, description: 'Um item por unidade aplicada (máx. 30)' })
  aderecos?: AderecoAplicadoDto[];
}

export class ConjuntoPedidoDto {
  @ApiProperty({ format: 'uuid' })
  id_tecido!: string;
  @ApiPropertyOptional({ maxLength: 500 })
  observacao?: string;
  @ApiProperty({ type: PecaPedidoDto })
  cima!: PecaPedidoDto;
  @ApiProperty({ type: PecaPedidoDto })
  baixo!: PecaPedidoDto;
}

export class EnderecoPedidoDto {
  @ApiProperty({ example: '58400100', description: '8 dígitos, hífen aceito. Cidade e estado vêm do ViaCEP' })
  cep!: string;
  @ApiProperty({ example: '10', maxLength: 20, description: 'Use S/N para endereço sem número' })
  numero!: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 250 })
  complemento?: string | null;
  @ApiPropertyOptional({ maxLength: 150, description: 'Obrigatória só quando o ViaCEP não traz a rua (CEP único da cidade)' })
  rua?: string;
  @ApiPropertyOptional({ maxLength: 100, description: 'Obrigatório só quando o ViaCEP não traz o bairro' })
  bairro?: string;
}

export class CriarPedidoDto {
  @ApiProperty({ example: '83999990000', description: 'DDD + número (10 ou 11 dígitos); pontuação é removida' })
  telefone!: string;
  @ApiProperty({ type: EnderecoPedidoDto })
  endereco!: EnderecoPedidoDto;
  @ApiProperty({ enum: ModalidadeFrete })
  modalidade_frete!: ModalidadeFrete;
  @ApiProperty({ example: '2026-11-27', description: 'YYYY-MM-DD' })
  data_entrega_prevista!: string;
  @ApiProperty({ type: ConjuntoPedidoDto, isArray: true, minItems: 1, maxItems: 6 })
  conjuntos!: ConjuntoPedidoDto[];
}

export class ConjuntoCriadoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Number })
  preco!: number;
}

export class PedidoCriadoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Number })
  num_pedido!: number;
  @ApiProperty({ enum: StatusPedido })
  status!: StatusPedido;
  @ApiProperty({ example: '2026-11-27' })
  data_entrega_prevista!: string;
  @ApiProperty({ enum: ModalidadeFrete })
  modalidade_frete!: ModalidadeFrete;
  @ApiProperty({ type: Number })
  preco_frete!: number;
  @ApiProperty({ type: Number })
  prazo_frete_dias!: number;
  @ApiProperty({ type: Number })
  preco_final!: number;
  @ApiProperty({ type: ConjuntoCriadoDto, isArray: true })
  conjuntos!: ConjuntoCriadoDto[];
}

export class PedidoListaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Number })
  num_pedido!: number;
  @ApiProperty({ enum: StatusPedido })
  status!: StatusPedido;
  @ApiProperty({ type: String, format: 'date-time' })
  data_pedido!: Date;
  @ApiProperty({ type: String, format: 'date' })
  data_entrega_prevista!: string;
  @ApiProperty({ type: Number, nullable: true })
  preco_final!: number | null;
  @ApiProperty({ type: Number })
  preco_frete!: number;
  @ApiProperty({ enum: ModalidadeFrete })
  modalidade_frete!: ModalidadeFrete;
  @ApiProperty({ type: Number, nullable: true })
  valor_parcela_1!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  valor_parcela_2!: number | null;
  @ApiProperty({ type: String, nullable: true })
  motivo_recusa_cancelamento!: string | null;
}

export class EnderecoDetalhePedidoDto {
  @ApiProperty() rua!: string;
  @ApiProperty() numero!: string;
  @ApiProperty({ type: String, nullable: true }) complemento!: string | null;
  @ApiProperty() bairro!: string;
  @ApiProperty() cidade!: string;
  @ApiProperty() estado!: string;
  @ApiProperty() cep!: string;
}

export class AderecoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id_adereco!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: Number }) coordenada_x!: number;
  @ApiProperty({ type: Number }) coordenada_y!: number;
}

export class PecaDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) id_modelo!: string;
  @ApiProperty() modelo!: string;
  @ApiProperty({ enum: ParteModelo }) parte!: ParteModelo;
  @ApiProperty({ enum: Tamanho }) tamanho!: Tamanho;
  @ApiProperty({ type: AderecoDetalhePedidoDto, isArray: true }) aderecos!: AderecoDetalhePedidoDto[];
}

export class ConjuntoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) id_tecido!: string;
  @ApiProperty() tecido!: string;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: String, nullable: true }) observacao!: string | null;
  @ApiProperty({ type: String, nullable: true }) foto_cliente!: string | null;
  @ApiProperty({ type: PecaDetalhePedidoDto }) cima!: PecaDetalhePedidoDto;
  @ApiProperty({ type: PecaDetalhePedidoDto }) baixo!: PecaDetalhePedidoDto;
}

export class HistoricoPedidoDto {
  @ApiProperty({ enum: StatusPedido }) status!: StatusPedido;
  @ApiProperty({ type: String, format: 'date-time' }) data_mudanca!: Date;
  @ApiProperty({ type: String, nullable: true }) motivo!: string | null;
}

export class PedidoDetalheDto extends PedidoListaDto {
  @ApiProperty({ type: EnderecoDetalhePedidoDto }) endereco!: EnderecoDetalhePedidoDto;
  @ApiProperty({ type: Number }) prazo_frete_dias!: number;
  @ApiProperty({ type: ConjuntoDetalhePedidoDto, isArray: true }) conjuntos!: ConjuntoDetalhePedidoDto[];
  @ApiProperty({ type: HistoricoPedidoDto, isArray: true }) historico!: HistoricoPedidoDto[];
}

export class PedidoGestaoClienteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) foto_url!: string | null;
}

export class PedidoGestaoListaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) num_pedido!: number;
  @ApiProperty({ enum: StatusPedido }) status!: StatusPedido;
  @ApiProperty({ type: String, format: 'date-time' }) data_pedido!: Date;
  @ApiProperty({ type: String, format: 'date' }) data_entrega_prevista!: string;
  @ApiProperty({ type: Number, nullable: true }) preco_final!: number | null;
  @ApiProperty({ type: Number }) preco_estimado!: number;
  @ApiProperty({ type: PedidoGestaoClienteDto }) cliente!: PedidoGestaoClienteDto;
}

export class PedidoGestaoPaginaDto {
  @ApiProperty({ type: PedidoGestaoListaDto, isArray: true }) dados!: PedidoGestaoListaDto[];
  @ApiProperty({ type: Number }) pagina!: number;
  @ApiProperty({ type: Number }) limite!: number;
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) total_paginas!: number;
}

export class FreteDetalhePedidoDto {
  @ApiProperty({ enum: ModalidadeFrete }) modalidade!: ModalidadeFrete;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: Number }) prazo_dias!: number;
}

export class TecidoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) foto!: string | null;
  @ApiProperty({ type: Number, nullable: true }) largura_cm!: number | null;
}

export class ModeloDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ enum: ParteModelo }) parte!: ParteModelo;
  @ApiProperty({ type: String }) svg_url!: string;
}

export class AderecoGestaoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id_adereco!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) foto!: string | null;
  @ApiProperty({ type: Number }) coordenada_x!: number;
  @ApiProperty({ type: Number }) coordenada_y!: number;
}

export class PecaGestaoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Tamanho }) tamanho!: Tamanho;
  @ApiProperty({ type: ModeloDetalhePedidoDto }) modelo!: ModeloDetalhePedidoDto;
  @ApiProperty({ type: AderecoGestaoDetalhePedidoDto, isArray: true }) aderecos!: AderecoGestaoDetalhePedidoDto[];
}

export class ConjuntoGestaoDetalhePedidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: TecidoDetalhePedidoDto }) tecido!: TecidoDetalhePedidoDto;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: String, nullable: true }) observacao!: string | null;
  @ApiProperty({ type: String, nullable: true }) foto_cliente!: string | null;
  @ApiProperty({ type: PecaGestaoDetalhePedidoDto }) cima!: PecaGestaoDetalhePedidoDto;
  @ApiProperty({ type: PecaGestaoDetalhePedidoDto }) baixo!: PecaGestaoDetalhePedidoDto;
}

export class PedidoGestaoDetalheDto extends PedidoGestaoListaDto {
  @ApiProperty() telefone!: string;
  @ApiProperty({ type: EnderecoDetalhePedidoDto }) endereco!: EnderecoDetalhePedidoDto;
  @ApiProperty({ type: FreteDetalhePedidoDto }) frete!: FreteDetalhePedidoDto;
  @ApiProperty({ type: ConjuntoGestaoDetalhePedidoDto, isArray: true }) conjuntos!: ConjuntoGestaoDetalhePedidoDto[];
  @ApiProperty({ type: HistoricoPedidoDto, isArray: true }) historico!: HistoricoPedidoDto[];
  @ApiProperty({ type: String, nullable: true }) motivo_recusa_cancelamento!: string | null;
}

export class RecusarPedidoDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 })
  motivo!: string;
}

export class PedidoAcaoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: StatusPedido }) status!: StatusPedido;
  @ApiProperty({ type: Number, nullable: true }) preco_final!: number | null;
  @ApiProperty({ type: Number, nullable: true }) valor_parcela_1!: number | null;
  @ApiProperty({ type: Number, nullable: true }) valor_parcela_2!: number | null;
  @ApiProperty({ type: String, nullable: true }) motivo_recusa_cancelamento!: string | null;
}
