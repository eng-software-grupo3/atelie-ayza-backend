import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export type GoogleExchange = {
  profile: GoogleProfile;
  refreshToken?: string | null;
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

  async exchange(code: string): Promise<GoogleExchange> {
    const client = this.getClient();
    let idToken: string;
    let refreshToken: string | null | undefined;
    try {
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new UnauthorizedException(
          'Google did not return an identity token',
        );
      }
      idToken = tokens.id_token;
      refreshToken = tokens.refresh_token;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Google authorization failed');
    }

    let profile: GoogleProfile | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.required('GOOGLE_CLIENT_ID'),
      });
      profile = ticket.getPayload() as GoogleProfile | undefined;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Google authorization failed');
    }
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    return { profile, refreshToken };
  }

  async accessTokenFromRefresh(refreshToken: string): Promise<string> {
    const client = new OAuth2Client(
      this.required('GOOGLE_CLIENT_ID'),
      this.required('GOOGLE_CLIENT_SECRET'),
      this.callbackUrl(),
    );
    client.setCredentials({ refresh_token: refreshToken });
    try {
      const { token } = await client.getAccessToken();
      if (!token) {
        throw new UnauthorizedException('Could not renew Google access token');
      }
      return token;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Could not renew Google access token');
    }
  }

  private getClient(): OAuth2Client {
    if (!this.client) {
      this.client = new OAuth2Client(
        this.required('GOOGLE_CLIENT_ID'),
        this.required('GOOGLE_CLIENT_SECRET'),
        this.callbackUrl(),
      );
    }
    return this.client;
  }

  private callbackUrl(): string {
    return this.config.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/auth/google/callback',
    );
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException(`Missing ${key}`);
    return value;
  }
}
