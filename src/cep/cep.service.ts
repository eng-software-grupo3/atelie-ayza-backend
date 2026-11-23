import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export type EnderecoCep = {
  /** 8 dígitos, sem hífen. */
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
};

const URL_BASE = 'https://viacep.com.br/ws';
const TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const CEP = /^\d{5}-?\d{3}$/;
const UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

type RespostaViaCep = {
  erro?: boolean | string;
  logradouro?: unknown;
  bairro?: unknown;
  localidade?: unknown;
  uf?: unknown;
};

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function indisponivel(): ServiceUnavailableException {
  return new ServiceUnavailableException('Serviço de CEP indisponível');
}

@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);
  private readonly cache = new Map<string, { valor: EnderecoCep; expira: number }>();

  async consultar(cepInformado: unknown): Promise<EnderecoCep> {
    if (typeof cepInformado !== 'string' || !CEP.test(cepInformado.trim())) {
      throw new BadRequestException('cep inválido');
    }
    const cep = cepInformado.trim().replace('-', '');

    const agora = Date.now();
    const guardado = this.cache.get(cep);
    if (guardado && guardado.expira > agora) return guardado.valor;

    const dados = await this.buscar(cep);
    if (dados.erro === true || dados.erro === 'true') {
      throw new BadRequestException('CEP não encontrado');
    }
    const cidade = textoOuNulo(dados.localidade);
    const estadoInformado = textoOuNulo(dados.uf);
    const estado = estadoInformado?.toUpperCase();
    if (!cidade || !estado || !UFS.has(estado)) {
      this.logger.warn(`ViaCEP devolveu o CEP ${cep} com cidade ou UF inválida`);
      throw indisponivel();
    }

    const valor: EnderecoCep = {
      cep,
      logradouro: textoOuNulo(dados.logradouro),
      bairro: textoOuNulo(dados.bairro),
      cidade,
      estado: estado.toUpperCase(),
    };
    // Só respostas boas entram no cache; falhas não.
    if (this.cache.size >= CACHE_MAX) this.cache.clear();
    this.cache.set(cep, { valor, expira: agora + CACHE_TTL_MS });
    return valor;
  }

  private async buscar(cep: string): Promise<RespostaViaCep> {
    try {
      const resposta = await fetch(`${URL_BASE}/${cep}/json/`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`);
      const corpo: unknown = await resposta.json();
      if (typeof corpo !== 'object' || corpo === null) throw new Error('resposta inesperada');
      return corpo as RespostaViaCep;
    } catch (erro) {
      this.logger.warn(`Falha ao consultar o ViaCEP: ${(erro as Error).message}`);
      throw indisponivel();
    }
  }
}