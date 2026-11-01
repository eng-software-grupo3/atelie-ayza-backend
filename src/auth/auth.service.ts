import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  requireConfig,
  type TokenPayload,
  type TokenType,
} from './auth.constants.js';
import {
  decryptSecret,
  encryptSecret,
  isValidState,
  signState,
} from './crypto.util.js';
import type { AuthSessionDto, AuthUserDto } from './dto/auth.dto.js';
import { GoogleAuthClient, type GoogleProfile } from './google-auth.client.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly google: GoogleAuthClient,
  ) {}

  getAuthorizationUrl(): { url: string; state: string } {
    // Fail before the Google redirect when the callback could not store the token.
    this.secret('TOKEN_ENCRYPTION_KEY');
    const state = signState(this.secret('JWT_SECRET'));
    return { state, url: this.google.authorizationUrl(state) };
  }

  async login(
    code: string,
    state: string,
    cookieState?: string,
  ): Promise<AuthSessionDto> {
    const encryptionKey = this.secret('TOKEN_ENCRYPTION_KEY');
    if (!code || !isValidState(state, cookieState, this.secret('JWT_SECRET'))) {
      throw new UnauthorizedException(
        'Invalid OAuth state or authorization code',
      );
    }

    const { profile, refreshToken } = await this.google.exchange(code);
    const user = await this.saveUser(
      profile,
      refreshToken ? encryptSecret(refreshToken, encryptionKey) : undefined,
    );
    return this.session(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthSessionDto> {
    const user = await this.verify(refreshToken, 'refresh');
    return this.session(user, refreshToken);
  }

  userFromAccessToken(token: string | undefined): Promise<Usuario> {
    return this.verify(token, 'access');
  }

  async logout(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'tokenVersion', 1);
  }

  toAuthUser(user: Usuario): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.nome,
      pictureUrl: user.fotoUrl,
      isAdmin: user.isAdmin,
    };
  }

  async getGoogleAccessToken(idGoogle: string): Promise<string> {
    const encryptionKey = this.secret('TOKEN_ENCRYPTION_KEY');
    const user = await this.users
      .createQueryBuilder('usuario')
      .addSelect('usuario.googleRefreshToken')
      .where('usuario.id_google = :idGoogle', { idGoogle })
      .getOne();

    let refreshToken: string;
    try {
      refreshToken = decryptSecret(
        user?.googleRefreshToken ?? '',
        encryptionKey,
      );
    } catch {
      throw new UnauthorizedException('Google account has no refresh token');
    }
    return this.google.accessTokenFromRefresh(refreshToken);
  }

  private async session(
    user: Usuario,
    refreshToken?: string,
  ): Promise<AuthSessionDto> {
    return {
      accessToken: await this.sign(user, 'access'),
      refreshToken: refreshToken ?? (await this.sign(user, 'refresh')),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUser(user),
    };
  }

  private sign(user: Usuario, typ: TokenType): Promise<string> {
    const payload: TokenPayload = { sub: user.id, typ, ver: user.tokenVersion };
    if (typ === 'access') {
      payload.email = user.email;
      payload.isAdmin = user.isAdmin;
    }
    return this.jwt.signAsync(payload, {
      expiresIn:
        typ === 'access' ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  private async verify(
    token: string | undefined,
    typ: TokenType,
  ): Promise<Usuario> {
    const payload = token
      ? await this.jwt.verifyAsync<TokenPayload>(token).catch(() => null)
      : null;
    const user =
      payload?.typ === typ && payload.sub
        ? await this.users.findOne({ where: { id: payload.sub } })
        : null;
    if (!user || user.tokenVersion !== payload?.ver) {
      throw new UnauthorizedException(`Invalid ${typ} token`);
    }
    return user;
  }

  private async saveUser(
    profile: GoogleProfile,
    encryptedRefreshToken?: string,
  ): Promise<Usuario> {
    const email = profile.email.trim().toLowerCase();
    const values: Partial<Usuario> = {
      idGoogle: profile.sub,
      nome: (profile.name?.trim() || email.split('@')[0]).slice(0, 120),
      email,
      fotoUrl: profile.picture ?? null,
      isAdmin:
        email === this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase(),
    };
    if (encryptedRefreshToken)
      values.googleRefreshToken = encryptedRefreshToken;

    const existing =
      (await this.users.findOne({ where: { idGoogle: profile.sub } })) ??
      (await this.users
        .createQueryBuilder('usuario')
        .where('LOWER(usuario.email) = :email', { email })
        .getOne());

    try {
      if (!existing) {
        return await this.users.save(
          this.users.create({ ...values, tokenVersion: 0 }),
        );
      }
      await this.users.update(existing.id, values);
      return await this.users.findOneByOrFail({ id: existing.id });
    } catch (error) {
      throw new BadRequestException('Could not save Google user', {
        cause: error,
      });
    }
  }

  private secret(key: string): string {
    return requireConfig(this.config, key);
  }
}
