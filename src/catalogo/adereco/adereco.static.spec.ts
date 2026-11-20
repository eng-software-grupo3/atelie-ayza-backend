import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureAderecoStaticAssets } from './adereco.static.js';

@Module({})
class StaticTestModule {}

describe('adereco static assets', () => {
  let app: NestExpressApplication;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'aderecos-static-'));
    app = await NestFactory.create<NestExpressApplication>(StaticTestModule, { logger: false });
    configureAderecoStaticAssets(app, directory);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('serves an uploaded image at the relative URL path', async () => {
    await writeFile(join(directory, 'sample.png'), 'image bytes');
    await request(app.getHttpServer())
      .get('/uploads/aderecos/sample.png')
      .expect(200)
      .expect(({ body }) => expect(body.toString()).toBe('image bytes'));
  });
});
