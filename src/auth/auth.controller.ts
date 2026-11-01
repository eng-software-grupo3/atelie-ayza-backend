import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
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
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  AuthSessionDto,
  AuthUserDto,
  RefreshSessionDto,
} from './dto/auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const LOGIN_STEPS =
  'Start sign-in with a full-page navigation to this URL, not fetch. ' +
  'The browser is sent to Google, then Google calls this API at /auth/google/callback. ' +
  'Register only that backend URL as the Google redirect URI. ' +
  'When FRONTEND_URL is set, the API redirects to {first FRONTEND_URL}/auth/callback. ' +
  'The success hash is access_token, refresh_token, token_type, and expires_in. ' +
  'The failure hash is error (access_denied, auth_failed, or server_error) and error_description. ' +
  'JSON responses use camelCase. The hash uses snake_case so the SPA can parse it with URLSearchParams.';

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
    response.setHeader(
      'Set-Cookie',
      this.stateCookie(state, OAUTH_STATE_MAX_AGE_SECONDS),
    );
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
    const frontend = this.frontendCallback();
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
      this.clearStateCookie(response);
      this.sendSession(response, frontend, session);
    } catch (error) {
      this.clearStateCookie(response);
      if (!frontend || response.headersSent) throw error;
      const failure = callbackFailure(error);
      response.redirect(
        `${frontend}#${new URLSearchParams(failure).toString()}`,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired, or revoked access token',
  })
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
  @ApiUnauthorizedResponse({
    description: 'Missing, expired, or revoked access token',
  })
  logout(@CurrentUser() user: Usuario): Promise<void> {
    return this.authService.logout(user.id);
  }

  private sendSession(
    response: Response,
    frontend: string | undefined,
    session: AuthSessionDto,
  ): void {
    if (!frontend) {
      response.json(session);
      return;
    }
    const hash = new URLSearchParams({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      token_type: session.tokenType,
      expires_in: String(session.expiresIn),
    });
    response.redirect(`${frontend}#${hash.toString()}`);
  }

  private frontendCallback(): string | undefined {
    const origin = this.config
      .get<string>('FRONTEND_URL')
      ?.split(',')[0]
      ?.trim();
    if (!origin) return undefined;
    return `${origin.replace(/\/$/, '')}/auth/callback`;
  }

  private clearStateCookie(response: Response): void {
    response.setHeader('Set-Cookie', this.stateCookie('', 0));
  }

  private stateCookie(value: string, maxAge: number): string {
    const parts = [
      `${OAUTH_STATE_COOKIE}=${value}`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax',
      'Path=/auth/google',
    ];
    if (this.secureCookie()) parts.push('Secure');
    return parts.join('; ');
  }

  private secureCookie(): boolean {
    return this.config
      .get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3000/auth/google/callback',
      )
      .startsWith('https://');
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

function callbackFailure(error: unknown): {
  error: string;
  error_description: string;
} {
  if (error instanceof UnauthorizedException) {
    const message = exceptionMessage(error);
    if (message === 'Google sign-in was cancelled') {
      return { error: 'access_denied', error_description: message };
    }
    return {
      error: 'auth_failed',
      error_description: message || 'Google sign-in failed',
    };
  }
  return { error: 'server_error', error_description: 'Google sign-in failed' };
}

function exceptionMessage(error: HttpException): string {
  const body = error.getResponse();
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && body && 'message' in body) {
    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return error.message;
}
