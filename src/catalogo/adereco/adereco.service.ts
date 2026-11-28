import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { Adereco } from '../entities/adereco.entity.js';
import { MAX_CATALOG_UPLOAD_SIZE } from '../upload.constants.js';
import { CreateAderecoBodyDto } from './dto/create-adereco-body.dto.js';
import { PatchAderecoBodyDto } from './dto/patch-adereco-body.dto.js';
import { UpdateAderecoDesabilitadoDto } from './dto/update-adereco-desabilitado.dto.js';
import { UpdateAderecoQuantidadeDto } from './dto/update-adereco-quantidade.dto.js';

const directory = () =>
  process.env.ADERECOS_UPLOAD_DIR || join(process.cwd(), 'uploads/aderecos');
const MANAGED_PHOTO_PATH =
  /^\/uploads\/aderecos\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i;
export type AderecoUpload = { buffer: Buffer; size: number };

function errorDetails(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function errorCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

function detectedType(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return undefined;
}

function amount(value: unknown): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value))
  ) {
    throw new BadRequestException('preco inválido');
  }
  return Number(value);
}

function quantity(value: unknown): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^-[0-9]+$|^[0-9]+$/.test(String(value))
  ) {
    throw new BadRequestException('quantidade inválida');
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > 2147483647 || result < -2147483648) {
    throw new BadRequestException('quantidade inválida');
  }
  return result;
}

@Injectable()
export class AderecoService {
  private readonly logger = new Logger(AderecoService.name);

  constructor(
    @InjectRepository(Adereco) private readonly repo: Repository<Adereco>,
  ) {}

  async savePhoto(file?: AderecoUpload): Promise<string | undefined> {
    if (!file) return undefined;
    if (
      file.size > MAX_CATALOG_UPLOAD_SIZE ||
      file.buffer.length > MAX_CATALOG_UPLOAD_SIZE
    ) {
      throw new PayloadTooLargeException();
    }
    const extension = detectedType(file.buffer);
    if (!extension) {
      throw new UnsupportedMediaTypeException(
        'Foto deve ser JPG, PNG ou WebP',
      );
    }
    const filename = `${randomUUID()}.${extension}`;
    try {
      await mkdir(directory(), { recursive: true });
      await writeFile(join(directory(), filename), file.buffer, { flag: 'wx' });
    } catch (error) {
      this.logger.error('Falha ao salvar foto', errorDetails(error));
      throw new InternalServerErrorException('Falha ao salvar foto');
    }
    return `/uploads/aderecos/${filename}`;
  }

  async list(admin = true) {
    const where = admin
      ? { excluido: false }
      : { excluido: false, desabilitado: false };
    return (await this.repo.find({ where })).map((row) =>
      this.project(row, admin),
    );
  }

  async get(id: string) {
    return this.project(await this.find(id), true);
  }

  async create(data: CreateAderecoBodyDto, file?: AderecoUpload) {
    const nome = this.normalizeName(data.nome);
    const preco = amount(data.preco);
    const quantidadeValue = quantity(data.quantidade);
    if (!file) throw new BadRequestException('foto obrigatória');
    const foto = await this.savePhoto(file);
    try {
      const row = this.repo.create({
        nome,
        foto: foto!,
        preco,
        quantidade: quantidadeValue,
        estoqueMinimo: 0,
        desabilitado: false,
        excluido: false,
      });
      return this.project(await this.repo.save(row), true);
    } catch (error) {
      await this.removeNewPhoto(foto!);
      throw error;
    }
  }

  async update(id: string, data: PatchAderecoBodyDto, file?: AderecoUpload) {
    const row = await this.find(id);
    if (data.nome !== undefined) row.nome = this.normalizeName(data.nome);
    if (data.preco !== undefined) row.preco = amount(data.preco);
    const previousPhoto = row.foto;
    const photo = await this.savePhoto(file);
    if (photo) row.foto = photo;
    let saved: Adereco;
    try {
      saved = await this.repo.save(row);
    } catch (error) {
      if (photo) await this.removeNewPhoto(photo);
      throw error;
    }
    if (photo && previousPhoto && previousPhoto !== photo) {
      await this.removeOldPhotoIfUnused(previousPhoto, row.id);
    }
    return this.project(saved, true);
  }

  async updateQuantity(id: string, data: UpdateAderecoQuantidadeDto) {
    const row = await this.find(id);
    row.quantidade = quantity(data.quantidade);
    return this.project(await this.repo.save(row), true);
  }

  async updateDisabled(id: string, data: UpdateAderecoDesabilitadoDto) {
    const row = await this.find(id);
    if (typeof data.desabilitado !== 'boolean') {
      throw new BadRequestException('desabilitado inválido');
    }
    row.desabilitado = data.desabilitado;
    return this.project(await this.repo.save(row), true);
  }

  async remove(id: string): Promise<void> {
    const row = await this.find(id);
    row.excluido = true;
    await this.repo.save(row);
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('nome inválido');
    }
    const nome = value.trim();
    if (!nome || nome.length > 100) {
      throw new BadRequestException('nome inválido');
    }
    return nome;
  }

  private async removeNewPhoto(photo: string): Promise<void> {
    const filename = MANAGED_PHOTO_PATH.exec(photo)?.[1];
    if (!filename) return;
    try {
      await unlink(join(directory(), filename));
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        this.logger.warn(
          'Não foi possível remover a foto nova após falha ao salvar',
          errorDetails(error),
        );
      }
    }
  }

  private async removeOldPhotoIfUnused(
    photo: string,
    aderecoId: string,
  ): Promise<void> {
    const filename = MANAGED_PHOTO_PATH.exec(photo)?.[1];
    if (!filename) return;

    let references: Adereco[];
    try {
      references = await this.repo.find({ where: { foto: photo } });
    } catch (error) {
      this.logger.warn(
        'Não foi possível verificar referências à foto antiga',
        errorDetails(error),
      );
      return;
    }
    if (references.some((reference) => reference.id !== aderecoId)) return;

    try {
      await unlink(join(directory(), filename));
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        this.logger.warn(
          'Não foi possível remover a foto antiga',
          errorDetails(error),
        );
      }
    }
  }

  private async find(id: string) {
    const row = await this.repo.findOneBy({ id, excluido: false });
    if (!row) throw new NotFoundException();
    return row;
  }

  private project(row: Adereco, admin: boolean) {
    const common = {
      id: row.id,
      nome: row.nome,
      foto: row.foto,
      preco: row.preco,
    };
    return admin
      ? {
          ...common,
          quantidade: row.quantidade,
          desabilitado: row.desabilitado,
        }
      : common;
  }
}
