import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';

const ignorePath = join(import.meta.dirname, '.prettierignore');

export default tseslint.config(
  includeIgnoreFile(ignorePath),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  // Global rule adjustments
  {
    rules: {
      'no-control-regex': 'off',
    },
  },
  // Test-only relaxations
  {
    files: ['packages/**/tests/**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
