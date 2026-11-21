import { describe, expect, it, vi } from 'vitest';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { AgendaClienteController } from './agenda-cliente.controller.js';

describe('AgendaClienteController', () => {
  const service = { listar: vi.fn() };
  const controller = new AgendaClienteController(service as never);

  it('delega a consulta ao service com os parâmetros da query', async () => {
    const datas = { mes: '2026-12', data_minima: '2026-12-01', dias: [] };
    service.listar.mockResolvedValue(datas);

    expect(await controller.listar('2026-12', '7')).toBe(datas);
    expect(service.listar).toHaveBeenCalledWith('2026-12', '7');
  });

  it('exige usuário autenticado, mas não administradora', () => {
    const guards = Reflect.getMetadata('__guards__', AgendaClienteController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(AdminGuard);
  });
});