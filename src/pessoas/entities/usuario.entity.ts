import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'id_google', length: 64, unique: true })
  idGoogle!: string;

  @Column({ length: 120 })
  nome!: string;

  // RF-01 só pede nome e foto do cliente; e-mail é obrigatório só para a admin (validar no back)
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'foto_url', type: 'text', nullable: true })
  fotoUrl!: string | null;

  @Column({ name: 'is_admin', default: false })
  isAdmin!: boolean;
}
