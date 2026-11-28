import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AgendaOcupado } from '../agenda/entities/agenda-ocupado.entity.js';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { Modelo } from '../catalogo/entities/modelo.entity.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { Endereco } from '../pessoas/entities/endereco.entity.js';
import { AderecoPeca } from './entities/adereco-peca.entity.js';
import { Conjunto } from './entities/conjunto.entity.js';
import { ModalidadeFrete } from './entities/enums.js';
import { HistoricoStatus } from './entities/historico-status.entity.js';
import { Peca } from './entities/peca.entity.js';
import { Pedido } from './entities/pedido.entity.js';
import { PedidosService } from './pedidos.service.js';

const ID_TECIDO = '00000000-0000-4000-8000-0000000000e1';
const ID_CIMA = '00000000-0000-4000-8000-0000000000e2';
const ID_BAIXO = '00000000-0000-4000-8000-0000000000e3';
const ID_ADERECO = '00000000-0000-4000-8000-0000000000e4';

const usuario = { id: 'u1', nome: 'Ana' };
const modeloCima = { id: ID_CIMA, parte: 'CIMA', valor: 40, metragemMediaM: 0.4 };
const modeloBaixo = { id: ID_BAIXO, parte: 'BAIXO', valor: 40, metragemMediaM: 0.4 };
const tecido = { id: ID_TECIDO, precoMetro: 35 };
const adereco = { id: ID_ADERECO, preco: 2 };
const cotacoes = [{ modalidade: ModalidadeFrete.PADRAO, preco: 29.67, prazo_frete_dias: 7 }];

const viacepCampina = {
  cep: '58400100',
  logradouro: 'Rua Maciel Pinheiro',
  bairro: 'Centro',
  cidade: 'Campina Grande',
  estado: 'PB',
};
// CEP único da cidade: o ViaCEP não traz rua nem bairro.
const viacepUnico = {
  cep: '12345000',
  logradouro: null,
  bairro: null,
  cidade: 'Cidadezinha',
  estado: 'PI',
};

const corpo = () => ({
  telefone: '83999990000',
  endereco: { cep: '58400-100', numero: '10', complemento: null },
  modalidade_frete: 'padrao',
  data_entrega_prevista: '2026-11-27',
  conjuntos: [
    {
      id_tecido: ID_TECIDO,
      observacao: 'Busto 94cm',
      cima: {
        id_modelo: ID_CIMA,
        tamanho: 'M',
        aderecos: [{ id_adereco: ID_ADERECO, coordenada_x: 0.25, coordenada_y: 0.4 }],
      },
      baixo: { id_modelo: ID_BAIXO, tamanho: 'P', aderecos: [] },
    },
  ],
});

const comEndereco = (alteracao: object) => ({
  ...corpo(),
  endereco: { ...corpo().endereco, ...alteracao },
});

type Opcoes = {
  minima?: string;
  bloqueada?: boolean;
  modelos?: object[];
  tecidos?: object[];
  aderecos?: object[];
  viacep?: object;
  cepErro?: Error;
  cotar?: () => Promise<unknown>;
};

function setup(opcoes: Opcoes = {}) {
  const {
    minima = '2026-11-26',
    bloqueada = false,
    modelos = [modeloCima, modeloBaixo],
    tecidos = [tecido],
    aderecos = [adereco],
    viacep = viacepCampina,
  } = opcoes;
  const salvos: Array<{ entidade: unknown; dados: unknown }> = [];
  let sequencia = 0;
  const manager = {
    find: vi.fn(async (entidade: unknown) => {
      if (entidade === Modelo) return modelos;
      if (entidade === Tecido) return tecidos;
      if (entidade === Adereco) return aderecos;
      return [];
    }),
    query: vi.fn(async () => [{ minima }]),
    count: vi.fn(async (entidade: unknown) => (entidade === AgendaOcupado && bloqueada ? 1 : 0)),
    save: vi.fn(async (entidade: unknown, dados: unknown) => {
      salvos.push({ entidade, dados });
      if (Array.isArray(dados)) return dados;
      sequencia += 1;
      return { ...(dados as object), id: `id-${sequencia}`, numPedido: 13 };
    }),
  };
  const dataSource = {
    transaction: vi.fn(async (executar: (m: typeof manager) => unknown) => executar(manager)),
  };
  const frete = { cotar: vi.fn(opcoes.cotar ?? (async () => cotacoes)) };
  const config = { get: vi.fn(() => '3') };
  const cep = {
    consultar: vi.fn(async () => {
      if (opcoes.cepErro) throw opcoes.cepErro;
      return viacep;
    }),
  };
  const estoque = { baixarPedido: vi.fn() };
  const service = new PedidosService(
    dataSource as never,
    frete as never,
    config as never,
    cep as never,
    estoque as never,
  );
  return { service, manager, dataSource, frete, cep, salvos };
}

