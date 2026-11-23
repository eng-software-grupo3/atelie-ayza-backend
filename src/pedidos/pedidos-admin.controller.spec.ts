import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { PedidosAdminController } from './pedidos-admin.controller.js';

describe('PedidosAdminController', () => {
  const service = { listarGestao: vi.fn(), obterDetalheGestao: vi.fn() };
  const controller = new PedidosAdminController(service as never);

  it('delega a listagem com status e paginacao', async () => {
    const pagina = { dados: [], pagina: 2, limite: 5, total: 0, total_paginas: 0 };
    service.listarGestao.mockResolvedValue(pagina);

    await expect(controller.listar('em_analise', '2', '5', 'desc'))
      .resolves.toBe(pagina);
    expect(service.listarGestao).toHaveBeenCalledWith(
      'em_analise',
      '2',
      '5',
      'desc',
    );
  });

  it('delega o detalhe pelo id', async () => {
    const detalhe = { id: 'pedido-1' };
    service.obterDetalheGestao.mockResolvedValue(detalhe);

    await expect(controller.obterDetalhe('pedido-1')).resolves.toBe(detalhe);
    expect(service.obterDetalheGestao).toHaveBeenCalledWith('pedido-1');
  });

  it('exige JWT e AdminGuard', () => {
    const guards = Reflect.getMetadata('__guards__', PedidosAdminController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(AdminGuard);
  });

  it('bloqueia usuário autenticado que não seja administrador', () => {
    const guard = new AdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'cliente-1', isAdmin: false } }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });
});
