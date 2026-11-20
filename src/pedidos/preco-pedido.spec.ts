import { describe, expect, it } from 'vitest';
import { calcularPrecoPedido, type ConjuntoParaPreco } from './preco-pedido.js';

// Dados do seed: Cortininha (40; 0,4 m), Asa Larga (40; 0,4 m), Faixa (45; 0,5 m),
// Lateral Fina (45; 0,45 m), Lycra Lisa Rosa (35/m), Pérola (2) e Strass (1,5).
const comAderecos: ConjuntoParaPreco = {
  valorCima: 40,
  valorBaixo: 40,
  metragemCima: 0.4,
  metragemBaixo: 0.4,
  precoMetroTecido: 35,
  precosAderecos: [2, 1.5, 1.5],
};

const semAderecos: ConjuntoParaPreco = {
  valorCima: 45,
  valorBaixo: 45,
  metragemCima: 0.5,
  metragemBaixo: 0.45,
  precoMetroTecido: 35,
  precosAderecos: [],
};

describe('calcularPrecoPedido', () => {
  it('conjunto com adereços: modelos + tecido + adereços', () => {
    const result = calcularPrecoPedido([comAderecos], 0);
    expect(result.conjuntos).toEqual([113]);
    expect(result.subtotal).toBe(113);
    expect(result.total).toBe(113);
  });

  it('conjunto sem adereços, com metragem fracionada', () => {
    expect(calcularPrecoPedido([semAderecos], 0).conjuntos).toEqual([123.25]);
  });

  it('soma vários conjuntos e acrescenta o frete só no total', () => {
    const result = calcularPrecoPedido([comAderecos, semAderecos], 29.67);
    expect(result.conjuntos).toEqual([113, 123.25]);
    expect(result.subtotal).toBe(236.25);
    expect(result.total).toBe(265.92);
  });

  it('frete zero (Floriano) não altera o total', () => {
    expect(calcularPrecoPedido([semAderecos], 0).total).toBe(123.25);
  });

  it('arredonda meio centavo do tecido para cima', () => {
    const meioCentavo: ConjuntoParaPreco = {
      valorCima: 0,
      valorBaixo: 0,
      metragemCima: 0.01,
      metragemBaixo: 0.01,
      precoMetroTecido: 0.25,
      precosAderecos: [],
    };
    expect(calcularPrecoPedido([meioCentavo], 0).conjuntos).toEqual([0.01]);
  });

  it('não acumula erro de ponto flutuante', () => {
    const flutuante: ConjuntoParaPreco = {
      valorCima: 0.1,
      valorBaixo: 0.2,
      metragemCima: 0,
      metragemBaixo: 0.01,
      precoMetroTecido: 0,
      precosAderecos: [1.15],
    };
    expect(calcularPrecoPedido([flutuante], 0).conjuntos).toEqual([1.45]);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejeita valor inválido (%s)', (valor) => {
    expect(() => calcularPrecoPedido([{ ...semAderecos, valorCima: valor }], 0)).toThrow(RangeError);
    expect(() => calcularPrecoPedido([semAderecos], valor)).toThrow(RangeError);
  });
});