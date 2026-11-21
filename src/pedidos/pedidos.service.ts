import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { AgendaOcupado } from '../agenda/entities/agenda-ocupado.entity.js';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { Modelo, ParteModelo } from '../catalogo/entities/modelo.entity.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { FreteService, type CotacaoFrete } from '../frete/frete.service.js';
import { Endereco } from '../pessoas/entities/endereco.entity.js';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import { AderecoPeca } from './entities/adereco-peca.entity.js';
import { Conjunto } from './entities/conjunto.entity.js';
import { ModalidadeFrete, StatusPedido } from './entities/enums.js';
import { HistoricoStatus } from './entities/historico-status.entity.js';
import { Peca } from './entities/peca.entity.js';
import { Pedido } from './entities/pedido.entity.js';
import type { PedidoDetalheDto, PedidoListaDto } from './pedidos.dto.js';
import { validarCriarPedido, type PedidoValidado } from './pedido-validacao.js';
import { calcularPrecoPedido, type ConjuntoParaPreco, type PrecoPedido } from './preco-pedido.js';

type Catalogo = {
  modelos: Map<string, Modelo>;
  tecidos: Map<string, Tecido>;
  aderecos: Map<string, Adereco>;
};

export type PedidoCriado = {
  id: string;
  num_pedido: number;
  status: StatusPedido;
  data_entrega_prevista: string;
  modalidade_frete: ModalidadeFrete;
  preco_frete: number;
  prazo_frete_dias: number;
  preco_final: number;
  conjuntos: Array<{ id: string; preco: number }>;
};

