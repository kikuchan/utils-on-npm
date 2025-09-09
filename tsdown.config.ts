import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsdown';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const projectRoot = import.meta.dirname;

const pkgName = pkg.name.replace(/^[^/]+\//, '');
const outDir = path.join(projectRoot, 'dist', pkgName);

function replaceRecursive(obj: object, replacer: (s: string, k: string) => string) {
  const results = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      results[key] = replacer(obj[key], key);
    } else if (typeof obj[key] === 'object') {
      results[key] = replaceRecursive(obj[key], replacer);
    } else {
      results[key] = obj[key];
    }
  }
  return results;
}

function replaceSrc(s: string, ext: string = 'js') {
  return s.replace(/^\.\/src\//, './').replace(/\.(vue|ts)$/, '.' + ext);
}

export default defineConfig({
  minify: true,
  dts: true,

  outDir,

  onSuccess() {
    fs.writeFileSync(
      path.join(outDir, 'package.json'),
      JSON.stringify(
        {
          ...pkg,
          main: replaceSrc(pkg.main),
          types: replaceSrc(pkg.main, 'd.ts'),
          exports: replaceRecursive(pkg.exports ?? { '.': replaceSrc(pkg.main) }, replaceSrc),
          dependencies: replaceRecursive(pkg.dependencies, (s, k) => {
            if (s !== 'workspace:*') return s;

            const ppkg = JSON.parse(
              fs.readFileSync(path.join(projectRoot, 'node_modules', k, 'package.json'), 'utf-8'),
            );
            if (ppkg?.version) return `^${ppkg.version}`;
            return '*';
          }),
          devDependencies: undefined,
          scripts: undefined,
          private: undefined,
        },
        null,
        2,
      ),
    );
  },
});
