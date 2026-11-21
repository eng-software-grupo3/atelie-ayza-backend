import { Module } from '@nestjs/common';
import { AderecoModule } from './adereco/adereco.module.js';
import { ModeloModule } from './modelo/modelo.module.js';
import { TecidoModule } from './tecido/tecido.module.js';

@Module({
  imports: [ModeloModule, TecidoModule, AderecoModule],
})
export class CatalogoModule {}
