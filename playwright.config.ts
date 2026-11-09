import { defineConfig } from '@playwright/test';

// Config for the Bun-runtime job (`bun --bun playwright test`).
// Keeps the Bun runner isolated from the Jest suite (*.test.ts).
// Note: under `bun --bun` the `files` option is ignored by the runner,
// so we use `testIgnore` to exclude the Jest files instead.
export default defineConfig({
    testDir: './tests',
    workers: 1,
    reporter: 'list',
    testIgnore: ['**/*.test.ts'],
    use: {},
});
