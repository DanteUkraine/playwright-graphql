#!/usr/bin/env node

import { runCommand } from './run-command';
import * as fs from 'fs';
import { dirname, resolve } from 'path';
import { writeFile, mkdir, readdir } from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generate, loadCodegenConfig, CodegenConfig } from '@graphql-codegen/cli';
import prettier from 'prettier';

/**
 * Converts a GraphQL CodeGen configuration object to a codegen.ts file
 *
 * @param config The CodegenConfig object to convert
 * @param outputPath Path to write the config file (default: './codegen.ts')
 * @returns Promise resolving to the file content
 */
export async function configToFile(
    config: CodegenConfig,
    outputPath = './codegen.ts'
): Promise<void> {
    const configObjectString = inspectConfig(config);

    const fileContent = `/**
 * GraphQL Code Generator Configuration
 * @see https://the-guild.dev/graphql/codegen/docs/config-reference/codegen-config
 */
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = ${configObjectString};

export default config;
`;

    const prettierOptions = await prettier.resolveConfig(process.cwd()) || {};
    const formattedContent = await prettier.format(fileContent, {
        ...prettierOptions,
        parser: 'typescript',
    });

    const resolvedPath = resolve(outputPath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, formattedContent, 'utf8');
}

/**
 * Recursively converts a configuration object to a TypeScript-friendly string
 * representation, preserving functions and formatting.
 */
function inspectConfig(obj: any, depth = 0): string {
    if (depth > 20) return '{/* Depth limit exceeded */}';

    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';

    // Handle functions (hooks, custom scalars, etc.)
    if (typeof obj === 'function') {
        return obj.toString();
    }

    if (typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map(item => inspectConfig(item, depth + 1));
        return `[${items.join(', ')}]`;
    }

    if (Object.keys(obj).length === 0) return '{}';

    const entries = Object.entries(obj).map(([key, value]) => {
        const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
            ? key
            : JSON.stringify(key);
        return `${formattedKey}: ${inspectConfig(value, depth + 1)}`;
    });

    return `{
  ${entries.join(',\n  ')}
}`;
}

function buildCodegenConfig(
    schema: string | string[],
    documents: string[],
    gqlClients: string[],
    rawRequest: boolean,
): CodegenConfig {
    const config = {
        schema,
        documents,
        generates: gqlClients.reduce((acc: any, clientPath: string) => {
            acc[clientPath] = {
                plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
                config: {
                    rawRequest,
                    scalars: {
                        BigInt: 'bigint|number',
                        Date: 'string',
                    },
                },
            };
            return acc;
        }, {}),
    };

    return config;
}

