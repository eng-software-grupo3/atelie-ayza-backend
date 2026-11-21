import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DatasDisponiveisService } from './datas-disponiveis.service.js';

type Opcoes = { minima?: string; bloqueadas?: string[]; prazoConfeccao?: string | undefined };

function setup(opcoes: Opcoes = {}) {
  const { minima = '2026-12-05', bloqueadas = [] } = opcoes;
  const ocupado = {
    find: vi.fn(async () => bloqueadas.map((data) => ({ data }))),
    query: vi.fn(async () => [{ minima }]),
  };
  const config = {
    get: vi.fn(() => ('prazoConfeccao' in opcoes ? opcoes.prazoConfeccao : '3')),
  };
  const service = new DatasDisponiveisService(ocupado as never, config as never);
  return { service, ocupado, config };
}

describe('DatasDisponiveisService', () => {
  it('marca indisponíveis os dias antes da data mínima e disponíveis a partir dela', async () => {
    const { service } = setup({ minima: '2026-12-05' });
    const result = await service.listar('2026-12', '7');
    const dia = (data: string) => result.dias.find((d) => d.data === data)?.disponivel;

    expect(result.mes).toBe('2026-12');
    expect(result.data_minima).toBe('2026-12-05');
    expect(result.dias).toHaveLength(31);
    expect(dia('2026-12-01')).toBe(false);
    expect(dia('2026-12-04')).toBe(false);
    expect(dia('2026-12-05')).toBe(true);
    expect(dia('2026-12-31')).toBe(true);
  });

  it('dia bloqueado pela gestora fica indisponível mesmo depois da data mínima', async () => {
    const { service } = setup({ minima: '2026-12-05', bloqueadas: ['2026-12-10'] });
    const result = await service.listar('2026-12', '7');
    const dia = (data: string) => result.dias.find((d) => d.data === data)?.disponivel;

    expect(dia('2026-12-10')).toBe(false);
    expect(dia('2026-12-11')).toBe(true);
  });

  it('mês inteiro antes da data mínima: nenhum dia disponível', async () => {
    const { service } = setup({ minima: '2026-12-05' });
    const result = await service.listar('2026-11', '7');
    expect(result.dias).toHaveLength(30);
    expect(result.dias.every((d) => !d.disponivel)).toBe(true);
  });

  it('mês depois da data mínima e sem bloqueios: todos os dias disponíveis', async () => {
    const { service } = setup({ minima: '2026-11-01' });
    const result = await service.listar('2026-12', '7');
    expect(result.dias.every((d) => d.disponivel)).toBe(true);
  });

  it('calcula a data mínima com a confecção mais o prazo do frete', async () => {
    const { service, ocupado } = setup({ prazoConfeccao: '3' });
    await service.listar('2026-12', '10');
    expect(ocupado.query).toHaveBeenCalledWith(expect.any(String), [13]);
  });

  it('usa PRAZO_CONFECCAO_DIAS do ambiente', async () => {
    const { service, ocupado } = setup({ prazoConfeccao: '5' });
    await service.listar('2026-12', '10');
    expect(ocupado.query).toHaveBeenCalledWith(expect.any(String), [15]);
  });

  it('usa 3 dias de confecção quando a variável não está definida', async () => {
    const { service, ocupado } = setup({ prazoConfeccao: undefined });
    await service.listar('2026-12', '10');
    expect(ocupado.query).toHaveBeenCalledWith(expect.any(String), [13]);
  });

  it('PRAZO_CONFECCAO_DIAS inválido devolve 500', async () => {
    const { service } = setup({ prazoConfeccao: 'abc' });
    await expect(service.listar('2026-12', '7')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('respeita o tamanho de fevereiro, com ano bissexto', async () => {
    const { service } = setup();
    expect((await service.listar('2028-02', '0')).dias).toHaveLength(29);
    expect((await service.listar('2027-02', '0')).dias).toHaveLength(28);
  });

  it.each(['2026-13', '2026-1', '2026-11-01', '1999-12', '', undefined, 202611])(
    'rejeita mes inválido (%s)',
    async (mes) => {
      const { service } = setup();
      await expect(service.listar(mes, '7')).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([undefined, '', '-1', '61', '1.5', 'abc', 7])(
    'rejeita prazo_frete_dias inválido (%s)',
    async (prazo) => {
      const { service } = setup();
      await expect(service.listar('2026-12', prazo)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('não consulta o banco quando um parâmetro é inválido', async () => {
    const { service, ocupado } = setup();
    await expect(service.listar('2026-13', '7')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listar('2026-12', 'abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(ocupado.query).not.toHaveBeenCalled();
    expect(ocupado.find).not.toHaveBeenCalled();
  });
});