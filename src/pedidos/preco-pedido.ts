export type ConjuntoParaPreco = {
  valorCima: number;
  valorBaixo: number;
  metragemCima: number;
  metragemBaixo: number;
  precoMetroTecido: number;
  /** Um preço por unidade de adereço aplicada (adereço repetido entra repetido). */
  precosAderecos: number[];
};

export type PrecoPedido = {
  /** Preço de cada conjunto, na mesma ordem da entrada. */
  conjuntos: number[];
  subtotal: number;
  total: number;
};

// Valores com 2 casas (reais ou metros) viram inteiros em centésimos.
function centesimos(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`valor inválido para o cálculo de preço: ${valor}`);
  }
  return Math.round(valor * 100);
}

function precoConjuntoCentavos(c: ConjuntoParaPreco): number {
  const modelos = centesimos(c.valorCima) + centesimos(c.valorBaixo);
  const metragem = centesimos(c.metragemCima) + centesimos(c.metragemBaixo);
  // centavos por metro × centésimos de metro ÷ 100, arredondado meio para cima
  const tecido = Math.floor((centesimos(c.precoMetroTecido) * metragem + 50) / 100);
  const aderecos = c.precosAderecos.reduce((soma, preco) => soma + centesimos(preco), 0);
  return modelos + tecido + aderecos;
}

export function calcularPrecoPedido(
  conjuntos: ConjuntoParaPreco[],
  precoFrete: number,
): PrecoPedido {
  const centavos = conjuntos.map(precoConjuntoCentavos);
  const subtotal = centavos.reduce((soma, valor) => soma + valor, 0);
  return {
    conjuntos: centavos.map((valor) => valor / 100),
    subtotal: subtotal / 100,
    total: (subtotal + centesimos(precoFrete)) / 100,
  };
}