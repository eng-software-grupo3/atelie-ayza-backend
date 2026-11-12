import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Adereco } from './entities/adereco.entity.js';
import { Modelo } from './entities/modelo.entity.js';
import { Tecido } from './entities/tecido.entity.js';
import { TecidoController } from './tecido/tecido.controller.js';
import { TecidosPublicController } from './tecido/tecido-public.controller.js';
import { TecidoService } from './tecido/tecido.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Modelo, Tecido, Adereco])],
  controllers: [TecidoController, TecidosPublicController],
  providers: [TecidoService],
  exports: [TypeOrmModule],
})
export class CatalogoModule {}
