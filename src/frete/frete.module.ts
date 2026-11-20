import { Module } from '@nestjs/common';
import { FreteTabelaService } from './frete-tabela.service.js';
import { FreteService } from './frete.service.js';

@Module({
  providers: [{ provide: FreteService, useClass: FreteTabelaService }],
  exports: [FreteService],
})
export class FreteModule {}