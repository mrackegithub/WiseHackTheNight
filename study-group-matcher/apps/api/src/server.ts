import { buildApp } from './app';

const app = await buildApp({ logger: true });

try {
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? 'localhost' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
