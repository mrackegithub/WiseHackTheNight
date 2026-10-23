import Fastify, { type FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';

// 1. Environment. Secrets come from Vercel project env vars, never from source.
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'ICS_ENCRYPTION_KEY']) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var ${key}. Set it in the Vercel project settings.`);
  }
}
process.env.GEOCODER_USER_AGENT ??=
  'StudyGroupMatcher/1.0 (contact@sgm.local)';
process.env.GEOCODER_URL ??=
  'https://nominatim.openstreetmap.org';
process.env.BOOKING_PROVIDER ??=
  'MOCK';
process.env.CORS_ORIGIN ??= '*';

// 2. Statically imported plugins
import prismaPlugin from '../apps/api/src/plugins/prisma.js';
import corsPlugin from '../apps/api/src/plugins/cors.js';
import jwtPlugin from '../apps/api/src/plugins/jwt.js';
import errorsPlugin from '../apps/api/src/plugins/errors.js';

// 3. Statically imported route modules
import healthRoutes from '../apps/api/src/modules/health/index.js';
import authRoutes from '../apps/api/src/modules/auth/index.js';
import usersRoutes from '../apps/api/src/modules/users/index.js';
import subjectsRoutes from '../apps/api/src/modules/subjects/index.js';
import matchingRoutes from '../apps/api/src/modules/matching/index.js';
import groupsRoutes from '../apps/api/src/modules/groups/index.js';
import sessionsRoutes from '../apps/api/src/modules/sessions/index.js';
import locationsRoutes from '../apps/api/src/modules/integrations/locations/index.js';
import roomsRoutes from '../apps/api/src/modules/integrations/rooms/index.js';
import neptunRoutes from '../apps/api/src/modules/integrations/neptun/index.js';

let appPromise: Promise<FastifyInstance> | null = null;

async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 3 * 1024 * 1024,
    logger: true,
  });

  // Handle empty JSON bodies gracefully without throwing 400 FST_ERR_CTP_EMPTY_JSON_BODY
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

  // Register the 4 shared plugins
  await app.register(prismaPlugin);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(errorsPlugin);

  // Helper to mount all 10 route modules
  const registerRoutes = async (scope: FastifyInstance) => {
    await scope.register(healthRoutes);
    await scope.register(authRoutes);
    await scope.register(usersRoutes);
    await scope.register(subjectsRoutes);
    await scope.register(matchingRoutes);
    await scope.register(groupsRoutes);
    await scope.register(sessionsRoutes);
    await scope.register(locationsRoutes);
    await scope.register(roomsRoutes);
    await scope.register(neptunRoutes);
  };

  // Mount under both /api/v1 and /api so both path patterns resolve cleanly
  await app.register(registerRoutes, { prefix: '/api/v1' });
  await app.register(registerRoutes, { prefix: '/api' });

  await app.ready();
  return app;
}

function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // If Vercel rewrites the URL to /api/index, restore the original incoming path from header
  const matchedPath = req.headers['x-matched-path'] as string | undefined;
  if (matchedPath) {
    req.url = matchedPath;
  } else if (req.url?.startsWith('/api/index')) {
    // Strip /api/index prefix if present
    const stripped = req.url.slice('/api/index'.length);
    req.url = stripped.startsWith('/') ? `/api${stripped}` : `/api/${stripped}`;
  }

  const app = await getApp();
  app.server.emit('request', req, res);
}

// Support CommonJS require() interop
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}
