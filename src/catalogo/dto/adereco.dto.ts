import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAderecoMultipartDto {
  @ApiProperty({ maxLength: 100 }) nome!: string;
  @ApiProperty({ type: 'string', format: 'binary' }) foto!: string;
  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }) preco!: number;
  @ApiProperty({ type: Number, format: 'int32', minimum: 0 }) quantidade!: number;
}
export class PatchAderecoMultipartDto {
  @ApiPropertyOptional({ maxLength: 100 }) nome?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) foto?: string;
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 99999999.99, multipleOf: 0.01 }) preco?: number;
}
export class CreateAderecoBodyDto { [key: string]: unknown; nome!: string; preco!: string | number; quantidade!: string | number; }
export class PatchAderecoBodyDto { [key: string]: unknown; nome?: string; preco?: string | number; }
export class AderecoManagementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) foto!: string | null;
  @ApiProperty({ type: Number }) preco!: number;
  @ApiProperty({ type: Number }) quantidade!: number;
  @ApiProperty() desabilitado!: boolean;
}
export class AderecoPublicDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) foto!: string | null;
  @ApiProperty({ type: Number }) preco!: number;
}
