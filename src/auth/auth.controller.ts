import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import {
  DEFAULT_CALLBACK_URL,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from './auth.constants.js';
import { CurrentUser, JwtAuthGuard } from './auth.guards.js';
import { AuthService } from './auth.service.js';
import {
  AuthSessionDto,
  AuthUserDto,
  RefreshSessionDto,
} from './dto/auth.dto.js';

const LOGIN_STEPS =
  'Start sign-in with a full-page navigation to this URL, not fetch. ' +
  'The browser is sent to Google, then Google calls this API at /auth/google/callback. ' +
  'Register only that backend URL as the Google redirect URI. ' +
  'When FRONTEND_URL is set, the API redirects to {first FRONTEND_URL}/auth/callback. ' +
  'The success hash is access_token, refresh_token, token_type, and expires_in. ' +
  'The failure hash is error (access_denied, auth_failed, or server_error) and error_description. ' +
  'JSON responses use camelCase. The hash uses snake_case so the SPA can parse it with URLSearchParams.';

const TOKEN_REJECTED = {
  description: 'Missing, expired, or revoked access token',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('google')
  @ApiOperation({ summary: 'Start Google sign-in', description: LOGIN_STEPS })
  @ApiFoundResponse({ description: 'Redirect to Google' })
  start(@Res() response: Response): void {
    const { url, state } = this.authService.getAuthorizationUrl();
    this.setStateCookie(response, state, OAUTH_STATE_MAX_AGE_SECONDS);
    response.redirect(url);
  }

  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Google redirects the browser here. With FRONTEND_URL set, the response redirects to the SPA. Without it, the body is AuthSession JSON.',
  })
  @ApiFoundResponse({
    description:
      'Redirect to the SPA /auth/callback with tokens or an error hash',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    this.setStateCookie(response, '', 0);
    const frontend = this.frontendCallback();
    let hash: Record<string, string>;
    try {
      if (oauthError) {
        throw new UnauthorizedException(
          oauthError === 'access_denied'
            ? 'Google sign-in was cancelled'
            : 'Google authorization failed',
        );
      }
      const session = await this.authService.login(
        code,
        state,
        readCookie(request.headers.cookie, OAUTH_STATE_COOKIE),
      );
      if (!frontend) {
        response.json(session);
        return;
      }
      hash = {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        token_type: session.tokenType,
        expires_in: String(session.expiresIn),
      };
    } catch (error) {
      if (!frontend) throw error;
      hash =
        error instanceof UnauthorizedException
          ? {
              error:
                oauthError === 'access_denied'
                  ? 'access_denied'
                  : 'auth_failed',
              error_description: error.message,
            }
          : {
              error: 'server_error',
              error_description: 'Google sign-in failed',
            };
    }
    response.redirect(`${frontend}#${new URLSearchParams(hash).toString()}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse(TOKEN_REJECTED)
  me(@CurrentUser() user: Usuario): AuthUserDto {
    return this.authService.toAuthUser(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renew the access token',
    description:
      'Send the refresh token in the body. No Bearer header is required.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or revoked refresh token' })
  refresh(@Body() body: RefreshSessionDto): Promise<AuthSessionDto> {
    return this.authService.refresh(body?.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse(TOKEN_REJECTED)
  logout(@CurrentUser() user: Usuario): Promise<void> {
    return this.authService.logout(user.id);
  }

  private frontendCallback(): string | undefined {
    const origin = this.config
      .get<string>('FRONTEND_URL')
      ?.split(',')[0]
      .trim()
      .replace(/\/$/, '');
    return origin ? `${origin}/auth/callback` : undefined;
  }

  private setStateCookie(
    response: Response,
    value: string,
    maxAge: number,
  ): void {
    const secure = this.config
      .get<string>('GOOGLE_CALLBACK_URL', DEFAULT_CALLBACK_URL)
      .startsWith('https://')
      ? '; Secure'
      : '';
    response.setHeader(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=${value}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/auth/google${secure}`,
    );
  }
}

function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  return header
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
