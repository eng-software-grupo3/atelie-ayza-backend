import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import { Endereco } from '../../pessoas/entities/endereco.entity.js';
import { Usuario } from '../../pessoas/entities/usuario.entity.js';
import { Conjunto } from './conjunto.entity.js';
import { HistoricoStatus } from './historico-status.entity.js';
import { ModalidadeFrete, StatusPedido } from './enums.js';

export { ModalidadeFrete, StatusPedido };



const dec = { type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer } as const;

@Entity('pedido')
@Check('"preco_estimado" >= 0')
@Check('"preco_frete" >= 0')
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'num_pedido', type: 'int', unique: true })
  @Generated('increment')
  numPedido!: number;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cliente' })
  cliente!: Usuario;

  @OneToOne(() => Endereco, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_endereco' })
  endereco!: Endereco;

  @Column({ type: 'enum', enum: StatusPedido, enumName: 'enum_status', default: StatusPedido.EM_ANALISE })
  status!: StatusPedido;

  @Column({ name: 'data_entrega_prevista', type: 'date' })
  dataEntregaPrevista!: string;

  @Column({ length: 20 })
  telefone!: string;

  @Column({ name: 'preco_estimado', ...dec })
  precoEstimado!: number;

  @Column({ name: 'modalidade_frete', type: 'enum', enum: ModalidadeFrete, enumName: 'enum_entrega' })
  modalidadeFrete!: ModalidadeFrete;

  @Column({ name: 'preco_frete', ...dec })
  precoFrete!: number;

  @Column({ name: 'prazo_frete_dias', type: 'int' })
  prazoFreteDias!: number;

  @CreateDateColumn({ name: 'data_pedido', type: 'timestamp' })
  dataPedido!: Date;

  @Column({ name: 'preco_final', ...dec, nullable: true })
  precoFinal!: number | null;

  @Column({ name: 'valor_parcela_1', ...dec, nullable: true })
  valorParcela1!: number | null;

  @Column({ name: 'valor_parcela_2', ...dec, nullable: true })
  valorParcela2!: number | null;

  @Column({ name: 'motivo_recusa_cancelamento', type: 'text', nullable: true })
  motivoRecusaCancelamento!: string | null;

  @OneToMany(() => Conjunto, (c) => c.pedido)
  conjuntos!: Relation<Conjunto[]>;

  @OneToMany(() => HistoricoStatus, (h) => h.pedido)
  historico!: Relation<HistoricoStatus[]>;
}
