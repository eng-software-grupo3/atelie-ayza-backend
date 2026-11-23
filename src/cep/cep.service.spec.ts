import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CepService } from './cep.service.js';

const resposta = (corpo: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => corpo,
});

const campina = {
  cep: '58400-000',
  logradouro: 'Rua das Flores',
  bairro: 'Centro',
  localidade: 'Campina Grande',
  uf: 'PB',
};
const floriano = { cep: '64800-000', logradouro: '', bairro: '', localidade: 'Floriano', uf: 'PI' };

describe('CepService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('consulta o ViaCEP e normaliza a resposta', async () => {
    fetchMock.mockResolvedValue(resposta(campina));
    const service = new CepService();

    expect(await service.consultar(' 58400-000 ')).toEqual({
      cep: '58400000',
      logradouro: 'Rua das Flores',
      bairro: 'Centro',
      cidade: 'Campina Grande',
      estado: 'PB',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/58400000/json/',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('logradouro e bairro vazios (CEP único da cidade) viram nulo', async () => {
    fetchMock.mockResolvedValue(resposta(floriano));
    expect(await new CepService().consultar('64800000')).toEqual({
      cep: '64800000',
      logradouro: null,
      bairro: null,
      cidade: 'Floriano',
      estado: 'PI',
    });
  });

  it.each([true, 'true'])('CEP inexistente (erro = %s) devolve 400', async (erro) => {
    fetchMock.mockResolvedValue(resposta({ erro }));
    const service = new CepService();
    await expect(service.consultar('99999999')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.consultar('99999999')).rejects.toThrow('CEP não encontrado');
  });

  it.each(['5840000', '5840A-000', '', undefined, 58400000])(
    'rejeita CEP em formato inválido (%s) sem consultar o ViaCEP',
    async (cep) => {
      await expect(new CepService().consultar(cep)).rejects.toThrow('cep inválido');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rede ou timeout devolve 503', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(new CepService().consultar('58400000')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('resposta com status de erro devolve 503', async () => {
    fetchMock.mockResolvedValue(resposta({}, false));
    await expect(new CepService().consultar('58400000')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('JSON inválido devolve 503', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('JSON inválido');
      },
    });
    await expect(new CepService().consultar('58400000')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('resposta sem cidade ou UF devolve 503', async () => {
    fetchMock.mockResolvedValue(resposta({ logradouro: 'Rua A' }));
    await expect(new CepService().consultar('58400000')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each(['', 'P', 'PIA', 'Piauí', 'XX', 27])(
    'resposta com UF inválida "%s" devolve 503',
    async (uf) => {
      fetchMock.mockResolvedValue(
        resposta({ localidade: 'Campina Grande', uf }),
      );
      await expect(new CepService().consultar('58400000')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('normaliza uma UF válida para maiúsculas', async () => {
    fetchMock.mockResolvedValue(
      resposta({ localidade: 'Campina Grande', uf: 'pb' }),
    );
    await expect(new CepService().consultar('58400000')).resolves.toMatchObject({
      estado: 'PB',
    });
  });

  it('reaproveita o cache na segunda consulta do mesmo CEP', async () => {
    fetchMock.mockResolvedValue(resposta(campina));
    const service = new CepService();
    await service.consultar('58400000');
    await service.consultar('58400-000');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('consulta de novo depois de 24 horas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
    fetchMock.mockResolvedValue(resposta(campina));
    const service = new CepService();
    await service.consultar('58400000');

    vi.setSystemTime(new Date('2026-11-22T12:00:01Z'));
    await service.consultar('58400000');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não guarda falhas no cache', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(resposta(campina));
    const service = new CepService();
    await expect(service.consultar('58400000')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.consultar('58400000')).resolves.toMatchObject({ cidade: 'Campina Grande' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});