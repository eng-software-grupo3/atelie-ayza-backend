import { Check, Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import { Tecido } from '../../catalogo/entities/tecido.entity.js';
import { Peca } from './peca.entity.js';
import { Pedido } from './pedido.entity.js';

@Entity('conjunto')
@Check('"preco" >= 0')
export class Conjunto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Pedido, (p) => p.conjuntos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_pedido' })
  pedido!: Relation<Pedido>;

  @Column({ name: 'foto_cliente', type: 'text', nullable: true })
  fotoCliente!: string | null;

  @OneToOne(() => Peca, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_peca_cima' })
  pecaCima!: Relation<Peca>;

  @OneToOne(() => Peca, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_peca_baixo' })
  pecaBaixo!: Relation<Peca>;

  @ManyToOne(() => Tecido, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tecido' })
  tecido!: Tecido;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  preco!: number;

  @Column({ type: 'text', nullable: true })
  observacao!: string | null;
}
