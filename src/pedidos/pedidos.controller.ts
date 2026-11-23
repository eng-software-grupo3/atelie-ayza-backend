import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiProduces, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.guards.js';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import { CriarPedidoDto, PedidoCriadoDto, PedidoDetalheDto, PedidoListaDto } from './pedidos.dto.js';
import { PedidosService } from './pedidos.service.js';

@ApiTags('pedidos')
@Controller('api/pedidos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  @ApiOkResponse({ type: PedidoListaDto, isArray: true })
  listar(@CurrentUser() user: Usuario) {
    return this.service.listar(user);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PedidoDetalheDto })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado ou não pertence ao cliente autenticado' })
  obterDetalhe(@CurrentUser() user: Usuario, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obterDetalhe(user, id);
  }

  @Post()
  @ApiBody({ type: CriarPedidoDto })
  @ApiCreatedResponse({ type: PedidoCriadoDto })
  @ApiResponse({ status: 400, description: 'Campo inválido, modalidade não atendida, modelo na parte errada ou data anterior ao mínimo' })
  @ApiResponse({ status: 409, description: 'code data_indisponivel (data bloqueada ou ocupada) ou item_indisponivel (com a lista ids)' })
  @ApiResponse({ status: 503, description: 'Serviço de frete indisponível' })
  create(@CurrentUser() user: Usuario, @Body() body: CriarPedidoDto) {
    return this.service.create(user, body);
  }
}
