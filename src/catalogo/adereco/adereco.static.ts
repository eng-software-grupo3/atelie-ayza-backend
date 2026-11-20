import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

export function configureAderecoStaticAssets(
  app: NestExpressApplication,
  directory = process.env.ADERECOS_UPLOAD_DIR || join(process.cwd(), 'uploads/aderecos'),
): void {
  app.useStaticAssets(directory, { prefix: '/uploads/aderecos/' });
}
