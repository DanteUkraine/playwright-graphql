#!/usr/bin/env node

import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve, parse, posix, join } from 'path';

import { generate, loadCodegenConfig, type CodegenConfig } from '@graphql-codegen/cli';
import gqlg from 'gql-generator';
import prettier from 'prettier';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getPathToTmpCoverageStash } from '../coverage-reporter/coverageStashPath';

import { runCommand } from './run-command';



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

    const prettierOptions = await prettier.resolveConfig(process.cwd()) ?? {};
    const formattedContent = await prettier.format(fileContent, {
        ...prettierOptions,
        parser: 'typescript',
    });

    const resolvedPath = resolve(outputPath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, formattedContent, 'utf8');
}

function isValidIdentifier(key: string): boolean {
    // Check if a string is a valid JavaScript identifier
    if (key.length === 0) return false;
    
    const firstChar = key[0];
    if (!(firstChar >= 'a' && firstChar <= 'z' || 
          firstChar >= 'A' && firstChar <= 'Z' || 
          firstChar === '_' || firstChar === '$')) {
        return false;
    }
    
    for (let i = 1; i < key.length; i++) {
        const char = key[i];
        if (!(char >= 'a' && char <= 'z' || 
              char >= 'A' && char <= 'Z' || 
              char >= '0' && char <= '9' || 
              char === '_' || char === '$')) {
            return false;
        }
    }
    
    return true;
}

function inspectConfig(obj: unknown, depth = 0): string {
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
        const formattedKey = isValidIdentifier(key) ? key : JSON.stringify(key);

        return `${formattedKey}: ${inspectConfig(value, depth + 1)}`;
    });

    return `{
  ${entries.join(',\n  ')}
}`;
}

function buildCodegenConfig(
    schemas: string[],
    documents: string[][],
    gqlClients: string[],
    rawRequest: boolean,
    enumsAsConst: boolean,
    silent: boolean,
): CodegenConfig {
    return {
        generates: gqlClients.reduce((acc: Record<string, { schema: string; documents: string[]; plugins: string[]; config: Record<string, unknown> }>, clientPath: string, currentIndex: number) => {
            acc[clientPath] = {
                schema: schemas[currentIndex],
                documents: documents[currentIndex],
                plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
                config: {
                    rawRequest,
                    enumsAsConst,
                    scalars: {
                        BigInt: 'bigint|number',
                        Date: 'string',
                    },
                },
            };

            return acc;
        }, {}),
        silent
    };
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
    const directory = parse(filePath).dir;
    if (directory.length && !existsSync(directory)) {
        await mkdir(directory, { recursive: true });
    }
}

function getGetGraphqlSchemaPath(): string {
    return join(__dirname, '../../node_modules/.bin/get-graphql-schema');
}

function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

async function getSchemasFromUrls(url: string[], schema: string[], header: string[] | undefined): Promise<boolean> {
    if (url.length === schema.length) {
        const apiCalls = url.map((url, index) => ({
            url,
            schema: schema[index]
        }));

        for (const i of apiCalls) {
            await ensureDirectoryExists(i.schema);

            const getGraphqlSchemaPath = getGetGraphqlSchemaPath();
            const headerArgs = header ? header.map(h => `-h "${h}"`).join(' ') : '';
            
            await runCommand(
                `${getGraphqlSchemaPath} ${headerArgs ? headerArgs + ' ' : ''}${i.url} > ${i.schema}`
            );
            
            // Validate that schema file was created and is not empty
            if (!existsSync(i.schema)) {
                log(`Error: Schema file "${i.schema}" was not created. Check if the GraphQL endpoint "${i.url}" is accessible.`);
                return false;
            }
            
            const { stat: statFn } = await import('fs/promises');
            const fileStats = await statFn(i.schema);
            if (fileStats.size === 0) {
                log(`Error: Schema file "${i.schema}" is empty. Check if the GraphQL endpoint "${i.url}" is accessible and returns a valid schema.`);
                return false;
            }
            
            log(`Schema generated from "${i.url}" to "${i.schema}".`);
        }

        return true;
    } else {
        log('Please provide equal count of url and schema parameters.');

        return false;
    }
}

