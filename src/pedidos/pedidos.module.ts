import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AderecoPeca } from './entities/adereco-peca.entity.js';
import { Conjunto } from './entities/conjunto.entity.js';
import { HistoricoStatus } from './entities/historico-status.entity.js';
import { Peca } from './entities/peca.entity.js';
import { Pedido } from './entities/pedido.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, Conjunto, Peca, AderecoPeca, HistoricoStatus])],
  exports: [TypeOrmModule],
})
export class PedidosModule {}
