import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Pedido } from './pedido.entity.js';
import { StatusPedido } from './enums.js';

@Entity('historico_status')
export class HistoricoStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Pedido, (p) => p.historico, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_pedido' })
  pedido!: Relation<Pedido>;

  @Column({ type: 'enum', enum: StatusPedido, enumName: 'enum_status' })
  status!: StatusPedido;

  @CreateDateColumn({ name: 'data_mudanca', type: 'timestamp' })
  dataMudanca!: Date;

  @Column({ type: 'text', nullable: true })
  motivo!: string | null;
}
