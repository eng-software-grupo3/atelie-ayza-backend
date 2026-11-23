import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CepService } from '../cep/cep.service.js';
import { MAX_CONJUNTOS } from '../pedidos/pedido-validacao.js';
import { FreteService, type CotacaoFrete } from './frete.service.js';

export type CotacaoCep = {
  cep: string;
  endereco: {
    logradouro: string | null;
    bairro: string | null;
    cidade: string;
    estado: string;
  };
  modalidades: CotacaoFrete[];
};

function quantidadeDeConjuntos(valor: unknown): number {
  if (typeof valor !== 'string' || !/^\d{1,2}$/.test(valor.trim())) {
    throw new BadRequestException('conjuntos inválido');
  }
  const quantidade = Number(valor.trim());
  if (quantidade < 1 || quantidade > MAX_CONJUNTOS) {
    throw new BadRequestException('conjuntos inválido');
  }
  return quantidade;
}

@Injectable()
export class FreteCotacaoService {
  constructor(
    private readonly cep: CepService,
    private readonly frete: FreteService,
  ) {}

  async cotar(cepInformado: unknown, conjuntosInformado: unknown): Promise<CotacaoCep> {
    // Valida antes de qualquer chamada externa.
    const conjuntos = quantidadeDeConjuntos(conjuntosInformado);
    const endereco = await this.cep.consultar(cepInformado);

    let modalidades: CotacaoFrete[];
    try {
      modalidades = await this.frete.cotar({
        cep: endereco.cep,
        cidade: endereco.cidade,
        estado: endereco.estado,
        conjuntos,
      });
    } catch (erro) {
      if (erro instanceof HttpException) throw erro;
      throw new ServiceUnavailableException('Serviço de frete indisponível');
    }
    if (modalidades.length === 0) {
      throw new BadRequestException('Nenhuma modalidade de frete atendida para o CEP');
    }

    return {
      cep: endereco.cep,
      endereco: {
        logradouro: endereco.logradouro,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        estado: endereco.estado,
      },
      modalidades,
    };
  }
}