import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AgendaOcupado } from './entities/agenda-ocupado.entity.js';

const MES = /^20\d{2}-(0[1-9]|1[0-2])$/;
const PRAZO = /^\d{1,2}$/;
const MAX_PRAZO_FRETE_DIAS = 60;

export type DatasDisponiveis = {
  mes: string;
  data_minima: string;
  dias: Array<{ data: string; disponivel: boolean }>;
};

// Disponibilidade das datas de entrega para o cliente (RF-08): só diz se cada dia pode
// ser escolhido, sem expor pedidos nem clientes.
@Injectable()
export class DatasDisponiveisService {
  constructor(
    @InjectRepository(AgendaOcupado) private readonly ocupado: Repository<AgendaOcupado>,
    private readonly config: ConfigService,
  ) {}

  async listar(mesInformado: unknown, prazoInformado: unknown): Promise<DatasDisponiveis> {
    const mes = this.validarMes(mesInformado);
    const prazoFreteDias = this.validarPrazo(prazoInformado);
    const diasMinimos = this.prazoConfeccao() + prazoFreteDias;

    const total = new Date(
      Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0),
    ).getUTCDate();
    const primeiro = `${mes}-01`;
    const ultimo = `${mes}-${String(total).padStart(2, '0')}`;

    // "Hoje" é a data do banco (CURRENT_DATE), a mesma regra do POST /api/pedidos.
    const linhas: Array<{ minima: string }> = await this.ocupado.query(
      `SELECT to_char(CURRENT_DATE + $1::int, 'YYYY-MM-DD') AS minima`,
      [diasMinimos],
    );
    const dataMinima = linhas[0].minima;
    const bloqueadas = new Set(
      (await this.ocupado.find({ where: { data: Between(primeiro, ultimo) } })).map(
        (b) => b.data,
      ),
    );

    const dias = Array.from({ length: total }, (_, i) => {
      const data = `${mes}-${String(i + 1).padStart(2, '0')}`;
      return { data, disponivel: data >= dataMinima && !bloqueadas.has(data) };
    });
    return { mes, data_minima: dataMinima, dias };
  }

  private validarMes(valor: unknown): string {
    if (typeof valor !== 'string' || !MES.test(valor)) {
      throw new BadRequestException('mes inválido');
    }
    return valor;
  }

  private validarPrazo(valor: unknown): number {
    if (typeof valor !== 'string' || !PRAZO.test(valor.trim())) {
      throw new BadRequestException('prazo_frete_dias inválido');
    }
    const prazo = Number(valor.trim());
    if (prazo > MAX_PRAZO_FRETE_DIAS) {
      throw new BadRequestException('prazo_frete_dias inválido');
    }
    return prazo;
  }

  // Mesma leitura do PedidosService (padrão de 3 dias). Pode virar um utilitário comum.
  private prazoConfeccao(): number {
    const bruto = this.config.get<string>('PRAZO_CONFECCAO_DIAS');
    const dias = bruto === undefined ? 3 : Number(bruto);
    if (!Number.isInteger(dias) || dias < 0) {
      throw new InternalServerErrorException('PRAZO_CONFECCAO_DIAS inválido');
    }
    return dias;
  }
}