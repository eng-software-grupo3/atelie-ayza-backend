import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CepModule } from '../cep/cep.module.js';
import { FreteModule } from '../frete/frete.module.js';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { AderecoPeca } from './entities/adereco-peca.entity.js';
import { Conjunto } from './entities/conjunto.entity.js';
import { HistoricoStatus } from './entities/historico-status.entity.js';
import { Peca } from './entities/peca.entity.js';
import { Pedido } from './entities/pedido.entity.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosAdminController } from './pedidos-admin.controller.js';
import { PedidosService } from './pedidos.service.js';

@Module({
  imports: [
    AuthModule,
    CepModule,
    FreteModule,
    EstoqueModule,
    TypeOrmModule.forFeature([Pedido, Conjunto, Peca, AderecoPeca, HistoricoStatus]),
  ],
  controllers: [PedidosController, PedidosAdminController],
  providers: [PedidosService],
  exports: [TypeOrmModule],
})
export class PedidosModule {}