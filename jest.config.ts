import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(gql-generator|@graphql-codegen/cli|yargs)/)',
    ],
    // Enable open handle detection to identify resource leaks
    detectOpenHandles: true,
    // Coverage configuration - only applies when --coverage flag is used
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.spec.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
};

export default config;
