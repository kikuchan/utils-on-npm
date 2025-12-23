import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsdown';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const projectRoot = import.meta.dirname;

const root = import.meta.dirname;
const pkgName = pkg.name.replace(/^[^/]+\//, '');
const outDir = path.join(projectRoot, 'dist', pkgName);

function replaceSrc(s: string, ext: string = 'js') {
  return s.replace(/^\.\/src\//, './').replace(/\.(vue|ts)$/, '.' + ext);
}

function replaceRecursive(
  obj: Record<string, unknown> | undefined,
  replacer: (s: string, k: string) => string | undefined,
) {
  if (!obj) return undefined;

  const results: Record<string, unknown> = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      results[key] = replacer(obj[key], key);
    } else if (typeof obj[key] === 'object') {
      results[key] = replaceRecursive(obj[key] as Record<string, unknown>, replacer);
    } else {
      results[key] = obj[key];
    }
  }
  return results;
}

export default defineConfig({
  minify: true,
  dts: true,

  outDir,
  fixedExtension: false,
  format: ['esm', 'cjs'],

  onSuccess() {
    fs.copyFileSync('./README.md', path.join(outDir, 'README.md'));
    fs.writeFileSync(
      path.join(outDir, 'package.json'),
      JSON.stringify(
        {
          ...pkg,
          main: replaceSrc(pkg.main),
          types: replaceSrc(pkg.main, 'd.ts'),
          exports: {
            '.': {
              types: replaceSrc(pkg.main, 'd.ts'),
              import: replaceSrc(pkg.main),
              require: replaceSrc(pkg.main, 'cjs'),
            },
          },
          repository: {
            url: 'https://github.com/kikuchan/utils-on-npm',
          },
          devDependencies: undefined,
          dependencies: replaceRecursive(pkg.dependencies, (s, k) => {
            if (s !== 'workspace:*') return s;

            const ppkg = JSON.parse(
              fs.readFileSync(path.join(root, 'packages', path.basename(k), 'package.json'), 'utf-8'),
            );
            if (ppkg?.version) return `^${ppkg.version}`;
            return '*';
          }),
          scripts: undefined,
          private: undefined,
        },
        null,
        2,
      ),
    );
  },
});
