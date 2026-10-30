import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';

@Entity('tecido')
@Check('"quantidade_m" >= 0')
@Check('"preco_metro" >= 0')
export class Tecido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  foto!: string | null;

  @Column({ name: 'quantidade_m', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  quantidadeM!: number;

  @Column({ name: 'preco_metro', type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  precoMetro!: number;

  @Column({ name: 'estoque_minimo_m', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  estoqueMinimoM!: number;

  @Column({ name: 'largura_cm', type: 'int', nullable: true })
  larguraCm!: number | null;

  @Column({ default: false })
  desabilitado!: boolean;

  @Column({ default: false })
  excluido!: boolean;
}