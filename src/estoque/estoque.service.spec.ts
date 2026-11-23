import { describe, expect, it, vi } from 'vitest';
import { EstoqueService } from './estoque.service.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { MovimentacaoEstoque } from './entities/movimentacao-estoque.entity.js';

describe('EstoqueService baixa por pedido', () => {
  it('calcula o consumo agregado de tecidos e aderecos', async () => {
    const tecido = { id: 'tecido-1', nome: 'Algodao', quantidadeM: 5 };
    const adereco = { id: 'adereco-1', nome: 'Laco', quantidade: 3 };
    const pedido = {
      id: 'pedido-1',
      conjuntos: [
        {
          tecido,
          pecaCima: {
            modelo: { metragemMediaM: 1.25 },
            adereco: [{ adereco }, { adereco }],
          },
          pecaBaixo: {
            modelo: { metragemMediaM: 0.75 },
            adereco: [{ adereco }],
          },
        },
      ],
    };
    const saved: Array<{ entidade: unknown; dados: unknown }> = [];
    const manager = {
      findOne: vi.fn(async (entidade: unknown, options: { where: { id: string } }) => {
        if (entidade === Tecido) return { ...tecido };
        if (entidade === Adereco) return { ...adereco };
        return null;
      }),
      save: vi.fn(async (entidade: unknown, dados: unknown) => {
        saved.push({ entidade, dados });
        return dados;
      }),
    };

    await new EstoqueService().baixarPedido(manager as never, pedido as never);

    expect(saved).toContainEqual({
      entidade: Tecido,
      dados: expect.objectContaining({ id: 'tecido-1', quantidadeM: 3 }),
    });
    expect(saved).toContainEqual({
      entidade: Adereco,
      dados: expect.objectContaining({ id: 'adereco-1', quantidade: 0 }),
    });
    expect(saved.filter((item) => item.entidade === MovimentacaoEstoque)).toHaveLength(2);
  });

  it('permite que o estoque fique negativo apos o desconto', async () => {
    const tecido = { id: 'tecido-1', nome: 'Algodao', quantidadeM: 1 };
    const pedido = {
      id: 'pedido-1',
      conjuntos: [{
        tecido,
        pecaCima: { modelo: { metragemMediaM: 1.25 }, adereco: [] },
        pecaBaixo: { modelo: { metragemMediaM: 0.75 }, adereco: [] },
      }],
    };
    const saved: Array<{ entidade: unknown; dados: unknown }> = [];
    const manager = {
      findOne: vi.fn(async (entidade: unknown) => entidade === Tecido ? ({ ...tecido }) : null),
      save: vi.fn(async (entidade: unknown, dados: unknown) => {
        saved.push({ entidade, dados });
        return dados;
      }),
    };

    await new EstoqueService().baixarPedido(manager as never, pedido as never);

    expect(saved).toContainEqual({
      entidade: Tecido,
      dados: expect.objectContaining({ quantidadeM: -1 }),
    });
  });
});
