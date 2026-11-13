import {
  BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException,
  PayloadTooLargeException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { Tecido } from '../entities/tecido.entity.js';

const MAX_SIZE = 5 * 1024 * 1024;
const directory = () => process.env.TECIDOS_UPLOAD_DIR || join(process.cwd(), 'uploads/tecidos');
const MANAGED_PHOTO_PATH = /^\/uploads\/tecidos\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i;
export type TecidoUpload = { buffer: Buffer; size: number };

function errorDetails(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

function detectedType(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}

function amount(value: unknown, field: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(`${field} inválido`);
  }
  const text = String(value);
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw new BadRequestException(`${field} inválido`);
  return Number(text);
}

@Injectable()
export class TecidoService {
  private readonly logger = new Logger(TecidoService.name);

  constructor(@InjectRepository(Tecido) private readonly repo: Repository<Tecido>) {}

  async savePhoto(file?: TecidoUpload): Promise<string | undefined> {
    if (!file) return undefined;
    if (file.size > MAX_SIZE || file.buffer.length > MAX_SIZE) throw new PayloadTooLargeException();
    const extension = detectedType(file.buffer);
    if (!extension) throw new UnsupportedMediaTypeException('Foto deve ser JPG, PNG ou WebP');
    const filename = `${randomUUID()}.${extension}`;
    try {
      await mkdir(directory(), { recursive: true });
      await writeFile(join(directory(), filename), file.buffer, { flag: 'wx' });
    } catch (error) {
      this.logger.error('Falha ao salvar foto', errorDetails(error));
      throw new InternalServerErrorException('Falha ao salvar foto');
    }
    return `/uploads/tecidos/${filename}`;
  }

  async list(admin = true) {
    const where = admin ? { excluido: false } : { excluido: false, desabilitado: false };
    return (await this.repo.find({ where })).map((tecido) => this.project(tecido, admin));
  }

  async get(id: string) { return this.project(await this.find(id), true); }

  async create(data: Record<string, unknown>, file?: TecidoUpload) {
    const nome = this.normalizeName(data.nome);
    const precoMetro = amount(data.preco_metro, 'preco_metro');
    const quantidadeM = amount(data.quantidade, 'quantidade');
    if (!file) throw new BadRequestException('foto obrigatória');
    const foto = await this.savePhoto(file);
    try {
      const tecido = this.repo.create({ nome, foto: foto!, precoMetro, quantidadeM, desabilitado: false, excluido: false });
      return this.project(await this.repo.save(tecido), true);
    } catch (error) {
      await unlink(join(directory(), foto!.split('/').pop()!)).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, data: Record<string, unknown>, file?: TecidoUpload) {
    const tecido = await this.find(id);
    if (data.nome !== undefined) tecido.nome = this.normalizeName(data.nome);
    if (data.preco_metro !== undefined) tecido.precoMetro = amount(data.preco_metro, 'preco_metro');
    const previousPhoto = tecido.foto;
    const photo = await this.savePhoto(file);
    if (photo) tecido.foto = photo;
    let saved: Tecido;
    try { saved = await this.repo.save(tecido); }
    catch (error) {
      if (photo) await unlink(join(directory(), photo.split('/').pop()!)).catch(() => undefined);
      throw error;
    }
    if (photo && previousPhoto && previousPhoto !== photo) {
      await this.removeOldPhotoIfUnused(previousPhoto, tecido.id);
    }
    return this.project(saved, true);
  }

  async updateQuantity(id: string, data: Record<string, unknown>) {
    const tecido = await this.find(id);
    tecido.quantidadeM = amount(data.quantidade, 'quantidade');
    return this.project(await this.repo.save(tecido), true);
  }

  async updateDisabled(id: string, data: Record<string, unknown>) {
    const tecido = await this.find(id);
    if (typeof data.desabilitado !== 'boolean') throw new BadRequestException('desabilitado inválido');
    tecido.desabilitado = data.desabilitado;
    return this.project(await this.repo.save(tecido), true);
  }

  async remove(id: string): Promise<void> {
    const tecido = await this.find(id);
    tecido.excluido = true;
    await this.repo.save(tecido);
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== 'string') throw new BadRequestException('nome inválido');
    const nome = value.trim();
    if (!nome || nome.length > 100) throw new BadRequestException('nome inválido');
    return nome;
  }

  private async removeOldPhotoIfUnused(photo: string, tecidoId: string): Promise<void> {
    const filename = MANAGED_PHOTO_PATH.exec(photo)?.[1];
    if (!filename) return;

    let references: Tecido[];
    try {
      references = await this.repo.find({ where: { foto: photo } });
    } catch (error) {
      this.logger.warn('Não foi possível verificar referências à foto antiga', errorDetails(error));
      return;
    }
    if (references.some((reference) => reference.id !== tecidoId)) return;

    try {
      await unlink(join(directory(), filename));
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        this.logger.warn('Não foi possível remover a foto antiga', errorDetails(error));
      }
    }
  }

  private async find(id: string) {
    const tecido = await this.repo.findOneBy({ id, excluido: false });
    if (!tecido) throw new NotFoundException();
    return tecido;
  }
  private project(tecido: Tecido, admin: boolean) {
    const common = { id: tecido.id, nome: tecido.nome, foto: tecido.foto, preco_metro: tecido.precoMetro };
    return admin ? { ...common, quantidade: tecido.quantidadeM, desabilitado: tecido.desabilitado } : common;
  }
}