async function getSchemasFromUrls(url: string | string[] | undefined, schema: string | string[], header: unknown[] | undefined): Promise<void> {

    if (!url) return;

    if (typeof url === 'string' && typeof schema === 'string') {
        await runCommand(
            header ?
                `get-graphql-schema ${url} > ${schema} ${header.map(h => `-h "${h}"`).join(' ')}` :
                `get-graphql-schema ${url} > ${schema}`
        );
        console.log(`Schema generated from "${url}" to "${schema}".`);
    }
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('url', {
            alias: 'u',
            describe: 'Full GraphQL endpoint URL',
            type: 'string',
        })
        .option('header', {
            alias: 'h',
            describe: 'Optional authentication header for the get-graphql-schema command.',
            type: 'array',
        })
        .option('schema', {
            alias: 's',
            describe: 'Path to save the generated GraphQL schema file.',
            type: 'string',
            default: 'schema.gql',
        })
        .option('gqlDir', {
            alias: 'd',
            describe: 'Path to save the auto generated GraphQL files.',
            type: 'string',
            default: 'gql',
        })
        .option('gqlFile', {
            alias: 'f',
            describe: 'Path to save the auto generated GraphQL queries and mutations and type script types.',
            type: 'string',
            default: 'graphql.ts',
        })
        .option('codegen', {
            alias: 'c',
            describe: 'Path to save the codegen config to for type script types.',
            type: 'string',
            default: 'codegen.ts',
        })
        .option('introspect', {
            alias: 'i',
            describe: 'Turns off auto generation of queries and mutations, for custom queries only.',
            type: 'boolean',
            default: true
        })
        .option('raw', {
            describe: 'Path to save the auto generated GraphQL queries and mutations and type script types.',
            type: 'boolean',
            default: false
        })
        .option('coverage', {
            describe: 'Will add coverage logger to auto-generated client.',
            type: 'boolean',
            default: false
        })
        .version()
        .help()
        .argv;

    // Pre-processing start
    if (argv.url) {
        await getSchemasFromUrls(argv.url, argv.schema, argv.header);
    }

    if (!fs.existsSync(argv.schema)) {
        console.log(`Schema file: "${argv.schema}" was not found.`);
        console.log('Exit with no generated output.');
        return;
    }

    const operationsPath = `${argv.gqlDir}/${argv.introspect ? 'autogenerated-operations' : 'custom-operations' }`;

    if (argv.introspect) {
        await runCommand(`gqlg --schemaFilePath ${argv.schema} --destDirPath ${operationsPath} --depthLimit 8`);

        console.log(`Operations were generated and saved to "${operationsPath}".`);
    } else {
        await mkdir(operationsPath, { recursive: true });
    }

    const codegenDefaultDocument = `${operationsPath}/**/*.gql`;
    const gqlClientFilePath = `${argv.gqlDir}/${argv.gqlFile}`;
    // Pre-processing finish
    // Codegen flow start
    if (fs.existsSync(argv.codegen)) {
        const existingCodegenConfig = (await loadCodegenConfig({
            configFilePath: argv.codegen
        })).config;

        const mismatchLogs: string[] = [];

        if (existingCodegenConfig.schema) {
            if (existingCodegenConfig.schema !== argv.schema) {
                existingCodegenConfig.schema = argv.schema;
                await configToFile(existingCodegenConfig, argv.codegen);
                console.log(`Updated schema path in "${argv.codegen}".`);
            }
        } else { // rethink this case
            mismatchLogs.push(`Could not locate the schema property in "${argv.codegen}".`);
        }

        if (argv.introspect && Array.isArray(existingCodegenConfig.documents) && !existingCodegenConfig.documents.includes(codegenDefaultDocument)) {
            mismatchLogs.push(`Could not find path "${operationsPath}" to autogenerated operations in "${argv.codegen}".`);
        }

        if (!Object.keys(existingCodegenConfig.generates).includes(gqlClientFilePath)) {
            mismatchLogs.push(`Could not find path to autogenerated graphql client file "${gqlClientFilePath}" in "${argv.codegen}".`);
        }

        if (mismatchLogs.length) {
            for (const log of mismatchLogs) {
                console.log(log);
            }
            console.log(`Remove file "${argv.codegen}" to generate new one or fix existing file manually.`);

            return;
        }
    } else {
        await configToFile(buildCodegenConfig(argv.schema, [codegenDefaultDocument], [gqlClientFilePath], argv.raw), argv.codegen);
        console.log(`File "${argv.codegen}" generated.`);
    }

    if (!argv.introspect) {
        const dir = await readdir(operationsPath, { withFileTypes: true });
        const operations = dir.map(i => i.isFile());

        if (!operations.includes(true)) {
            console.log(`No operations found, API client "${gqlClientFilePath}" was not generated, add operations and generate again.`);

            return;
        }
    }

 //   await runCommand(`graphql-codegen --config ${argv.codegen}`);
    await generate(buildCodegenConfig(argv.schema, [codegenDefaultDocument], [gqlClientFilePath], argv.raw), true)

    const [importFragment, getSdkFragment] = argv.coverage ?
        ['getSdkRequester, coverageLogger', 'coverageLogger(getSdk(getSdkRequester(apiContext, options, requestHandler)))'] :
        ['getSdkRequester', 'getSdk(getSdkRequester(apiContext, options, requestHandler))'];

    const graphqlAutogeneratedFileModification = `

// This additional logic appended by playwright-graphql cli to ensure seamless integration
import { ${importFragment} } from 'playwright-graphql';

export type APIRequestContext = Parameters<typeof getSdkRequester>[0];
export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;
export type RequestHandler = Parameters<typeof getSdkRequester>[2];

export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => ${getSdkFragment};

export type GqlAPI = ReturnType<typeof getClient>;

`;

    await writeFile(gqlClientFilePath, graphqlAutogeneratedFileModification, { flag: 'a' });

    console.log('Type Script types for Playwright auto generated type safe GQL client generated.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
