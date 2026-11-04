import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type TokenPayload,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { decryptSecret, encryptSecret, signState } from './crypto.util.js';
import { GoogleAuthClient, type GoogleProfile } from './google-auth.client.js';

const JWT_SECRET = 'jwt-test-secret';
const ENCRYPTION_KEY = 'encryption-key';

const profile: GoogleProfile = {
  sub: 'google-sub',
  email: 'Ana@Ayza.test',
  name: ' Ana Silva ',
  picture: 'https://pic.test/a.png',
  email_verified: true,
};

describe('AuthService', () => {
  const secrets: Record<string, string | undefined> = {};
  const users = {
    increment: vi.fn(),
    findOne: vi.fn(),
    findOneByOrFail: vi.fn(),
    save: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const google = {
    authorizationUrl: vi.fn(),
    exchange: vi.fn(),
    accessTokenFromRefresh: vi.fn(),
  };
  const config = {
    get: vi.fn((key: string) => secrets[key]),
  };

  let service: AuthService;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        AuthService,
        { provide: getRepositoryToken(Usuario), useValue: users },
        { provide: ConfigService, useValue: config },
        { provide: GoogleAuthClient, useValue: google },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    secrets.JWT_SECRET = JWT_SECRET;
    secrets.TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY;
    secrets.ADMIN_EMAIL = 'admin@ayza.test';
    users.create.mockImplementation((data: Partial<Usuario>) => data);
    users.save.mockImplementation(async (entity: Partial<Usuario>) => ({
      googleRefreshToken: null,
      isAdmin: false,
      tokenVersion: 0,
      fotoUrl: null,
      ...entity,
      id: 'user-1',
    }));
    google.authorizationUrl.mockImplementation(
      (state: string) => `https://google.test/auth?state=${state}`,
    );
  });

  describe('getAuthorizationUrl', () => {
    it('returns a Google URL and a state signed with JWT_SECRET', () => {
      const { url, state } = service.getAuthorizationUrl();

      expect(url).toBe(`https://google.test/auth?state=${state}`);
      expect(google.authorizationUrl).toHaveBeenCalledWith(state);
    });

    it('fails before redirecting when a required secret is missing', () => {
      secrets.TOKEN_ENCRYPTION_KEY = '   ';

      expect(() => service.getAuthorizationUrl()).toThrow(
        new ServiceUnavailableException('Missing TOKEN_ENCRYPTION_KEY'),
      );
      expect(google.authorizationUrl).not.toHaveBeenCalled();

      secrets.TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY;
      secrets.JWT_SECRET = undefined;

      expect(() => service.getAuthorizationUrl()).toThrow('Missing JWT_SECRET');
    });
  });

  describe('login', () => {
    it('creates a user and a session from a verified Google profile', async () => {
      const { session } = await loginWith(profile, 'google-refresh');
      const created = users.create.mock.calls[0][0] as Partial<Usuario>;

      expect(created).toMatchObject({
        idGoogle: 'google-sub',
        nome: 'Ana Silva',
        email: 'ana@ayza.test',
        fotoUrl: 'https://pic.test/a.png',
        isAdmin: false,
        tokenVersion: 0,
      });
      expect(decryptSecret(created.googleRefreshToken!, ENCRYPTION_KEY)).toBe(
        'google-refresh',
      );
      expect(session).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: {
          id: 'user-1',
          email: 'ana@ayza.test',
          name: 'Ana Silva',
          pictureUrl: 'https://pic.test/a.png',
          isAdmin: false,
        },
      });
      expect(payloadOf(session.accessToken)).toMatchObject({
        sub: 'user-1',
        typ: 'access',
        ver: 0,
        email: 'ana@ayza.test',
        isAdmin: false,
      });
      expect(payloadOf(session.refreshToken)).toMatchObject({
        sub: 'user-1',
        typ: 'refresh',
        ver: 0,
      });
      expect(payloadOf(session.refreshToken)).not.toHaveProperty('email');
    });

    it('does not store a refresh token Google did not return', async () => {
      await loginWith(profile, null);

      expect(users.create.mock.calls[0][0]).not.toHaveProperty(
        'googleRefreshToken',
      );
    });

    it('marks the configured admin email and normalizes blank names', async () => {
      await loginWith({
        ...profile,
        email: '  ADMIN@ayza.test ',
        name: '   ',
        picture: undefined,
      });

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@ayza.test',
          nome: 'admin',
          fotoUrl: null,
          isAdmin: true,
        }),
      );
    });

    it('trims the admin email and limits the stored name to 120 characters', async () => {
      secrets.ADMIN_EMAIL = '  Admin@Ayza.test  ';

      await loginWith({
        ...profile,
        email: 'admin@ayza.test',
        name: 'A'.repeat(150),
      });

      const created = users.create.mock.calls[0][0] as Partial<Usuario>;
      expect(created.nome).toHaveLength(120);
      expect(created.isAdmin).toBe(true);
    });

    it('updates an existing Google account without looking up the email', async () => {
      const existing = {
        id: 'user-9',
        tokenVersion: 2,
        nome: 'Ana Silva',
        email: 'ana@ayza.test',
        fotoUrl: 'https://pic.test/a.png',
        isAdmin: false,
      };
      users.findOne.mockResolvedValue(existing);
      users.findOneByOrFail.mockResolvedValue(existing);
      const state = signState(JWT_SECRET);
      google.exchange.mockResolvedValue({ profile, refreshToken: undefined });

      const session = await service.login('auth-code', state, state);

      expect(users.createQueryBuilder).not.toHaveBeenCalled();
      expect(users.update).toHaveBeenCalledWith('user-9', {
        idGoogle: 'google-sub',
        nome: 'Ana Silva',
        email: 'ana@ayza.test',
        fotoUrl: 'https://pic.test/a.png',
        isAdmin: false,
      });
      expect(users.save).not.toHaveBeenCalled();
      expect(session.user.id).toBe('user-9');
      expect(payloadOf(session.accessToken).ver).toBe(2);
    });

    it('links an existing account found by email', async () => {
      const existing = {
        id: 'user-4',
        tokenVersion: 0,
        idGoogle: profile.sub,
        email: 'ana@ayza.test',
        nome: 'Ana Silva',
        fotoUrl: profile.picture,
        isAdmin: false,
      };
      users.findOne.mockResolvedValue(null);
      const qb = emailLookup(existing);
      users.findOneByOrFail.mockResolvedValue(existing);
      const state = signState(JWT_SECRET);
      google.exchange.mockResolvedValue({ profile });

      const session = await service.login('auth-code', state, state);

      expect(qb.where).toHaveBeenCalledWith('LOWER(usuario.email) = :email', {
        email: 'ana@ayza.test',
      });
      expect(users.update).toHaveBeenCalledWith(
        'user-4',
        expect.objectContaining({ email: 'ana@ayza.test' }),
      );
      expect(session.user.id).toBe('user-4');
    });

    it('rejects a missing code or a state that does not match the cookie', async () => {
      const state = signState(JWT_SECRET);

      await expect(service.login('', state, state)).rejects.toThrow(
        'Invalid OAuth state or authorization code',
      );
      await expect(
        service.login('auth-code', state, 'other-state'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('auth-code', state, undefined),
      ).rejects.toThrow(UnauthorizedException);
      expect(google.exchange).not.toHaveBeenCalled();
    });

    it('wraps a failed save', async () => {
      const cause = new Error('unique violation');
      users.save.mockRejectedValue(cause);

      const error = await loginWith(profile).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'Could not save Google user',
      );
      expect((error as BadRequestException).cause).toBe(cause);
    });
  });

  describe('refresh', () => {
    it('issues a new access token and keeps the refresh token', async () => {
      const { session, saved } = await loginWith(profile);
      users.findOne.mockResolvedValue(saved);

      const renewed = await service.refresh(session.refreshToken);

      expect(renewed.refreshToken).toBe(session.refreshToken);
      expect(renewed.expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);
      expect(payloadOf(renewed.accessToken)).toMatchObject({
        sub: saved.id,
        typ: 'access',
        ver: saved.tokenVersion,
      });
    });

    it('rejects a missing, malformed, revoked, or wrong-type token', async () => {
      const { session, saved } = await loginWith(profile);

      await expect(service.refresh(undefined)).rejects.toThrow(
        'Invalid refresh token',
      );
      await expect(service.refresh('not-a-jwt')).rejects.toThrow(
        UnauthorizedException,
      );

      users.findOne.mockResolvedValue(null);
      await expect(service.refresh(session.refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );

      users.findOne.mockResolvedValue({ id: saved.id, tokenVersion: 1 });
      await expect(service.refresh(session.refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );

      users.findOne.mockResolvedValue(saved);
      await expect(service.refresh(session.accessToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  describe('userFromAccessToken', () => {
    it('returns the user for a current access token', async () => {
      const { session, saved } = await loginWith(profile);
      users.findOne.mockResolvedValue(saved);

      await expect(
        service.userFromAccessToken(session.accessToken),
      ).resolves.toBe(saved);
    });

    it('rejects a refresh token used as an access token', async () => {
      const { session, saved } = await loginWith(profile);
      users.findOne.mockResolvedValue(saved);

      await expect(
        service.userFromAccessToken(session.refreshToken),
      ).rejects.toThrow('Invalid access token');
    });
  });

  describe('logout', () => {
    it('bumps the token version so existing tokens stop verifying', async () => {
      await service.logout('user-1');

      expect(users.increment).toHaveBeenCalledWith(
        { id: 'user-1' },
        'tokenVersion',
        1,
      );
    });
  });

  describe('toAuthUser', () => {
    it('maps the persisted user onto the public shape', () => {
      expect(
        service.toAuthUser({
          id: 'user-1',
          email: null,
          nome: 'Ana',
          fotoUrl: null,
          isAdmin: true,
        } as Usuario),
      ).toEqual({
        id: 'user-1',
        email: null,
        name: 'Ana',
        pictureUrl: null,
        isAdmin: true,
      });
    });
  });

  describe('getGoogleAccessToken', () => {
    it('decrypts the stored refresh token and asks Google for an access token', async () => {
      const qb = tokenLookup({
        googleRefreshToken: encryptSecret('google-refresh', ENCRYPTION_KEY),
      });
      google.accessTokenFromRefresh.mockResolvedValue('ya29.token');

      await expect(service.getGoogleAccessToken('google-sub')).resolves.toBe(
        'ya29.token',
      );
      expect(qb.addSelect).toHaveBeenCalledWith('usuario.googleRefreshToken');
      expect(qb.where).toHaveBeenCalledWith('usuario.id_google = :idGoogle', {
        idGoogle: 'google-sub',
      });
      expect(google.accessTokenFromRefresh).toHaveBeenCalledWith(
        'google-refresh',
      );
    });

    it('rejects an account with no usable refresh token', async () => {
      tokenLookup({ googleRefreshToken: 'not-ciphertext' });

      await expect(service.getGoogleAccessToken('google-sub')).rejects.toThrow(
        'Google account has no refresh token',
      );

      tokenLookup(null);
      await expect(service.getGoogleAccessToken('missing')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(google.accessTokenFromRefresh).not.toHaveBeenCalled();
    });

    it('fails when the encryption key is not configured', async () => {
      secrets.TOKEN_ENCRYPTION_KEY = undefined;

      await expect(service.getGoogleAccessToken('google-sub')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(users.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  function payloadOf(token: string): TokenPayload {
    return jwt.decode(token) as TokenPayload;
  }

  function emailLookup(found: { id: string } | null) {
    const qb = {
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(found),
    };
    users.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  function tokenLookup(found: { googleRefreshToken?: string | null } | null) {
    const qb = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(found),
    };
    users.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  async function loginWith(
    googleProfile: GoogleProfile,
    refreshToken?: string | null,
  ) {
    const state = signState(JWT_SECRET);
    google.exchange.mockResolvedValue({
      profile: googleProfile,
      refreshToken,
    });
    users.findOne.mockResolvedValue(null);
    emailLookup(null);
    const session = await service.login('auth-code', state, state);
    const saved = (await users.save.mock.results[0].value) as Usuario;
    return { session, saved };
  }
});
