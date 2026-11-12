import {
  ArgumentsHost, Body, Catch, Controller, Delete, ExceptionFilter, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseFilters,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse,
  ApiOkResponse, ApiProduces, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../../auth/auth.guards.js';
import { TecidoService } from './tecido.service.js';
import type { TecidoUpload } from './tecido.service.js';
import { CreateTecidoBodyDto } from './dto/create-tecido-body.dto.js';
import { CreateTecidoMultipartDto } from './dto/create-tecido-multipart.dto.js';
import { PatchTecidoBodyDto } from './dto/patch-tecido-body.dto.js';
import { PatchTecidoMultipartDto } from './dto/patch-tecido-multipart.dto.js';
import { TecidoManagementDto } from './dto/tecido-management.dto.js';
import { UpdateTecidoDesabilitadoDto } from './dto/update-tecido-desabilitado.dto.js';
import { UpdateTecidoQuantidadeDto } from './dto/update-tecido-quantidade.dto.js';
@Catch()
class UploadErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const multerError = error as { code?: string; message?: string };
    if (!multerError.code?.startsWith('LIMIT_')) throw error;
    const response = host.switchToHttp().getResponse();
    const status = multerError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    response.status(status).json({ statusCode: status, message: multerError.message });
  }
}
@ApiTags('tecidos')
@Controller('api/gestao/tecidos')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Acesso restrito a administradores' })
@ApiResponse({ status: 404, description: 'Tecido inexistente ou excluído' })
export class TecidoController {
  constructor(private readonly service: TecidoService) {}

  @Get()
  @ApiOkResponse({ type: TecidoManagementDto, isArray: true })
  list() { return this.service.list(); }

  @Get(':id')
  @ApiOkResponse({ type: TecidoManagementDto })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  get(@Param('id', new ParseUUIDPipe()) id: string) { return this.service.get(id); }

  @Post()
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @UseFilters(UploadErrorFilter)
  @ApiConsumes('multipart/form-data') @ApiBody({ type: CreateTecidoMultipartDto })
  @ApiCreatedResponse({ type: TecidoManagementDto })
  @ApiResponse({ status: 400, description: 'Campos inválidos' })
  @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' })
  @ApiResponse({ status: 415, description: 'Formato de foto não suportado' })
  create(@Body() body: CreateTecidoBodyDto, @UploadedFile() file: TecidoUpload) { return this.service.create(body, file); }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @UseFilters(UploadErrorFilter)
  @ApiConsumes('multipart/form-data') @ApiBody({ type: PatchTecidoMultipartDto })
  @ApiOkResponse({ type: TecidoManagementDto })
  @ApiResponse({ status: 400, description: 'ID ou campos inválidos' })
  @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' })
  @ApiResponse({ status: 415, description: 'Formato de foto não suportado' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: PatchTecidoBodyDto, @UploadedFile() file?: TecidoUpload) { return this.service.update(id, body, file); }

  @Patch(':id/quantidade')
  @ApiBody({ type: UpdateTecidoQuantidadeDto })
  @ApiOkResponse({ type: TecidoManagementDto })
  @ApiResponse({ status: 400, description: 'ID ou quantidade inválidos' })
  updateQuantity(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateTecidoQuantidadeDto) { return this.service.updateQuantity(id, body); }

  @Patch(':id/desabilitado')
  @ApiBody({ type: UpdateTecidoDesabilitadoDto })
  @ApiOkResponse({ type: TecidoManagementDto })
  @ApiResponse({ status: 400, description: 'ID ou valor de desabilitado inválidos' })
  updateDisabled(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateTecidoDesabilitadoDto) { return this.service.updateDisabled(id, body); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tecido excluído logicamente' })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) { return this.service.remove(id); }
}
