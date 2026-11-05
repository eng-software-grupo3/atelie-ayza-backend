import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';

import { Adereco } from './entities/adereco.entity.js';
import { Modelo } from './entities/modelo.entity.js';
import { Tecido } from './entities/tecido.entity.js';

import {
  ModeloController,
  ModelosPublicController,
} from './modelo.controller.js';


import { ModeloService } from './modelo.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Modelo, Tecido, Adereco]),
  ],
  controllers: [
    ModeloController,
    ModelosPublicController,
  ],
  providers: [
    ModeloService,
  ],
  exports: [TypeOrmModule],
})
export class CatalogoModule {}
