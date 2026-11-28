import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PedidosService } from './pedidos.service.js';

const cliente = { id: 'cliente-1' };

function serviceWithRepository(
  repository: {
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  findAndCount?: ReturnType<typeof vi.fn>;
  },
  options: { estoque?: unknown; manager?: unknown } = {},
) {
  const manager = options.manager ?? {};
  const dataSource = {
    getRepository: vi.fn(() => repository),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(manager)),
  };
  return {
    service: new PedidosService(
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      options.estoque as never,
    ),
    dataSource,
  };
}

describe('PedidosService consultas do cliente', () => {
  it('lista apenas os pedidos do cliente, ordenados do mais recente, incluindo dados dos cards', async () => {
    const dataPedido = new Date('2026-11-20T12:00:00.000Z');
    const pedidos = [{
      id: 'pedido-1',
      numPedido: 42,
      status: 'recusado',
      dataPedido,
      dataEntregaPrevista: '2026-12-01',
      precoFinal: 120,
      precoFrete: 20,
      modalidadeFrete: 'padrao',
      valorParcela1: null,
      valorParcela2: null,
      motivoRecusaCancelamento: 'Fora do prazo',
    }];
    const repository = { find: vi.fn().mockResolvedValue(pedidos), findOne: vi.fn() };
    const { service } = serviceWithRepository(repository);

    await expect(service.listar(cliente as never)).resolves.toEqual([{
      id: 'pedido-1',
      num_pedido: 42,
      status: 'recusado',
      data_pedido: dataPedido,
      data_entrega_prevista: '2026-12-01',
      preco_final: 120,
      preco_frete: 20,
      modalidade_frete: 'padrao',
      valor_parcela_1: null,
      valor_parcela_2: null,
      motivo_recusa_cancelamento: 'Fora do prazo',
    }]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { cliente: { id: cliente.id } },
      order: { dataPedido: 'DESC', numPedido: 'DESC' },
    });
  });

  it('carrega e mapeia o detalhe e ordena o histórico cronologicamente', async () => {
    const maisAntigo = new Date('2026-11-19T12:00:00.000Z');
    const maisNovo = new Date('2026-11-20T12:00:00.000Z');
    const pedido = {
      id: 'pedido-1', numPedido: 42, status: 'em_producao', dataPedido: maisNovo,
      dataEntregaPrevista: '2026-12-01', precoFinal: 120, precoFrete: 20,
      modalidadeFrete: 'padrao', prazoFreteDias: 3, valorParcela1: 60, valorParcela2: 60,
      motivoRecusaCancelamento: null,
      endereco: { rua: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Campina Grande', estado: 'PB', cep: '58400000' },
      conjuntos: [{
        id: 'conjunto-1', tecido: { id: 'tecido-1', nome: 'Algodão' }, preco: 100,
        observacao: 'Ajustar manga', fotoCliente: null,
        pecaCima: {
          id: 'peca-1', tamanho: 'M', modelo: { id: 'modelo-1', nome: 'Blusa', parte: 'CIMA' },
          adereco: [{ adereco: { id: 'adereco-1', nome: 'Laço' }, coordenadaX: '0.2500', coordenadaY: '0.5000' }],
        },
        pecaBaixo: {
          id: 'peca-2', tamanho: 'P', modelo: { id: 'modelo-2', nome: 'Saia', parte: 'BAIXO' },
          adereco: [],
        },
      }],
      historico: [
        { status: 'em_producao', dataMudanca: maisNovo, motivo: null },
        { status: 'em_analise', dataMudanca: maisAntigo, motivo: null },
      ],
    };
    const repository = { find: vi.fn(), findOne: vi.fn().mockResolvedValue(pedido) };
    const { service } = serviceWithRepository(repository);

    await expect(service.obterDetalhe(cliente as never, 'pedido-1')).resolves.toMatchObject({
      id: 'pedido-1',
      valor_parcela_1: 60,
      valor_parcela_2: 60,
      endereco: { rua: 'Rua A', cep: '58400000' },
      conjuntos: [{
        id: 'conjunto-1', tecido: 'Algodão', observacao: 'Ajustar manga',
        cima: { id_modelo: 'modelo-1', modelo: 'Blusa', aderecos: [{
          id_adereco: 'adereco-1', nome: 'Laço', coordenada_x: 0.25, coordenada_y: 0.5,
        }] },
        baixo: { id_modelo: 'modelo-2', modelo: 'Saia', aderecos: [] },
      }],
      historico: [
        { status: 'em_analise', data_mudanca: maisAntigo },
        { status: 'em_producao', data_mudanca: maisNovo },
      ],
    });
    expect(repository.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pedido-1', cliente: { id: cliente.id } },
      relations: expect.objectContaining({ conjuntos: expect.any(Object), endereco: true, historico: true }),
    }));
  });

  it('retorna 404 se não existir pedido pertencente ao cliente', async () => {
    const repository = { find: vi.fn(), findOne: vi.fn().mockResolvedValue(null) };
    const { service } = serviceWithRepository(repository);

    await expect(service.obterDetalhe(cliente as never, 'pedido-de-outra-cliente'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pedido-de-outra-cliente', cliente: { id: cliente.id } },
    }));
  });

  it('lista pedidos da gestao com filtro de status e paginacao', async () => {
    const pedido = {
      id: 'pedido-1',
      numPedido: 42,
      status: 'em_analise',
      dataPedido: new Date('2026-11-20T12:00:00.000Z'),
      dataEntregaPrevista: '2026-12-01',
      precoEstimado: 100,
      precoFinal: null,
      cliente: {
        id: 'cliente-1',
        nome: 'Ana',
        email: 'ana@example.com',
        fotoUrl: null,
      },
    };
    const repository = {
      find: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[pedido], 1]),
    };
    const { service } = serviceWithRepository(repository);

    await expect(service.listarGestao('em_analise', '2', '5', 'desc')).resolves.toMatchObject({
      dados: [{
        id: 'pedido-1',
        num_pedido: 42,
        status: 'em_analise',
        cliente: { nome: 'Ana', email: 'ana@example.com' },
      }],
      pagina: 2,
      limite: 5,
      total: 1,
      total_paginas: 1,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: { status: 'em_analise' },
      relations: { cliente: true },
      order: { dataPedido: 'DESC', numPedido: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('rejeita status, pagina, limite e ordem invalidos na gestao', async () => {
    const repository = { find: vi.fn(), findOne: vi.fn(), findAndCount: vi.fn() };
    const { service } = serviceWithRepository(repository);

    await expect(service.listarGestao('inventado', 1, 10, 'desc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listarGestao('todos', 0, 10, 'desc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listarGestao('todos', 1, 101, 'desc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listarGestao('todos', 1, 10, 'horizontal')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('retorna estado vazio sem itens na gestao', async () => {
    const repository = {
      find: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    const { service } = serviceWithRepository(repository);

    await expect(service.listarGestao('todos', 1, 10, 'desc')).resolves.toEqual({
      dados: [],
      pagina: 1,
      limite: 10,
      total: 0,
      total_paginas: 0,
    });
  });

  it('retorna 404 ao consultar detalhe administrativo inexistente', async () => {
    const repository = { find: vi.fn(), findOne: vi.fn().mockResolvedValue(null), findAndCount: vi.fn() };
    const { service } = serviceWithRepository(repository);

    await expect(service.obterDetalheGestao('pedido-inexistente'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('mapeia o detalhe administrativo completo, incluindo aderecos e historico', async () => {
    const antiga = new Date('2026-11-19T12:00:00.000Z');
    const atual = new Date('2026-11-20T12:00:00.000Z');
    const pedido = {
      id: 'pedido-1',
      numPedido: 42,
      status: 'em_producao',
      dataPedido: atual,
      dataEntregaPrevista: '2026-12-01',
      precoEstimado: 100,
      precoFinal: 120,
      precoFrete: 20,
      modalidadeFrete: 'sedex',
      prazoFreteDias: 3,
      telefone: '83999990000',
      motivoRecusaCancelamento: null,
      cliente: {
        id: 'cliente-1',
        nome: 'Ana',
        email: 'ana@example.com',
        fotoUrl: 'https://example.com/ana.jpg',
      },
      endereco: {
        rua: 'Rua A',
        numero: '10',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Campina Grande',
        estado: 'PB',
        cep: '58400000',
      },
      conjuntos: [{
        id: 'conjunto-1',
        tecido: {
          id: 'tecido-1',
          nome: 'Algodao',
          foto: 'https://example.com/tecido.jpg',
          larguraCm: 140,
        },
        preco: 100,
        observacao: 'Ajustar manga',
        fotoCliente: null,
        pecaCima: {
          id: 'peca-1',
          tamanho: 'M',
          modelo: {
            id: 'modelo-1',
            nome: 'Blusa',
            parte: 'CIMA',
            svgUrl: 'https://example.com/blusa.svg',
          },
          adereco: [{
            adereco: {
              id: 'adereco-1',
              nome: 'Laco',
              foto: 'https://example.com/laco.jpg',
            },
            coordenadaX: '0.2500',
            coordenadaY: '0.5000',
          }],
        },
        pecaBaixo: {
          id: 'peca-2',
          tamanho: 'P',
          modelo: {
            id: 'modelo-2',
            nome: 'Saia',
            parte: 'BAIXO',
            svgUrl: 'https://example.com/saia.svg',
          },
          adereco: [],
        },
      }],
      historico: [
        { status: 'em_producao', dataMudanca: atual, motivo: null },
        { status: 'em_analise', dataMudanca: antiga, motivo: null },
      ],
    };
    const repository = { find: vi.fn(), findOne: vi.fn().mockResolvedValue(pedido), findAndCount: vi.fn() };
    const { service } = serviceWithRepository(repository);

    await expect(service.obterDetalheGestao('pedido-1')).resolves.toMatchObject({
      telefone: '83999990000',
      cliente: { nome: 'Ana', email: 'ana@example.com' },
      endereco: { rua: 'Rua A', cep: '58400000' },
      frete: { modalidade: 'sedex', preco: 20, prazo_dias: 3 },
      conjuntos: [{
        tecido: { nome: 'Algodao', largura_cm: 140 },
        cima: {
          modelo: { nome: 'Blusa', parte: 'CIMA' },
          aderecos: [{
            nome: 'Laco',
            foto: 'https://example.com/laco.jpg',
            coordenada_x: 0.25,
            coordenada_y: 0.5,
          }],
        },
        baixo: { modelo: { nome: 'Saia', parte: 'BAIXO' }, aderecos: [] },
      }],
      historico: [
        { status: 'em_analise', data_mudanca: antiga },
        { status: 'em_producao', data_mudanca: atual },
      ],
    });
  });

  it('recusa pedido em analise e registra o historico sem estoque', async () => {
    const pedido = {
      id: 'pedido-1',
      status: 'em_analise',
      precoFinal: null,
      valorParcela1: null,
      valorParcela2: null,
      motivoRecusaCancelamento: null,
    };
    const saved: unknown[] = [];
    const manager = {
      findOne: vi.fn().mockResolvedValue(pedido),
      save: vi.fn(async (_entidade: unknown, dados: unknown) => {
        saved.push(dados);
        return dados;
      }),
    };
    const repository = { find: vi.fn(), findOne: vi.fn(), findAndCount: vi.fn() };
    const { service } = serviceWithRepository(repository, { manager });

    await expect(service.recusarPedido('pedido-1', { motivo: 'Fora do prazo' }))
      .resolves.toMatchObject({
        id: 'pedido-1',
        status: 'recusado',
        motivo_recusa_cancelamento: 'Fora do prazo',
      });
    expect(saved).toContainEqual(expect.objectContaining({ status: 'recusado', motivoRecusaCancelamento: 'Fora do prazo' }));
  });

  it('aceita apenas pedido em analise e bloqueia transicoes invalidas', async () => {
    const pedido = {
      id: 'pedido-1',
      status: 'recusado',
      precoFinal: null,
      valorParcela1: null,
      valorParcela2: null,
      motivoRecusaCancelamento: null,
      conjuntos: [],
    };
    const manager = {
      findOne: vi.fn().mockResolvedValue(pedido),
      save: vi.fn(),
    };
    const repository = { find: vi.fn(), findOne: vi.fn(), findAndCount: vi.fn() };
    const estoque = { baixarPedido: vi.fn() };
    const { service } = serviceWithRepository(repository, { manager, estoque });

    await expect(service.aceitarPedido('pedido-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(estoque.baixarPedido).not.toHaveBeenCalled();
  });

  it('aceita pedido em analise, calcula o valor final e registra o historico', async () => {
    const pedido = {
      id: 'pedido-1',
      status: 'em_analise',
      precoFinal: null,
      valorParcela1: null,
      valorParcela2: null,
      motivoRecusaCancelamento: null,
      precoFrete: 10,
      conjuntos: [{ preco: 60.01 }, { preco: 40 }],
    };
    const saved: Array<{ entidade: unknown; dados: unknown }> = [];
    const manager = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(pedido)
        .mockResolvedValueOnce(pedido),
      save: vi.fn(async (entidade: unknown, dados: unknown) => {
        saved.push({ entidade, dados });
        return dados;
      }),
    };
    const repository = { find: vi.fn(), findOne: vi.fn(), findAndCount: vi.fn() };
    const estoque = { baixarPedido: vi.fn().mockResolvedValue(undefined) };
    const { service } = serviceWithRepository(repository, { manager, estoque });

    await expect(service.aceitarPedido('pedido-1')).resolves.toMatchObject({
      id: 'pedido-1',
      status: 'esperando_1_pag',
      preco_final: 110.01,
      valor_parcela_1: 55,
      valor_parcela_2: 55.01,
    });
    expect(estoque.baixarPedido).toHaveBeenCalledTimes(1);
    expect(saved).toContainEqual(expect.objectContaining({
      dados: expect.objectContaining({
        status: 'esperando_1_pag',
        precoFinal: 110.01,
        valorParcela1: 55,
        valorParcela2: 55.01,
      }),
    }));
  });

  it('faz rollback sem baixar estoque quando a transacao falha', async () => {
    const pedido = {
      id: 'pedido-1',
      status: 'em_analise',
      precoFinal: null,
      valorParcela1: null,
      valorParcela2: null,
      motivoRecusaCancelamento: null,
      conjuntos: [],
    };
    const estoque = { baixarPedido: vi.fn().mockRejectedValue(new Error('falha no estoque')) };
    const manager = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(pedido)
        .mockResolvedValueOnce(pedido),
      save: vi.fn(),
    };
    const dataSource = {
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(manager)),
    };
    const service = new PedidosService(
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      estoque as never,
    );

    await expect(service.aceitarPedido('pedido-1'))
      .rejects.toThrow('falha no estoque');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
