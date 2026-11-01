import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('agenda_ocupado')
export class AgendaOcupado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date', unique: true })
  data!: string;
}
