import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  pictureUrl!: string | null;

  @ApiProperty()
  isAdmin!: boolean;
}

export class AuthSessionDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class RefreshSessionDto {
  @ApiProperty({ description: 'Refresh token received after Google sign-in' })
  refreshToken!: string;
}
