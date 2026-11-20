import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiProduces, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.guards.js';
import { Usuario } from '../pessoas/entities/usuario.entity.js';
import { CriarPedidoDto, PedidoCriadoDto } from './pedidos.dto.js';
import { PedidosService } from './pedidos.service.js';

@ApiTags('pedidos')
@Controller('api/pedidos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

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