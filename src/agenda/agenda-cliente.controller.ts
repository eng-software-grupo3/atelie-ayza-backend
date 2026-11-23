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
import { DatasDisponiveisDto } from './datas-disponiveis.dto.js';
import { DatasDisponiveisService } from './datas-disponiveis.service.js';

@ApiTags('agenda')
@Controller('api/agenda')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
export class AgendaClienteController {
  constructor(private readonly service: DatasDisponiveisService) {}

  @Get('datas-disponiveis')
  @ApiQuery({ name: 'mes', example: '2026-12', description: 'Formato YYYY-MM (anos 2000 a 2099)' })
  @ApiQuery({
    name: 'prazo_frete_dias',
    example: 7,
    description: 'Prazo da modalidade escolhida, de 0 a 60, como devolvido pela cotação',
  })
  @ApiOkResponse({ type: DatasDisponiveisDto })
  @ApiResponse({ status: 400, description: 'mes ou prazo_frete_dias inválidos' })
  listar(@Query('mes') mes?: string, @Query('prazo_frete_dias') prazoFreteDias?: string) {
    return this.service.listar(mes, prazoFreteDias);
  }
}