import { describe, expect, it, vi } from 'vitest';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { PedidosController } from './pedidos.controller.js';

describe('PedidosController', () => {
  const service = { create: vi.fn() };
  const controller = new PedidosController(service as never);

  it('delega a criação ao service com o usuário autenticado', async () => {
    const user = { id: 'u1' };
    const body = { telefone: '83999990000' };
    const criado = { id: 'p1', num_pedido: 13 };
    service.create.mockResolvedValue(criado);

    expect(await controller.create(user as never, body as never)).toBe(criado);
    expect(service.create).toHaveBeenCalledWith(user, body);
  });

  it('exige usuário autenticado, mas não exige administradora', () => {
    const guards = Reflect.getMetadata('__guards__', PedidosController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(AdminGuard);
  });
});