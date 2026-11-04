import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import {
  DEFAULT_CALLBACK_URL,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from './auth.constants.js';
import { JwtAuthGuard } from './auth.guards.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { AuthSessionDto } from './dto/auth.dto.js';

const session: AuthSessionDto = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'ana@ayza.test',
    name: 'Ana',
    pictureUrl: null,
    isAdmin: false,
  },
};

const user = { id: 'user-1' } as Usuario;

describe('AuthController', () => {
  const settings: Record<string, string | undefined> = {};
  const auth = {
    getAuthorizationUrl: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    toAuthUser: vi.fn(),
    userFromAccessToken: vi.fn(),
  };
  const config = {
    get: vi.fn((key: string, defaultValue?: string) =>
      Object.prototype.hasOwnProperty.call(settings, key)
        ? settings[key]
        : defaultValue,
    ),
  };
  const controller = new AuthController(
    auth as unknown as AuthService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
    auth.login.mockResolvedValue(session);
    auth.toAuthUser.mockReturnValue(session.user);
  });

  describe('start', () => {
    it('stores the oauth state and redirects to Google', () => {
      auth.getAuthorizationUrl.mockReturnValue({
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        state: 'abc.def',
      });
      const response = mockResponse();

      controller.start(response);

      expect(response.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        `${OAUTH_STATE_COOKIE}=abc.def; Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/auth/google`,
      );
      expect(response.redirect).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
    });

    it('marks the state cookie Secure when the callback is https', () => {
      settings.GOOGLE_CALLBACK_URL = 'https://api.example/auth/google/callback';
      auth.getAuthorizationUrl.mockReturnValue({
        url: 'https://accounts.google.com',
        state: 'abc.def',
      });
      const response = mockResponse();

      controller.start(response);

      expect(response.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('; Secure'),
      );
    });

    it('leaves the cookie insecure for the default http callback', () => {
      const response = mockResponse();
      auth.getAuthorizationUrl.mockReturnValue({
        url: 'https://accounts.google.com',
        state: 'abc.def',
      });

      controller.start(response);

      expect(config.get).toHaveBeenCalledWith(
        'GOOGLE_CALLBACK_URL',
        DEFAULT_CALLBACK_URL,
      );
      expect(String(response.setHeader.mock.calls[0][1])).not.toContain(
        'Secure',
      );
    });
  });

  describe('callback', () => {
    it('returns the session as JSON when no frontend is configured', async () => {
      const response = mockResponse();

      await controller.callback(
        'auth-code',
        'state-value',
        '',
        requestWithCookie('other=1; oauth_state=state-value'),
        response,
      );

      expect(auth.login).toHaveBeenCalledWith(
        'auth-code',
        'state-value',
        'state-value',
      );
      expect(response.json).toHaveBeenCalledWith(session);
      expect(response.redirect).not.toHaveBeenCalled();
      expect(response.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        `${OAUTH_STATE_COOKIE}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/auth/google`,
      );
    });

    it('reads the matching state cookie among several cookies', async () => {
      await controller.callback(
        'auth-code',
        'right',
        '',
        requestWithCookie('oauth_state_extra=no; oauth_state=right'),
        mockResponse(),
      );

      expect(auth.login).toHaveBeenCalledWith('auth-code', 'right', 'right');
    });

    it('passes an absent cookie through as undefined', async () => {
      await controller.callback(
        'auth-code',
        'state-value',
        '',
        { headers: {} } as Request,
        mockResponse(),
      );

      expect(auth.login).toHaveBeenCalledWith(
        'auth-code',
        'state-value',
        undefined,
      );
    });

    it('redirects the browser to the first frontend with the session hash', async () => {
      settings.FRONTEND_URL = 'https://app.example/ , https://other.example';
      const response = mockResponse();

      await controller.callback(
        'auth-code',
        'state-value',
        '',
        requestWithCookie('oauth_state=state-value'),
        response,
      );

      const location = redirectedTo(response);
      expect(location.startsWith('https://app.example/auth/callback#')).toBe(
        true,
      );
      expect(hashOf(location)).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: '900',
      });
      expect(response.json).not.toHaveBeenCalled();
    });

    it('redirects cancellation and authorization failures to the frontend', async () => {
      settings.FRONTEND_URL = 'https://app.example';
      const cancelled = mockResponse();

      await controller.callback(
        '',
        '',
        'access_denied',
        requestWithCookie(),
        cancelled,
      );

      expect(hashOf(redirectedTo(cancelled))).toEqual({
        error: 'access_denied',
        error_description: 'Google sign-in was cancelled',
      });
      expect(auth.login).not.toHaveBeenCalled();

      auth.login.mockRejectedValue(
        new UnauthorizedException('Invalid OAuth state or authorization code'),
      );
      const failed = mockResponse();
      await controller.callback(
        'auth-code',
        'state',
        '',
        requestWithCookie(),
        failed,
      );

      expect(hashOf(redirectedTo(failed))).toEqual({
        error: 'auth_failed',
        error_description: 'Invalid OAuth state or authorization code',
      });
    });

    it('hides unexpected failures as a server error on the frontend', async () => {
      settings.FRONTEND_URL = 'https://app.example';
      auth.login.mockRejectedValue(new Error('database down'));
      const response = mockResponse();

      await controller.callback(
        'auth-code',
        'state',
        '',
        requestWithCookie(),
        response,
      );

      expect(hashOf(redirectedTo(response))).toEqual({
        error: 'server_error',
        error_description: 'Google sign-in failed',
      });
    });

    it('sends Google errors back to the caller when no frontend is configured', async () => {
      const response = mockResponse();

      await expect(
        controller.callback(
          '',
          '',
          'access_denied',
          requestWithCookie(),
          response,
        ),
      ).rejects.toThrow('Google sign-in was cancelled');
      await expect(
        controller.callback(
          '',
          '',
          'invalid_scope',
          requestWithCookie(),
          response,
        ),
      ).rejects.toThrow('Google authorization failed');
      expect(response.json).not.toHaveBeenCalled();
    });
  });

  describe('me, refresh, and logout', () => {
    it('returns the current user', () => {
      expect(controller.me(user)).toBe(session.user);
      expect(auth.toAuthUser).toHaveBeenCalledWith(user);
    });

    it('renews a session from the refresh token body', async () => {
      auth.refresh.mockResolvedValue(session);

      await expect(
        controller.refresh({ refreshToken: 'refresh-token' }),
      ).resolves.toBe(session);
      await expect(
        controller.refresh(undefined as unknown as { refreshToken: string }),
      ).resolves.toBe(session);
      expect(auth.refresh).toHaveBeenNthCalledWith(2, undefined);
    });

    it('revokes the current user session', async () => {
      auth.logout.mockResolvedValue(undefined);

      await controller.logout(user);

      expect(auth.logout).toHaveBeenCalledWith('user-1');
    });
  });
});

