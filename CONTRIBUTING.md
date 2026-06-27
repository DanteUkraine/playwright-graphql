# Contributing to playwright-graphql

Thank you for your interest in contributing to **playwright-graphql**! We welcome contributions from everyone.

This document provides guidelines for contributing to the project. Please read it before submitting your first pull request.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Coding Standards](#-coding-standards)
- [Code Style](#-code-style)
- [Testing](#-testing)
- [Pull Request Process](#-pull-request-process)
- [Commit Message Guidelines](#-commit-message-guidelines)
- [Reporting Issues](#-reporting-issues)
- [License](#-license)

---

## 🤝 Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. By participating, you are expected to uphold this code.

Please be respectful and inclusive in all interactions.

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 18.x (LTS recommended)
- **npm**: >= 9.x (comes with Node.js)
- **TypeScript**: >= 6.0.3
- **Git**: Latest version

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DanteUkraine/playwright-graphql.git
cd playwright-graphql

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Verify ESLint compliance
npx eslint src/**/*.ts
```

---

## 🔧 Development Setup

### 1. Fork the Repository

Fork the project on GitHub and clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/playwright-graphql.git
cd playwright-graphql
```

### 2. Install Dependencies

```bash
npm install
```

This installs both production and development dependencies.

### 3. Set Up Git Hooks

This project uses [Husky](https://typed.dev/husky) for Git hooks to automatically run linting on commits:

```bash
npm run prepare
```

Or manually:

```bash
npx husky install
```

The pre-commit hook will run ESLint on staged files. You can bypass it with `--no-verify` if needed.

### 4. Verify Setup

```bash
# Build the project
npm run build

# Run all tests
npm test

# Check ESLint
npx eslint src/**/*.ts
```

All commands should complete successfully.

---

## 📁 Project Structure

```
playwright-graphql/
├── src/
│   ├── codegen-cli/
│   │   ├── run-command.ts         # Command execution utilities
│   │   └── setup-codegen-cli.ts   # CLI entry point and configuration
│   ├── coverage-reporter/
│   │   ├── coverage-calculation-helpers.ts  # Coverage calculation logic
│   │   ├── coverageLogger.ts      # Coverage logging proxy
│   │   ├── coverageStashPath.ts   # Coverage file path utilities
│   │   ├── gql-client-parser.ts   # GraphQL client AST parser (ts-morph)
│   │   ├── html-generator.ts      # HTML report generation
│   │   ├── index.ts              # Coverage reporter exports
│   │   ├── report.ts             # Main reporter implementation
│   │   └── types.ts              # TypeScript type definitions
│   ├── gql-generator.d.ts        # Type declarations for gql-generator
│   ├── index.ts                  # Main library exports
│   └── requester.ts              # GraphQL request handling
├── tests/
│   ├── resources/                # Test fixtures and generated files
│   └── *.test.ts                # Test files
├── docs/
│   ├── coverage-html.png        # Coverage report screenshot
│   └── gql-autocomplete-demo.gif # Autocomplete demo
├── .eslintrc.cjs                # ESLint configuration
├── .github/                     # GitHub configurations
├── .gitignore
├── .lintstagedrc.cjs            # lint-staged configuration
├── CHANGELOG.md                 # Change log
├── CONTRIBUTING.md              # This file
├── LICENSE
├── README.md
├── jest.config.ts               # Jest configuration
├── package.json
├── tsconfig.json                # TypeScript configuration
└── _config.yml
```

---

## 📜 Coding Standards

### TypeScript

- Use **strict type checking** - avoid `any` types
- Prefer **explicit types** over type inference when clarity is improved
- Use **type guards** for runtime type validation
- Prefer **`unknown`** over `any` for dynamic values
- Use **`Record<string, T>`** instead of `{[key: string]: T}` or `{}`

### Error Handling

- Use **descriptive error messages**
- Throw errors with context: `throw new Error('Invalid input: expected string, got number')`
- Handle edge cases explicitly

### Code Organization

- **Single Responsibility Principle**: Each file/module should have one clear purpose
- **Keep functions small**: Aim for < 50 lines per function
- **Group related logic**: Keep related functionality together

---

## 🎨 Code Style

This project uses **ESLint** with strict `@typescript-eslint` rules. Run the linter to check your code:

```bash
npx eslint src/**/*.ts
```

### Key ESLint Rules

| Rule | Purpose | Example |
|------|---------|---------|
| `@typescript-eslint/no-explicit-any` | Avoid `any` types | Use `unknown` or proper types |
| `@typescript-eslint/no-unsafe-*` | Safe type operations | Add type guards |
| `import/order` | Consistent imports | Group: built-ins, third-party, local |
| `no-console` | No console statements | Use logger or remove |
| `eqeqeq` | Strict equality | Use `===` not `==` |
| `prefer-nullish-coalescing` | Safer default values | Use `??` not `||` |
| `require-await` | Async functions must await | Add `await Promise.resolve()` |
| `explicit-function-return-type` | Explicit return types | Always specify return types |

### Import Order

Imports must be grouped in this order with **one blank line** between groups:

```typescript
// 1. Node.js built-in modules
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// 2. Third-party modules (from node_modules)
import { print } from 'graphql';
import prettier from 'prettier';

// 3. Local modules (from src/)
import { getClient } from './client';
import { types } from '../types';
```

### Type Safety Patterns

**Before (problematic):**
```typescript
function parseInput(data: any) {
  return data.value; // Unsafe!
}
```

**After (type-safe):**
```typescript
function parseInput(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected object');
  }
  const obj = data as { value?: unknown };
  if (!('value' in obj) || typeof obj.value !== 'string') {
    throw new Error('Expected string value');
  }
  return obj.value;
}
```

### String Methods Over Regex

**Before:**
```typescript
const hasPrefix = /^prefix/.test(str);
const hasSuffix = /suffix$/.test(str);
const withoutLastChar = str.replace(/.$/, '');
```

**After:**
```typescript
const hasPrefix = str.startsWith('prefix');
const hasSuffix = str.endsWith('suffix');
const withoutLastChar = str.slice(0, -1);
```

---

## 🧪 Testing

### Running Tests

```bash
npm test
```

This runs all Jest tests with coverage.

### Test Structure

Tests are located in the `tests/` directory:

- `requester.test.ts` - Tests for GraphQL request handling
- `reporter.test.ts` - Tests for coverage reporter
- `coverage-logger.test.ts` - Tests for coverage logger
- `coverage-calculation-helpers.test.ts` - Tests for coverage calculations
- `html-generator.test.ts` - Tests for HTML report generation
- `codegen-cli.test.ts` - Tests for CLI functionality

### Writing Tests

- Use `@jest/globals` types for `test`, `expect`, `describe`, etc.
- Test both happy paths and error cases
- Use clear, descriptive test names
- Keep tests isolated

### Test Example

```typescript
import { test, expect, describe } from '@jest/globals';
import { someFunction } from '../src/some-module';

describe('someFunction', () => {
  test('should return correct result for valid input', () => {
    const result = someFunction('valid-input');
    expect(result).toBe('expected-output');
  });

  test('should throw error for invalid input', () => {
    expect(() => someFunction('')).toThrow('Input cannot be empty');
  });
});
```

---

## 📤 Pull Request Process

### 1. Create a Feature Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create your feature branch
git checkout -b feature/your-feature-name
```

**Branch Naming Conventions:**

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feature/` | `feature/esm-support` |
| Bug Fix | `fix/` | `fix/type-error` |
| Documentation | `docs/` | `docs/contributing-guide` |
| Refactor | `refactor/` | `refactor/ast-parsing` |
| Chore | `chore/` | `chore/dependencies` |
| Release | `release/` | `release/2.3.0-rc1` |

### 2. Make Your Changes

- Follow the [Coding Standards](#-coding-standards) and [Code Style](#-code-style)
- Add tests for new functionality
- Update documentation if needed
- Run `npm run build` and `npm test` to verify everything works

### 3. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: add new feature description"
```

See [Commit Message Guidelines](#-commit-message-guidelines) below.

### 4. Push to Your Fork

```bash
 git push origin feature/your-feature-name
```

### 5. Create a Pull Request

Go to the [GitHub repository](https://github.com/DanteUkraine/playwright-graphql) and create a pull request from your branch to `main`.

**PR Template:**

```markdown
## 📝 Description

[Describe what this PR does]

## 🎯 Related Issue

[Link to related issue if any, or N/A]

## ✅ Checklist

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`npm test`)
- [ ] No ESLint errors (`npx eslint src/**/*.ts`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] Tests added for new functionality

## 📋 Changes Made

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactor
- [ ] Dependency update
- [ ] Other (please describe)

## ⚠️ Breaking Changes

[Describe any breaking changes, or N/A]

## 🔍 Testing

[Describe how you tested your changes]
```

### 6. PR Review Process

- A maintainer will review your PR within 3-5 business days
- You may be asked to make changes based on feedback
- Once approved, a maintainer will merge your PR
- Your contribution will be included in the next release

---

## 📝 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Commit Message Format

```
type(scope): subject

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | A new feature | `feat(cli): add coverage flag option` |
| `fix` | A bug fix | `fix(requester): handle null response data` |
| `docs` | Documentation only changes | `docs(readme): add ESM setup guide` |
| `style` | Code style changes (formatting, missing semicolons, etc.) | `style: fix import order` |
| `refactor` | Code refactoring (no functional changes) | `refactor(parser): migrate to ts-morph` |
| `perf` | Performance improvements | `perf: optimize AST parsing` |
| `test` | Adding or fixing tests | `test: add coverage for edge cases` |
| `chore` | Build process or auxiliary tool changes | `chore: update dependencies` |
| `revert` | Revert a previous commit | `revert: undo breaking change` |

### Scopes

Use the file or module name as the scope:
- `cli` - Codegen CLI related changes
- `reporter` - Coverage reporter changes
- `requester` - GraphQL requester changes
- `parser` - AST parsing changes
- `deps` - Dependency updates
- `eslint` - Linting configuration

### Subject

- Use imperative mood: "add" not "added", "fix" not "fixed"
- Start with a lowercase letter
- Keep it concise (50-72 characters)
- Don't end with a period

### Examples

**Good:**
```
feat(cli): add ESM support for codegen
fix(parser): validate input parameters before access
refactor(requester): migrate to type-safe error handling
docs(readme): add prerequisites section
chore(deps): update @graphql-codegen/cli to v7.1.3
```

**Bad:**
```
Added ESM support  # Missing type, past tense
Fix parser bug  # Missing scope, imperative mood
updated dependencies  # Missing type, past tense
```

---

## 🐛 Reporting Issues

Before reporting an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** (README, docs)
3. **Verify you're using the latest version**

### Bug Report Template

When creating a bug report, include:

- **Version**: `playwright-graphql@2.3.0-rc1`
- **Node.js Version**: `node -v`
- **TypeScript Version**: `tsc -v`
- **@playwright/test Version**: `npm list @playwright/test`
- **Operating System**: Windows/macOS/Linux

**Steps to Reproduce:**
1. Run command...
2. Use configuration...
3. Observe error...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Error Messages:**
```
[Full error output]
```

**Minimal Reproduction:**
[Code or repository that reproduces the issue]

---

## 📄 Feature Request Template

When requesting a feature, include:

- **Problem**: What problem are you trying to solve?
- **Solution**: What solution do you propose?
- **Alternatives**: Have you considered any alternatives?
- **Use Case**: How would this feature help you?
- **Example**: Code example showing desired API

---

## 🎉 Getting Help

If you need help:

1. **Read the documentation** - README.md and docs/
2. **Check existing issues** - Someone may have asked the same question
3. **Create an issue** - Use the appropriate template
4. **Join the discussion** - Ask questions and share ideas

---

## 📜 License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

## 🙏 Thank You!

Your contributions help make **playwright-graphql** better for everyone. Thank you for your time and effort!

---

*Maintained with ❤️ by [Oleksandr Solomin](https://github.com/DanteUkraine)*
