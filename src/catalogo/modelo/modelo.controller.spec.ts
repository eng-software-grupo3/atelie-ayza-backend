
import 'reflect-metadata';

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AuthService } from '../../auth/auth.service.js';
import {
  ModeloController,
  ModelosPublicController,
} from './modelo.controller.js';
import { ModeloService } from './modelo.service.js';

const ID = '7bcb11e2-2fa4-4fd0-a2df-c6f5ecb7b97d';

const record = {
  id: ID,
  nome: 'Cortininha',
  parte: 'CIMA',
  valor: 40,
  metragem_media_m: 0.4,
  svg_url: '<svg>exemplo</svg>',
  atualizado_em: new Date(),
  habilitado: true,
};

describe('modelo HTTP API', () => {
  let app: any;

  const service = {
    list: vi.fn(async (admin = true) =>
      admin
        ? [record]
        : [{
            id: record.id,
            nome: record.nome,
            parte: record.parte,
            valor: record.valor,
            metragem_media_m: record.metragem_media_m,
            svg_url: record.svg_url,
          }],
    ),

    get: vi.fn(async () => record),
    create: vi.fn(async () => record),
    update: vi.fn(async () => record),
    setHabilitado: vi.fn(async (_id, habilitado) => ({
      ...record,
      habilitado,
    })),
    remove: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [
        ModeloController,
        ModelosPublicController,
      ],
      providers: [
        {
          provide: ModeloService,
          useValue: service,
        },
        {
          provide: AuthService,
          useValue: {
            userFromAccessToken: vi.fn(async (token?: string) => {
              if (!token) {
                throw new UnauthorizedException();
              }

              return {
                isAdmin: token === 'admin',
              };
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('protects management routes with authentication and admin authorization', async () => {
    await request(app.getHttpServer())
      .get('/api/gestao/modelos')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/gestao/modelos')
      .set('Authorization', 'Bearer user')
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/gestao/modelos')
      .set('Authorization', 'Bearer admin')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toHaveProperty('nome', 'Cortininha');
        expect(body[0]).toHaveProperty('habilitado', true);
      });
  });

  it('routes management CRUD with expected HTTP statuses', async () => {
    const auth = {
      Authorization: 'Bearer admin',
    };

    await request(app.getHttpServer())
      .get(`/api/gestao/modelos/${ID}`)
      .set(auth)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/gestao/modelos')
      .set(auth)
      .send({
        nome: 'Cortininha',
        parte: 'CIMA',
        valor: 40,
        metragem_media_m: 0.4,
        svg_url: '<svg>exemplo</svg>',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/gestao/modelos/${ID}`)
      .set(auth)
      .send({
        nome: 'Cortininha Atualizada',
        valor: 50,
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/gestao/modelos/${ID}`)
      .set(auth)
      .expect(204)
      .expect('');
  });

  it('updates model enabled status', async () => {
    await request(app.getHttpServer())
      .patch(`/api/gestao/modelos/${ID}/habilitado`)
      .set('Authorization', 'Bearer admin')
      .send({ habilitado: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveProperty('habilitado', false);
      });

    expect(service.setHabilitado).toHaveBeenCalledWith(
      ID,
      false,
    );
  });

  it('keeps public route unguarded and returns only public fields', async () => {
    await request(app.getHttpServer())
      .get('/api/modelos')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toEqual({
          id: record.id,
          nome: record.nome,
          parte: record.parte,
          valor: record.valor,
          metragem_media_m: record.metragem_media_m,
          svg_url: record.svg_url,
        });

        expect(body[0]).not.toHaveProperty('habilitado');
        expect(body[0]).not.toHaveProperty('atualizado_em');
      });

    expect(service.list).toHaveBeenCalledWith(false);
  });

  it.each([
    [400, new BadRequestException()],
    [404, new NotFoundException()],
  ])('preserves service HTTP status %i', async (status, exception) => {
    service.create.mockRejectedValueOnce(exception);

    await request(app.getHttpServer())
      .post('/api/gestao/modelos')
      .set('Authorization', 'Bearer admin')
      .send({
        nome: 'Cortininha',
        parte: 'CIMA',
        valor: 40,
        metragem_media_m: 0.4,
        svg_url: '<svg>exemplo</svg>',
      })
      .expect(status);
  });

  it('documents request bodies, responses and public schema in Swagger', async () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addBearerAuth()
        .build(),
    );

    const paths: any = document.paths;
    const components: any = document.components?.schemas;

    const management = paths['/api/gestao/modelos']!;
    const post = management.post!;

    expect(
      post.requestBody.content['application/json'].schema.$ref,
    ).toContain('CreateModeloDto');

    expect(
      Object.keys(components.CreateModeloDto.properties),
    ).toEqual([
      'nome',
      'parte',
      'valor',
      'metragem_media_m',
      'svg_url',
    ]);

    expect(
      Object.keys(post.responses),
    ).toEqual(
      expect.arrayContaining([
        '201',
        '400',
        '401',
        '403',
        '404',
      ]),
    );

    const detail = paths['/api/gestao/modelos/{id}']!;

    expect(
      detail.get.responses['200'].content['application/json'].schema.$ref,
    ).toContain('ModeloManagementDto');

    expect(
      detail.patch.requestBody.content['application/json'].schema.$ref,
    ).toContain('PatchModeloDto');

    const habilitado = paths[
      '/api/gestao/modelos/{id}/habilitado'
    ]!.patch;

    expect(
      habilitado.requestBody.content['application/json'].schema.$ref,
    ).toContain('SetModeloHabilitadoDto');

    expect(
      components.SetModeloHabilitadoDto.properties,
    ).toHaveProperty('habilitado');

    expect(
      Object.keys(components.ModeloManagementDto.properties),
    ).toEqual([
      'id',
      'nome',
      'parte',
      'valor',
      'metragem_media_m',
      'svg_url',
      'atualizado_em',
      'habilitado',
    ]);

    const publicRoute = paths['/api/modelos']!.get;

    expect(publicRoute.responses).toHaveProperty('200');
    expect(publicRoute.security).toBeUndefined();

    expect(
      Object.keys(components.ModeloPublicDto.properties),
    ).toEqual([
      'id',
      'nome',
      'parte',
      'valor',
      'metragem_media_m',
      'svg_url',
    ]);

    expect(detail.delete.responses).toHaveProperty('204');
  });
});