const criar = (service: PedidosService, dados: unknown = corpo()) =>
  service.create(usuario as never, dados);

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  return promessa.then(
    () => {
      throw new Error('esperava um erro');
    },
    (erro: unknown) => erro,
  );
}

describe('PedidosService.create', () => {
  it('cria o pedido, recalcula os valores e grava tudo na ordem', async () => {
    const { service, salvos, frete } = setup();
    const result = await criar(service);

    expect(result).toEqual({
      id: expect.any(String),
      num_pedido: 13,
      status: 'em_analise',
      data_entrega_prevista: '2026-11-27',
      modalidade_frete: 'padrao',
      preco_frete: 29.67,
      prazo_frete_dias: 7,
      preco_final: null,
      conjuntos: [{ id: expect.any(String), preco: 110 }],
    });
    expect(frete.cotar).toHaveBeenCalledWith({
      cep: '58400100',
      cidade: 'Campina Grande',
      estado: 'PB',
      conjuntos: 1,
    });
    expect(salvos.map((s) => s.entidade)).toEqual([
      Endereco, Pedido, Peca, Peca, Conjunto, AderecoPeca, HistoricoStatus,
    ]);
    expect(salvos[1].dados).toMatchObject({
      cliente: usuario,
      status: 'em_analise',
      telefone: '83999990000',
      precoEstimado: 139.67,
      precoFinal: null,
      precoFrete: 29.67,
      prazoFreteDias: 7,
      modalidadeFrete: 'padrao',
      dataEntregaPrevista: '2026-11-27',
    });
    expect(salvos[5].dados).toEqual([
      expect.objectContaining({ coordenadaX: '0.2500', coordenadaY: '0.4000' }),
    ]);
    expect(salvos[6].dados).toMatchObject({ status: 'em_analise', motivo: null });
  });

  it('grava o endereço com os dados do ViaCEP', async () => {
    const { service, salvos, cep } = setup();
    await criar(service);
    expect(cep.consultar).toHaveBeenCalledWith('58400100');
    expect(salvos[0].entidade).toBe(Endereco);
    expect(salvos[0].dados).toEqual({
      cep: '58400100',
      rua: 'Rua Maciel Pinheiro',
      numero: '10',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Campina Grande',
      estado: 'PB',
    });
  });

  it('usa a cidade e o estado do ViaCEP, e não os enviados pelo cliente', async () => {
    const { service, salvos, frete } = setup();
    await criar(service, comEndereco({ cidade: 'Floriano', estado: 'PI' }));
    expect(frete.cotar).toHaveBeenCalledWith(
      expect.objectContaining({ cidade: 'Campina Grande', estado: 'PB' }),
    );
    expect(salvos[0].dados).toMatchObject({ cidade: 'Campina Grande', estado: 'PB' });
  });

  it('a rua e o bairro do ViaCEP prevalecem sobre os enviados', async () => {
    const { service, salvos } = setup();
    await criar(service, comEndereco({ rua: 'Outra Rua', bairro: 'Outro Bairro' }));
    expect(salvos[0].dados).toMatchObject({ rua: 'Rua Maciel Pinheiro', bairro: 'Centro' });
  });

  it('CEP único: usa a rua e o bairro enviados quando o ViaCEP não os traz', async () => {
    const { service, salvos, frete } = setup({ viacep: viacepUnico });
    await criar(service, comEndereco({ cep: '12345-000', rua: 'Rua J', bairro: 'Bom Lugar' }));
    expect(salvos[0].dados).toMatchObject({
      rua: 'Rua J',
      bairro: 'Bom Lugar',
      cidade: 'Cidadezinha',
      estado: 'PI',
    });
    expect(frete.cotar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PI' }));
  });

  it.each([
    ['rua', { bairro: 'Bom Lugar' }],
    ['bairro', { rua: 'Rua J' }],
  ])('CEP único sem %s enviado devolve 400 antes de cotar o frete', async (campo, enviados) => {
    const { service, frete, dataSource } = setup({ viacep: viacepUnico });
    await expect(criar(service, comEndereco({ cep: '12345-000', ...enviados }))).rejects.toThrow(
      `endereco.${campo} obrigatório para este CEP`,
    );
    expect(frete.cotar).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('CEP inexistente devolve 400 sem cotar o frete', async () => {
    const { service, frete, dataSource } = setup({
      cepErro: new BadRequestException('CEP não encontrado'),
    });
    await expect(criar(service)).rejects.toThrow('CEP não encontrado');
    expect(frete.cotar).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('serviço de CEP indisponível devolve 503', async () => {
    const { service } = setup({
      cepErro: new ServiceUnavailableException('Serviço de CEP indisponível'),
    });
    await expect(criar(service)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ignora preços enviados pelo cliente', async () => {
    const { service, salvos } = setup();
    await criar(service, { ...corpo(), preco_final: 1, preco_frete: 0 });
    expect(salvos[1].dados).toMatchObject({ precoFinal: null, precoFrete: 29.67 });
  });

  it('calcula a data mínima com a confecção (3 dias) mais o prazo do frete', async () => {
    const { service, manager } = setup();
    await criar(service);
    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [10]);
  });

  it('aceita a data igual ao mínimo', async () => {
    const { service } = setup({ minima: '2026-11-27' });
    await expect(criar(service)).resolves.toMatchObject({ data_entrega_prevista: '2026-11-27' });
  });

  it('rejeita data anterior ao mínimo sem gravar nada', async () => {
    const { service, salvos } = setup({ minima: '2026-11-30' });
    await expect(criar(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(salvos).toEqual([]);
  });

  it('rejeita data bloqueada com 409 data_indisponivel', async () => {
    const { service, salvos } = setup({ bloqueada: true });
    const erro = await erroDe(criar(service));
    expect(erro).toBeInstanceOf(ConflictException);
    expect((erro as ConflictException).getResponse()).toMatchObject({ code: 'data_indisponivel' });
    expect(salvos).toEqual([]);
  });

  it('rejeita tecido indisponível com 409 item_indisponivel e os ids', async () => {
    const { service, salvos } = setup({ tecidos: [] });
    const erro = await erroDe(criar(service));
    expect(erro).toBeInstanceOf(ConflictException);
    expect((erro as ConflictException).getResponse()).toMatchObject({
      code: 'item_indisponivel',
      ids: [ID_TECIDO],
    });
    expect(salvos).toEqual([]);
  });

  it('rejeita adereço desabilitado ou excluído', async () => {
    const { service } = setup({ aderecos: [] });
    const erro = await erroDe(criar(service));
    expect((erro as ConflictException).getResponse()).toMatchObject({
      code: 'item_indisponivel',
      ids: [ID_ADERECO],
    });
  });

  it('rejeita modelo de cima que não é da parte de cima', async () => {
    const { service } = setup({ modelos: [{ ...modeloCima, parte: 'BAIXO' }, modeloBaixo] });
    await expect(criar(service)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita modalidade não atendida antes de abrir a transação', async () => {
    const { service, dataSource } = setup();
    await expect(criar(service, { ...corpo(), modalidade_frete: 'sedex' })).rejects.toThrow(
      'modalidade_frete não atendida para o CEP',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('devolve 503 quando o serviço de frete falha', async () => {
    const { service } = setup({
      cotar: async () => {
        throw new Error('timeout');
      },
    });
    await expect(criar(service)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejeita corpo inválido sem consultar o CEP nem o frete', async () => {
    const { service, frete, cep } = setup();
    await expect(criar(service, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(cep.consultar).not.toHaveBeenCalled();
    expect(frete.cotar).not.toHaveBeenCalled();
  });
});