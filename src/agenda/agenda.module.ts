import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaOcupado } from './entities/agenda-ocupado.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaOcupado])],
  exports: [TypeOrmModule],
})
export class AgendaModule {}
