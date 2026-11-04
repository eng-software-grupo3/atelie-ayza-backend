import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DEFAULT_CALLBACK_URL } from './auth.constants.js';
import { GoogleAuthClient } from './google-auth.client.js';

const { oauthClient, OAuth2ClientMock } = vi.hoisted(() => {
  const oauthClient = {
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    verifyIdToken: vi.fn(),
    setCredentials: vi.fn(),
    getAccessToken: vi.fn(),
  };
  const OAuth2ClientMock = vi.fn(function OAuth2Client() {
    return oauthClient;
  });
  return { oauthClient, OAuth2ClientMock };
});

vi.mock('google-auth-library', () => ({
  OAuth2Client: OAuth2ClientMock,
}));

const verifiedProfile = {
  sub: 'google-sub',
  email: 'ana@ayza.test',
  email_verified: true,
  name: 'Ana',
  picture: 'https://pic.test/a.png',
};

function configOf(values: Record<string, string | undefined>): ConfigService {
  return {
    get(key: string, defaultValue?: string) {
      return values[key] === undefined ? defaultValue : values[key];
    },
  } as ConfigService;
}

function client(
  values: Record<string, string | undefined> = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
  },
): GoogleAuthClient {
  return new GoogleAuthClient(configOf(values));
}

describe('GoogleAuthClient', () => {
  beforeEach(() => {
    OAuth2ClientMock.mockClear();
    oauthClient.generateAuthUrl.mockReset();
    oauthClient.getToken.mockReset();
    oauthClient.verifyIdToken.mockReset();
    oauthClient.setCredentials.mockReset();
    oauthClient.getAccessToken.mockReset();
  });

  describe('authorizationUrl', () => {
    it('builds an offline consent URL and reuses the OAuth client', () => {
      oauthClient.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com',
      );
      const google = client();

      expect(google.authorizationUrl('state-1')).toBe(
        'https://accounts.google.com',
      );
      google.authorizationUrl('state-2');

      expect(oauthClient.generateAuthUrl).toHaveBeenNthCalledWith(1, {
        access_type: 'offline',
        prompt: 'consent',
        scope: ['openid', 'email', 'profile'],
        state: 'state-1',
      });
      expect(OAuth2ClientMock).toHaveBeenCalledTimes(1);
      expect(OAuth2ClientMock).toHaveBeenCalledWith(
        'client-id',
        'client-secret',
        DEFAULT_CALLBACK_URL,
      );
    });

    it('trims credentials and uses a configured callback URL', () => {
      oauthClient.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com',
      );

      client({
        GOOGLE_CLIENT_ID: '  client-id  ',
        GOOGLE_CLIENT_SECRET: '  client-secret  ',
        GOOGLE_CALLBACK_URL: 'https://api.example/auth/google/callback',
      }).authorizationUrl('state');

      expect(OAuth2ClientMock).toHaveBeenCalledWith(
        'client-id',
        'client-secret',
        'https://api.example/auth/google/callback',
      );
    });

    it('fails before calling Google when credentials are missing', () => {
      expect(() => client({}).authorizationUrl('state')).toThrow(
        new ServiceUnavailableException('Missing GOOGLE_CLIENT_ID'),
      );
      expect(OAuth2ClientMock).not.toHaveBeenCalled();
    });
  });

  describe('exchange', () => {
    function stubToken(profile: unknown, refreshToken?: string) {
      oauthClient.getToken.mockResolvedValue({
        tokens: { id_token: 'id-token', refresh_token: refreshToken },
      });
      oauthClient.verifyIdToken.mockResolvedValue({
        getPayload: () => profile,
      });
    }

    it('returns the verified profile and refresh token', async () => {
      stubToken(verifiedProfile, 'google-refresh');

      await expect(client().exchange('auth-code')).resolves.toEqual({
        profile: verifiedProfile,
        refreshToken: 'google-refresh',
      });
      expect(oauthClient.getToken).toHaveBeenCalledWith('auth-code');
      expect(oauthClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'id-token',
        audience: 'client-id',
      });
    });

    it('allows a missing refresh token', async () => {
      stubToken(verifiedProfile);

      await expect(client().exchange('auth-code')).resolves.toEqual({
        profile: verifiedProfile,
        refreshToken: undefined,
      });
    });

    it('keeps the specific error when Google omits the identity token', async () => {
      oauthClient.getToken.mockResolvedValue({ tokens: {} });

      await expect(client().exchange('auth-code')).rejects.toThrow(
        new UnauthorizedException('Google did not return an identity token'),
      );
      expect(oauthClient.verifyIdToken).not.toHaveBeenCalled();
    });

    it('rejects an unverified or incomplete profile', async () => {
      stubToken({ ...verifiedProfile, email_verified: false });
      const google = client();

      await expect(google.exchange('auth-code')).rejects.toThrow(
        'Google account email is not verified',
      );

      stubToken({ ...verifiedProfile, email: undefined });
      await expect(google.exchange('auth-code')).rejects.toThrow(
        UnauthorizedException,
      );

      stubToken(undefined);
      await expect(google.exchange('auth-code')).rejects.toThrow(
        'Google account email is not verified',
      );
    });

    it('hides transport failures behind a generic authorization error', async () => {
      oauthClient.getToken.mockRejectedValue(new Error('network down'));

      await expect(client().exchange('auth-code')).rejects.toThrow(
        new UnauthorizedException('Google authorization failed'),
      );
    });
  });

  describe('accessTokenFromRefresh', () => {
    it('exchanges the refresh token for an access token', async () => {
      oauthClient.getAccessToken.mockResolvedValue({ token: 'ya29.token' });
      const google = client();
      google.authorizationUrl('state');

      await expect(
        google.accessTokenFromRefresh('google-refresh'),
      ).resolves.toBe('ya29.token');

      expect(oauthClient.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'google-refresh',
      });
      expect(OAuth2ClientMock).toHaveBeenCalledTimes(2);
    });

    it('rejects an empty token and Google client failures', async () => {
      oauthClient.getAccessToken.mockResolvedValue({ token: null });
      const google = client();

      await expect(
        google.accessTokenFromRefresh('google-refresh'),
      ).rejects.toThrow('Could not renew Google access token');

      oauthClient.getAccessToken.mockRejectedValue(new Error('invalid_grant'));
      await expect(
        google.accessTokenFromRefresh('google-refresh'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('fails when the client secret is missing', () => {
      expect(() =>
        client({ GOOGLE_CLIENT_ID: 'client-id' }).accessTokenFromRefresh('r'),
      ).toThrow(
        new ServiceUnavailableException('Missing GOOGLE_CLIENT_SECRET'),
      );
    });
  });
});
