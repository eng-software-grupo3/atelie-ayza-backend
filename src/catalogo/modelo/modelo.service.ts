
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modelo, ParteModelo } from '../entities/modelo.entity.js';
import { CreateModeloDto, PatchModeloDto } from './dto/modelo.dto.js';
import { ModeloManagementDto,  ModeloPublicDto } from './dto/modelo.dto.js';

function amount(value: unknown, field: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(`${field} inválido`);
  }

  const text = String(value);

  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException(`${field} inválido`);
  }

  return Number(text);
}

@Injectable()
export class ModeloService {
  constructor(
    @InjectRepository(Modelo)
    private readonly repo: Repository<Modelo>,
  ) {}

  async list(admin = true) {
    const where = admin
      ? { excluido: false }
      : { excluido: false, habilitado: true };

    return (await this.repo.find({ where })).map(
      (modelo) => this.project(modelo, admin),
    );
  }

  async get(id: string) {
    return this.project(await this.find(id), true);
  }

  async create(data: CreateModeloDto) {
    this.validateName(data.nome);
    this.validateParte(data.parte);
    this.validateSvgUrl(data.svg_url);

    const valor = amount(data.valor, 'valor');
    const metragemMediaM = amount(
      data.metragem_media_m,
      'metragem_media_m',
    );

    if (metragemMediaM <= 0) {
      throw new BadRequestException(
        'metragem_media_m deve ser maior que zero',
      );
    }

    const modelo = this.repo.create({
      nome: data.nome as string,
      parte: data.parte as ParteModelo,
      valor,
      metragemMediaM,
      svgUrl: data.svg_url as string,
      atualizadoEm: new Date(),
      habilitado: true,
      excluido: false,
    });

    return this.project(await this.repo.save(modelo), true);
  }

  async update(id: string, data: PatchModeloDto) {
    const modelo = await this.find(id);

    if (data.nome !== undefined) {
      this.validateName(data.nome);
      modelo.nome = data.nome as string;
    }

    if (data.parte !== undefined) {
      this.validateParte(data.parte);
      modelo.parte = data.parte as ParteModelo;
    }

    if (data.valor !== undefined) {
      modelo.valor = amount(data.valor, 'valor');
    }

    if (data.metragem_media_m !== undefined) {
      const metragem = amount(
        data.metragem_media_m,
        'metragem_media_m',
      );

      if (metragem <= 0) {
        throw new BadRequestException(
          'metragem_media_m deve ser maior que zero',
        );
      }

      modelo.metragemMediaM = metragem;
    }

    if (data.svg_url !== undefined) {
      this.validateSvgUrl(data.svg_url);
      modelo.svgUrl = data.svg_url as string;
    }

    modelo.atualizadoEm = new Date();

    return this.project(await this.repo.save(modelo), true);
  }

  async remove(id: string): Promise<void> {
    const modelo = await this.find(id);

    modelo.excluido = true;

    await this.repo.save(modelo);
  }

  async setHabilitado(id: string, habilitado: boolean): Promise<ModeloManagementDto> {
    const modelo = await this.find(id);

    modelo.habilitado = habilitado;
    modelo.atualizadoEm = new Date();

    const atualizado = await this.repo.save(modelo);

    return this.project(atualizado, true);
    }

  private validateName(value: unknown): asserts value is string {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > 100
    ) {
      throw new BadRequestException('nome inválido');
    }
  }

  private validateParte(value: unknown): asserts value is ParteModelo {
    if (!Object.values(ParteModelo).includes(value as ParteModelo)) {
      throw new BadRequestException('parte inválida');
    }
  }

  private validateSvgUrl(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('svg_url inválida');
    }
  }

  private async find(id: string) {
    const modelo = await this.repo.findOneBy({
      id,
      excluido: false,
    });

    if (!modelo) {
      throw new NotFoundException('Modelo inexistente ou excluído');
    }

    return modelo;
  }

  private project(modelo: Modelo, admin: true): ModeloManagementDto;
  private project(modelo: Modelo, admin: false): ModeloPublicDto;
  private project(
    modelo: Modelo,
    admin: boolean,
  ): ModeloManagementDto | ModeloPublicDto;

  private project(
    modelo: Modelo,
    admin: boolean,
  ): ModeloManagementDto | ModeloPublicDto {
    const common = {
      id: modelo.id,
      nome: modelo.nome,
      parte: modelo.parte,
      valor: modelo.valor,
      metragem_media_m: modelo.metragemMediaM,
      svg_url: modelo.svgUrl,
    };

    if (admin) {
      return {
        ...common,
        atualizado_em: modelo.atualizadoEm,
        habilitado: modelo.habilitado,
      };
    }

    return common;
  }

  
}
