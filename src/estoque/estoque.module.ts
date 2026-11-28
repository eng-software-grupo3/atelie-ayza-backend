import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimentacaoEstoque } from './entities/movimentacao-estoque.entity.js';
import { EstoqueService } from './estoque.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MovimentacaoEstoque])],
  providers: [EstoqueService],
  exports: [TypeOrmModule, EstoqueService],
})
export class EstoqueModule {}