function conflito(code: string, message: string, extra: object = {}): ConflictException {
  return new ConflictException({ statusCode: 409, error: 'Conflict', code, message, ...extra });
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly frete: FreteService,
    private readonly config: ConfigService,
  ) {}

  async listar(user: Usuario): Promise<PedidoListaDto[]> {
    const pedidos = await this.dataSource.getRepository(Pedido).find({
      where: { cliente: { id: user.id } },
      order: { dataPedido: 'DESC', numPedido: 'DESC' },
    });
    return pedidos.map((pedido) => ({
      id: pedido.id,
      num_pedido: pedido.numPedido,
      status: pedido.status,
      data_pedido: pedido.dataPedido,
      data_entrega_prevista: pedido.dataEntregaPrevista,
      preco_final: pedido.precoFinal,
      preco_frete: pedido.precoFrete,
      modalidade_frete: pedido.modalidadeFrete,
      valor_parcela_1: pedido.valorParcela1,
      valor_parcela_2: pedido.valorParcela2,
      motivo_recusa_cancelamento: pedido.motivoRecusaCancelamento,
    }));
  }

  async obterDetalhe(user: Usuario, id: string): Promise<PedidoDetalheDto> {
    const pedido = await this.dataSource.getRepository(Pedido).findOne({
      where: { id, cliente: { id: user.id } },
      relations: {
        endereco: true,
        conjuntos: {
          tecido: true,
          pecaCima: { modelo: true, adereco: { adereco: true } },
          pecaBaixo: { modelo: true, adereco: { adereco: true } },
        },
        historico: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    const mapPeca = (peca: Peca) => ({
      id: peca.id,
      id_modelo: peca.modelo.id,
      modelo: peca.modelo.nome,
      parte: peca.modelo.parte,
      tamanho: peca.tamanho,
      aderecos: peca.adereco.map((aplicacao) => ({
        id_adereco: aplicacao.adereco.id,
        nome: aplicacao.adereco.nome,
        coordenada_x: Number(aplicacao.coordenadaX),
        coordenada_y: Number(aplicacao.coordenadaY),
      })),
    });

    return {
      id: pedido.id,
      num_pedido: pedido.numPedido,
      status: pedido.status,
      data_pedido: pedido.dataPedido,
      data_entrega_prevista: pedido.dataEntregaPrevista,
      preco_final: pedido.precoFinal,
      preco_frete: pedido.precoFrete,
      modalidade_frete: pedido.modalidadeFrete,
      prazo_frete_dias: pedido.prazoFreteDias,
      valor_parcela_1: pedido.valorParcela1,
      valor_parcela_2: pedido.valorParcela2,
      motivo_recusa_cancelamento: pedido.motivoRecusaCancelamento,
      endereco: {
        rua: pedido.endereco.rua,
        numero: pedido.endereco.numero,
        complemento: pedido.endereco.complemento,
        bairro: pedido.endereco.bairro,
        cidade: pedido.endereco.cidade,
        estado: pedido.endereco.estado,
        cep: pedido.endereco.cep,
      },
      conjuntos: pedido.conjuntos.map((conjunto) => ({
        id: conjunto.id,
        id_tecido: conjunto.tecido.id,
        tecido: conjunto.tecido.nome,
        preco: conjunto.preco,
        observacao: conjunto.observacao,
        foto_cliente: conjunto.fotoCliente,
        cima: mapPeca(conjunto.pecaCima),
        baixo: mapPeca(conjunto.pecaBaixo),
      })),
      historico: pedido.historico
        .sort((a, b) => a.dataMudanca.getTime() - b.dataMudanca.getTime())
        .map((item) => ({
          status: item.status,
          data_mudanca: item.dataMudanca,
          motivo: item.motivo,
        })),
    };
  }

  async create(user: Usuario, corpo: unknown): Promise<PedidoCriado> {
    const pedido = validarCriarPedido(corpo);
    // O frete é consultado fora da transação para não segurar uma conexão do banco.
    const cotacao = await this.cotarFrete(pedido);
    const diasMinimos = this.prazoConfeccao() + cotacao.prazo_frete_dias;

    return this.dataSource.transaction(async (manager) => {
      const catalogo = await this.carregarCatalogo(manager, pedido);
      this.validarPartes(pedido, catalogo);
      await this.validarData(manager, pedido.dataEntregaPrevista, diasMinimos);
      const precos = calcularPrecoPedido(this.paraPreco(pedido, catalogo), cotacao.preco);
      return this.gravar(manager, user, pedido, cotacao, precos, catalogo);
    });
  }

  private prazoConfeccao(): number {
    const bruto = this.config.get<string>('PRAZO_CONFECCAO_DIAS');
    const dias = bruto === undefined ? 3 : Number(bruto);
    if (!Number.isInteger(dias) || dias < 0) {
      throw new InternalServerErrorException('PRAZO_CONFECCAO_DIAS inválido');
    }
    return dias;
  }

  private async cotarFrete(pedido: PedidoValidado): Promise<CotacaoFrete> {
    let cotacoes: CotacaoFrete[];
    try {
      cotacoes = await this.frete.cotar({
        cep: pedido.endereco.cep,
        cidade: pedido.endereco.cidade,
        estado: pedido.endereco.estado,
        conjuntos: pedido.conjuntos.length,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Serviço de frete indisponível');
    }
    const cotacao = cotacoes.find((c) => c.modalidade === pedido.modalidadeFrete);
    if (!cotacao) throw new BadRequestException('modalidade_frete não atendida para o CEP');
    return cotacao;
  }

  private async carregarCatalogo(manager: EntityManager, pedido: PedidoValidado): Promise<Catalogo> {
    const idsModelos = new Set<string>();
    const idsTecidos = new Set<string>();
    const idsAderecos = new Set<string>();
    for (const c of pedido.conjuntos) {
      idsTecidos.add(c.idTecido);
      for (const peca of [c.cima, c.baixo]) {
        idsModelos.add(peca.idModelo);
        for (const a of peca.aderecos) idsAderecos.add(a.idAdereco);
      }
    }

    // Consultas em sequência: a transação usa uma única conexão.
    const modelos = await manager.find(Modelo, {
      where: { id: In([...idsModelos]), excluido: false, habilitado: true },
    });
    const tecidos = await manager.find(Tecido, {
      where: { id: In([...idsTecidos]), excluido: false, desabilitado: false },
    });
    const aderecos = idsAderecos.size
      ? await manager.find(Adereco, {
          where: { id: In([...idsAderecos]), excluido: false, desabilitado: false },
        })
      : [];

    const catalogo: Catalogo = {
      modelos: new Map(modelos.map((m) => [m.id, m] as const)),
      tecidos: new Map(tecidos.map((t) => [t.id, t] as const)),
      aderecos: new Map(aderecos.map((a) => [a.id, a] as const)),
    };
    const indisponiveis = [
      ...[...idsModelos].filter((id) => !catalogo.modelos.has(id)),
      ...[...idsTecidos].filter((id) => !catalogo.tecidos.has(id)),
      ...[...idsAderecos].filter((id) => !catalogo.aderecos.has(id)),
    ];
    if (indisponiveis.length) {
      throw conflito('item_indisponivel', 'Modelo, tecido ou adereço indisponível', {
        ids: indisponiveis,
      });
    }
    return catalogo;
  }

  private validarPartes(pedido: PedidoValidado, catalogo: Catalogo): void {
    pedido.conjuntos.forEach((c, i) => {
      if (catalogo.modelos.get(c.cima.idModelo)?.parte !== ParteModelo.CIMA) {
        throw new BadRequestException(`conjuntos[${i}].cima.id_modelo inválido`);
      }
      if (catalogo.modelos.get(c.baixo.idModelo)?.parte !== ParteModelo.BAIXO) {
        throw new BadRequestException(`conjuntos[${i}].baixo.id_modelo inválido`);
      }
    });
  }

  // "Hoje" é a data do banco (CURRENT_DATE), como combinado.
  private async validarData(manager: EntityManager, data: string, diasMinimos: number): Promise<void> {
    const linhas: Array<{ minima: string }> = await manager.query(
      `SELECT to_char(CURRENT_DATE + $1::int, 'YYYY-MM-DD') AS minima`,
      [diasMinimos],
    );
    const { minima } = linhas[0];
    if (data < minima) {
      throw new BadRequestException(`data_entrega_prevista anterior ao mínimo (${minima})`);
    }
    if ((await manager.count(AgendaOcupado, { where: { data } })) > 0) {
      throw conflito('data_indisponivel', 'Data indisponível');
    }
  }

  private paraPreco(pedido: PedidoValidado, catalogo: Catalogo): ConjuntoParaPreco[] {
    return pedido.conjuntos.map((c) => {
      const cima = catalogo.modelos.get(c.cima.idModelo)!;
      const baixo = catalogo.modelos.get(c.baixo.idModelo)!;
      return {
        valorCima: cima.valor,
        valorBaixo: baixo.valor,
        metragemCima: cima.metragemMediaM,
        metragemBaixo: baixo.metragemMediaM,
        precoMetroTecido: catalogo.tecidos.get(c.idTecido)!.precoMetro,
        precosAderecos: [...c.cima.aderecos, ...c.baixo.aderecos].map(
          (a) => catalogo.aderecos.get(a.idAdereco)!.preco,
        ),
      };
    });
  }

  private async gravar(
    manager: EntityManager,
    user: Usuario,
    pedido: PedidoValidado,
    cotacao: CotacaoFrete,
    precos: PrecoPedido,
    catalogo: Catalogo,
  ): Promise<PedidoCriado> {
    const endereco = await manager.save(Endereco, { ...pedido.endereco });
    const salvo = await manager.save(Pedido, {
      cliente: user,
      endereco,
      status: StatusPedido.EM_ANALISE,
      dataEntregaPrevista: pedido.dataEntregaPrevista,
      telefone: pedido.telefone,
      precoEstimado: precos.total,
      precoFinal: precos.total,
      modalidadeFrete: pedido.modalidadeFrete,
      precoFrete: cotacao.preco,
      prazoFreteDias: cotacao.prazo_frete_dias,
    });

    const conjuntos: PedidoCriado['conjuntos'] = [];
    for (const [i, c] of pedido.conjuntos.entries()) {
      const pecaCima = await manager.save(Peca, {
        modelo: catalogo.modelos.get(c.cima.idModelo)!,
        tamanho: c.cima.tamanho,
      });
      const pecaBaixo = await manager.save(Peca, {
        modelo: catalogo.modelos.get(c.baixo.idModelo)!,
        tamanho: c.baixo.tamanho,
      });
      const conjunto = await manager.save(Conjunto, {
        pedido: salvo,
        fotoCliente: null,
        pecaCima,
        pecaBaixo,
        tecido: catalogo.tecidos.get(c.idTecido)!,
        preco: precos.conjuntos[i],
        observacao: c.observacao,
      });

      // Uma linha por unidade de adereço aplicada.
      const aplicados = [
        ...c.cima.aderecos.map((a) => ({ peca: pecaCima, a })),
        ...c.baixo.aderecos.map((a) => ({ peca: pecaBaixo, a })),
      ];
      if (aplicados.length) {
        await manager.save(
          AderecoPeca,
          aplicados.map(({ peca, a }) => ({
            peca,
            adereco: catalogo.aderecos.get(a.idAdereco)!,
            coordenadaX: a.coordenadaX.toFixed(4),
            coordenadaY: a.coordenadaY.toFixed(4),
          })),
        );
      }
      conjuntos.push({ id: conjunto.id, preco: precos.conjuntos[i] });
    }

    await manager.save(HistoricoStatus, {
      pedido: salvo,
      status: StatusPedido.EM_ANALISE,
      motivo: null,
    });

    const numPedido =
      salvo.numPedido ?? (await manager.findOneByOrFail(Pedido, { id: salvo.id })).numPedido;
    return {
      id: salvo.id,
      num_pedido: numPedido,
      status: StatusPedido.EM_ANALISE,
      data_entrega_prevista: pedido.dataEntregaPrevista,
      modalidade_frete: pedido.modalidadeFrete,
      preco_frete: cotacao.preco,
      prazo_frete_dias: cotacao.prazo_frete_dias,
      preco_final: precos.total,
      conjuntos,
    };
  }
}
