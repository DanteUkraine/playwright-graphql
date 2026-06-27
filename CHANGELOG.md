# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0-rc1] - 2026-06-27

### ✨ New Features

- **ESM Compatibility**: Full support for @graphql-codegen/cli@7.1.3 with ECMAScript Modules, enabling seamless integration with modern ESM-based projects while maintaining CommonJS compatibility.
- **ts-morph Migration**: Complete migration from TypeScript Compiler API to [ts-morph](https://github.com/dsherret/ts-morph) for AST parsing in `gql-client-parser.ts`, providing better type safety and maintainability.
- **Type Safety Enhancements**: Comprehensive type safety improvements across the entire codebase with strict type checking, eliminating unsafe `any` types.
- **ESLint Enforcement**: Full ESLint compliance with strict `@typescript-eslint` rules, ensuring consistent code quality.

### 🔧 Improvements

- **Code Quality**: 100% ESLint compliance with zero errors across all source files
- **Import Organization**: Consistent import grouping (built-ins, third-party, local) with proper spacing
- **Null Safety**: Enhanced null/undefined checks with type guards throughout the codebase
- **String Methods**: Refactored regular expressions to use string methods (`startsWith`, `endsWith`, `slice`, etc.) where possible
- **Error Handling**: Improved error messages for invalid inputs and edge cases
- **Type Guards**: Added runtime type validation for safer object property access
- **Yargs Integration**: Fixed import from `yargs/helpers` for `hideBin` function, resolving ESM compatibility issues

### 🐛 Bug Fixes

- Fixed ESM module resolution issues with @graphql-codegen/cli v7.1.3
- Corrected unsafe type assignments and `any` usage throughout the codebase
- Resolved template literal type safety issues in error messages
- Fixed import order violations per ESLint rules
- Corrected strict equality comparisons (replaced `==` with `===`)
- Resolved unsafe enum comparisons in GraphQL document validation
- Fixed nullish coalescing operator usage (replaced `||` with `??` where appropriate)

### 📋 Requirements

- **TypeScript**: >= 6.0.3 (required for ESM and new language features)
- **@playwright/test**: >= 1.44.x (peer dependency)
- **Node.js**: >= 18.x (recommended for ESM support)

### 🔄 Migration Notes

This is a **quality-focused release** with no breaking changes. However, note the following:

- **Type Safety**: This release enforces stricter type checking. If your code relies on implicit `any` types or unsafe operations, you may need to add explicit type annotations.
- **ESM Compatibility**: The library now fully supports ESM. If you encounter "Cannot use import statement outside module" errors, ensure your project is configured for ESM or use CommonJS imports.
- **@graphql-codegen/cli**: Updated to v7.1.3 which includes ESM support. If you were using an older version, this is automatically handled by the dependency update.

### 📝 Technical Details

#### AST Migration (ts-morph)
- Migrated `src/coverage-reporter/gql-client-parser.ts` from TypeScript Compiler API to ts-morph
- Added comprehensive type guards for safe AST node access
- Improved error handling for invalid TypeScript/GraphQL syntax
- Better type inference for parsed parameters and operations

#### ESLint Improvements
- Fixed all `@typescript-eslint/no-explicit-any` violations
- Resolved `@typescript-eslint/no-unsafe-*` errors with proper type guards
- Corrected `import/order` violations with consistent grouping
- Added `no-console` exceptions for intentional logging (muted gqlg logs)
- Fixed `restrict-template-expressions` issues with proper type assertions

#### Dependencies
- Updated `@graphql-codegen/cli` from 6.1.0 to 7.1.3 for ESM support
- Added `ts-morph` v28.0.0 for AST manipulation
- Updated TypeScript to 6.0.3+ support

---

## [2.3.0] - 2025-XX-XX

### ⚠️ Release Notes

> This version was skipped in favor of 2.3.0-rc1 to ensure quality without accumulating technical debt.

---

## [2.2.0] - 2025-XX-XX

> Previous version - see Git history for changes.

---

[Unreleased]: https://github.com/DanteUkraine/playwright-graphql/compare/2.3.0-rc1...HEAD
[2.3.0-rc1]: https://github.com/DanteUkraine/playwright-graphql/compare/2.2.0...2.3.0-rc1
