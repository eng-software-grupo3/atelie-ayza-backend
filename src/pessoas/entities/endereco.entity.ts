import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('endereco')
export class Endereco {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 150 })
  rua!: string;

  @Column({ length: 100 })
  bairro!: string;

  @Column({ length: 100 })
  cidade!: string;

  @Column({ length: 2 })
  estado!: string;

  @Column({ length: 8 })
  cep!: string;

  @Column({ length: 20 })
  numero!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  complemento!: string | null;
}
