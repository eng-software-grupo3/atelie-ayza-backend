import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ModalidadeFrete } from '../pedidos/entities/enums.js';
import { FreteCotacaoService } from './frete-cotacao.service.js';

const campina = {
  cep: '58400000',
  logradouro: 'Rua das Flores',
  bairro: 'Centro',
  cidade: 'Campina Grande',
  estado: 'PB',
};
const cotacoes = [
  { modalidade: ModalidadeFrete.PADRAO, preco: 26, prazo_frete_dias: 7 },
  { modalidade: ModalidadeFrete.SEDEX, preco: 48, prazo_frete_dias: 3 },
];

function setup() {
  const cep = { consultar: vi.fn(async () => campina) };
  const frete = { cotar: vi.fn(async () => cotacoes) };
  const service = new FreteCotacaoService(cep as never, frete as never);
  return { service, cep, frete };
}

describe('FreteCotacaoService', () => {
  it('devolve o endereço do ViaCEP e as modalidades', async () => {
    const { service } = setup();
    expect(await service.cotar('58400-000', '2')).toEqual({
      cep: '58400000',
      endereco: {
        logradouro: 'Rua das Flores',
        bairro: 'Centro',
        cidade: 'Campina Grande',
        estado: 'PB',
      },
      modalidades: cotacoes,
    });
  });

  it('cota com a cidade e o estado do ViaCEP e a quantidade de conjuntos', async () => {
    const { service, cep, frete } = setup();
    await service.cotar('58400-000', '3');
    expect(cep.consultar).toHaveBeenCalledWith('58400-000');
    expect(frete.cotar).toHaveBeenCalledWith({
      cep: '58400000',
      cidade: 'Campina Grande',
      estado: 'PB',
      conjuntos: 3,
    });
  });

  it.each([undefined, '', '0', '7', '1.5', 'abc'])(
    'rejeita conjuntos inválido (%s) sem chamar nenhuma API externa',
    async (conjuntos) => {
      const { service, cep, frete } = setup();
      await expect(service.cotar('58400000', conjuntos)).rejects.toThrow('conjuntos inválido');
      expect(cep.consultar).not.toHaveBeenCalled();
      expect(frete.cotar).not.toHaveBeenCalled();
    },
  );

  it('propaga o 400 de CEP inexistente sem cotar o frete', async () => {
    const { service, cep, frete } = setup();
    cep.consultar.mockRejectedValue(new BadRequestException('CEP não encontrado'));
    await expect(service.cotar('99999999', '1')).rejects.toThrow('CEP não encontrado');
    expect(frete.cotar).not.toHaveBeenCalled();
  });

  it('propaga o 503 do serviço de CEP', async () => {
    const { service, cep } = setup();
    cep.consultar.mockRejectedValue(new ServiceUnavailableException('Serviço de CEP indisponível'));
    await expect(service.cotar('58400000', '1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('devolve 503 quando o serviço de frete falha', async () => {
    const { service, frete } = setup();
    frete.cotar.mockRejectedValue(new Error('timeout'));
    await expect(service.cotar('58400000', '1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('mantém o erro HTTP lançado pelo serviço de frete', async () => {
    const { service, frete } = setup();
    frete.cotar.mockRejectedValue(new BadRequestException('CEP fora da área'));
    await expect(service.cotar('58400000', '1')).rejects.toThrow('CEP fora da área');
  });

  it('devolve 400 quando nenhuma modalidade é atendida', async () => {
    const { service, frete } = setup();
    frete.cotar.mockResolvedValue([]);
    await expect(service.cotar('58400000', '1')).rejects.toThrow(
      'Nenhuma modalidade de frete atendida para o CEP',
    );
  });
});