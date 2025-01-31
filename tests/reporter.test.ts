import { test, expect, beforeEach } from '@jest/globals';
import GraphqlCoverageReport from '../src/reporter/report';
import { coverageDir } from '../src/reporter/consts';
import { resolve } from 'path';

describe('Graphql Coverage Report', () => {

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
        expect(reporter['coverageFilePath']).toEqual('./gql-coverage.log');
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

        expect(accessMock).toHaveBeenCalledWith(coverageDir);
        expect(rmMock).toHaveBeenCalledWith(coverageDir, { recursive: true });
        expect(mkdirMock).toHaveBeenCalledWith(coverageDir);
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

        expect(accessMock).toHaveBeenCalledWith(coverageDir);
        expect(rmMock).not.toHaveBeenCalledWith(resolve(coverageDir), { recursive: true });
        expect(mkdirMock).toHaveBeenCalledWith(coverageDir);
    });

    test('onEnd should throw error if no coverage dir found', async () => {
        const options = {
            graphqlFilePath: './tests/resources/raw-graphql.ts',
            coverageFilePath: './mock-coverage.log',
        };

        const reporter = new GraphqlCoverageReport(options);

        jest.spyOn(require('fs/promises'), 'access')
            .mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(reporter.onEnd()).rejects.toThrowError(`Directory with logged coverage was not found: ${coverageDir}`);
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

        const reporter = new GraphqlCoverageReport(options);

        await reporter.onEnd();

        expect(readFileMock).toBeCalledTimes(2);
        expect(writeFileMock).toBeCalledTimes(5);
        expect(rmMock).toHaveBeenCalledWith(coverageDir, { recursive: true });
    });
});
