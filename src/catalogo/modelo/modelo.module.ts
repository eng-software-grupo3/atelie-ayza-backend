import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module.js';
import { Modelo } from '../entities/modelo.entity.js';
import { ModeloController } from './modelo.controller.js';
import { ModelosPublicController } from './modelo-public.controller.js';
import { ModeloService } from './modelo.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Modelo])],
  controllers: [ModeloController, ModelosPublicController],
  providers: [ModeloService],
})
export class ModeloModule {}
