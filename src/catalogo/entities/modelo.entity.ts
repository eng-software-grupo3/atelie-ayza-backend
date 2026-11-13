import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';

export enum ParteModelo {
  CIMA = 'CIMA',
  BAIXO = 'BAIXO',
}

@Entity('modelo')
@Check('"valor" >= 0')
@Check('"metragem_media_m" > 0')
export class Modelo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nome!: string;

  @Column({ type: 'enum', enum: ParteModelo, enumName: 'parte_modelo' })
  parte!: ParteModelo;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  valor!: number;

  @Column({ name: 'metragem_media_m', type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  metragemMediaM!: number;

  @Column({ name: 'svg_url', type: 'text' })
  svgUrl!: string;

  @Column({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;

  @Column({ default: true })
  habilitado!: boolean;

  @Column({ default: false })
  excluido!: boolean;
}