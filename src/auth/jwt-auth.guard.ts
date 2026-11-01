import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import type { AccessTokenPayload } from './auth.constants.js';

export type AuthenticatedRequest = Request & { user: Usuario };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
    if (!token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (
      payload.typ !== 'access' ||
      !payload.sub ||
      typeof payload.ver !== 'number'
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException();
    }
    request.user = user;
    return true;
  }
}
