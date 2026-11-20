import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CatalogoModule } from './catalogo.module.js';
import { AderecoModule } from './adereco/adereco.module.js';
import { ModeloModule } from './modelo/modelo.module.js';
import { TecidoModule } from './tecido/tecido.module.js';

describe('CatalogoModule', () => {
  it('imports a dedicated module for each catalog item type', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, CatalogoModule)).toEqual(
      expect.arrayContaining([ModeloModule, TecidoModule, AderecoModule]),
    );
  });
});