async function appendCode(gqlFiles: string[], coverage: boolean): Promise<void> {

    const importFragment =  coverage ? 'getSdkRequester, coverageLogger' : 'getSdkRequester';

    const getSdkCoverageFragment = (loggerStash: string): string => `coverageLogger(getSdk(getSdkRequester(apiContext, options, requestHandler)), '${loggerStash}')`;
    const getSdkFragment = (): string => 'getSdk(getSdkRequester(apiContext, options, requestHandler))';

    const graphqlAutogeneratedFileModification = (loggerStash?: string): string => `

// This additional logic appended by playwright-graphql cli to ensure seamless integration
import { ${importFragment} } from 'playwright-graphql';

export type APIRequestContext = Parameters<typeof getSdkRequester>[0];
export type RequesterOptions = Parameters<typeof getSdkRequester>[1] | string;
export type RequestHandler = Parameters<typeof getSdkRequester>[2];

export const getClient = (apiContext: APIRequestContext, options?: RequesterOptions, requestHandler?: RequestHandler) => ${loggerStash ? getSdkCoverageFragment(loggerStash) : getSdkFragment()};

export type GqlAPI = ReturnType<typeof getClient>;

`;

    await Promise.all(
        gqlFiles.map(gqlClientFilePath => writeFile(
                gqlClientFilePath,
                graphqlAutogeneratedFileModification(coverage ? getPathToTmpCoverageStash(gqlClientFilePath) : undefined),
                { flag: 'a' }
            )
        )
    );

    log('Type Script types for Playwright auto generated type safe GQL client generated.');
}

const convertToGlob = (path: string): string => `${path}/**/*.{gql,graphql}`;

let isSilent: boolean = false;
// eslint-disable-next-line no-console
const originalLog = console.log;
// mute default gqlg logs, they are not informative
// eslint-disable-next-line no-console
console.log = (): void => {};
function log(...args: unknown[]): void {
    if (isSilent) return;
    originalLog(...args);
}

