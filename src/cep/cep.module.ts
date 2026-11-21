import { Module } from '@nestjs/common';
import { CepService } from './cep.service.js';

@Module({
  providers: [CepService],
  exports: [CepService],
})
export class CepModule {}