import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import autoload from '@fastify/autoload';

const srcDir = fileURLToPath(new URL('.', import.meta.url));

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  // Shared plugins (wrapped with fastify-plugin so their decorators are visible everywhere).
  await app.register(autoload, {
    dir: join(srcDir, 'plugins'),
    ignoreFilter: /\.test\.ts$/,
  });

  // Route modules: every src/modules/**/index.ts is a Fastify plugin mounted under /api/v1.
  // - Folder names are NOT route prefixes; each module declares its full contract path ('/health', '/me/schedule').
  // - Only index files are loaded, so helpers and *.test.ts can live next to them.
  // Adding a module = adding a folder. Nobody edits a shared router file.
  await app.register(autoload, {
    dir: join(srcDir, 'modules'),
    options: { prefix: '/api/v1' },
    dirNameRoutePrefix: false,
    matchFilter: /\/index\.(?:ts|js)$/,
  });

  return app;
}
