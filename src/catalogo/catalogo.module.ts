import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';

import { Adereco } from './entities/adereco.entity.js';
import { Modelo } from './entities/modelo.entity.js';
import { Tecido } from './entities/tecido.entity.js';
import { TecidoController, TecidosPublicController } from './tecido/tecido.controller.js';
import { TecidoService } from './tecido/tecido.service.js';

import {
  ModeloController,
  ModelosPublicController,
} from './modelo/modelo.controller.js';


import { ModeloService } from './modelo/modelo.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Modelo, Tecido, Adereco]),
  ],
  controllers: [
    ModeloController,
    ModelosPublicController,
    TecidoController,
    TecidosPublicController,
  ],
  providers: [
    ModeloService,
    TecidoService,
  ],
  exports: [TypeOrmModule],
})
export class CatalogoModule {}
