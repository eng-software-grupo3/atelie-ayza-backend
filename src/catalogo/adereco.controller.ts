import { ArgumentsHost, Body, Catch, Controller, Delete, ExceptionFilter, Get, HttpCode, HttpStatus, Param, Patch, Post, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guards.js';
import { AderecoService } from './adereco.service.js';
import type { AderecoUpload } from './adereco.service.js';
import { AderecoManagementDto, AderecoPublicDto, CreateAderecoBodyDto, CreateAderecoMultipartDto, PatchAderecoBodyDto, PatchAderecoMultipartDto } from './dto/adereco.dto.js';

@Catch()
class UploadErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const e = error as { code?: string; message?: string };
    if (!e.code?.startsWith('LIMIT_')) throw error;
    const status = e.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message: e.message });
  }
}

@ApiTags('adereços') @Controller('api/gestao/aderecos') @UseGuards(JwtAuthGuard, AdminGuard) @ApiBearerAuth() @ApiProduces('application/json')
@ApiResponse({ status: 401, description: 'Não autenticado' }) @ApiResponse({ status: 403, description: 'Acesso restrito a administradores' }) @ApiResponse({ status: 404, description: 'Adereço inexistente ou excluído' })
export class AderecoController {
  constructor(private readonly service: AderecoService) {}
  @Get() @ApiOkResponse({ type: AderecoManagementDto, isArray: true }) list() { return this.service.list(); }
  @Get(':id') @ApiOkResponse({ type: AderecoManagementDto }) get(@Param('id') id: string) { return this.service.get(id); }
  @Post() @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } })) @UseFilters(UploadErrorFilter) @ApiConsumes('multipart/form-data') @ApiBody({ type: CreateAderecoMultipartDto }) @ApiCreatedResponse({ type: AderecoManagementDto }) @ApiResponse({ status: 400, description: 'Campos inválidos' }) @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' }) @ApiResponse({ status: 415, description: 'Formato não suportado' })
  create(@Body() body: CreateAderecoBodyDto, @UploadedFile() file: AderecoUpload) { return this.service.create(body, file); }
  @Patch(':id') @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } })) @UseFilters(UploadErrorFilter) @ApiConsumes('multipart/form-data') @ApiBody({ type: PatchAderecoMultipartDto }) @ApiOkResponse({ type: AderecoManagementDto }) @ApiResponse({ status: 400, description: 'Campos inválidos' }) @ApiResponse({ status: 413, description: 'Foto maior que 5 MiB' }) @ApiResponse({ status: 415, description: 'Formato não suportado' })
  update(@Param('id') id: string, @Body() body: PatchAderecoBodyDto, @UploadedFile() file?: AderecoUpload) { return this.service.update(id, body, file); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse({ description: 'Adereço excluído logicamente' }) remove(@Param('id') id: string) { return this.service.remove(id); }
}

@ApiTags('adereços') @Controller('api/aderecos')
export class AderecosPublicController {
  constructor(private readonly service: AderecoService) {}
  @Get() @ApiOkResponse({ type: AderecoPublicDto, isArray: true }) list() { return this.service.list(false); }
}
