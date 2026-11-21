import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CepModule } from '../cep/cep.module.js';
import { FreteController } from './frete.controller.js';
import { FreteCotacaoService } from './frete-cotacao.service.js';
import { FreteTabelaService } from './frete-tabela.service.js';
import { FreteService } from './frete.service.js';

@Module({
  imports: [AuthModule, CepModule],
  controllers: [FreteController],
  providers: [FreteCotacaoService, { provide: FreteService, useClass: FreteTabelaService }],
  exports: [FreteService],
})
export class FreteModule {}