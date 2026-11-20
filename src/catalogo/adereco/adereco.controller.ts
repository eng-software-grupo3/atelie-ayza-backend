import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../../auth/auth.guards.js';
import { MAX_CATALOG_UPLOAD_SIZE } from '../upload.constants.js';
import { AderecoService } from './adereco.service.js';
import type { AderecoUpload } from './adereco.service.js';
import { AderecoManagementDto } from './dto/adereco-management.dto.js';
import { AderecoPublicDto } from './dto/adereco-public.dto.js';
import { CreateAderecoBodyDto } from './dto/create-adereco-body.dto.js';
import { CreateAderecoMultipartDto } from './dto/create-adereco-multipart.dto.js';
import { PatchAderecoBodyDto } from './dto/patch-adereco-body.dto.js';
import { PatchAderecoMultipartDto } from './dto/patch-adereco-multipart.dto.js';
import { UpdateAderecoDesabilitadoDto } from './dto/update-adereco-desabilitado.dto.js';
import { UpdateAderecoQuantidadeDto } from './dto/update-adereco-quantidade.dto.js';

@Catch()
class UploadErrorFilter extends BaseExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    if (typeof code !== 'string' || !code.startsWith('LIMIT_')) {
      super.catch(error, host);
      return;
    }

    const status = code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    host.switchToHttp().getResponse().status(status).json({
      statusCode: status,
      message: error instanceof Error ? error.message : 'Falha no upload',
    });
  }
}

@ApiTags('adereços')
@Controller('api/gestao/aderecos')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Acesso restrito a administradores' })
@ApiResponse({ status: 404, description: 'Adereço inexistente ou excluído' })
export class AderecoController {
  constructor(private readonly service: AderecoService) {}

  @Get()
  @ApiOkResponse({ type: AderecoManagementDto, isArray: true })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: AderecoManagementDto })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_CATALOG_UPLOAD_SIZE } }),
  )
  @UseFilters(UploadErrorFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateAderecoMultipartDto })
  @ApiCreatedResponse({ type: AderecoManagementDto })
  @ApiResponse({ status: 400, description: 'Campos inválidos' })
  @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' })
  @ApiResponse({ status: 415, description: 'Formato não suportado' })
  create(
    @Body() body: CreateAderecoBodyDto,
    @UploadedFile() file: AderecoUpload,
  ) {
    return this.service.create(body, file);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_CATALOG_UPLOAD_SIZE } }),
  )
  @UseFilters(UploadErrorFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: PatchAderecoMultipartDto })
  @ApiOkResponse({ type: AderecoManagementDto })
  @ApiResponse({ status: 400, description: 'Campos inválidos' })
  @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' })
  @ApiResponse({ status: 415, description: 'Formato não suportado' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchAderecoBodyDto,
    @UploadedFile() file?: AderecoUpload,
  ) {
    return this.service.update(id, body, file);
  }

  @Patch(':id/quantidade')
  @ApiBody({ type: UpdateAderecoQuantidadeDto })
  @ApiOkResponse({ type: AderecoManagementDto })
  @ApiResponse({ status: 400, description: 'Quantidade inválida' })
  updateQuantity(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAderecoQuantidadeDto,
  ) {
    return this.service.updateQuantity(id, body);
  }

  @Patch(':id/desabilitado')
  @ApiBody({ type: UpdateAderecoDesabilitadoDto })
  @ApiOkResponse({ type: AderecoManagementDto })
  @ApiResponse({ status: 400, description: 'Valor de desabilitado inválido' })
  updateDisabled(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAderecoDesabilitadoDto,
  ) {
    return this.service.updateDisabled(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Adereço excluído logicamente' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}

@ApiTags('adereços')
@Controller('api/aderecos')
export class AderecosPublicController {
  constructor(private readonly service: AderecoService) {}

  @Get()
  @ApiOkResponse({ type: AderecoPublicDto, isArray: true })
  list() {
    return this.service.list(false);
  }
}
