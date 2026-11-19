import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { Adereco } from './entities/adereco.entity.js';

const MAX_SIZE = 5 * 1024 * 1024;
const directory = () => process.env.ADERECOS_UPLOAD_DIR || join(process.cwd(), 'uploads/aderecos');
export type AderecoUpload = { buffer: Buffer; size: number };

function detectedType(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}

function amount(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value))) throw new BadRequestException('preco inválido');
  return Number(value);
}

function quantity(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) throw new BadRequestException('quantidade inválida');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > 2147483647) throw new BadRequestException('quantidade inválida');
  return result;
}

@Injectable()
export class AderecoService {
  constructor(@InjectRepository(Adereco) private readonly repo: Repository<Adereco>) {}

  async savePhoto(file?: AderecoUpload): Promise<string | undefined> {
    if (!file) return undefined;
    if (file.size > MAX_SIZE) throw new PayloadTooLargeException();
    const extension = detectedType(file.buffer);
    if (!extension) throw new UnsupportedMediaTypeException('Foto deve ser JPG, PNG ou WebP');
    const filename = `${randomUUID()}.${extension}`;
    try {
      await mkdir(directory(), { recursive: true });
      await writeFile(join(directory(), filename), file.buffer, { flag: 'wx' });
    } catch { throw new BadRequestException('Falha ao salvar foto'); }
    return `/uploads/aderecos/${filename}`;
  }

  async list(admin = true) {
    const where = admin ? { excluido: false } : { excluido: false, desabilitado: false };
    return (await this.repo.find({ where })).map((row) => this.project(row, admin));
  }
  async get(id: string) { return this.project(await this.find(id), true); }

  async create(data: Record<string, unknown>, file?: AderecoUpload) {
    this.validateName(data.nome);
    const preco = amount(data.preco);
    const quantidadeValue = quantity(data.quantidade);
    if (!file) throw new BadRequestException('foto obrigatória');
    const foto = await this.savePhoto(file);
    try {
      const row = this.repo.create({ nome: data.nome as string, foto: foto!, preco, quantidade: quantidadeValue, tipo: 'adereço', estoqueMinimo: 0, desabilitado: false, excluido: false });
      return this.project(await this.repo.save(row), true);
    } catch (error) {
      await unlink(join(directory(), foto!.split('/').pop()!)).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, data: Record<string, unknown>, file?: AderecoUpload) {
    const row = await this.find(id);
    if (data.nome !== undefined) { this.validateName(data.nome); row.nome = data.nome as string; }
    if (data.preco !== undefined) row.preco = amount(data.preco);
    const photo = await this.savePhoto(file);
    if (photo) row.foto = photo;
    try { return this.project(await this.repo.save(row), true); }
    catch (error) { if (photo) await unlink(join(directory(), photo.split('/').pop()!)).catch(() => undefined); throw error; }
  }
  async updateQuantity(id: string, data: Record<string, unknown>) {
    const row = await this.find(id);
    row.quantidade = quantity(data.quantidade);
    return this.project(await this.repo.save(row), true);
  }
  async updateDisabled(id: string, data: Record<string, unknown>) {
    const row = await this.find(id);
    if (typeof data.desabilitado !== 'boolean') throw new BadRequestException('desabilitado inválido');
    row.desabilitado = data.desabilitado;
    return this.project(await this.repo.save(row), true);
  }
  async remove(id: string): Promise<void> { const row = await this.find(id); row.excluido = true; await this.repo.save(row); }

  private validateName(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new BadRequestException('nome inválido');
  }
  private async find(id: string) {
    const row = await this.repo.findOneBy({ id, excluido: false });
    if (!row) throw new NotFoundException();
    return row;
  }
  private project(row: Adereco, admin: boolean) {
    const common = { id: row.id, nome: row.nome, foto: row.foto, preco: row.preco };
    return admin ? { ...common, quantidade: row.quantidade, desabilitado: row.desabilitado } : common;
  }
}
