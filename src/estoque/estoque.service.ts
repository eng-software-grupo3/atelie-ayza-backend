import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { MovimentacaoEstoque, TipoMovimentacao } from './entities/movimentacao-estoque.entity.js';
import { Pedido } from '../pedidos/entities/pedido.entity.js';

@Injectable()
export class EstoqueService {
  async baixarPedido(manager: EntityManager, pedido: Pedido): Promise<void> {
    const tecidos = new Map<string, { tecido: Tecido; quantidade: number }>();
    const aderecos = new Map<string, { adereco: Adereco; quantidade: number }>();

    for (const conjunto of pedido.conjuntos ?? []) {
      for (const peca of [conjunto.pecaCima, conjunto.pecaBaixo]) {
        const tecido = conjunto.tecido;
        const consumo = peca.modelo.metragemMediaM;
        const atual = tecidos.get(tecido.id);
        tecidos.set(tecido.id, {
          tecido,
          quantidade: (atual?.quantidade ?? 0) + consumo,
        });

        for (const aplicacao of peca.adereco ?? []) {
          const adereco = aplicacao.adereco;
          const atualAdereco = aderecos.get(adereco.id);
          aderecos.set(adereco.id, {
            adereco,
            quantidade: (atualAdereco?.quantidade ?? 0) + 1,
          });
        }
      }
    }

    const tecidosBloqueados = new Map<string, Tecido>();
    for (const id of [...tecidos.keys()].sort()) {
      const consumo = tecidos.get(id)!;
      const tecido = await manager.findOne(Tecido, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tecido) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'estoque_item_inexistente',
          message: 'Tecido do pedido não existe mais',
          itens: [{ tipo: 'tecido', id, nome: consumo.tecido.nome }],
        });
      }
      tecidosBloqueados.set(id, tecido);
    }

    const aderecosBloqueados = new Map<string, Adereco>();
    for (const id of [...aderecos.keys()].sort()) {
      const consumo = aderecos.get(id)!;
      const adereco = await manager.findOne(Adereco, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adereco) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'estoque_item_inexistente',
          message: 'Adereço do pedido não existe mais',
          itens: [{ tipo: 'adereco', id, nome: consumo.adereco.nome }],
        });
      }
      aderecosBloqueados.set(id, adereco);
    }

    for (const id of [...tecidos.keys()].sort()) {
      const consumo = tecidos.get(id)!;
      const tecido = tecidosBloqueados.get(id)!;
      tecido.quantidadeM = Number((tecido.quantidadeM - consumo.quantidade).toFixed(2));
      await manager.save(Tecido, tecido);
      await manager.save(MovimentacaoEstoque, {
        tecido,
        adereco: null,
        tipo: TipoMovimentacao.BAIXA_PEDIDO,
        quantidade: Number(consumo.quantidade.toFixed(2)),
        pedido,
        observacao: null,
      });
    }

    for (const id of [...aderecos.keys()].sort()) {
      const consumo = aderecos.get(id)!;
      const adereco = aderecosBloqueados.get(id)!;
      adereco.quantidade -= consumo.quantidade;
      await manager.save(Adereco, adereco);
      await manager.save(MovimentacaoEstoque, {
        tecido: null,
        adereco,
        tipo: TipoMovimentacao.BAIXA_PEDIDO,
        quantidade: consumo.quantidade,
        pedido,
        observacao: null,
      });
    }
  }
}
