import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;
export const DEFAULT_CALLBACK_URL =
  'http://localhost:3000/auth/google/callback';

export type TokenType = 'access' | 'refresh';

export type TokenPayload = {
  sub: string;
  typ: TokenType;
  ver: number;
  email?: string | null;
  isAdmin?: boolean;
};

export function requireConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim();
  if (!value) throw new ServiceUnavailableException(`Missing ${key}`);
  return value;
}
