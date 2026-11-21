import { describe, expect, it, vi } from 'vitest';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { FreteController } from './frete.controller.js';

describe('FreteController', () => {
  const service = { cotar: vi.fn() };
  const controller = new FreteController(service as never);

  it('delega a cotação ao service com os parâmetros da query', async () => {
    const cotacao = { cep: '64800000', modalidades: [] };
    service.cotar.mockResolvedValue(cotacao);

    expect(await controller.cotar('64800-000', '2')).toBe(cotacao);
    expect(service.cotar).toHaveBeenCalledWith('64800-000', '2');
  });

  it('exige usuário autenticado, mas não administradora', () => {
    const guards = Reflect.getMetadata('__guards__', FreteController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(AdminGuard);
  });
});