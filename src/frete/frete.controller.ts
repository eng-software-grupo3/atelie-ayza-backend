import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guards.js';
import { CotacaoFreteDto } from './frete.dto.js';
import { FreteCotacaoService } from './frete-cotacao.service.js';

@ApiTags('frete')
@Controller('api/frete')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
export class FreteController {
  constructor(private readonly service: FreteCotacaoService) {}

  @Get('cotacao')
  @ApiQuery({ name: 'cep', example: '64800000', description: '8 dígitos, hífen aceito' })
  @ApiQuery({ name: 'conjuntos', example: 1, description: 'Quantidade de conjuntos (1 a 6)' })
  @ApiOkResponse({ type: CotacaoFreteDto })
  @ApiResponse({ status: 400, description: 'CEP ou quantidade inválidos, CEP inexistente ou sem modalidade atendida' })
  @ApiResponse({ status: 503, description: 'Serviço de CEP ou de frete indisponível' })
  cotar(@Query('cep') cep?: string, @Query('conjuntos') conjuntos?: string) {
    return this.service.cotar(cep, conjuntos);
  }
}