import { BadRequestException, InternalServerErrorException, Logger, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AderecoService } from './adereco.service.js';
import { MAX_CATALOG_UPLOAD_SIZE } from '../upload.constants.js';

const signatures: Record<string, Buffer> = { jpg: Buffer.from([0xff, 0xd8, 0xff, 0]), png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), webp: Buffer.from('RIFF0000WEBP') };
const file = (buffer = signatures.png) => ({ buffer, size: buffer.length });

describe('AderecoService', () => {
  let directory: string; let service: AderecoService; let rows: any[]; let repo: any;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'aderecos-')); process.env.ADERECOS_UPLOAD_DIR = directory; rows = [];
    repo = {
      find: vi.fn(async ({ where }) => rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value))),
      findOneBy: vi.fn(async ({ id, excluido }) => rows.find((row) => row.id === id && row.excluido === excluido) ?? null),
      create: vi.fn((value) => ({ ...value, id: 'server-id' })),
      save: vi.fn(async (row) => { if (!rows.includes(row)) rows.push(row); return row; }),
    };
    service = new AderecoService(repo);
  });
  afterEach(async () => { delete process.env.ADERECOS_UPLOAD_DIR; await rm(directory, { recursive: true, force: true }); });

  it.each(Object.entries(signatures))('stores %s with UUID URL', async (ext, buffer) => {
    const url = await service.savePhoto(file(buffer));
    expect(url).toMatch(new RegExp(`^/uploads/aderecos/[0-9a-f-]{36}\\.${ext}$`));
    expect(await readFile(join(directory, url!.split('/').pop()!))).toEqual(buffer);
  });
  it('rejects invalid signature and files over 5 MiB', async () => {
    await expect(service.savePhoto(file(Buffer.from('bad')))).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(service.savePhoto({ ...file(), size: MAX_CATALOG_UPLOAD_SIZE + 1 })).rejects.toBeInstanceOf(PayloadTooLargeException);
    const oversizedBuffer = Buffer.alloc(MAX_CATALOG_UPLOAD_SIZE + 1);
    signatures.png.copy(oversizedBuffer);
    await expect(service.savePhoto({ buffer: oversizedBuffer, size: signatures.png.length })).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
  it('creates defaults/projection and preserves quantity and flags on patch', async () => {
    const result = await service.create(
      Object.assign(
        { nome: '  Laço  ', preco: '12.50', quantidade: '4' },
        { desabilitado: true },
      ),
      file(),
    );
    expect(result).toMatchObject({ id: 'server-id', preco: 12.5, quantidade: 4, desabilitado: false });
    expect(result.nome).toBe('Laço');
    expect(rows[0]).toMatchObject({ tipo: 'adereço', estoqueMinimo: 0, excluido: false });
    expect(await service.list(false)).toEqual([{ id: 'server-id', nome: 'Laço', foto: rows[0].foto, preco: 12.5 }]);
    rows[0].desabilitado = true;
    await service.update(
      rows[0].id,
      Object.assign({ nome: ' Novo ', preco: '3' }, {
        quantidade: 99,
        desabilitado: false,
        excluido: true,
      }),
    );
    expect(rows[0]).toMatchObject({ nome: 'Novo', quantidade: 4, desabilitado: true, excluido: false });
    expect(await service.list(false)).toEqual([]); expect(await service.list()).toHaveLength(1);
    await service.remove(rows[0].id); expect(rows).toHaveLength(1); expect(await service.list()).toEqual([]);
  });
  it('returns not found for missing or logically deleted records', async () => {
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    await service.create({ nome: 'A', preco: '1', quantidade: '1' }, file());
    await service.remove(rows[0].id);
    await expect(service.get(rows[0].id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('updates quantity and disabled state through dedicated operations', async () => {
    await service.create({ nome: 'A', preco: '1', quantidade: '1' }, file());
    const row = rows[0];
    expect((await service.updateQuantity(row.id, { quantidade: '7' })).quantidade).toBe(7);
    expect((await service.updateDisabled(row.id, { desabilitado: true })).desabilitado).toBe(true);
    await expect(service.updateQuantity(row.id, { quantidade: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateDisabled(row.id, { desabilitado: 'false' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([
    { nome: '', preco: '1', quantidade: '1' }, { nome: 'x'.repeat(101), preco: '1', quantidade: '1' },
    { nome: 'x', preco: '-1', quantidade: '1' }, { nome: 'x', preco: '1.001', quantidade: '1' },
    { nome: 'x', preco: '100000000', quantidade: '1' }, { nome: 'x', preco: '1', quantidade: '1.2' },
  ])('rejects invalid payload %#', async (payload) => {
    await expect(service.create(payload, file())).rejects.toBeInstanceOf(BadRequestException); expect(rows).toHaveLength(0);
  });
  it('removes uploaded photo if persistence fails', async () => {
    repo.save.mockRejectedValueOnce(new Error('db failure'));
    await expect(service.create({ nome: 'A', preco: '1', quantidade: '1' }, file())).rejects.toThrow('db failure');
    expect(rows).toHaveLength(0);
  });

  it('removes the old managed photo after replacement', async () => {
    await service.create({ nome: 'A', preco: '1', quantidade: '1' }, file());
    const row = rows[0];
    const oldPhoto = row.foto as string;
    const oldPath = join(directory, oldPhoto.split('/').pop()!);
    const updated = await service.update(row.id, {}, file(signatures.jpg));
    expect(updated.foto).not.toBe(oldPhoto);
    await expect(readFile(oldPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the previous photo and removes the replacement if persistence fails', async () => {
    await service.create({ nome: 'A', preco: '1', quantidade: '1' }, file());
    const row = rows[0];
    const oldPhoto = row.foto as string;
    const oldPath = join(directory, oldPhoto.split('/').pop()!);
    let attemptedPhoto: string | undefined;
    repo.save.mockImplementationOnce(async (updated) => {
      attemptedPhoto = updated.foto;
      throw new Error('Falha simulada ao salvar adereço');
    });

    await expect(service.update(row.id, {}, file(signatures.jpg)))
      .rejects.toThrow('Falha simulada ao salvar adereço');

    expect(await readFile(oldPath)).toEqual(signatures.png);
    expect(attemptedPhoto).toBeDefined();
    await expect(readFile(join(directory, attemptedPhoto!.split('/').pop()!)))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps an old photo while another record references it', async () => {
    await service.create({ nome: 'A', preco: '1', quantidade: '1' }, file());
    const row = rows[0];
    const oldPhoto = row.foto as string;
    const oldPath = join(directory, oldPhoto.split('/').pop()!);
    rows.push({ id: 'other', foto: oldPhoto });
    await service.update(row.id, {}, file(signatures.jpg));
    expect(await readFile(oldPath)).toEqual(signatures.png);
  });

  it('returns an internal server error and logs when photo storage fails', async () => {
    const occupied = join(directory, 'not-a-directory');
    await writeFile(occupied, 'file');
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADERECOS_UPLOAD_DIR = occupied;
    try {
      await expect(service.savePhoto(file())).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(logger).toHaveBeenCalled();
    } finally {
      process.env.ADERECOS_UPLOAD_DIR = directory;
      logger.mockRestore();
    }
  });
});
