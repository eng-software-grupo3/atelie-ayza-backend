export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export type AccessTokenPayload = {
  sub: string;
  email: string | null;
  isAdmin: boolean;
  typ: 'access';
  ver: number;
};

export type RefreshTokenPayload = {
  sub: string;
  typ: 'refresh';
  ver: number;
};
