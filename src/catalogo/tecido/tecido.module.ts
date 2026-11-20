import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module.js';
import { Tecido } from '../entities/tecido.entity.js';
import { TecidoController } from './tecido.controller.js';
import { TecidosPublicController } from './tecido-public.controller.js';
import { TecidoService } from './tecido.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Tecido])],
  controllers: [TecidoController, TecidosPublicController],
  providers: [TecidoService],
})
export class TecidoModule {}
