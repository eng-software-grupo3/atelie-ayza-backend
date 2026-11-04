import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

export function configureTecidoStaticAssets(
  app: NestExpressApplication,
  directory = process.env.TECIDOS_UPLOAD_DIR || join(process.cwd(), 'uploads/tecidos'),
): void {
  app.useStaticAssets(directory, { prefix: '/uploads/tecidos/' });
}
