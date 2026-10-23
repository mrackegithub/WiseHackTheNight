import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const envPath = resolve(__dirname, '.env');
if (existsSync(envPath) && process.loadEnvFile) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    fileParallelism: false,
    server: {
      deps: {
        inline: ['@fastify/autoload'],
      },
    },
  },
});

