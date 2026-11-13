import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AgendaService } from './agenda.service.js';

function setup() {
  const ocupado = { find: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
  const pedidos = { find: vi.fn() };
  const service = new AgendaService(ocupado as never, pedidos as never);
  return { service, ocupado, pedidos };
}

describe('AgendaService', () => {
  describe('calendar', () => {
    it('classifica cada dia do mês', async () => {
      const { service, ocupado, pedidos } = setup();
      ocupado.find.mockResolvedValue([{ data: '2026-11-20' }, { data: '2026-11-25' }]);
      pedidos.find.mockResolvedValue([
        { dataEntregaPrevista: '2026-11-20' },
        { dataEntregaPrevista: '2026-11-20' },
        { dataEntregaPrevista: '2026-11-10' },
      ]);

      const result = await service.calendar('2026-11');
      const dia = (d: string) => result.dias.find((x) => x.data === d);

      expect(result.mes).toBe('2026-11');
      expect(result.dias).toHaveLength(30);
      expect(dia('2026-11-01')).toEqual({ data: '2026-11-01', estado: 'disponivel', qtd_pedidos: 0 });
      expect(dia('2026-11-10')).toEqual({ data: '2026-11-10', estado: 'com_entrega', qtd_pedidos: 1 });
      expect(dia('2026-11-20')).toEqual({ data: '2026-11-20', estado: 'bloqueada', qtd_pedidos: 2 });
      expect(dia('2026-11-25')).toEqual({ data: '2026-11-25', estado: 'bloqueada', qtd_pedidos: 0 });
    });

    it('respeita ano bissexto', async () => {
      const { service, ocupado, pedidos } = setup();
      ocupado.find.mockResolvedValue([]);
      pedidos.find.mockResolvedValue([]);
      expect((await service.calendar('2028-02')).dias).toHaveLength(29);
      expect((await service.calendar('2027-02')).dias).toHaveLength(28);
    });

    it.each([undefined, '', '2026-13', '2026-1', '2026-11-01', 202611])(
      'rejeita mes inválido (%s)',
      async (mes) => {
        const { service } = setup();
        await expect(service.calendar(mes)).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe('ordersOn', () => {
    it('devolve só os campos do contrato', async () => {
      const { service, pedidos } = setup();
      pedidos.find.mockResolvedValue([
        {
          id: 'p1',
          numPedido: 12,
          modalidadeFrete: 'sedex',
          cliente: { id: 'u1', nome: 'Ana', idGoogle: 'segredo', email: 'a@a.com' },
          status: 'em_producao',
          endereco: {
            id: 'e1', rua: 'Rua A', numero: '10', complemento: null,
            bairro: 'Centro', cidade: 'Campina Grande', estado: 'PB', cep: '58400000',
          },
        },
      ]);

      expect(await service.ordersOn('2026-11-20')).toEqual([
        {
          id: 'p1',
          num_pedido: 12,
          cliente: { id: 'u1', nome: 'Ana' },
          status: 'em_producao',
          entrega: {
            modalidade_frete: 'sedex',
            endereco: {
              rua: 'Rua A', numero: '10', complemento: null,
              bairro: 'Centro', cidade: 'Campina Grande', estado: 'PB', cep: '58400000',
            },
          },
        },
      ]);
    });

    it.each(['2026-02-30', '2026-13-01', '20-11-2026', '', undefined])(
      'rejeita data inválida (%s)',
      async (data) => {
        const { service } = setup();
        await expect(service.ordersOn(data)).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe('setBlocked', () => {
    it('bloqueia com upsert', async () => {
      const { service, ocupado } = setup();
      const result = await service.setBlocked('2026-11-20', { bloqueada: true });
      expect(ocupado.upsert).toHaveBeenCalledWith({ data: '2026-11-20' }, ['data']);
      expect(ocupado.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ data: '2026-11-20', bloqueada: true });
    });

    it('libera apagando a linha', async () => {
      const { service, ocupado } = setup();
      const result = await service.setBlocked('2026-11-20', { bloqueada: false });
      expect(ocupado.delete).toHaveBeenCalledWith({ data: '2026-11-20' });
      expect(ocupado.upsert).not.toHaveBeenCalled();
      expect(result).toEqual({ data: '2026-11-20', bloqueada: false });
    });

    it('rejeita bloqueada não booleano', async () => {
      const { service, ocupado } = setup();
      await expect(service.setBlocked('2026-11-20', { bloqueada: 'true' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setBlocked('2026-11-20', {})).rejects.toBeInstanceOf(BadRequestException);
      expect(ocupado.upsert).not.toHaveBeenCalled();
    });

    it('rejeita data inválida', async () => {
      const { service } = setup();
      await expect(service.setBlocked('2026-02-30', { bloqueada: true })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});