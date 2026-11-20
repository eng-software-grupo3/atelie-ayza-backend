import { ModalidadeFrete } from '../pedidos/entities/enums.js';

type PrecoFrete = { preco: number; prazo_frete_dias: number };

export const CIDADE_ATELIE = 'floriano';
export const UF_ATELIE = 'PI';
export const NORDESTE = ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];

// VALORES DE EXEMPLO: substituir pelos reais informados pela gestora.
// Floriano só tem a modalidade padrão, grátis.
export const TABELA_FRETE = {
  cidade: {
    [ModalidadeFrete.PADRAO]: { preco: 0, prazo_frete_dias: 0 },
  },
  estado: {
    [ModalidadeFrete.PADRAO]: { preco: 18, prazo_frete_dias: 5 },
    [ModalidadeFrete.SEDEX]: { preco: 32, prazo_frete_dias: 2 },
  },
  nordeste: {
    [ModalidadeFrete.PADRAO]: { preco: 26, prazo_frete_dias: 7 },
    [ModalidadeFrete.SEDEX]: { preco: 48, prazo_frete_dias: 3 },
  },
  brasil: {
    [ModalidadeFrete.PADRAO]: { preco: 35, prazo_frete_dias: 10 },
    [ModalidadeFrete.SEDEX]: { preco: 60, prazo_frete_dias: 4 },
  },
} satisfies Record<string, Partial<Record<ModalidadeFrete, PrecoFrete>>>;

export type ZonaFrete = keyof typeof TABELA_FRETE;