#!/usr/bin/env node

import { runCommand } from './run-command';
import * as fs from 'fs';
import { writeFile, readFile } from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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

    if (argv.url) {
        await runCommand(
            argv.header ?
                `get-graphql-schema ${argv.url} > ${argv.schema} ${argv.header.map(h => `-h "${h}"`).join(' ')}` :
                `get-graphql-schema ${argv.url} > ${argv.schema}`
        );
        console.log(`Schema generated from "${argv.url}" to "${argv.schema}".`);
    }

    if (!fs.existsSync(argv.schema)) {
        console.log(`Schema file: "${argv.schema}" was not found.`);
        console.log('Exit with no generated output.');
        return;
    }

    const autoGeneratedOperations = `${argv.gqlDir}/autogenerated-operations`;
    await runCommand(`gqlg --schemaFilePath ${argv.schema} --destDirPath ${autoGeneratedOperations} --depthLimit 8`);

    console.log(`Operations were generated and saved to "${autoGeneratedOperations}".`);

    const codegenDefaultDocument = `${autoGeneratedOperations}/**/*.gql`;
    const codegenGqlFile = `${argv.gqlDir}/${argv.gqlFile}`;

    if (fs.existsSync(argv.codegen)) {
        const mismatchLogs: string[] = [];
        const existingContent = await readFile(argv.codegen, 'utf8');

        const schemaRegex = /\sschema:\s*(['"`])(.+?)\1,/;
        const schemaMatch = existingContent.match(schemaRegex);

        if (schemaMatch) {
            if (schemaMatch[2] !== argv.schema) {
                const updatedContent = existingContent.replace(
                    schemaRegex,
                    ` schema: '${argv.schema}',`
                );
                await writeFile(argv.codegen, updatedContent, 'utf8');
                console.log(`Updated schema path in "${argv.codegen}".`);
            }
        } else {
            mismatchLogs.push(`Could not locate the schema property in "${argv.codegen}".`);
        }

        if (!existingContent.includes(codegenDefaultDocument)) {
            mismatchLogs.push(`Could not path "${autoGeneratedOperations}" to autogenerated operations in "${argv.codegen}".`);
        }

        if (!existingContent.includes(codegenGqlFile)) {
            mismatchLogs.push(`Could not locate path to autogenerated graphql types file "${codegenGqlFile}" in "${argv.codegen}".`);
        }

        if (mismatchLogs.length) {
            for (const log of mismatchLogs) {
                console.log(log);
            }
            console.log(`Remove file "${argv.codegen}" to generate new one or fix existing file manually.`);
            return;
        }
    } else {
        const codegenContent = `
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: '${argv.schema}',
  documents: [
    '${codegenDefaultDocument}',
  ],
  generates: {
    '${codegenGqlFile}': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: {
      rawRequest: ${argv.raw},
        scalars: {
          BigInt: 'bigint|number',
          Date: 'string',
        },
      },
    },
  },
};
        
export default config;
`;

        await writeFile(argv.codegen, codegenContent, 'utf8');

        console.log(`File "${argv.codegen}" generated.`);
    }

    await runCommand(`graphql-codegen --config ${argv.codegen}`);

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

`;

    await writeFile(codegenGqlFile, graphqlAutogeneratedFileModification, { flag: 'a' });

    console.log('Type Script types for Playwright auto generated type safe GQL client generated.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
