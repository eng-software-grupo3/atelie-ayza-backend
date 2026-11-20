import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
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
    const result = await service.create({ nome: 'Linho', preco_metro: '12.50', quantidade_m: '2.25', excluido: true, desabilitado: true }, file());
    expect(result).toMatchObject({ id: 'server-generated-uuid', nome: 'Linho', preco_metro: 12.5, quantidade_m: 2.25, desabilitado: false });
    expect(rows[0].excluido).toBe(false);
  });

  it('accepts name length 100 and the maximum numeric(10,2) amount', async () => {
    const result = await service.create({ nome: 'N'.repeat(100), preco_metro: '99999999.99', quantidade_m: '0.01' }, file());
    expect(result.nome).toHaveLength(100);
    expect(result.preco_metro).toBe(99999999.99);
    expect(rows[0].quantidadeM).toBe(0.01);
  });

  it.each([
    [{ nome: '', preco_metro: '1', quantidade_m: '1' }],
    [{ nome: 'x'.repeat(101), preco_metro: '1', quantidade_m: '1' }],
    [{ nome: 'x', preco_metro: '-1', quantidade_m: '1' }],
    [{ nome: 'x', preco_metro: '1.001', quantidade_m: '1' }],
    [{ nome: 'x', preco_metro: '1', quantidade_m: '100000000' }],
    [{ nome: 'x', preco_metro: '100000000', quantidade_m: '1' }],
    [{ nome: 'x', preco_metro: '1', quantidade_m: '-0.01' }],
  ])('rejects invalid create payloads', async (payload) => {
    const upload = payload.nome === 'x' && payload.quantidade_m === '1' ? undefined : file();
    await expect(service.create(payload, upload)).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('rejects a missing photo without persisting a record', async () => {
    await expect(service.create({ nome: 'Linho', preco_metro: '1', quantidade_m: '1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('projects and filters admin/public reads; patch preserves quantity and flags; delete keeps row', async () => {
    await service.create({ nome: 'A', preco_metro: '1', quantidade_m: '7' }, file());
    const row = rows[0];
    const publicResult = await service.list(false);
    expect(publicResult[0]).not.toHaveProperty('quantidade_m');
    row.desabilitado = true;
    expect(await service.list(false)).toEqual([]);
    expect(await service.list()).toHaveLength(1);
    await service.update(row.id, { nome: 'B', quantidade_m: '999', excluido: true, desabilitado: false });
    expect(row).toMatchObject({ quantidadeM: 7, excluido: false, desabilitado: true, nome: 'B' });
    await service.remove(row.id);
    expect(rows).toHaveLength(1);
    expect(await service.list()).toEqual([]);
  });

  it('does not persist a record if photo storage fails', async () => {
    const occupied = join(directory, 'occupied');
    await writeFile(occupied, 'not a directory');
    process.env.TECIDOS_UPLOAD_DIR = occupied;
    await expect(service.create({ nome: 'A', preco_metro: '1', quantidade_m: '1' }, file())).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });
});