async function main(): Promise<void> {
    const argv = await yargs([...hideBin(process.argv)])
        .option('url', {
            alias: 'u',
            describe: 'Full GraphQL endpoint URL',
            type: 'array'
        })
        .option('header', {
            alias: 'h',
            describe: 'Optional authentication header for the get-graphql-schema command.',
            type: 'array'
        })
        .option('schema', {
            alias: 's',
            describe: 'Path to save the generated GraphQL schema file.',
            type: 'array',
            default: ['schema.gql']
        })
        .option('gqlDir', {
            alias: 'd',
            describe: 'Path to save the auto generated GraphQL files.',
            type: 'string',
            default: 'gql'
        })
        .option('gqlFile', {
            alias: 'f',
            describe: 'Path to save the auto generated GraphQL queries and mutations and type script types.',
            type: 'array',
            default: ['graphql.ts']
        })
        .option('document', {
            alias: 'o',
            describe: 'Glob pattern that will be added to documents.',
            type: 'array'
        })
        .option('depthLimit', {
            describe: 'Defines the maximum depth of nested fields to include in the generated GraphQL queries.',
            type: 'number',
            default: 20
        })
        .option('includeCrossReferences', {
            describe: 'There might be recursive fields in the query, so gql-generator ignores the types which have been added in the parent queries already by default. This can be disabled using the --includeCrossReferences false.',
            type: 'boolean',
            default: false
        })
        .option('introspect', {
            alias: 'i',
            describe: 'Introspect autogenerate operations, set false to turn off.',
            type: 'boolean',
            default: true
        })
        .option('codegen', {
            alias: 'c',
            describe: 'Path to save the codegen config to for type script types.',
            type: 'string',
            default: 'codegen.ts',
        })
        .option('saveCodegen', {
            describe: 'Pass to save codegen file.',
            type: 'boolean',
            default: false
        })
        .option('custom', {
            describe: 'Pass to generate client from custom codegen.ts file.',
            type: 'boolean',
            default: false
        })
        .option('raw', {
            describe: 'Pass to generate client with not type safe response.',
            type: 'boolean',
            default: false
        })
        .option('enumsAsConst', {
            describe: 'Type safe client will be build with "as const" instead of enum.',
            type: 'boolean',
            default: false
        })
        .option('coverage', {
            describe: 'Will add coverage logger to auto-generated client.',
            type: 'boolean',
            default: false
        })
        .option('silent', {
            type: 'boolean',
            description: 'Suppress all logs.',
            default: false
        })
        .version()
        .help()
        .argv;

    isSilent = argv.silent;

    if (argv.custom) {
        const codegen = await loadCodegenConfig({ configFilePath: argv.codegen });

        await generate(codegen.config, true);

        const gqlFiles = Object.keys(codegen.config.generates);

        await appendCode(gqlFiles, argv.coverage);
    } else {

        const schemas = (argv.schema as string[]).map(schema => (schema.endsWith('.gql') || schema.endsWith('.graphql')) ? schema : `${schema}.gql`);

        // Validate depthLimit early if introspect is enabled
        if (argv.introspect && isNaN(argv.depthLimit)) {
            console.error('--depthLimit NaN but should be number');
            return;
        }

        // Validate URLs if provided
        if (argv.url) {
            const urls = argv.url as string[];
            for (const url of urls) {
                if (!isValidUrl(url)) {
                    console.error(`Invalid URL: "${url}". Must be a valid HTTP/HTTPS URL.`);
                    return;
                }
            }
        }

        // Validate gqlDir is not empty
        if (!argv.gqlDir || typeof argv.gqlDir !== 'string' || argv.gqlDir.trim() === '') {
            console.error('--gqlDir must be a non-empty string');
            return;
        }

        // Validate gqlFile entries are not empty
        if (argv.gqlFile) {
            const gqlFiles = argv.gqlFile as string[];
            for (const file of gqlFiles) {
                if (typeof file !== 'string' || file.trim() === '') {
                    console.error('--gqlFile entries must be non-empty strings');
                    return;
                }
            }
        }

        if (argv.url) {
            const result = await getSchemasFromUrls(argv.url as string[], argv.schema as string[], argv.header as string[]);

            if (!result) return;
        }

        for (const schema of schemas) {
            if (!existsSync(schema)) {
                log(`Schema file: "${schema}" was not found.`);
                log('Exit with no generated output.');

                return;
            }
        }

        if (!argv.introspect && !argv.document) {
            log('Client can not be build without any operations, in case of introspect false set path to custom operations: "-o path/to/folder-with-operations"');
            return;
        }

        const operationsPaths: string[][] = [];

        if (argv.document) {
            const documents = argv.document as string[];
            documents.forEach((doc, index) => {
                if (operationsPaths[index]) {
                    operationsPaths[index].push(convertToGlob(doc));
                } else {
                    operationsPaths.push([convertToGlob(doc)]);
                }
            });
        }

        const buildOperationsPath = (schema: string): string => posix.join(argv.gqlDir, parse(schema).name, 'autogenerated-operations');

        if (argv.introspect) {

            for (let i = 0; i < schemas.length; i++) {
                const operationsPath = buildOperationsPath(schemas[i]);

                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    gqlg({
                        schemaFilePath: schemas[i],
                        destDirPath: operationsPath,
                        depthLimit: argv.depthLimit,
                        fileExtension: 'gql',
                        includeCrossReferences: argv.includeCrossReferences,
                    });
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log(`Error generating operations from schema "${schemas[i]}": ${errorMessage}`);
                    return;
                }

                if (operationsPaths[i]) {
                    operationsPaths[i].push(convertToGlob(operationsPath));
                } else {
                    operationsPaths.push([convertToGlob(operationsPath)]);
                }

                log(`Operations were generated and saved to "${operationsPath}".`);
            }
        }

        const gqlFiles: string[] = (schemas.length === operationsPaths.length && operationsPaths.length === (argv.gqlFile as string[]).length) ?
            (argv.gqlFile as string[]).map(file => `${argv.gqlDir}/${file.endsWith('.ts') ? file : `${file}.ts`}`) :
            schemas.map(schema => posix.join(argv.gqlDir, `${parse(schema).name}.ts`));

        await generate(buildCodegenConfig(schemas, operationsPaths, gqlFiles, argv.raw, argv.enumsAsConst, argv.silent), true);

        await appendCode(gqlFiles, argv.coverage);

        if (argv.saveCodegen) {
            await configToFile(buildCodegenConfig(schemas, operationsPaths, gqlFiles, argv.raw, argv.enumsAsConst, argv.silent), argv.codegen);
            log(`File "${argv.codegen}" generated.`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
