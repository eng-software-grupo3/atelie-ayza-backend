import { ModalidadeFrete } from '../pedidos/entities/enums.js';

export type CotacaoFrete = {
  modalidade: ModalidadeFrete;
  preco: number;
  prazo_frete_dias: number;
};

export type DestinoFrete = {
  cep: string;
  cidade: string;
  estado: string;
  /** Quantidade de conjuntos do pedido (define a embalagem nas implementações reais). */
  conjuntos: number;
};

export abstract class FreteService {
  abstract cotar(destino: DestinoFrete): Promise<CotacaoFrete[]>;
}