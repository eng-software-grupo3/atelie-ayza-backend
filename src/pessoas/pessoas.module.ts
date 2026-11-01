import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Endereco } from './entities/endereco.entity.js';
import { Usuario } from './entities/usuario.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Endereco])],
  exports: [TypeOrmModule],
})
export class PessoasModule {}
