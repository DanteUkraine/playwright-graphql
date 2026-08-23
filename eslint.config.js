import tsESLint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  // Preset configurations
  // ESLint core recommended rules for TypeScript files
  tsESLint.configs['flat/eslint-recommended'],
  // TypeScript ESLint recommended rules (includes base + eslint-recommended + recommended)
  ...tsESLint.configs['flat/recommended'],

  // Ignore patterns
  {
    ignores: ['lib/', 'node_modules/', '*.d.ts', '**/*.test.ts', 'jest.config.ts', 'coverage/', 'tests/resources/'],
  },
  // TypeScript files configuration
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {},
      ecmaVersion: 2023,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsESLint,
      'import-x': importX,
      'unused-imports': unusedImports,
    },
    settings: {
      // Import-x settings for TypeScript support
      'import-x/extensions': ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs'],
      'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.cts', '.mts'],
      },
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import organization - using import-x prefix
      'import-x/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
      'import-x/no-duplicates': 'error',
      'import-x/no-useless-path-segments': 'error',

      // Unused imports
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',

      // Code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Disabled (handled by TypeScript)
      'no-undef': 'off',
      'no-redeclare': 'off',
    },
  },
];
