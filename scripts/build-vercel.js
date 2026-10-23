const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

console.log('===> Step 1: Generating contracts...');
execSync('pnpm --filter @sgm/contracts generate', { stdio: 'inherit' });

console.log('===> Step 2: Generating Prisma Client...');
execSync('pnpm --filter @sgm/api exec prisma generate', { stdio: 'inherit' });

console.log('===> Step 3: Copying generated .prisma/client to root node_modules...');
function findPrismaClientDirs(startDir, results = []) {
  if (!fs.existsSync(startDir)) return results;
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.prisma') {
        const clientPath = path.join(fullPath, 'client');
        if (fs.existsSync(clientPath) && fs.existsSync(path.join(clientPath, 'schema.prisma'))) {
          results.push(clientPath);
        }
      } else if (entry.name === '.pnpm' || entry.name.startsWith('@prisma') || entry.name === 'node_modules') {
        findPrismaClientDirs(fullPath, results);
      }
    }
  }
  return results;
}

const foundDirs = [
  ...findPrismaClientDirs(path.resolve('apps/api/node_modules')),
  ...findPrismaClientDirs(path.resolve('node_modules')),
];

const sourcePrismaClient = foundDirs[0];

if (sourcePrismaClient) {
  console.log('Found source .prisma/client at:', sourcePrismaClient);
  const targetDirs = new Set([
    path.resolve('node_modules/.prisma/client'),
  ]);

  const rootPnpm = path.resolve('node_modules/.pnpm');
  if (fs.existsSync(rootPnpm)) {
    for (const name of fs.readdirSync(rootPnpm)) {
      if (name.includes('@prisma+client')) {
        targetDirs.add(path.resolve(rootPnpm, name, 'node_modules/.prisma/client'));
      }
    }
  }

  for (const targetDir of targetDirs) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(sourcePrismaClient, targetDir, { recursive: true });
    console.log('Copied .prisma/client to:', targetDir);
  }
} else {
  console.warn('Warning: Could not find generated .prisma/client directory to copy');
}

console.log('===> Step 4: Bundling scripts/vercel-api-entry.ts with esbuild...');
fs.mkdirSync(path.resolve('api'), { recursive: true });
esbuild.buildSync({
  entryPoints: ['scripts/vercel-api-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'api/index.js',
  external: ['@prisma/client', 'argon2'],
  nodePaths: ['apps/api/node_modules', 'packages/integrations/node_modules'],
});
console.log('API bundled to api/index.js successfully.');

console.log('===> Step 5: Building web frontend...');
execSync('pnpm --filter @sgm/web build', { stdio: 'inherit' });

console.log('===> Full build complete!');
