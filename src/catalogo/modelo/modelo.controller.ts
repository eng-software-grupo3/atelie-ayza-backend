
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard, AdminGuard } from '../../auth/auth.guards.js';

import { ModeloService } from './modelo.service.js';

import { CreateModeloDto } from './dto/create-modelo.dto.js';
import { ModeloManagementDto } from './dto/modelo-management.dto.js';
import { PatchModeloDto } from './dto/patch-modelo.dto.js';
import { SetModeloHabilitadoDto } from './dto/set-modelo-habilitado.dto.js';

@ApiTags('modelos')
@Controller('api/gestao/modelos')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({
  status: 403,
  description: 'Acesso restrito a administradores',
})
@ApiResponse({
  status: 404,
  description: 'Modelo inexistente ou excluído',
})
export class ModeloController {
  constructor(private readonly service: ModeloService) {}

  @Get()
  @ApiOkResponse({ type: ModeloManagementDto, isArray: true })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: ModeloManagementDto })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: ModeloManagementDto })
  @ApiResponse({ status: 400, description: 'Campos inválidos' })
  create(@Body() body: CreateModeloDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ModeloManagementDto })
  @ApiResponse({ status: 400, description: 'ID ou campos inválidos' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchModeloDto,
  ) {
    return this.service.update(id, body);
  }

  @Patch(':id/habilitado')
  @ApiOkResponse({ type: ModeloManagementDto })
  @ApiResponse({ status: 400, description: 'ID ou campo habilitado inválido' })
  setHabilitado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SetModeloHabilitadoDto,
  ) {
    return this.service.setHabilitado(id, body.habilitado);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Modelo excluído logicamente',
  })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
