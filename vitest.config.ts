import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const alias = Object.fromEntries(
  fs
    .readdirSync(new URL('./packages', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packageDir = new URL(`./packages/${entry.name}/`, import.meta.url);
      const packageJson = JSON.parse(fs.readFileSync(new URL('package.json', packageDir), 'utf8'));
      return [packageJson.name, resolve(workspaceRoot, `packages/${entry.name}/src/index.ts`)];
    }),
);

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    include: ['packages/*/tests/**/*.{spec,test}.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
