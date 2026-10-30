import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Adereco } from './entities/adereco.entity.js';
import { Modelo } from './entities/modelo.entity.js';
import { Tecido } from './entities/tecido.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Modelo, Tecido, Adereco])],
  exports: [TypeOrmModule],
})
export class CatalogoModule {}