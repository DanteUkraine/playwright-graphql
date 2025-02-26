import { promisify } from 'node:util';
import { exec } from 'child_process';
import { readdir, mkdir, rm } from 'fs/promises';
import { startFakeGraphQLServer, stopFakeGraphQLServer, lastRequestHeaders } from './resources/gql-fake-server';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Setup Codegen CLI', () => {
    const cliPath = path.resolve(__dirname, '../lib/codegen-cli/setup-codegen-cli.js');
    const stabServer = 'http://localhost:4000';
    const schemaFile = 'test-schema.gql';
    const testDir = path.join(__dirname, 'codegen-test');

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
        if (fs.existsSync(testDir)) {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test('generates schema and operations when no existing files', async () => {
        await execAsync(`node ${cliPath} --url ${stabServer} --schema ${schemaFile}`, {
            cwd: testDir,
        });

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([schemaFile, 'gql', 'codegen.ts' ].sort());
        expect(lastRequestHeaders).not.toHaveProperty('authorization');
    });

    test('generates schema and operations when no existing files and args passed with aliases', async () => {
        await execAsync(`node ${cliPath} -u ${stabServer} -s ${schemaFile} -h Authorization=blablaHash256`, {
            cwd: testDir,
        });

        const dir = await readdir(testDir, { withFileTypes: true });
        expect(dir.map(i => i.name ).sort()).toEqual([schemaFile, 'gql', 'codegen.ts' ].sort());
        expect(lastRequestHeaders).toHaveProperty('authorization', 'blablaHash256');
    });

    // test('generates types from existing schema', async () => {
    //     // Create test schema
    //     const schemaContent = `
    //         type Query {
    //             hello: String
    //         }
    //     `;
    //     fs.writeFileSync(path.join(tmpDir, 'schema.graphql'), schemaContent);
    //
    //     const cliPath = path.resolve(__dirname, '../src/codegen-cli.ts');
    //     execSync(`node -r ts-node/register ${cliPath} generate`, {
    //         encoding: 'utf8',
    //         stdio: 'inherit'
    //     });
    //
    //     const generatedTypes = fs.readFileSync(path.join(tmpDir, 'generated/graphql.ts'), 'utf8');
    //     expect(generatedTypes).toContain('export type Query');
    // });

    // test('updates existing codegen config', async () => {
    //     // Create initial config
    //     const initialConfig = `
    //         import type { CodegenConfig } from '@graphql-codegen/cli';
    //
    //         const config: CodegenConfig = {
    //             schema: './old-schema.graphql',
    //             documents: ['./operations/**/*.graphql'],
    //             generates: {
    //                 './generated/graphql.ts': {
    //                     plugins: ['typescript']
    //                 }
    //             }
    //         };
    //
    //         export default config;
    //     `;
    //     fs.writeFileSync(path.join(tmpDir, 'codegen.ts'), initialConfig);
    //
    //     const cliPath = path.resolve(__dirname, '../src/codegen-cli.ts');
    //     execSync(`node -r ts-node/register ${cliPath} init --endpoint "${stabServer}"`, {
    //         encoding: 'utf8',
    //         stdio: 'inherit'
    //     });
    //
    //     const updatedConfig = fs.readFileSync(path.join(tmpDir, 'codegen.ts'), 'utf8');
    //     expect(updatedConfig).toContain('schema: "./schema.graphql"');
    // });
});
