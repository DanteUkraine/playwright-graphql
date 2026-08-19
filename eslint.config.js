import tsESLint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';

// This flat config includes all rules from the TypeScript-ESLint plugin:
// - eslint:recommended (enabled automatically by @typescript-eslint/parser)
// - plugin:@typescript-eslint/recommended (enabled automatically for TypeScript files)
// - plugin:import/typescript (enabled via import-x plugin)
//
// Note: plugin:@typescript-eslint/recommended-requiring-type-checking is NOT enabled
// as it requires type information and would flag existing code. This is a known
// limitation of the flat config migration that should be addressed separately.
export default [
  // Ignore patterns
  {
    ignores: ['lib/', 'node_modules/', '*.d.ts', '**/*.test.ts', 'jest.config.ts', 'coverage/'],
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
