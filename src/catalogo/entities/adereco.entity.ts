import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';

@Entity('adereco')
@Check('"quantidade" >= 0')
@Check('"preco" >= 0')
export class Adereco {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nome!: string;

  // tipo livre (ex.: pedraria, argola, laço), digitado pela gestora
  @Column({ length: 60 })
  tipo!: string;

  @Column({ type: 'text', nullable: true })
  foto!: string | null;

  @Column({ type: 'int', default: 0 })
  quantidade!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  preco!: number;

  @Column({ name: 'estoque_minimo', type: 'int', default: 0 })
  estoqueMinimo!: number;

  @Column({ default: false })
  desabilitado!: boolean;

  @Column({ default: false })
  excluido!: boolean;
}
