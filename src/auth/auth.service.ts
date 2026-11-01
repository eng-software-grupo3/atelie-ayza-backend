import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
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
  type AccessTokenPayload,
  type RefreshTokenPayload,
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
    this.encryptionKey();
    const state = signState(this.stateSecret());
    return { state, url: this.google.authorizationUrl(state) };
  }

  async login(
    code: string,
    state: string,
    cookieState?: string,
  ): Promise<AuthSessionDto> {
    this.encryptionKey();
    if (!code || !isValidState(state, cookieState, this.stateSecret())) {
      throw new UnauthorizedException(
        'Invalid OAuth state or authorization code',
      );
    }

    const { profile, refreshToken } = await this.google.exchange(code);
    const user = await this.saveUser(profile, refreshToken);
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSessionDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const payload = await this.verifyRefresh(refreshToken);
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return {
      accessToken: await this.signAccess(user),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUser(user),
    };
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
    const user = await this.users
      .createQueryBuilder('usuario')
      .addSelect('usuario.googleRefreshToken')
      .where('usuario.id_google = :idGoogle', { idGoogle })
      .getOne();
    if (!user?.googleRefreshToken) {
      throw new UnauthorizedException('Google account has no refresh token');
    }

    let refreshToken: string;
    try {
      refreshToken = decryptSecret(
        user.googleRefreshToken,
        this.encryptionKey(),
      );
    } catch {
      throw new UnauthorizedException('Google account has no refresh token');
    }
    return this.google.accessTokenFromRefresh(refreshToken);
  }

  private async issueSession(user: Usuario): Promise<AuthSessionDto> {
    return {
      accessToken: await this.signAccess(user),
      refreshToken: await this.signRefresh(user),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUser(user),
    };
  }

  private async signAccess(user: Usuario): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      typ: 'access',
      ver: user.tokenVersion,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  private async signRefresh(user: Usuario): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      typ: 'refresh',
      ver: user.tokenVersion,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token);
      if (
        payload.typ !== 'refresh' ||
        !payload.sub ||
        typeof payload.ver !== 'number'
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async saveUser(
    profile: GoogleProfile,
    refreshToken?: string | null,
  ): Promise<Usuario> {
    const email = profile.email.trim().toLowerCase();
    const nome = (profile.name?.trim() || email.split('@')[0]).slice(0, 120);
    const values: Partial<Usuario> = {
      idGoogle: profile.sub,
      nome,
      email,
      fotoUrl: profile.picture ?? null,
      isAdmin: this.isAdminEmail(email),
    };
    if (refreshToken) {
      values.googleRefreshToken = encryptSecret(
        refreshToken,
        this.encryptionKey(),
      );
    }

    let user = await this.users.findOne({ where: { idGoogle: profile.sub } });
    if (!user) user = await this.findByEmail(email);

    try {
      if (user) {
        await this.users.update(user.id, values);
        return await this.users.findOneByOrFail({ id: user.id });
      }
      return await this.users.save(
        this.users.create({ ...values, tokenVersion: 0 }),
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Could not save Google user', {
        cause: error,
      });
    }
  }

  private async findByEmail(email: string): Promise<Usuario | null> {
    return this.users
      .createQueryBuilder('usuario')
      .where('LOWER(usuario.email) = :email', { email })
      .getOne();
  }

  private isAdminEmail(email: string): boolean {
    const adminEmail = this.config
      .get<string>('ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    return Boolean(adminEmail && email === adminEmail);
  }

  private stateSecret(): string {
    return this.required('JWT_SECRET');
  }

  private encryptionKey(): string {
    return this.required('TOKEN_ENCRYPTION_KEY');
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException(`Missing ${key}`);
    return value;
  }
}
