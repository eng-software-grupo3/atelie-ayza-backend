import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';

export enum TipoModelo {
  CIMA = 'cima',
  BAIXO = 'baixo',
}

@Entity('modelo')
@Check('"preco" >= 0')
@Check('"metragem_media_m" > 0')
export class Modelo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nome!: string;

  @Column({ type: 'enum', enum: TipoModelo, enumName: 'tipo_modelo' })
  tipo!: TipoModelo;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  preco!: number;

  @Column({ name: 'metragem_media_m', type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  metragemMediaM!: number;

  @Column({ name: 'foto_svg', type: 'text' })
  fotoSvg!: string;

  @Column({ default: false })
  desabilitado!: boolean;

  @Column({ default: false })
  excluido!: boolean;
}