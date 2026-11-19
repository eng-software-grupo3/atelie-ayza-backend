
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modelo, ParteModelo } from '../entities/modelo.entity.js';
import { ModeloService } from './modelo.service.js';

const ID = '7bcb11e2-2fa4-4fd0-a2df-c6f5ecb7b97d';

const validData = {
  nome: 'Cortininha',
  parte: ParteModelo.CIMA,
  valor: 40,
  metragem_media_m: 0.4,
  svg_url: '<svg>exemplo</svg>',
};

describe('ModeloService', () => {
  let service: ModeloService;
  let rows: Modelo[];
  let repo: any;

  beforeEach(() => {
    rows = [];

    repo = {
      find: vi.fn(async ({ where }) =>
        rows.filter((row) =>
          Object.entries(where).every(
            ([key, value]) =>
              (row as any)[key] === value,
          ),
        ),
      ),

      findOneBy: vi.fn(async (where) =>
        rows.find((row) =>
          Object.entries(where).every(
            ([key, value]) =>
              (row as any)[key] === value,
          ),
        ) ?? null,
      ),

      create: vi.fn((data) => ({
        ...data,
        id: ID,
      })),

      save: vi.fn(async (row) => {
        if (!rows.includes(row)) {
          rows.push(row);
        }
        return row;
      }),
    };

    service = new ModeloService(repo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a model with server controlled defaults', async () => {
    const result = await service.create(validData);

    expect(result).toMatchObject({
      id: ID,
      nome: 'Cortininha',
      parte: ParteModelo.CIMA,
      valor: 40,
      metragem_media_m: 0.4,
      svg_url: '<svg>exemplo</svg>',
      habilitado: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].excluido).toBe(false);
    expect(rows[0].atualizadoEm).toBeInstanceOf(Date);
  });

  it('accepts the maximum numeric(10,2) values', async () => {
    const result = await service.create({
      ...validData,
      valor: 99999999.99,
      metragem_media_m: 99999999.99,
    });

    expect(result.valor).toBe(99999999.99);
    expect(result.metragem_media_m).toBe(99999999.99);
  });

  it.each([
    [{ ...validData, nome: '' }],
    [{ ...validData, nome: 'x'.repeat(101) }],
    [{ ...validData, parte: 'INVALIDA' }],
    [{ ...validData, valor: '-1' }],
    [{ ...validData, valor: '1.001' }],
    [{ ...validData, valor: '100000000' }],
    [{ ...validData, metragem_media_m: '0' }],
    [{ ...validData, metragem_media_m: '-0.01' }],
    [{ ...validData, metragem_media_m: '1.001' }],
    [{ ...validData, metragem_media_m: '100000000' }],
    [{ ...validData, svg_url: '' }],
  ])('rejects invalid create payloads', async (payload) => {
    await expect(
      service.create(payload as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rows).toHaveLength(0);
  });

  it('lists all non-excluded models for management', async () => {
    await service.create(validData);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledWith({
      where: { excluido: false },
    });
  });

  it('lists only enabled models in the public route', async () => {
    await service.create(validData);

    const row = rows[0];
    row.habilitado = false;

    const result = await service.list(false);

    expect(result).toHaveLength(0);
    expect(repo.find).toHaveBeenCalledWith({
      where: {
        excluido: false,
        habilitado: true,
      },
    });
  });

  it('does not expose management fields in public results', async () => {
    await service.create(validData);

    const result = await service.list(false);

    expect(result[0]).not.toHaveProperty('habilitado');
    expect(result[0]).not.toHaveProperty('atualizado_em');
  });

  it('gets a model by id', async () => {
    await service.create(validData);

    const result = await service.get(ID);

    expect(result).toMatchObject({
      id: ID,
      nome: 'Cortininha',
    });
  });

  it('throws NotFoundException when model does not exist', async () => {
    await expect(
      service.get(ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates model data without changing protected fields', async () => {
    await service.create(validData);

    const row = rows[0];
    const originalDate = row.atualizadoEm;

    const result = await service.update(ID, {
      nome: 'Cortininha Atualizada',
      valor: 55,
    });

    expect(result).toMatchObject({
      nome: 'Cortininha Atualizada',
      valor: 55,
      habilitado: true,
    });

    expect(row.excluido).toBe(false);
    expect(row.metragemMediaM).toBe(0.4);
    expect(row.atualizadoEm.getTime()).toBeGreaterThanOrEqual(
      originalDate.getTime(),
    );
  });

  it('rejects invalid update data', async () => {
    await service.create(validData);

    await expect(
      service.update(ID, { valor: -10 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rows[0].valor).toBe(40);
  });

  it('does not update a non-existing model', async () => {
    await expect(
      service.update(ID, { nome: 'Novo nome' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('disables and enables a model', async () => {
    await service.create(validData);

    const disabled = await service.setHabilitado(ID, false);

    expect(disabled.habilitado).toBe(false);
    expect(rows[0].habilitado).toBe(false);

    const enabled = await service.setHabilitado(ID, true);

    expect(enabled.habilitado).toBe(true);
    expect(rows[0].habilitado).toBe(true);
  });

  it('does not change habilitado when updating other fields', async () => {
    await service.create(validData);

    rows[0].habilitado = false;

    await service.update(ID, {
      nome: 'Novo nome',
    });

    expect(rows[0].habilitado).toBe(false);
  });

  it('logically deletes a model without removing the row', async () => {
    await service.create(validData);

    await service.remove(ID);

    expect(rows).toHaveLength(1);
    expect(rows[0].excluido).toBe(true);
    expect(await service.list()).toHaveLength(0);
  });

  it('does not delete a non-existing model', async () => {
    await expect(
      service.remove(ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not allow access to an already deleted model', async () => {
    await service.create(validData);

    rows[0].excluido = true;

    await expect(
      service.get(ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
