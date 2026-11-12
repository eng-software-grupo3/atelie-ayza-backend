import 'reflect-metadata';
import { BadRequestException, NotFoundException, PayloadTooLargeException, UnauthorizedException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/auth.service.js';
import { TecidoController } from './tecido.controller.js';
import { TecidosPublicController } from './tecido-public.controller.js';
import { configureTecidoStaticAssets } from './tecido.static.js';
import { TecidoService } from './tecido.service.js';

describe('tecido HTTP API', () => {
  let app: NestExpressApplication;
  let dir: string;
  const record = { id: '7bcb11e2-2fa4-4fd0-a2df-c6f5ecb7b97d', nome: 'Linho', foto: null, preco_metro: 12, quantidade: 3, desabilitado: false };
  const service = {
    list: vi.fn(async (admin = true) => admin ? [record] : [{ id: record.id, nome: record.nome, foto: null, preco_metro: 12 }]),
    get: vi.fn(async () => record), create: vi.fn(async () => record), update: vi.fn(async () => record),
    updateQuantity: vi.fn(async () => record), updateDisabled: vi.fn(async () => record), remove: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'tecido-http-'));
    const module = await Test.createTestingModule({ controllers: [TecidoController, TecidosPublicController], providers: [
      { provide: TecidoService, useValue: service },
      { provide: AuthService, useValue: { userFromAccessToken: vi.fn(async (token?: string) => {
        if (!token) throw new UnauthorizedException();
        return { isAdmin: token === 'admin' };
      }) } },
    ] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureTecidoStaticAssets(app, dir);
    await app.init();
  });
  afterEach(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });

  it('routes management CRUD with authorization and expected HTTP statuses', async () => {
    await request(app.getHttpServer()).get('/api/gestao/tecidos').expect(401);
    await request(app.getHttpServer()).get('/api/gestao/tecidos').set('Authorization', 'Bearer user').expect(403);
    await request(app.getHttpServer()).get('/api/gestao/tecidos').set('Authorization', 'Bearer admin').expect(200).expect(({ body }) => expect(body[0]).toHaveProperty('quantidade', 3));
    await request(app.getHttpServer()).get(`/api/gestao/tecidos/${record.id}`).set('Authorization', 'Bearer admin').expect(200);
    await request(app.getHttpServer()).post('/api/gestao/tecidos').set('Authorization', 'Bearer admin').field('nome', 'Linho').field('preco_metro', '12').field('quantidade', '3').attach('foto', Buffer.from('not image'), 'x.png').expect(201);
    await request(app.getHttpServer()).patch(`/api/gestao/tecidos/${record.id}`).set('Authorization', 'Bearer admin').field('nome', 'Novo').expect(200);
    await request(app.getHttpServer()).patch(`/api/gestao/tecidos/${record.id}/quantidade`).set('Authorization', 'Bearer admin').send({ quantidade: 4.5 }).expect(200);
    await request(app.getHttpServer()).patch(`/api/gestao/tecidos/${record.id}/desabilitado`).set('Authorization', 'Bearer admin').send({ desabilitado: true }).expect(200);
    await request(app.getHttpServer()).delete(`/api/gestao/tecidos/${record.id}`).set('Authorization', 'Bearer admin').expect(204).expect('');
  });

  it('rejects invalid UUIDs before calling the get service', async () => {
    await request(app.getHttpServer())
      .get('/api/gestao/tecidos/not-a-uuid')
      .set('Authorization', 'Bearer admin')
      .expect(400);

    expect(service.get).not.toHaveBeenCalled();
  });

  it('keeps public route unguarded and returns only public fields', async () => {
    await request(app.getHttpServer()).get('/api/tecidos').expect(200).expect(({ body }) => {
      expect(body[0]).toEqual({ id: record.id, nome: record.nome, foto: null, preco_metro: 12 });
    });
    expect(service.list).toHaveBeenCalledWith(false);
  });

  it.each([[400], [404], [413], [415]])('preserves service HTTP status %i', async (status) => {
    const exception = status === 400 ? new BadRequestException() : status === 404 ? new NotFoundException() : status === 413 ? new PayloadTooLargeException() : new UnsupportedMediaTypeException();
    service.create.mockRejectedValueOnce(exception);
    await request(app.getHttpServer()).post('/api/gestao/tecidos').set('Authorization', 'Bearer admin').field('nome', 'A').field('preco_metro', '1').field('quantidade', '1').attach('foto', Buffer.from('a'), 'a.jpg').expect(status);
  });

  it('maps Multer file-size errors to 413 before calling the service', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    await request(app.getHttpServer())
      .post('/api/gestao/tecidos')
      .set('Authorization', 'Bearer admin')
      .field('nome', 'Linho')
      .field('preco_metro', '12')
      .field('quantidade', '3')
      .attach('foto', oversized, 'large.png')
      .expect(413);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('serves uploaded files at the relative URL path', async () => {
    await writeFile(join(dir, 'sample.png'), 'image bytes');
    await request(app.getHttpServer())
      .get('/uploads/tecidos/sample.png')
      .expect(200)
      .expect(({ body }) => expect(body.toString()).toBe('image bytes'));
  });

  it('documents multipart, response properties, status codes, and public schema without auth', async () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    const paths: any = document.paths;
    const components: any = document.components?.schemas;
    const post = paths['/api/gestao/tecidos']!.post!;
    expect(post.requestBody?.content?.['multipart/form-data']?.schema?.$ref).toContain('CreateTecidoMultipartDto');
    expect(components.CreateTecidoMultipartDto.required).toEqual(['nome', 'foto', 'preco_metro', 'quantidade']);
    expect(Object.keys(components.PatchTecidoMultipartDto.properties)).toEqual(['nome', 'foto', 'preco_metro']);
    expect(Object.keys(post.responses ?? {})).toEqual(expect.arrayContaining(['201', '400', '401', '403', '404', '413', '415']));
    const detail = paths['/api/gestao/tecidos/{id}']!;
    expect(detail.get.responses['200'].content['application/json'].schema.$ref).toContain('TecidoManagementDto');
    expect(detail.get.responses).toHaveProperty('400');
    expect(detail.patch.requestBody.content['multipart/form-data'].schema.$ref).toContain('PatchTecidoMultipartDto');
    expect(Object.keys(detail.patch.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '403', '404', '413', '415']));
    expect(Object.keys(components.TecidoManagementDto.properties)).toEqual(['id', 'nome', 'foto', 'preco_metro', 'quantidade', 'desabilitado']);
    expect(components.UpdateTecidoQuantidadeDto.properties.quantidade.type).toBe('number');
    expect(components.UpdateTecidoDesabilitadoDto.properties.desabilitado.type).toBe('boolean');
    const pub = paths['/api/tecidos']!.get!;
    const fields = Object.keys(components.TecidoPublicDto.properties);
    expect(fields).toEqual(['id', 'nome', 'foto', 'preco_metro']);
    expect(pub.responses).toHaveProperty('200');
    expect(pub.security).toBeUndefined();
    expect(detail.delete.responses).toHaveProperty('204');
    expect(detail.delete.responses).toHaveProperty('400');
    expect(paths['/api/gestao/tecidos/{id}/quantidade'].patch.requestBody.content['application/json'].schema.$ref).toContain('UpdateTecidoQuantidadeDto');
    expect(paths['/api/gestao/tecidos/{id}/desabilitado'].patch.requestBody.content['application/json'].schema.$ref).toContain('UpdateTecidoDesabilitadoDto');
  });
});
