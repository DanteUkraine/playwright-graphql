import { test, expect, beforeEach } from '@jest/globals';
import GraphqlCoverageReport from '../src/coverage-reporter/report';
import { resolve, join } from 'path';

describe('Graphql Coverage Report', () => {

    const expectedCoverageDir = '.raw-graphql-coverage';

    beforeEach(() => {
        jest.restoreAllMocks();
    })

    test('should initialize with all options', async () => {
        const options = {
            graphqlFilePath: './tests/resources/graphql.ts',
            coverageFilePath: './mock-coverage.log',
            logUncoveredOperations: true,
            minCoveragePerOperation: 80,
            saveGqlCoverageLog: true,
        };

        const reporter = new GraphqlCoverageReport(options);

        expect(reporter).toBeDefined();
        expect(reporter['operationsSchema']).toEqual([
            { inputParams: [{ called: 0, key: "id", type: "string" }], name: "group" },
            { inputParams: [], name: "groups" },
            { inputParams: [{ called: 0, key: "id", type: "string" }], name: "user" },
            { inputParams: [], name: "users" }]
        );
        expect(reporter['coverageFilePath']).toEqual(options.coverageFilePath);
        expect(reporter['logUncoveredOperations']).toEqual(options.logUncoveredOperations);
        expect(reporter['minCoveragePerOperation']).toEqual(options.minCoveragePerOperation);
        expect(reporter['saveGqlCoverageLog']).toEqual(options.saveGqlCoverageLog);
    });

    test('should parse enums as const and enums equally', async () => {
        const options1 = {
            graphqlFilePath: './tests/resources/clientWithEnum.ts',
            coverageFilePath: './mock-coverage.log',
            logUncoveredOperations: true,
            minCoveragePerOperation: 80,
            saveGqlCoverageLog: true,
        };

        const options2 = {
            graphqlFilePath: './tests/resources/clientWithEnumsAsConst.ts',
            coverageFilePath: './mock-coverage.log',
            logUncoveredOperations: true,
            minCoveragePerOperation: 80,
            saveGqlCoverageLog: true,
        };

        const reporter1 = new GraphqlCoverageReport(options1);
        const reporter2 = new GraphqlCoverageReport(options2);

        expect(reporter2['operationsSchema']).toEqual(reporter1['operationsSchema']);
    });

    test('should initialize with required options', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
        };

        const reporter = new GraphqlCoverageReport(options);

        expect(reporter).toBeDefined();
        expect(reporter['operationsSchema']).toEqual([
            { inputParams: [{ called: 0, key: "id", type: "string" }], name: "group" },
            { inputParams: [], name: "groups" },
            { inputParams: [{ called: 0, key: "id", type: "string" }], name: "user" },
            { inputParams: [], name: "users" }]
        );
        expect(reporter['coverageFilePath']).toEqual('./raw-graphql-coverage.log');
        expect(reporter['logUncoveredOperations']).toEqual(false);
        expect(reporter['minCoveragePerOperation']).toEqual(100);
        expect(reporter['saveGqlCoverageLog']).toEqual(false);
    });

    test('should throw error if GraphQL file does not exist', () => {
        const options = {
            graphqlFilePath: './none-graphql.ts',
        };

        expect(() => new GraphqlCoverageReport(options)).toThrowError(
            `Source file '${resolve(options.graphqlFilePath)}' does not exist.`
        );
    });

    test('onBegin should create and remove coverage directory', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
            coverageFilePath: './mock-coverage.log',
        };

        const reporter = new GraphqlCoverageReport(options);

        const accessMock = jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(Promise<void>);
        const rmMock = jest.spyOn(require('fs/promises'), 'rm').mockResolvedValue(Promise<void>);
        const mkdirMock = jest.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(Promise<void>);

        await reporter.onBegin();

        expect(accessMock).toHaveBeenCalledWith(join(process.cwd(), expectedCoverageDir));
        expect(rmMock).toHaveBeenCalledWith(join(process.cwd(), expectedCoverageDir), { recursive: true });
        expect(mkdirMock).toHaveBeenCalledWith(join(process.cwd(), expectedCoverageDir));
    });

    test('onBegin should create coverage directory', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
            coverageFilePath: './mock-coverage.log',
        };

        const reporter = new GraphqlCoverageReport(options);

        const accessMock = jest.spyOn(require('fs/promises'), 'access')
            .mockRejectedValue(new Error('ENOENT: no such file or directory'));
        const rmMock = jest.spyOn(require('fs/promises'), 'rm')
            .mockResolvedValue(Promise<void>);
        const mkdirMock = jest.spyOn(require('fs/promises'), 'mkdir')
            .mockResolvedValue(Promise<void>);

        await reporter.onBegin();

        expect(accessMock).toHaveBeenCalledWith(join(process.cwd(), expectedCoverageDir));
        expect(rmMock).not.toHaveBeenCalledWith(resolve(expectedCoverageDir), { recursive: true });
        expect(mkdirMock).toHaveBeenCalledWith(join(process.cwd(), expectedCoverageDir));
    });

    test('onEnd should throw error if no coverage dir found', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
            coverageFilePath: './mock-coverage.log',
        };

        const reporter = new GraphqlCoverageReport(options);

        jest.spyOn(require('fs/promises'), 'access')
            .mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(reporter.onEnd()).rejects.toThrowError(`Directory with logged coverage was not found: ${join(process.cwd(), expectedCoverageDir)}`);
    });

    test('onEnd should calculate coverage and write logs', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
            coverageFilePath: './test-coverage.log',
            saveGqlCoverageLog: true,
        };

        const rmMock = jest.spyOn(require('fs/promises'), 'rm')
            .mockResolvedValue(undefined);
        const readFileMock = jest.spyOn(require('fs/promises'), 'readFile');
        const writeFileMock = jest.spyOn(require('fs/promises'), 'writeFile')
            .mockResolvedValue(Promise<void>);

        const stabCoverageDir = './tests/resources/coverageDir';

        const reporter = new GraphqlCoverageReport(options);

        // @ts-ignore
        reporter['coverageDir'] = stabCoverageDir;

        await reporter.onEnd();

        expect(readFileMock).toBeCalledTimes(2);
        expect(writeFileMock).toBeCalledTimes(5);
        expect(rmMock).toHaveBeenCalledWith(stabCoverageDir, { recursive: true });
    });
});
