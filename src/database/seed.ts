import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { extname, join, parse } from 'node:path';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { AppModule } from '../app.module.js';
import { Adereco } from '../catalogo/entities/adereco.entity.js';
import { Modelo, ParteModelo } from '../catalogo/entities/modelo.entity.js';
import { Tecido } from '../catalogo/entities/tecido.entity.js';
import { Usuario } from '../pessoas/entities/usuario.entity.js';

// Imagens de exemplo versionadas no repositório: seed-assets/<pasta>/<nome-em-slug>.<ext>
const ASSETS = join(process.cwd(), 'seed-assets');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

async function ensure<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  data: DeepPartial<T>,
): Promise<T> {
  const existente = await repo.findOneBy(where);
  if (existente) return existente;
  return repo.save(repo.create(data));
}

// "Laço de Cetim" -> "laco-de-cetim"
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findAsset(
  folder: string,
  nome: string,
  extensions: string[],
): Promise<string | undefined> {
  const files = await readdir(join(ASSETS, folder)).catch(() => [] as string[]);
  const wanted = slug(nome);
  return files.find(
    (file) =>
      parse(file).name.toLowerCase() === wanted &&
      extensions.includes(extname(file).toLowerCase()),
  );
}

// Copia a imagem de exemplo para a pasta de uploads e devolve o caminho público.
async function seedPhoto(
  folder: 'tecidos' | 'aderecos',
  uploadDir: string,
  nome: string,
): Promise<string | null> {
  const file = await findAsset(folder, nome, IMAGE_EXTENSIONS);
  if (!file) {
    console.warn(
      `Sem imagem para "${nome}": esperado seed-assets/${folder}/${slug(nome)}.png (ou .jpg/.webp)`,
    );
    return null;
  }
  const target = `seed-${slug(nome)}${extname(file).toLowerCase()}`;
  await mkdir(uploadDir, { recursive: true });
  await copyFile(join(ASSETS, folder, file), join(uploadDir, target));
  return `/uploads/${folder}/${target}`;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const ds = app.get(DataSource);
    const config = app.get(ConfigService);

    // Admin (RF-02): e-mail vem de variável de ambiente, nunca do repositório.
    // update() não regrava google_refresh_token nem troca um id_google já vinculado.
    const adminEmail = config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    if (adminEmail) {
      const usuarios = ds.getRepository(Usuario);
      const existente = await usuarios
        .createQueryBuilder('usuario')
        .where('LOWER(usuario.email) = :email', { email: adminEmail })
        .getOne();
      if (!existente) {
        await usuarios.save(
          usuarios.create({
            idGoogle: 'seed-admin',
            nome: 'Gestora (seed)',
            email: adminEmail,
            fotoUrl: null,
            isAdmin: true,
            tokenVersion: 0,
          }),
        );
      } else {
        await usuarios.update(existente.id, {
          email: adminEmail,
          isAdmin: true,
        });
      }
    } else {
      console.warn('ADMIN_EMAIL não definido: admin não criada.');
    }

    // Modelos fictícios: o SVG vem de seed-assets/modelos/<nome-em-slug>.svg
    const modelos: Array<[string, ParteModelo, number, number]> = [
      ['Cortininha', ParteModelo.CIMA, 40, 0.4],
      ['Faixa', ParteModelo.CIMA, 45, 0.5],
      ['Asa Larga', ParteModelo.BAIXO, 40, 0.4],
      ['Lateral Fina', ParteModelo.BAIXO, 45, 0.45],
    ];
    const modeloRepo = ds.getRepository(Modelo);
    for (const [nome, parte, valor, metragemMediaM] of modelos) {
      const file = await findAsset('modelos', nome, ['.svg']);
      if (!file) {
        console.warn(
          `Sem SVG para "${nome}": esperado seed-assets/modelos/${slug(nome)}.svg. Modelo não criado.`,
        );
        continue;
      }
      const svgUrl = await readFile(join(ASSETS, 'modelos', file), 'utf8');
      const modelo = await ensure(
        modeloRepo,
        { nome },
        {
          nome,
          parte,
          valor,
          metragemMediaM,
          svgUrl,
          atualizadoEm: new Date(),
          habilitado: true,
          excluido: false,
        },
      );
      // Mantém o SVG de exemplo em dia nos modelos que já existiam.
      if (modelo.svgUrl !== svgUrl) {
        modelo.svgUrl = svgUrl;
        modelo.atualizadoEm = new Date();
        await modeloRepo.save(modelo);
      }
    }

    // Tecidos fictícios
    const tecidosDir =
      process.env.TECIDOS_UPLOAD_DIR || join(process.cwd(), 'uploads/tecidos');
    const tecidos: Array<[string, number, number, number]> = [
      ['Lycra Lisa Rosa', 20, 35, 3],
      ['Lycra Texturizada Azul', 15, 42, 3],
      ['Poliamida Preta', 25, 38, 5],
    ];
    const tecidoRepo = ds.getRepository(Tecido);
    for (const [nome, quantidadeM, precoMetro, estoqueMinimoM] of tecidos) {
      const foto = await seedPhoto('tecidos', tecidosDir, nome);
      const tecido = await ensure(
        tecidoRepo,
        { nome },
        {
          nome,
          foto,
          quantidadeM,
          precoMetro,
          estoqueMinimoM,
          larguraCm: 150,
          desabilitado: false,
          excluido: false,
        },
      );
      // Só preenche quando ainda não há foto, sem sobrescrever upload feito pela gestora.
      if (foto && !tecido.foto) {
        tecido.foto = foto;
        await tecidoRepo.save(tecido);
      }
    }

    // Adereços fictícios
    const aderecosDir =
      process.env.ADERECOS_UPLOAD_DIR || join(process.cwd(), 'uploads/aderecos');
    const aderecos: Array<[string, string, number, number, number]> = [
      ['Pérola', 'Pedraria', 50, 2, 10],
      ['Strass', 'Pedraria', 80, 1.5, 15],
      ['Argola Dourada', 'Argola', 30, 4, 6],
      ['Laço de Cetim', 'Laço', 20, 3, 5],
    ];
    const aderecoRepo = ds.getRepository(Adereco);
    for (const [nome, tipo, quantidade, preco, estoqueMinimo] of aderecos) {
      const foto = await seedPhoto('aderecos', aderecosDir, nome);
      const adereco = await ensure(
        aderecoRepo,
        { nome },
        {
          nome,
          tipo,
          foto,
          quantidade,
          preco,
          estoqueMinimo,
          desabilitado: false,
          excluido: false,
        },
      );
      if (foto && !adereco.foto) {
        adereco.foto = foto;
        await aderecoRepo.save(adereco);
      }
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