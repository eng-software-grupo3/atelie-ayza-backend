import { BadRequestException } from '@nestjs/common';
import { ModalidadeFrete, Tamanho } from './entities/enums.js';

export const MAX_CONJUNTOS = 6;
const MAX_ADERECOS_POR_PECA = 30;
const MAX_OBSERVACAO = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SEM_NUMERO = /^s\/?n$/i;

export type AderecoAplicadoValidado = {
  idAdereco: string;
  coordenadaX: number;
  coordenadaY: number;
};

export type PecaValidada = {
  idModelo: string;
  tamanho: Tamanho;
  aderecos: AderecoAplicadoValidado[];
};

export type ConjuntoValidado = {
  idTecido: string;
  observacao: string | null;
  cima: PecaValidada;
  baixo: PecaValidada;
};

export type EnderecoValidado = {
  cep: string;
  numero: string;
  complemento: string | null;
  /** Só vale quando o ViaCEP não traz a rua (CEP único da cidade). */
  rua: string | null;
  /** Só vale quando o ViaCEP não traz o bairro. */
  bairro: string | null;
};

export type PedidoValidado = {
  telefone: string;
  endereco: EnderecoValidado;
  modalidadeFrete: ModalidadeFrete;
  dataEntregaPrevista: string;
  conjuntos: ConjuntoValidado[];
};

type Objeto = Record<string, unknown>;

function invalido(campo: string): never {
  throw new BadRequestException(`${campo} inválido`);
}

function objeto(valor: unknown, campo: string): Objeto {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) invalido(campo);
  return valor as Objeto;
}

function texto(valor: unknown, campo: string, max: number): string {
  if (typeof valor !== 'string') invalido(campo);
  const limpo = valor.trim();
  if (!limpo || limpo.length > max) invalido(campo);
  return limpo;
}

function textoOpcional(valor: unknown, campo: string, max: number): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') invalido(campo);
  const limpo = valor.trim();
  if (!limpo) return null;
  if (limpo.length > max) invalido(campo);
  return limpo;
}

function uuid(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) invalido(campo);
  return valor.toLowerCase();
}

// Data de calendário como texto YYYY-MM-DD, sem fuso.
function dataReal(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !DATA.test(valor)) invalido(campo);
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    teste.getUTCFullYear() !== ano ||
    teste.getUTCMonth() !== mes - 1 ||
    teste.getUTCDate() !== dia
  ) {
    invalido(campo);
  }
  return valor;
}

function telefone(valor: unknown): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') invalido('telefone');
  const digitos = String(valor).replace(/\D/g, '');
  if (!/^[1-9]\d{9,10}$/.test(digitos)) invalido('telefone');
  return digitos;
}

// Coordenada em proporção da imagem (0 a 1), com até 4 casas.
function coordenada(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 1) {
    invalido(campo);
  }
  if (Math.round(valor * 10000) / 10000 !== valor) invalido(campo);
  return valor;
}

// Cidade e estado não são lidos do corpo: vêm do ViaCEP (PedidosService).
function endereco(valor: unknown): EnderecoValidado {
  const e = objeto(valor, 'endereco');
  const cepTexto = typeof e.cep === 'string' ? e.cep.trim() : '';
  if (!/^\d{5}-?\d{3}$/.test(cepTexto)) invalido('endereco.cep');
  const numero = texto(e.numero, 'endereco.numero', 20);
  return {
    cep: cepTexto.replace('-', ''),
    numero: SEM_NUMERO.test(numero) ? 'S/N' : numero,
    complemento: textoOpcional(e.complemento, 'endereco.complemento', 250),
    rua: textoOpcional(e.rua, 'endereco.rua', 150),
    bairro: textoOpcional(e.bairro, 'endereco.bairro', 100),
  };
}

function peca(valor: unknown, campo: string): PecaValidada {
  const p = objeto(valor, campo);
  const tamanho = Object.values(Tamanho).find((t) => t === p.tamanho);
  if (!tamanho) invalido(`${campo}.tamanho`);
  const bruto = p.aderecos ?? [];
  if (!Array.isArray(bruto) || bruto.length > MAX_ADERECOS_POR_PECA) {
    invalido(`${campo}.aderecos`);
  }
  return {
    idModelo: uuid(p.id_modelo, `${campo}.id_modelo`),
    tamanho,
    aderecos: bruto.map((item, i) => {
      const caminho = `${campo}.aderecos[${i}]`;
      const a = objeto(item, caminho);
      return {
        idAdereco: uuid(a.id_adereco, `${caminho}.id_adereco`),
        coordenadaX: coordenada(a.coordenada_x, `${caminho}.coordenada_x`),
        coordenadaY: coordenada(a.coordenada_y, `${caminho}.coordenada_y`),
      };
    }),
  };
}

function conjunto(valor: unknown, indice: number): ConjuntoValidado {
  const campo = `conjuntos[${indice}]`;
  const c = objeto(valor, campo);
  return {
    idTecido: uuid(c.id_tecido, `${campo}.id_tecido`),
    observacao: textoOpcional(c.observacao, `${campo}.observacao`, MAX_OBSERVACAO),
    cima: peca(c.cima, `${campo}.cima`),
    baixo: peca(c.baixo, `${campo}.baixo`),
  };
}

// Valida e normaliza o corpo de POST /api/pedidos. Campos extras (preços, status, cidade, estado) são ignorados.
export function validarCriarPedido(corpo: unknown): PedidoValidado {
  const c = objeto(corpo, 'corpo');
  const modalidadeFrete = Object.values(ModalidadeFrete).find((m) => m === c.modalidade_frete);
  if (!modalidadeFrete) invalido('modalidade_frete');
  const lista = c.conjuntos;
  if (!Array.isArray(lista) || lista.length < 1 || lista.length > MAX_CONJUNTOS) {
    invalido('conjuntos');
  }
  return {
    telefone: telefone(c.telefone),
    endereco: endereco(c.endereco),
    modalidadeFrete,
    dataEntregaPrevista: dataReal(c.data_entrega_prevista, 'data_entrega_prevista'),
    conjuntos: lista.map((item, i) => conjunto(item, i)),
  };
}