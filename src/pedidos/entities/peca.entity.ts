import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Modelo } from '../../catalogo/entities/modelo.entity.js';
import { AderecoPeca } from './adereco-peca.entity.js';
import { Tamanho } from './enums.js';


@Entity('peca')
export class Peca {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Modelo, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_modelo' })
  modelo!: Modelo;

  @Column({ type: 'enum', enum: Tamanho, enumName: 'enum_tamanho' })
  tamanho!: Tamanho;

  @OneToMany(() => AderecoPeca, (a) => a.peca)
  adereco!: Relation<AderecoPeca[]>;
}
