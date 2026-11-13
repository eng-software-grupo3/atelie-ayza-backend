import { BadRequestException, InternalServerErrorException, Logger, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TecidoService } from './tecido.service.js';

const signatures: Record<string, Buffer> = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0]),
  png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  webp: Buffer.from('RIFF0000WEBP'),
};
const file = (buffer = signatures.png) => ({ buffer, size: buffer.length });

describe('TecidoService', () => {
  let directory: string;
  let service: TecidoService;
  let rows: any[];
  let repo: any;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'tecidos-'));
    process.env.TECIDOS_UPLOAD_DIR = directory;
    rows = [];
    repo = {
      find: vi.fn(async ({ where }) => rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value))),
      findOneBy: vi.fn(async ({ id, excluido }) => rows.find((row) => row.id === id && row.excluido === excluido) ?? null),
      create: vi.fn((value) => ({ ...value, id: 'server-generated-uuid' })),
      save: vi.fn(async (row) => { if (!rows.includes(row)) rows.push(row); return row; }),
    };
    service = new TecidoService(repo);
  });
  afterEach(async () => { delete process.env.TECIDOS_UPLOAD_DIR; await rm(directory, { recursive: true, force: true }); });

  it.each(Object.entries(signatures))('validates %s signature and persists a UUID URL', async (extension, buffer) => {
    const url = await service.savePhoto(file(buffer));
    expect(url).toMatch(new RegExp(`^/uploads/tecidos/[0-9a-f-]{36}\\.${extension}$`));
    expect(await readFile(join(directory, url!.split('/').pop()!))).toEqual(buffer);
  });

  it('rejects unsupported signatures and files larger than 5 MiB', async () => {
    await expect(service.savePhoto(file(Buffer.from('not an image')))).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(service.savePhoto({ buffer: signatures.png, size: 5 * 1024 * 1024 + 1 })).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('creates with generated id and server controlled defaults', async () => {
    const result = await service.create({ nome: 'Linho', preco_metro: '12.50', quantidade: '2.25', excluido: true, desabilitado: true }, file());
    expect(result).toMatchObject({ id: 'server-generated-uuid', nome: 'Linho', preco_metro: 12.5, quantidade: 2.25, desabilitado: false });
    expect(rows[0].excluido).toBe(false);
  });

  it('accepts name length 100 and the maximum numeric(10,2) amount', async () => {
    const result = await service.create({ nome: 'N'.repeat(100), preco_metro: '99999999.99', quantidade: '0.01' }, file());
    expect(result.nome).toHaveLength(100);
    expect(result.preco_metro).toBe(99999999.99);
    expect(rows[0].quantidadeM).toBe(0.01);
  });

  it.each([
    [{ nome: '', preco_metro: '1', quantidade: '1' }],
    [{ nome: 'x'.repeat(101), preco_metro: '1', quantidade: '1' }],
    [{ nome: 'x', preco_metro: '-1', quantidade: '1' }],
    [{ nome: 'x', preco_metro: '1.001', quantidade: '1' }],
    [{ nome: 'x', preco_metro: '1', quantidade: '100000000' }],
    [{ nome: 'x', preco_metro: '100000000', quantidade: '1' }],
    [{ nome: 'x', preco_metro: '1', quantidade: '-0.01' }],
  ])('rejects invalid create payloads', async (payload) => {
    const upload = payload.nome === 'x' && payload.quantidade === '1' ? undefined : file();
    await expect(service.create(payload, upload)).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('rejects a missing photo without persisting a record', async () => {
    await expect(service.create({ nome: 'Linho', preco_metro: '1', quantidade: '1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('projects and filters admin/public reads; patch preserves quantity and flags; delete keeps row', async () => {
    await service.create({ nome: 'A', preco_metro: '1', quantidade: '7' }, file());
    const row = rows[0];
    const originalPhoto = row.foto;
    const publicResult = await service.list(false);
    expect(publicResult[0]).not.toHaveProperty('quantidade');
    row.desabilitado = true;
    expect(await service.list(false)).toEqual([]);
    expect(await service.list()).toHaveLength(1);
    await service.update(row.id, { nome: 'B', quantidade: '999', excluido: true, desabilitado: false });
    expect(row).toMatchObject({ quantidadeM: 7, excluido: false, desabilitado: true, nome: 'B', foto: originalPhoto });
    expect(await readFile(join(directory, originalPhoto.split('/').pop()!))).toEqual(signatures.png);
    await service.remove(row.id);
    expect(rows).toHaveLength(1);
    expect(await service.list()).toEqual([]);
  });

  it('removes the previous managed photo after saving its replacement', async () => {
    await service.create({ nome: 'Linho', preco_metro: '1', quantidade: '1' }, file());
    const row = rows[0];
    const previousPhoto = row.foto as string;
    const previousFile = join(directory, previousPhoto.split('/').pop()!);

    const updated = await service.update(row.id, {}, file(signatures.jpg));
    const replacementPhoto = updated.foto as string;

    expect(replacementPhoto).not.toBe(previousPhoto);
    await expect(readFile(previousFile)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(directory, replacementPhoto.split('/').pop()!))).toEqual(signatures.jpg);
  });

  it('keeps the previous photo if saving the replacement fails', async () => {
    await service.create({ nome: 'Linho', preco_metro: '1', quantidade: '1' }, file());
    const row = rows[0];
    const previousPhoto = row.foto as string;
    const previousFile = join(directory, previousPhoto.split('/').pop()!);
    let attemptedPhoto: string | undefined;
    repo.save.mockImplementationOnce(async (tecido) => {
      attemptedPhoto = tecido.foto;
      throw new Error('Falha simulada ao salvar tecido');
    });

    await expect(service.update(row.id, {}, file(signatures.jpg))).rejects.toThrow('Falha simulada ao salvar tecido');

    expect(await readFile(previousFile)).toEqual(signatures.png);
    expect(attemptedPhoto).toBeDefined();
    await expect(readFile(join(directory, attemptedPhoto!.split('/').pop()!))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not delete an old photo still referenced by another fabric', async () => {
    await service.create({ nome: 'Linho', preco_metro: '1', quantidade: '1' }, file());
    const row = rows[0];
    const previousPhoto = row.foto as string;
    const previousFile = join(directory, previousPhoto.split('/').pop()!);
    rows.push({ id: 'another-fabric', foto: previousPhoto });

    await service.update(row.id, {}, file(signatures.jpg));

    expect(await readFile(previousFile)).toEqual(signatures.png);
  });

  it('does not delete a seed photo when replacing it', async () => {
    const seedPhoto = '/uploads/tecidos/seed-lycra-lisa-rosa.png';
    const seedFile = join(directory, 'seed-lycra-lisa-rosa.png');
    await writeFile(seedFile, signatures.png);
    rows.push({ id: 'seeded-fabric', nome: 'Lycra Lisa Rosa', foto: seedPhoto, precoMetro: 1, quantidadeM: 1, excluido: false });

    await service.update('seeded-fabric', {}, file(signatures.jpg));

    expect(await readFile(seedFile)).toEqual(signatures.png);
  });

  it('updates quantity and disabled state through dedicated operations', async () => {
    await service.create({ nome: 'A', preco_metro: '1', quantidade: '2.25' }, file());
    const row = rows[0];
    expect((await service.updateQuantity(row.id, { quantidade: '4.50' })).quantidade).toBe(4.5);
    expect((await service.updateDisabled(row.id, { desabilitado: true })).desabilitado).toBe(true);
    await expect(service.updateQuantity(row.id, { quantidade: '1.234' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateDisabled(row.id, { desabilitado: 'false' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an internal error and logs when photo storage fails', async () => {
    const occupied = join(directory, 'occupied');
    await writeFile(occupied, 'not a directory');
    process.env.TECIDOS_UPLOAD_DIR = occupied;
    const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      await expect(service.create({ nome: 'A', preco_metro: '1', quantidade: '1' }, file()))
        .rejects.toBeInstanceOf(InternalServerErrorException);
      expect(loggerSpy).toHaveBeenCalledWith('Falha ao salvar foto', expect.any(String));
      expect(rows).toHaveLength(0);
    } finally {
      loggerSpy.mockRestore();
    }
  });
});
