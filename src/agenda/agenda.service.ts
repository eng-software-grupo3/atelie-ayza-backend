import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { StatusPedido } from '../pedidos/entities/enums.js';
import { Pedido } from '../pedidos/entities/pedido.entity.js';
import { AgendaOcupado } from './entities/agenda-ocupado.entity.js';

// Pedidos recusados e cancelados liberam a data (RF-06 e RF-13)
const INATIVOS = [StatusPedido.RECUSADO, StatusPedido.CANCELADO];
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Datas são tratadas como string YYYY-MM-DD, sem fuso, para o dia não deslocar.
function assertDate(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !DATA.test(value)) {
    throw new BadRequestException('data inválida');
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new BadRequestException('data inválida');
  }
}

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaOcupado) private readonly ocupado: Repository<AgendaOcupado>,
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
  ) {}

  // RF-10: calendário do mês
  async calendar(mes: unknown) {
    if (typeof mes !== 'string' || !MES.test(mes)) {
      throw new BadRequestException('mes inválido');
    }
    const year = Number(mes.slice(0, 4));
    const month = Number(mes.slice(5, 7));
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const first = `${mes}-01`;
    const last = `${mes}-${String(total).padStart(2, '0')}`;

    const [bloqueadas, entregas] = await Promise.all([
      this.ocupado.find({ where: { data: Between(first, last) } }),
      this.pedidos.find({
        select: { id: true, dataEntregaPrevista: true },
        where: { dataEntregaPrevista: Between(first, last), status: Not(In(INATIVOS)) },
      }),
    ]);

    const blocked = new Set(bloqueadas.map((b) => b.data));
    const counts = new Map<string, number>();
    for (const p of entregas) {
      counts.set(p.dataEntregaPrevista, (counts.get(p.dataEntregaPrevista) ?? 0) + 1);
    }

    const dias = Array.from({ length: total }, (_, i) => {
      const data = `${mes}-${String(i + 1).padStart(2, '0')}`;
      const qtd = counts.get(data) ?? 0;
      const estado = blocked.has(data) ? 'bloqueada' : qtd > 0 ? 'com_entrega' : 'disponivel';
      return { data, estado, qtd_pedidos: qtd };
    });
    return { mes, dias };
  }

  // RF-10: pedidos com entrega prevista em uma data
  async ordersOn(data: unknown) {
    assertDate(data);
    const pedidos = await this.pedidos.find({
      where: { dataEntregaPrevista: data, status: Not(In(INATIVOS)) },
      relations: { cliente: true, endereco: true },
      order: { numPedido: 'ASC' },
    });
    return pedidos.map((p) => ({
      id: p.id,
      num_pedido: p.numPedido,
      cliente: { id: p.cliente.id, nome: p.cliente.nome },
      status: p.status,
      entrega: {
        modalidade_frete: p.modalidadeFrete,
        endereco: {
          rua: p.endereco.rua,
          numero: p.endereco.numero,
          complemento: p.endereco.complemento,
          bairro: p.endereco.bairro,
          cidade: p.endereco.cidade,
          estado: p.endereco.estado,
          cep: p.endereco.cep,
        },
      },
    }));
  }

  // RF-11: bloquear ou liberar uma data (idempotente)
  async setBlocked(data: unknown, body: Record<string, unknown>) {
    assertDate(data);
    if (typeof body?.bloqueada !== 'boolean') {
      throw new BadRequestException('bloqueada inválido');
    }
    if (body.bloqueada) {
      await this.ocupado.upsert({ data }, ['data']);
    } else {
      await this.ocupado.delete({ data });
    }
    return { data, bloqueada: body.bloqueada };
  }
}