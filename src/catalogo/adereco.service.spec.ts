import { BadRequestException, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AderecoService } from './adereco.service.js';

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
    await expect(service.savePhoto({ ...file(), size: 5 * 1024 * 1024 + 1 })).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
  it('creates defaults/projection and preserves quantity and flags on patch', async () => {
    const result = await service.create({ nome: 'Laço', preco: '12.50', quantidade: '4', desabilitado: true }, file());
    expect(result).toMatchObject({ id: 'server-id', preco: 12.5, quantidade: 4, desabilitado: false });
    expect(rows[0]).toMatchObject({ tipo: 'adereço', estoqueMinimo: 0, excluido: false });
    expect(await service.list(false)).toEqual([{ id: 'server-id', nome: 'Laço', foto: rows[0].foto, preco: 12.5 }]);
    rows[0].desabilitado = true;
    await service.update(rows[0].id, { nome: 'Novo', preco: '3', quantidade: 99, desabilitado: false, excluido: true });
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
});
