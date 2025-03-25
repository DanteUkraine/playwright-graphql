import { promisify } from 'node:util';
import { exec } from 'child_process';
import { readdir, mkdir, rm, writeFile, readFile } from 'fs/promises';
import { startFakeGraphQLServer, stopFakeGraphQLServer, lastRequestHeaders } from './resources/gql-fake-server';
import { existsSync } from 'fs';
import * as path from 'path';
import { join } from 'path';
import { loadCodegenConfig } from '@graphql-codegen/cli';

const execAsync = promisify(exec);

describe('Setup Codegen CLI', () => {
    const cliPath = path.resolve(__dirname, '../lib/codegen-cli/setup-codegen-cli.js');
    const stabServer = 'http://localhost:4000';
    const schemaFile = 'test-schema.gql';
    const schemaName = schemaFile.split('.')[0];
    const gqlDirectory = 'graphql';
    const gqlFile = 'gql.ts';
    const testDir = path.join(__dirname, 'codegen-test');

    jest.setTimeout(15_000);

    beforeAll(async () => {
        await startFakeGraphQLServer();
    });

    afterAll(async () => {
        await stopFakeGraphQLServer();
    });

    beforeEach(async () => {
        await mkdir(testDir);
    });

    afterEach(async () => {
        if (existsSync(testDir)) {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test('generates schema and operations from url no headers', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} --url ${stabServer} --schema ${schemaFile} --gqlDir ${gqlDirectory} --gqlFile ${gqlFile}`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ schemaFile, gqlDirectory ].sort());

        expect(lastRequestHeaders).not.toHaveProperty('authorization');

        expect(cliLogs).toMatchObject({
            stdout: 'Schema generated from "http://localhost:4000" to "test-schema.gql".\n' +
                    `Operations were generated and saved to "${gqlDirectory}/${schemaName}/autogenerated-operations".\n` +
                    'Type Script types for Playwright auto generated type safe GQL client generated.\n',
        });
    });

    test('generates schemas and operations from multiple urls no headers', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} -u ${stabServer} -u ${stabServer} -s first-${schemaFile} -s second-${schemaFile} -f first-gql -f second-gql`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort())
            .toEqual([ `first-${schemaFile}`, `second-${schemaFile}`, 'gql' ].sort());

        const gqlDir = await readdir(join(testDir, 'gql'), { withFileTypes: true });
        expect(gqlDir.map(i => i.name ).sort())
            .toEqual([ `first-test-schema`, `second-test-schema`, `first-gql.ts`, `second-gql.ts` ].sort());

        // order is not strict since schema introspect works in Promise all
        expect(cliLogs.stdout.split('\n').filter(i => i).sort()).toMatchObject([
                `Schema generated from "http://localhost:4000" to "first-${schemaFile}".`,
                `Schema generated from "http://localhost:4000" to "second-${schemaFile}".`,
                `Operations were generated and saved to "gql/first-${schemaFile.split('.')[0]}/autogenerated-operations".`,
                `Operations were generated and saved to "gql/second-${schemaFile.split('.')[0]}/autogenerated-operations".`,
                'Type Script types for Playwright auto generated type safe GQL client generated.',
        ].sort());
    });

    test('generates schemas and operations from multiple schemas default gql naming', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} -u ${stabServer} -u ${stabServer} -s first-schema.gql -s second-schema.gql`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort())
            .toEqual([ `first-schema.gql`, `second-schema.gql`, 'gql' ].sort());

        const gqlDir = await readdir(join(testDir, 'gql'), { withFileTypes: true });
        expect(gqlDir.map(i => i.name ).sort())
            .toEqual([ `first-schema`, `second-schema`, `first-schema.ts`, `second-schema.ts` ].sort());

        // order is not strict since schema introspect works in Promise all
        expect(cliLogs.stdout.split('\n').filter(i => i).sort()).toMatchObject([
            `Schema generated from "http://localhost:4000" to "first-schema.gql".`,
            `Schema generated from "http://localhost:4000" to "second-schema.gql".`,
            `Operations were generated and saved to "gql/first-schema/autogenerated-operations".`,
            `Operations were generated and saved to "gql/second-schema/autogenerated-operations".`,
            'Type Script types for Playwright auto generated type safe GQL client generated.',
        ].sort());
    });

    test('generates schemas and operations from multiple schemas with custom operations', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} -u ${stabServer} -u ${stabServer} -s first-schema.gql -s second-schema.gql -o custom -o more-custom --saveCodegen`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort())
            .toEqual([ 'codegen.ts', 'first-schema.gql', 'second-schema.gql', 'gql' ].sort());

        const gqlDir = await readdir(join(testDir, 'gql'), { withFileTypes: true });
        expect(gqlDir.map(i => i.name ).sort())
            .toEqual([ `first-schema`, `second-schema`, `first-schema.ts`, `second-schema.ts` ].sort());

        // order is not strict since schema introspect works in Promise all
        expect(cliLogs.stdout.split('\n').filter(i => i).sort()).toMatchObject([
            `Schema generated from "http://localhost:4000" to "first-schema.gql".`,
            `Schema generated from "http://localhost:4000" to "second-schema.gql".`,
            `Operations were generated and saved to "gql/first-schema/autogenerated-operations".`,
            `Operations were generated and saved to "gql/second-schema/autogenerated-operations".`,
            'Type Script types for Playwright auto generated type safe GQL client generated.',
            'File "codegen.ts" generated.'
        ].sort());

        const codegen = await loadCodegenConfig({ configFilePath: path.join(testDir, 'codegen.ts') });

        expect(codegen.config.generates).toMatchObject({
            ['gql/first-schema.ts']: {
                schema: 'first-schema.gql',
                documents: [
                    'custom/**/*.gql',
                    'gql/first-schema/autogenerated-operations/**/*.gql'
                ],
                config: {
                    rawRequest: false,
                    scalars: {
                        BigInt: 'bigint|number',
                        Date: 'string'
                    }
                }
            },
            ['gql/second-schema.ts']: {
                schema: 'second-schema.gql',
                documents: [
                    'more-custom/**/*.gql',
                    'gql/second-schema/autogenerated-operations/**/*.gql'
                ],
                config: {
                    rawRequest: false,
                    scalars: {
                        BigInt: 'bigint|number',
                        Date: 'string'
                    }
                }
            },
        });
    });

    test('generates with introspect without custom operations', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} -u ${stabServer} -i false`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name).sort()).toEqual(['schema.gql'].sort());

        expect(cliLogs).toMatchObject({
            stdout: 'Schema generated from "http://localhost:4000" to "schema.gql".\n' +
                'Client can not be build without any operations, in case of introspect false set path to custom operations: "-o path/to/folder-with-operations"\n',
        });
    });

    test('generates schema and operations from url with headers', async () => {
        const cliLogs =await execAsync(`node ${cliPath} -u ${stabServer} -s ${schemaFile} -h "Authorization=Bearer blablaHash256" -h "Cookies={'Authorization': 'Bearer blablaHash'}"`, {
            cwd: testDir,
        });

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([schemaFile, 'gql' ].sort());
        expect(lastRequestHeaders).toHaveProperty('authorization', 'Bearer blablaHash256');
        expect(lastRequestHeaders).toHaveProperty('cookies', '{\'Authorization\': \'Bearer blablaHash\'}');

        expect(cliLogs).toMatchObject({
            stdout: 'Schema generated from "http://localhost:4000" to "test-schema.gql".\n' +
                    `Operations were generated and saved to "gql/${schemaName}/autogenerated-operations".\n` +
                    'Type Script types for Playwright auto generated type safe GQL client generated.\n',
        });
    });

    test('generates types from existing schema and adds coverage logger to client', async () => {
        const schemaFile = 'existing-schema.gql';
        const schemaContext = `
            type Query {
              hello: String
            }
        `;
        await writeFile(path.join(testDir, schemaFile), schemaContext);

        const cliLogs = await execAsync(`node ${cliPath} -s ${schemaFile} --coverage`, {
            cwd: testDir,
        });

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ schemaFile, 'gql' ].sort());

        expect(cliLogs).toMatchObject({
            stdout: `Operations were generated and saved to "gql/existing-schema/autogenerated-operations".\n` +
                    'Type Script types for Playwright auto generated type safe GQL client generated.\n',
        });
    });

    test('skip execution with message about absent schema', async () => {
        const cliLogs = await execAsync(`node ${cliPath} --schema ${schemaFile}`, {
            cwd: testDir,
        });

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name )).toHaveLength(0);

        expect(cliLogs).toMatchObject({
            stdout: 'Schema file: "test-schema.gql" was not found.\n' +
                    'Exit with no generated output.\n',
        });
    });

    test('generated type script should contain modification', async () => {
        await execAsync(
            `node ${cliPath} --url ${stabServer} --schema ${schemaFile} --gqlDir ${gqlDirectory} --gqlFile ${gqlFile}`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ schemaFile, gqlDirectory ].sort());

        const generatedFile = await readFile(join(testDir, gqlDirectory, gqlFile), 'utf8');
        expect(generatedFile).toContain(`import { getSdkRequester } from 'playwright-graphql';`);
        expect(generatedFile).toContain(`export type APIRequestContext = Parameters<typeof getSdkRequester>[0];`);
        expect(generatedFile).toContain(`export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;`);
        expect(generatedFile).toContain(`export type RequestHandler = Parameters<typeof getSdkRequester>[2];`);
        expect(generatedFile).toContain(`export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => getSdk(getSdkRequester(apiContext, options, requestHandler));`);
        expect(generatedFile).toContain(`export type GqlAPI = ReturnType<typeof getClient>;\n`);
    });

    test('generated type script should contain modification with coverage logger', async () => {
        await execAsync(
            `node ${cliPath} --url ${stabServer} --schema ${schemaFile} --gqlDir ${gqlDirectory} --gqlFile ${gqlFile} --coverage`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ schemaFile, gqlDirectory ].sort());

        const generatedFile = await readFile(join(testDir, gqlDirectory, gqlFile), 'utf8');
        expect(generatedFile).toContain(`import { getSdkRequester, coverageLogger } from 'playwright-graphql';`);
        expect(generatedFile).toContain(`export type APIRequestContext = Parameters<typeof getSdkRequester>[0];`);
        expect(generatedFile).toContain(`export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;`);
        expect(generatedFile).toContain(`export type RequestHandler = Parameters<typeof getSdkRequester>[2];`);
        expect(generatedFile).toContain(`export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => coverageLogger(getSdk(getSdkRequester(apiContext, options, requestHandler)));`);
        expect(generatedFile).toContain(`export type GqlAPI = ReturnType<typeof getClient>;\n`);
    });

    test('generate type safe client with --saveCodegen', async () => {
        const cliLogs = await execAsync(
            `node ${cliPath} --url ${stabServer} -d ${gqlDirectory} -f ${gqlFile} --saveCodegen`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ 'codegen.ts', 'schema.gql', gqlDirectory ].sort());

        const generatedFile = await readFile(join(testDir, gqlDirectory, gqlFile), 'utf8');
        expect(generatedFile).toContain(`import { getSdkRequester } from 'playwright-graphql';`);
        expect(generatedFile).toContain(`export type APIRequestContext = Parameters<typeof getSdkRequester>[0];`);
        expect(generatedFile).toContain(`export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;`);
        expect(generatedFile).toContain(`export type RequestHandler = Parameters<typeof getSdkRequester>[2];`);
        expect(generatedFile).toContain(`export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => getSdk(getSdkRequester(apiContext, options, requestHandler));`);
        expect(generatedFile).toContain(`export type GqlAPI = ReturnType<typeof getClient>;\n`);

        expect(cliLogs).toMatchObject({
            stdout: `Schema generated from "${stabServer}" to "schema.gql".\n` +
                `Operations were generated and saved to "${gqlDirectory}/schema/autogenerated-operations".\n` +
                `Type Script types for Playwright auto generated type safe GQL client generated.\n` +
                `File "codegen.ts" generated.\n`,
        });

        const codegen = await loadCodegenConfig({ configFilePath: path.join(testDir, 'codegen.ts') });

        expect(codegen.config.generates).toMatchObject({
            [`${gqlDirectory}/${gqlFile}`]: {
                schema: 'schema.gql',
                documents: [`${gqlDirectory}/schema/autogenerated-operations/**/*.gql`],
                config: { rawRequest: false }
            },
        });
    });

    test('generate type safe client with custom codegen (--custom and --codegen)', async () => {
        const codegen = 'custom-codegen.ts';

        await execAsync(
            `node ${cliPath} --url ${stabServer} -d ${gqlDirectory} -f ${gqlFile} --saveCodegen -c ${codegen}`,
            { cwd: testDir }
        );

        const cliLogs = await execAsync(
            `node ${cliPath} --custom -c ${codegen}`,
            { cwd: testDir }
        );

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([ codegen, 'schema.gql', gqlDirectory ].sort());

        const generatedFile = await readFile(join(testDir, gqlDirectory, gqlFile), 'utf8');
        expect(generatedFile).toContain(`import { getSdkRequester } from 'playwright-graphql';`);
        expect(generatedFile).toContain(`export type APIRequestContext = Parameters<typeof getSdkRequester>[0];`);
        expect(generatedFile).toContain(`export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;`);
        expect(generatedFile).toContain(`export type RequestHandler = Parameters<typeof getSdkRequester>[2];`);
        expect(generatedFile).toContain(`export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => getSdk(getSdkRequester(apiContext, options, requestHandler));`);
        expect(generatedFile).toContain(`export type GqlAPI = ReturnType<typeof getClient>;\n`);

        expect(cliLogs).toMatchObject({
            stdout: `Type Script types for Playwright auto generated type safe GQL client generated.\n`
        });
    });
});
