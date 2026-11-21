import { describe, expect, it } from 'vitest';
import { ModalidadeFrete } from '../pedidos/entities/enums.js';
import { TABELA_FRETE } from './frete.config.js';
import { FreteTabelaService } from './frete-tabela.service.js';

const service = new FreteTabelaService();
const destino = (cidade: string, estado: string) => ({ cep: '64800000', cidade, estado, conjuntos: 1 });

describe('FreteTabelaService', () => {
  it('Floriano: só a modalidade padrão, grátis', async () => {
    expect(await service.cotar(destino('Floriano', 'PI'))).toEqual([
      { modalidade: ModalidadeFrete.PADRAO, ...TABELA_FRETE.cidade.padrao },
    ]);
    expect(TABELA_FRETE.cidade.padrao.preco).toBe(0);
  });

  it('ignora caixa e espaços em Floriano e no estado', async () => {
    const result = await service.cotar(destino('  FLORIANO ', 'pi'));
    expect(result).toHaveLength(1);
    expect(result[0].preco).toBe(0);
  });

  it('outra cidade do Piauí', async () => {
    expect(await service.cotar(destino('Teresina', 'PI'))).toEqual([
      { modalidade: ModalidadeFrete.PADRAO, ...TABELA_FRETE.estado.padrao },
      { modalidade: ModalidadeFrete.SEDEX, ...TABELA_FRETE.estado.sedex },
    ]);
  });

  it('Nordeste fora do Piauí', async () => {
    expect(await service.cotar(destino('Campina Grande', 'PB'))).toEqual([
      { modalidade: ModalidadeFrete.PADRAO, ...TABELA_FRETE.nordeste.padrao },
      { modalidade: ModalidadeFrete.SEDEX, ...TABELA_FRETE.nordeste.sedex },
    ]);
  });

  it('resto do país', async () => {
    expect(await service.cotar(destino('São Paulo', 'SP'))).toEqual([
      { modalidade: ModalidadeFrete.PADRAO, ...TABELA_FRETE.brasil.padrao },
      { modalidade: ModalidadeFrete.SEDEX, ...TABELA_FRETE.brasil.sedex },
    ]);
  });

  it('uma cidade chamada Floriano em outro estado não é grátis', async () => {
    const result = await service.cotar(destino('Floriano', 'SP'));
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.preco > 0)).toBe(true);
  });
});