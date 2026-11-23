import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PedidosService } from './pedidos.service.js';

const cliente = { id: 'cliente-1' };

function serviceWithRepository(repository: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> }) {
  const dataSource = { getRepository: vi.fn(() => repository) };
  return { service: new PedidosService(dataSource as never, {} as never, {} as never), dataSource };
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
});
