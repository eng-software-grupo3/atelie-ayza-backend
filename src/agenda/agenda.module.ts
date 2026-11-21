import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Pedido } from '../pedidos/entities/pedido.entity.js';
import { AgendaClienteController } from './agenda-cliente.controller.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaService } from './agenda.service.js';
import { DatasDisponiveisService } from './datas-disponiveis.service.js';
import { AgendaOcupado } from './entities/agenda-ocupado.entity.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([AgendaOcupado, Pedido])],
  controllers: [AgendaController, AgendaClienteController],
  providers: [AgendaService, DatasDisponiveisService],
  exports: [TypeOrmModule, AgendaService],
})
export class AgendaModule {}