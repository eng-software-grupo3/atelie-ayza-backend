import 'reflect-metadata';
import { BadRequestException, NotFoundException, PayloadTooLargeException, UnauthorizedException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { AderecoController, AderecosPublicController } from './adereco.controller.js';
import { AderecoService } from './adereco.service.js';

describe('adereco HTTP API', () => {
  let app: any;
  const row = { id: '7bcb11e2-2fa4-4fd0-a2df-c6f5ecb7b97d', nome: 'Laço', foto: '/x.png', preco: 5, quantidade: 2, desabilitado: false };
  const service = { list: vi.fn(async (admin = true) => admin ? [row] : [{ id: row.id, nome: row.nome, foto: row.foto, preco: row.preco }]), get: vi.fn(async () => row), create: vi.fn(async () => row), update: vi.fn(async () => row), updateQuantity: vi.fn(async () => row), updateDisabled: vi.fn(async () => row), remove: vi.fn(async () => undefined) };
  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({ controllers: [AderecoController, AderecosPublicController], providers: [
      { provide: AderecoService, useValue: service },
      { provide: AuthService, useValue: { userFromAccessToken: vi.fn(async (token?: string) => { if (!token) throw new UnauthorizedException(); return { isAdmin: token === 'admin' }; }) } },
    ] }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterEach(async () => app.close());
  it('protects CRUD routes and maps their status codes', async () => {
    await request(app.getHttpServer()).get('/api/gestao/aderecos').expect(401);
    await request(app.getHttpServer()).get('/api/gestao/aderecos').set('Authorization', 'Bearer user').expect(403);
    await request(app.getHttpServer()).get('/api/gestao/aderecos').set('Authorization', 'Bearer admin').expect(200);
    await request(app.getHttpServer()).get(`/api/gestao/aderecos/${row.id}`).set('Authorization', 'Bearer admin').expect(200);
    await request(app.getHttpServer()).post('/api/gestao/aderecos').set('Authorization', 'Bearer admin').field('nome', 'Laço').field('preco', '5').field('quantidade', '2').attach('foto', Buffer.from('x'), 'x.png').expect(201);
    await request(app.getHttpServer()).patch(`/api/gestao/aderecos/${row.id}`).set('Authorization', 'Bearer admin').field('nome', 'Novo').expect(200);
    await request(app.getHttpServer()).patch(`/api/gestao/aderecos/${row.id}/quantidade`).set('Authorization', 'Bearer admin').send({ quantidade: 3 }).expect(200);
    await request(app.getHttpServer()).patch(`/api/gestao/aderecos/${row.id}/desabilitado`).set('Authorization', 'Bearer admin').send({ desabilitado: true }).expect(200);
    await request(app.getHttpServer()).delete(`/api/gestao/aderecos/${row.id}`).set('Authorization', 'Bearer admin').expect(204);
  });
  it('leaves public route unguarded and projects only public fields', async () => {
    await request(app.getHttpServer()).get('/api/aderecos').expect(200).expect(({ body }) => expect(body[0]).toEqual({ id: row.id, nome: row.nome, foto: row.foto, preco: row.preco }));
    expect(service.list).toHaveBeenCalledWith(false);
  });
  it.each([
    [400, new BadRequestException()],
    [413, new PayloadTooLargeException()],
    [415, new UnsupportedMediaTypeException()],
  ])('preserves service error status %i', async (status, error) => {
    service.create.mockRejectedValueOnce(error);
    await request(app.getHttpServer()).post('/api/gestao/aderecos').set('Authorization', 'Bearer admin')
      .field('nome', 'A').field('preco', '1').field('quantidade', '1')
      .attach('foto', Buffer.from('x'), 'x.png').expect(status);
  });
  it('returns 404 for an unknown management item', async () => {
    service.get.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer()).get(`/api/gestao/aderecos/${row.id}`).set('Authorization', 'Bearer admin').expect(404);
  });
  it('maps oversized multipart photos to 413 before calling the service', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    await request(app.getHttpServer()).post('/api/gestao/aderecos').set('Authorization', 'Bearer admin')
      .field('nome', 'A').field('preco', '1').field('quantidade', '1')
      .attach('foto', oversized, 'large.png').expect(413);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('documents multipart fields, statuses, projections, and public access', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    const paths: any = doc.paths, schemas: any = doc.components?.schemas;
    expect(schemas.CreateAderecoMultipartDto.required).toEqual(['nome', 'foto', 'preco', 'quantidade']);
    expect(schemas.CreateAderecoMultipartDto.properties.quantidade.format).toBe('int32');
    expect(Object.keys(schemas.PatchAderecoMultipartDto.properties)).toEqual(['nome', 'foto', 'preco']);
    expect(Object.keys(schemas.AderecoManagementDto.properties)).toEqual(['id', 'nome', 'foto', 'preco', 'quantidade', 'desabilitado']);
    expect(Object.keys(schemas.AderecoPublicDto.properties)).toEqual(['id', 'nome', 'foto', 'preco']);
    expect(schemas.UpdateAderecoQuantidadeDto.properties.quantidade.format).toBe('int32');
    expect(schemas.UpdateAderecoDesabilitadoDto.properties.desabilitado.type).toBe('boolean');
    expect(Object.keys(paths['/api/gestao/aderecos'].post.responses)).toEqual(expect.arrayContaining(['201', '400', '401', '403', '404', '413', '415']));
    expect(paths['/api/gestao/aderecos/{id}'].delete.responses).toHaveProperty('204');
    expect(paths['/api/gestao/aderecos/{id}/quantidade'].patch.requestBody.content['application/json'].schema.$ref).toContain('UpdateAderecoQuantidadeDto');
    expect(paths['/api/gestao/aderecos/{id}/desabilitado'].patch.requestBody.content['application/json'].schema.$ref).toContain('UpdateAderecoDesabilitadoDto');
    expect(paths['/api/aderecos'].get.security).toBeUndefined();
  });
});
