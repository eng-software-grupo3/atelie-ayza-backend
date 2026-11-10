import { describe, expect, it, vi } from 'vitest';
import { AgendaController } from './agenda.controller.js';

describe('AgendaController', () => {
  const service = { calendar: vi.fn(), ordersOn: vi.fn(), setBlocked: vi.fn() };
  const controller = new AgendaController(service as never);

  it('delega o calendário ao service', async () => {
    service.calendar.mockResolvedValue({ mes: '2026-11', dias: [] });
    expect(await controller.calendar('2026-11')).toEqual({ mes: '2026-11', dias: [] });
    expect(service.calendar).toHaveBeenCalledWith('2026-11');
  });

  it('delega os pedidos da data ao service', async () => {
    service.ordersOn.mockResolvedValue([]);
    expect(await controller.ordersOn('2026-11-20')).toEqual([]);
    expect(service.ordersOn).toHaveBeenCalledWith('2026-11-20');
  });

  it('delega o bloqueio ao service', async () => {
    const body = { bloqueada: true };
    service.setBlocked.mockResolvedValue({ data: '2026-11-20', bloqueada: true });
    await controller.setBlocked('2026-11-20', body);
    expect(service.setBlocked).toHaveBeenCalledWith('2026-11-20', body);
  });
});