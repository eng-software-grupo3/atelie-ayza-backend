import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Adereco } from '../../catalogo/entities/adereco.entity.js';
import { Peca } from './peca.entity.js';

// Uma linha por adereço aplicado; quantidade = contagem de linhas.
// Coordenadas em proporção da imagem (0 a 1).
@Entity('adereco_peca')
@Check('"coordenada_x" >= 0 AND "coordenada_x" <= 1')
@Check('"coordenada_y" >= 0 AND "coordenada_y" <= 1')
export class AderecoPeca {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Peca, (p) => p.adereco, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_peca' })
  peca!: Relation<Peca>;

  @ManyToOne(() => Adereco, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_adereco' })
  adereco!: Adereco;

  @Column({ name: 'coordenada_x', type: 'numeric', precision: 5, scale: 4 })
  coordenadaX!: string;

  @Column({ name: 'coordenada_y', type: 'numeric', precision: 5, scale: 4 })
  coordenadaY!: string;
}