describe('AuthController HTTP', () => {
  const settings: Record<string, string | undefined> = {};
  const auth = {
    getAuthorizationUrl: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    toAuthUser: vi.fn(),
    userFromAccessToken: vi.fn(),
  };
  const config = {
    get: (key: string, defaultValue?: string) =>
      Object.prototype.hasOwnProperty.call(settings, key)
        ? settings[key]
        : defaultValue,
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        JwtAuthGuard,
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
  });

  it('GET /auth/google redirects to Google', async () => {
    auth.getAuthorizationUrl.mockReturnValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      state: 'abc.def',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(302);

    expect(response.headers.location).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    const cookie = response.headers['set-cookie'];
    const setCookie = Array.isArray(cookie) ? cookie.join(';') : cookie;
    expect(setCookie).toContain(`${OAUTH_STATE_COOKIE}=abc.def`);
  });

  it('GET /auth/google/callback returns the session', async () => {
    auth.login.mockResolvedValue(session);

    const response = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ code: 'auth-code', state: 'abc.def' })
      .set('Cookie', `${OAUTH_STATE_COOKIE}=abc.def`)
      .expect(200);

    expect(response.body).toEqual(session);
    expect(auth.login).toHaveBeenCalledWith('auth-code', 'abc.def', 'abc.def');
  });

  it('GET /auth/google/callback redirects errors to the frontend', async () => {
    settings.FRONTEND_URL = 'https://app.example';

    const response = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ error: 'access_denied' })
      .expect(302);

    expect(response.headers.location).toContain(
      'https://app.example/auth/callback#',
    );
    expect(response.headers.location).toContain('error=access_denied');
  });

  it('GET /auth/me requires a bearer token and returns the user', async () => {
    auth.userFromAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );
    auth.toAuthUser.mockReturnValue(session.user);

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    auth.userFromAccessToken.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200);

    expect(auth.userFromAccessToken).toHaveBeenCalledWith('access-token');
    expect(response.body).toEqual(session.user);
  });

  it('POST /auth/refresh returns a session', async () => {
    auth.refresh.mockResolvedValue(session);

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(200);

    expect(response.body).toEqual(session);
    expect(auth.refresh).toHaveBeenCalledWith('refresh-token');
  });

  it('POST /auth/logout revokes the session and returns no content', async () => {
    auth.userFromAccessToken.mockResolvedValue(user);
    auth.logout.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .expect(204);

    expect(auth.logout).toHaveBeenCalledWith('user-1');
  });
});

function mockResponse(): Response & {
  redirect: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
} {
  return {
    redirect: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as Response & {
    redirect: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

function requestWithCookie(cookie?: string): Request {
  return { headers: { cookie } } as Request;
}

function redirectedTo(response: {
  redirect: ReturnType<typeof vi.fn>;
}): string {
  return response.redirect.mock.calls[0][0] as string;
}

function hashOf(location: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(location.split('#')[1]));
}
