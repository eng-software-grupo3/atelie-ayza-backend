import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ enum: ['CIMA', 'BAIXO'] }) parte!: string;
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
