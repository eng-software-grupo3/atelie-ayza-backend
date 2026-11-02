import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Usuario } from '../pessoas/entities/usuario.entity.js';
import { AuthService } from './auth.service.js';

export type AuthenticatedRequest = Request & { user: Usuario };

function requestOf(context: ExecutionContext): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = requestOf(context);
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    request.user = await this.auth.userFromAccessToken(
      scheme === 'Bearer' ? token : undefined,
    );
    return true;
  }
}

/** Use after `JwtAuthGuard`, which sets `request.user`. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!requestOf(context).user?.isAdmin) throw new ForbiddenException();
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Usuario =>
    requestOf(context).user,
);
