import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Adereco } from '../../catalogo/entities/adereco.entity.js';
import { Tecido } from '../../catalogo/entities/tecido.entity.js';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import { Pedido } from '../../pedidos/entities/pedido.entity.js';

export enum TipoMovimentacao {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
  CORRECAO = 'correcao',
  BAIXA_PEDIDO = 'baixa_pedido',
  DEVOLUCAO_PEDIDO = 'devolucao_pedido',
}

// Exatamente um entre tecido e adereço; quantidade sempre positiva (o tipo diz se soma ou subtrai).
@Entity('movimentacao_estoque')
@Check('("id_tecido" IS NOT NULL AND "id_adereco" IS NULL) OR ("id_tecido" IS NULL AND "id_adereco" IS NOT NULL)')
@Check('"quantidade" > 0')
export class MovimentacaoEstoque {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tecido, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tecido' })
  tecido!: Tecido | null;

  @ManyToOne(() => Adereco, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_adereco' })
  adereco!: Adereco | null;

  @Column({ type: 'enum', enum: TipoMovimentacao, enumName: 'enum_movimentacao' })
  tipo!: TipoMovimentacao;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  quantidade!: number;

  @ManyToOne(() => Pedido, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_pedido' })
  pedido!: Relation<Pedido> | null;

  @CreateDateColumn({ name: 'data_movimentacao', type: 'timestamp' })
  dataMovimentacao!: Date;

  @Column({ type: 'text', nullable: true })
  observacao!: string | null;
}
