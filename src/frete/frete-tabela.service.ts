import { Injectable } from '@nestjs/common';
import { ModalidadeFrete } from '../pedidos/entities/enums.js';
import {
  CIDADE_ATELIE,
  NORDESTE,
  TABELA_FRETE,
  UF_ATELIE,
  type ZonaFrete,
} from './frete.config.js';
import { FreteService, type CotacaoFrete, type DestinoFrete } from './frete.service.js';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Cotação provisória por zona de destino. Troca por outra implementação sem mexer em quem usa FreteService.
@Injectable()
export class FreteTabelaService extends FreteService {
  async cotar(destino: DestinoFrete): Promise<CotacaoFrete[]> {
    const tabela: Partial<Record<ModalidadeFrete, { preco: number; prazo_frete_dias: number }>> =
      TABELA_FRETE[this.zona(destino)];
    const cotacoes: CotacaoFrete[] = [];
    for (const modalidade of Object.values(ModalidadeFrete)) {
      const item = tabela[modalidade];
      if (item) cotacoes.push({ modalidade, ...item });
    }
    return cotacoes;
  }

  private zona(destino: DestinoFrete): ZonaFrete {
    const uf = destino.estado.trim().toUpperCase();
    if (uf === UF_ATELIE && normalizar(destino.cidade) === CIDADE_ATELIE) return 'cidade';
    if (uf === UF_ATELIE) return 'estado';
    if (NORDESTE.includes(uf)) return 'nordeste';
    return 'brasil';
  }
}