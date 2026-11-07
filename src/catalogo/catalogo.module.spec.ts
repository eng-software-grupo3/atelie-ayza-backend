import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CatalogoModule } from './catalogo.module.js';
import { AderecoController, AderecosPublicController } from './adereco.controller.js';
import { AderecoService } from './adereco.service.js';

describe('CatalogoModule adereços', () => {
  it('registers management and public controllers with the service provider', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CatalogoModule)).toEqual(expect.arrayContaining([AderecoController, AderecosPublicController]));
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CatalogoModule)).toEqual(expect.arrayContaining([AderecoService]));
  });
});
