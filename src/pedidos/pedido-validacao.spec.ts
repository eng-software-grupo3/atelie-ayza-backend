import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validarCriarPedido } from './pedido-validacao.js';

const ID_TECIDO = '00000000-0000-4000-8000-0000000000d1';
const ID_MODELO_CIMA = '00000000-0000-4000-8000-0000000000d2';
const ID_MODELO_BAIXO = '00000000-0000-4000-8000-0000000000d3';
const ID_ADERECO = '00000000-0000-4000-8000-0000000000d4';

const aderecoValido = () => ({ id_adereco: ID_ADERECO, coordenada_x: 0.25, coordenada_y: 0.4 });

const conjuntoValido = () => ({
  id_tecido: ID_TECIDO,
  observacao: '  Busto 94cm  ',
  cima: { id_modelo: ID_MODELO_CIMA, tamanho: 'M', aderecos: [aderecoValido()] },
  baixo: { id_modelo: ID_MODELO_BAIXO, tamanho: 'P' },
});

const enderecoValido = () => ({
  cep: '58400-000',
  rua: ' Rua das Flores ',
  numero: '10',
  complemento: '',
  bairro: 'Centro',
  cidade: 'Campina Grande',
  estado: 'pb',
});

const corpoValido = () => ({
  telefone: '(83) 99999-0000',
  endereco: enderecoValido(),
  modalidade_frete: 'padrao',
  data_entrega_prevista: '2026-11-27',
  conjuntos: [conjuntoValido()],
});

const base = corpoValido();
const conjunto = conjuntoValido();
const comEndereco = (alteracao: object) => ({ ...base, endereco: { ...base.endereco, ...alteracao } });
const comConjunto = (alteracao: object) => ({ ...base, conjuntos: [{ ...conjunto, ...alteracao }] });
const comCima = (alteracao: object) => comConjunto({ cima: { ...conjunto.cima, ...alteracao } });
const comBaixo = (alteracao: object) => comConjunto({ baixo: { ...conjunto.baixo, ...alteracao } });
const comCoordenada = (alteracao: object) =>
  comCima({ aderecos: [{ ...aderecoValido(), ...alteracao }] });

describe('validarCriarPedido', () => {
  it('normaliza um corpo válido', () => {
    expect(validarCriarPedido(corpoValido())).toEqual({
      telefone: '83999990000',
      endereco: {
        cep: '58400000',
        rua: 'Rua das Flores',
        numero: '10',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Campina Grande',
        estado: 'PB',
      },
      modalidadeFrete: 'padrao',
      dataEntregaPrevista: '2026-11-27',
      conjuntos: [
        {
          idTecido: ID_TECIDO,
          observacao: 'Busto 94cm',
          cima: {
            idModelo: ID_MODELO_CIMA,
            tamanho: 'M',
            aderecos: [{ idAdereco: ID_ADERECO, coordenadaX: 0.25, coordenadaY: 0.4 }],
          },
          baixo: { idModelo: ID_MODELO_BAIXO, tamanho: 'P', aderecos: [] },
        },
      ],
    });
  });

  it('aceita o máximo de 6 conjuntos', () => {
    const corpo = { ...corpoValido(), conjuntos: Array.from({ length: 6 }, conjuntoValido) };
    expect(validarCriarPedido(corpo).conjuntos).toHaveLength(6);
  });

  it('ignora campos extras como preços e status', () => {
    const corpo = { ...corpoValido(), preco_final: 1, status: 'concluido' };
    const result = validarCriarPedido(corpo);
    expect(result).not.toHaveProperty('preco_final');
    expect(result).not.toHaveProperty('status');
  });

  it('lança BadRequestException com o nome do campo', () => {
    expect(() => validarCriarPedido({ ...base, telefone: '123' })).toThrow(BadRequestException);
    expect(() => validarCriarPedido({ ...base, telefone: '123' })).toThrow('telefone inválido');
  });

  const casos: Array<[string, unknown, string]> = [
    ['corpo nulo', null, 'corpo'],
    ['telefone curto', { ...base, telefone: '123' }, 'telefone'],
    ['telefone com letras', { ...base, telefone: '83abc9999' }, 'telefone'],
    ['cep com 7 dígitos', comEndereco({ cep: '5840000' }), 'endereco.cep'],
    ['cep com letras', comEndereco({ cep: '5840A-000' }), 'endereco.cep'],
    ['estado inexistente', comEndereco({ estado: 'XX' }), 'endereco.estado'],
    ['estado com 3 letras', comEndereco({ estado: 'PBB' }), 'endereco.estado'],
    ['rua vazia', comEndereco({ rua: '  ' }), 'endereco.rua'],
    ['numero ausente', comEndereco({ numero: undefined }), 'endereco.numero'],
    ['complemento muito longo', comEndereco({ complemento: 'x'.repeat(101) }), 'endereco.complemento'],
    ['modalidade inexistente', { ...base, modalidade_frete: 'retirada' }, 'modalidade_frete'],
    ['data inexistente', { ...base, data_entrega_prevista: '2026-02-30' }, 'data_entrega_prevista'],
    ['data em outro formato', { ...base, data_entrega_prevista: '27/11/2026' }, 'data_entrega_prevista'],
    ['sem conjuntos', { ...base, conjuntos: [] }, 'conjuntos'],
    ['mais de 6 conjuntos', { ...base, conjuntos: Array.from({ length: 7 }, conjuntoValido) }, 'conjuntos'],
    ['conjuntos não é lista', { ...base, conjuntos: {} }, 'conjuntos'],
    ['id_tecido fora do formato', comConjunto({ id_tecido: 'abc' }), 'conjuntos[0].id_tecido'],
    ['id_modelo de baixo fora do formato', comBaixo({ id_modelo: '123' }), 'conjuntos[0].baixo.id_modelo'],
    ['tamanho inexistente', comCima({ tamanho: 'XG' }), 'conjuntos[0].cima.tamanho'],
    ['aderecos não é lista', comBaixo({ aderecos: 'perola' }), 'conjuntos[0].baixo.aderecos'],
    ['coordenada_x acima de 1', comCoordenada({ coordenada_x: 1.5 }), 'conjuntos[0].cima.aderecos[0].coordenada_x'],
    ['coordenada_y negativa', comCoordenada({ coordenada_y: -0.1 }), 'conjuntos[0].cima.aderecos[0].coordenada_y'],
    ['coordenada com 5 casas', comCoordenada({ coordenada_x: 0.12345 }), 'conjuntos[0].cima.aderecos[0].coordenada_x'],
    ['coordenada como texto', comCoordenada({ coordenada_x: '0.5' }), 'conjuntos[0].cima.aderecos[0].coordenada_x'],
    ['observacao muito longa', comConjunto({ observacao: 'x'.repeat(501) }), 'conjuntos[0].observacao'],
    [
      'mais de 30 adereços',
      comCima({ aderecos: Array.from({ length: 31 }, aderecoValido) }),
      'conjuntos[0].cima.aderecos',
    ],
  ];

  it.each(casos)('rejeita %s', (_nome, corpo, campo) => {
    expect(() => validarCriarPedido(corpo)).toThrow(`${campo} inválido`);
  });
});