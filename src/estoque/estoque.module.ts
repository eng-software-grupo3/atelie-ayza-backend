import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimentacaoEstoque } from './entities/movimentacao-estoque.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([MovimentacaoEstoque])],
  exports: [TypeOrmModule],
})
export class EstoqueModule {}
