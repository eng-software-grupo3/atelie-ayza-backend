import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DEFAULT_CALLBACK_URL, requireConfig } from './auth.constants.js';

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

@Injectable()
export class GoogleAuthClient {
  private client?: OAuth2Client;

  constructor(private readonly config: ConfigService) {}

  authorizationUrl(state: string): string {
    return this.getClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  async exchange(
    code: string,
  ): Promise<{ profile: GoogleProfile; refreshToken?: string | null }> {
    const client = this.getClient();
    const audience = requireConfig(this.config, 'GOOGLE_CLIENT_ID');
    const { profile, refreshToken } = await unauthorizedOnError(
      'Google authorization failed',
      async () => {
        const { tokens } = await client.getToken(code);
        if (!tokens.id_token) {
          throw new UnauthorizedException(
            'Google did not return an identity token',
          );
        }
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience,
        });
        return {
          profile: ticket.getPayload() as GoogleProfile | undefined,
          refreshToken: tokens.refresh_token,
        };
      },
    );
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    return { profile, refreshToken };
  }

  accessTokenFromRefresh(refreshToken: string): Promise<string> {
    const client = this.createClient();
    client.setCredentials({ refresh_token: refreshToken });
    return unauthorizedOnError(
      'Could not renew Google access token',
      async () => {
        const { token } = await client.getAccessToken();
        if (!token) throw new Error('Empty Google access token');
        return token;
      },
    );
  }

  private getClient(): OAuth2Client {
    return (this.client ??= this.createClient());
  }

  private createClient(): OAuth2Client {
    return new OAuth2Client(
      requireConfig(this.config, 'GOOGLE_CLIENT_ID'),
      requireConfig(this.config, 'GOOGLE_CLIENT_SECRET'),
      this.config.get<string>('GOOGLE_CALLBACK_URL', DEFAULT_CALLBACK_URL),
    );
  }
}

async function unauthorizedOnError<T>(
  message: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException(message);
  }
}
