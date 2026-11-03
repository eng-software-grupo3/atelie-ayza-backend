import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { Usuario } from '../pessoas/entities/usuario.entity.js';
import {
  AdminGuard,
  CurrentUser,
  JwtAuthGuard,
  type AuthenticatedRequest,
} from './auth.guards.js';
import type { AuthService } from './auth.service.js';

const user = {
  id: 'user-1',
  isAdmin: false,
} as Usuario;

function httpContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const auth = {
    userFromAccessToken: vi.fn(),
  };
  const guard = new JwtAuthGuard(auth as unknown as AuthService);

  beforeEach(() => {
    auth.userFromAccessToken.mockReset();
    auth.userFromAccessToken.mockResolvedValue(user);
  });

  it('attaches the user from a bearer token', async () => {
    const request = {
      headers: { authorization: 'Bearer access-token' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);

    expect(auth.userFromAccessToken).toHaveBeenCalledWith('access-token');
    expect(request.user).toBe(user);
  });

  it('passes no token when the scheme is missing or is not Bearer', async () => {
    const missing = { headers: {} } as AuthenticatedRequest;
    const basic = {
      headers: { authorization: 'Basic access-token' },
    } as AuthenticatedRequest;

    await guard.canActivate(httpContext(missing));
    await guard.canActivate(httpContext(basic));

    expect(auth.userFromAccessToken).toHaveBeenNthCalledWith(1, undefined);
    expect(auth.userFromAccessToken).toHaveBeenNthCalledWith(2, undefined);
  });

  it('propagates an invalid token', async () => {
    auth.userFromAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );
    const request = {
      headers: { authorization: 'Bearer expired' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(httpContext(request))).rejects.toThrow(
      'Invalid access token',
    );
    expect(request.user).toBeUndefined();
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows an admin', () => {
    const request = {
      user: { id: user.id, isAdmin: true },
    } as AuthenticatedRequest;

    expect(guard.canActivate(httpContext(request))).toBe(true);
  });

  it('rejects a non-admin and a request with no user', () => {
    expect(() =>
      guard.canActivate(httpContext({ user } as AuthenticatedRequest)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(httpContext({} as AuthenticatedRequest)),
    ).toThrow(ForbiddenException);
  });
});

describe('CurrentUser', () => {
  it('reads the user stored on the request', () => {
    class Probe {
      handler(@CurrentUser() _user: Usuario) {}
    }

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Probe,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => Usuario }
    >;
    const factory = Object.values(metadata)[0].factory;
    const request = { user } as AuthenticatedRequest;

    expect(factory(undefined, httpContext(request))).toBe(user);
  });
});
