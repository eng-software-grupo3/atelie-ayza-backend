import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { requireConfig } from './auth.constants.js';

function configReturning(value: string | undefined): ConfigService {
  return {
    get: () => value,
  } as unknown as ConfigService;
}

describe('requireConfig', () => {
  it('returns a trimmed value', () => {
    expect(requireConfig(configReturning('  secret  '), 'JWT_SECRET')).toBe(
      'secret',
    );
  });

  it('fails when the value is missing or blank', () => {
    expect(() =>
      requireConfig(configReturning(undefined), 'JWT_SECRET'),
    ).toThrow(ServiceUnavailableException);
    expect(() => requireConfig(configReturning('   '), 'JWT_SECRET')).toThrow(
      'Missing JWT_SECRET',
    );
  });
});
