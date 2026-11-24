import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiBody,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { StatusPedido } from './entities/enums.js';
import {
  PedidoGestaoDetalheDto,
  PedidoGestaoPaginaDto,
  PedidoAcaoDto,
  RecusarPedidoDto,
} from './pedidos.dto.js';
import { PedidosService } from './pedidos.service.js';

@ApiTags('gestao-pedidos')
@Controller('api/gestao/pedidos')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Acesso restrito a administradores' })
export class PedidosAdminController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: [...Object.values(StatusPedido), 'todos'] })
  @ApiQuery({ name: 'pagina', required: false, example: 1 })
  @ApiQuery({ name: 'limite', required: false, example: 10 })
  @ApiQuery({ name: 'ordem', required: false, enum: ['asc', 'desc'], example: 'desc' })
  @ApiOkResponse({ type: PedidoGestaoPaginaDto })
  @ApiResponse({ status: 400, description: 'Status, página, limite ou ordem inválidos' })
  listar(
    @Query('status') status?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('ordem') ordem?: string,
  ) {
    return this.service.listarGestao(status, pagina, limite, ordem);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PedidoGestaoDetalheDto })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  obterDetalhe(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obterDetalheGestao(id);
  }

  @Patch(':id/aceitar')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PedidoAcaoDto })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  @ApiResponse({ status: 409, description: 'Transição inválida ou item do pedido inexistente no catálogo' })
  aceitar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.aceitarPedido(id);
  }

  @Patch(':id/recusar')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RecusarPedidoDto })
  @ApiOkResponse({ type: PedidoAcaoDto })
  @ApiResponse({ status: 400, description: 'Motivo inválido' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  @ApiResponse({ status: 409, description: 'Transição inválida' })
  recusar(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: RecusarPedidoDto) {
    return this.service.recusarPedido(id, body);
  }
}
