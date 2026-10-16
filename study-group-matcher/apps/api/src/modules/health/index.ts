import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import pkg from '../../../package.json' with { type: 'json' };

type HealthResponse = paths['/health']['get']['responses'][200]['content']['application/json'];

/** getHealth: `ok` when the database answers, `degraded` otherwise. */
const health: FastifyPluginAsync = async (app) => {
  app.get('/health', async (): Promise<HealthResponse> => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', version: pkg.version };
    } catch (err) {
      app.log.warn({ err }, 'health: database unreachable');
      return { status: 'degraded', version: pkg.version };
    }
  });
};

export default health;
