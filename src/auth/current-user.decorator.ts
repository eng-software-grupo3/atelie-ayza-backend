import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Usuario } from '../pessoas/entities/usuario.entity.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Usuario => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
