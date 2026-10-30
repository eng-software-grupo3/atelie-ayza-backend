import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource, DeepPartial, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { Modelo, TipoModelo } from '../catalogo/entities/modelo.entity.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { Usuario } from '../pessoas/entities/usuario.entity.js';

async function ensure<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  data: DeepPartial<T>,
): Promise<T> {
  const existente = await repo.findOneBy(where);
  if (existente) return existente;
  return repo.save(repo.create(data));
}

function svg(cor: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<path d="M10 20 Q50 70 90 20 L80 10 Q50 45 20 10 Z" fill="' +
    cor +
    '"/></svg>'
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const config = app.get(ConfigService);

    // Admin (RF-02): e-mail vem de variável de ambiente, nunca do repositório
    const adminEmail = config.get<string>('ADMIN_EMAIL');
    const adminGoogleId = 'seed-admin';
    if (adminEmail) {
      await ensure(
        ds.getRepository(Usuario),
        { email: adminEmail },
        { idGoogle: adminGoogleId, nome: 'Gestora (seed)', email: adminEmail, fotoUrl: null, isAdmin: true },
      );
    } else {
      console.warn('ADMIN_EMAIL não definido: admin não criada.');
    }


    // Modelos fictícios (SVG de exemplo)
    const modelos: Array<[string, TipoModelo, number, number, string]> = [
      ['Cortininha', TipoModelo.CIMA, 40, 0.4, '#e07a9b'],
      ['Faixa', TipoModelo.CIMA, 45, 0.5, '#7aa7e0'],
      ['Asa Larga', TipoModelo.BAIXO, 40, 0.4, '#e07a9b'],
      ['Lateral Fina', TipoModelo.BAIXO, 45, 0.45, '#7aa7e0'],
    ];
    for (const [nome, tipo, preco, metragemMediaM, cor] of modelos) {
      await ensure(
        ds.getRepository(Modelo),
        { nome },
        { nome, tipo, preco, metragemMediaM, fotoSvg: svg(cor), desabilitado: false, excluido: false },
      );
    }

    // Tecidos fictícios
    const tecidos: Array<[string, number, number, number]> = [
      ['Lycra Lisa Rosa', 20, 35, 3],
      ['Lycra Texturizada Azul', 15, 42, 3],
      ['Poliamida Preta', 25, 38, 5],
    ];
    for (const [nome, quantidadeM, precoMetro, estoqueMinimoM] of tecidos) {
      await ensure(
        ds.getRepository(Tecido),
        { nome },
        { nome, foto: null, quantidadeM, precoMetro, estoqueMinimoM, larguraCm: 150, desabilitado: false, excluido: false },
      );
    }

    // Adereços fictícios
    const adercos: Array<[string, string, number, number, number]> = [
      ['Pérola', 'Pedraria', 50, 2, 10],
      ['Strass', 'Pedraria', 80, 1.5, 15],
      ['Argola Dourada', 'Argola', 30, 4, 6],
      ['Laço de Cetim', 'Laço', 20, 3, 5],
    ];
    for (const [nome, cat, quantidade, preco, estoqueMinimo] of adercos) {
      await ensure(
        ds.getRepository(Adereco),
        { nome },
        {
          nome,
          tipo: cat,
          foto: null,
          quantidade,
          preco,
          estoqueMinimo,
          desabilitado: false,
          excluido: false,
        },
      );
    }

    console.log('Seed concluído.');
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
