import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOkResponse, ApiParam, ApiProduces, ApiQuery,
  ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { AgendaService } from './agenda.service.js';
import {
  AgendaBloqueioDto, AgendaMesDto, AgendaPedidoDto, UpdateAgendaBloqueadaDto,
} from './agenda.dto.js';

@ApiTags('agenda')
@Controller('api/gestao/agenda')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Acesso restrito a administradores' })
export class AgendaController {
  constructor(private readonly service: AgendaService) {}

  @Get()
  @ApiQuery({ name: 'mes', example: '2026-11', description: 'Formato YYYY-MM' })
  @ApiOkResponse({ type: AgendaMesDto })
  @ApiResponse({ status: 400, description: 'mes ausente ou inválido' })
  calendar(@Query('mes') mes?: string) { return this.service.calendar(mes); }

  @Get(':data/pedidos')
  @ApiParam({ name: 'data', example: '2026-11-20', description: 'Formato YYYY-MM-DD' })
  @ApiOkResponse({ type: AgendaPedidoDto, isArray: true })
  @ApiResponse({ status: 400, description: 'Data inválida' })
  ordersOn(@Param('data') data: string) { return this.service.ordersOn(data); }

  @Patch(':data/bloqueada')
  @ApiParam({ name: 'data', example: '2026-11-20', description: 'Formato YYYY-MM-DD' })
  @ApiBody({ type: UpdateAgendaBloqueadaDto })
  @ApiOkResponse({ type: AgendaBloqueioDto })
  @ApiResponse({ status: 400, description: 'Data inválida ou bloqueada não booleano' })
  setBlocked(@Param('data') data: string, @Body() body: UpdateAgendaBloqueadaDto) {
    return this.service.setBlocked(data, body);
  }
}