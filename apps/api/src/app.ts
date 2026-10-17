import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import autoload from '@fastify/autoload';

const srcDir = fileURLToPath(new URL('.', import.meta.url));

export async function buildApp(opts: FastifyServerOptions = {}) {
  // 3 MB: .ics uploads may be up to 2 MB (contract) plus multipart overhead; Fastify's default is 1 MB.
  const app = Fastify({ bodyLimit: 3 * 1024 * 1024, ...opts });

  // Clients often send `Content-Type: application/json` on POST/DELETE without a body (e.g. sync, leave
  // group, cancel booking). Fastify rejects that with 400 FST_ERR_CTP_EMPTY_JSON_BODY; treat it as no body.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (text.trim() === '') return done(null, undefined);
    try {
      done(null, JSON.parse(text));
    } catch {
      const err = new Error('Body is not valid JSON') as Error & { statusCode: number; code: string };
      err.statusCode = 400;
      err.code = 'FST_ERR_CTP_INVALID_JSON_BODY';
      done(err, undefined);
    }
  });

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
