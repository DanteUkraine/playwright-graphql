# Playwright-graphql
This library provide playwright integration with graphql and typescript for efficient API tests.
It helps you to get autogenerated graphql api client with autocomplete feature.

![DEMO](docs/gql-autocomplete-demo.gif)
## 🌟 Features

- 🚀 Autogenerated GraphQL API client with TypeScript autocomplete
- 📊 Comprehensive schema and operation generation
- 🔍 Flexible request handling and response management
- 📈 Optional GraphQL coverage reporting

To build graphql client, this library includes several graphql generators like: 

- [get-graphql-schema](https://www.npmjs.com/package/get-graphql-schema) to generate schema.
- [gql-generator](https://www.npmjs.com/package/gql-generator) to generate operations (queries and mutations).
- [@graphql-codegen/cli and @graphql-codegen/typescript-generic-sdk](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-generic-sdk) 
takes as input codegen config, generates ts file with all types and operations (without api client).
---
- [Project Setup](#project-setup)
- [Installation](#installation)
- [Generate graphql schema](#generate-graphql-schema-from-server-under-test)
- [Generate operations from schema](#generate-operations-from-schema)
- [Create codegen.ts file](#create-codegen-file)
- [Type Generation](#generate-types)
- [Add path to your tsconfig](#add-path-to-your-tsconfig)
- [Create gql fixtures](#create-gql-fixture)
- [More Features](#advanced-features)
    - [Raw Response](#return-raw-response-body-instead-of-schema-defined-type)
    - [Request Handler Callback](#request-handler-callback)
    - [Custom operations](#more-about-configuration)
    - [Graphql explorer](#graphql-explorer)
    - [Code generation scripts](#code-generation-scripts)
    - [Operation options](#operation-options)
    - [Negative Testing](#negative-test-cases)
    - [GraphQL Coverage Reporting](#graphql-coverage-reporting)


## Project setup:

1. Installation.
2. Generate schema and operations.
3. Generate typescript types.
4. Add graphql client fixture.
5. Wright graphql tests with joy!

Template project: https://github.com/DanteUkraine/playwright-graphql-example

### 💾 Installation
- `npm install playwright-graphql`
or for dev dependency
- `npm install -D playwright-graphql`

#### Generate graphql schema from server under test
- `get-graphql-schema https://${baseUrl}/api/graphql > schema.gql`

Pay attention that url should have graphql endpoint, it may be custom for your project.
Now you should be able to find schema.gql file in your working directory.

#### Generate operations from schema
- `gqlg --schemaFilePath ./schema.gql --destDirPath ./gql/autogenerated-operations`

New directory with `.gql` files generated *gql/autogenerated-operations/*.

#### Create codegen file
Create _codegen.ts_ file:
```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './schema.gql',
  documents: [
    'gql/autogenerated-operations/**/*.gql',
  ],
  generates: {
    'gql/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: {
        scalars: {
          BigInt: 'bigint|number',
          Date: 'string',
        },
      },
    },
  },
};

export default config;
```

#### Generate types

- `graphql-codegen --config codegen.ts` generates graphql.ts in gql directory. 

In case you need to customize output check [docs](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript).

#### Add path to your tsconfig

Add `"@gql": ["gql/graphql"]` for easy import.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": "./",
    "paths": {
      "@fixtures/*": ["fixtures/gql"],
      "@gql": ["gql/graphql"]
    }
  }
}
```

#### Create gql fixture

*fixtures/gql.ts*
```ts
import { test as baseTest, expect, request, APIRequestContext } from '@playwright/test';
import { getSdkRequester } from 'playwright-graphql';
import { getSdk } from '@gql';

export { expect };

const getClient = (apiContext: APIRequestContext) => getSdk(getSdkRequester(apiContext));

type WorkerFixtures = {
    gql: ReturnType<typeof getClient>;
};

export const test = baseTest.extend<{}, WorkerFixtures>({
    gql: [
        async ({}, use) => {
            const apiContext = await request.newContext({
                baseURL: 'http://localhost:4000'
            });
            await use(getClient(apiContext));
        }, { auto: false, scope: 'worker' }
    ]
});
```

#### Now you are ready jump into writing tests!

*tests/example.test*
```ts
import { test, expect } from '@fixtures/gql';

test('playwright-graphql test', async ({ gql }) => {
    const res = await gql.getCityByName({
        name: 'Lviv'
    });

    expect(res.getCityByName).not.toBeNull();
})
```
---
### More Features

#### Return raw response body instead of schema defined type.

1. Add `rawRequest: true` to codegen.ts file. When rawRequest set to true rawResponse has to be set to true as well:
`getSdkRequester(apiContext, { rawResponse: true })`.
 

codegen.ts file:
```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './schema.gql',
  documents: [
    'gql/autogenerated-operations/**/*.gql',
  ],
  generates: {
    'gql/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: {
          rawRequest: true,
          scalars: {
          BigInt: 'bigint|number',
          Date: 'string',
        },
      },
    },
  },
};

export default config;
```

2. Add options `{ rawResponse: true }` to getSdrRequester: 

*fixtures/gql.ts*
```ts
const getClient = (apiContext: APIRequestContext) => getSdk(getSdkRequester(apiContext, { rawResponse: true }));
```

3. Now you can use raw response in your tests:

*tests/example.test*
```ts
import { test, expect } from '@fixtures/gql';

test('playwright-graphql test', async ({ gql }) => {
    const res = await gql.getCityByName({
        name: 'Lviv'
    });
    
    expect(res).toHaveProperty('data');
    expect(res).toHaveProperty('errors');
    res.data; // will have type raw schema.
})
```
---
### Request Handler Callback

Inject custom logic before and after GraphQL API calls:

```typescript
const customRequestHandler = async (requester: () => Promise<APIResponse>) => {
  // Custom pre-call logic
  const res = await requester();
  // Custom post-call logic
  return res;
};

const getClient = (apiContext: APIRequestContext) =>
  getSdk(
    getSdkRequester(apiContext, {
      gqlEndpoint: '/api/graphql',
      requestHandler: customRequestHandler
    })
  );
```

#### Get SDK Requester signature 

`getSdkRequester(
    apiContext: APIRequestContext, 
    options: { gqlEndpoint?: string, rawResponse?: boolean }, 
    requestHandler?: (request: () => Promise<APIResponse>) => Promise<APIResponse>
 );`

Default values for options: `{ gqlEndpoint: '/api/graphql', rawResponse: false }`

Set `gqlEndpoint` to customize graphql endpoint.

Set `rawResponse` to return { errors: any[], body: R } instead of R, R represents autogenerated return type from gql schema. 
This parameter can be used only when `rawRequest: true` is included in `codege.ts`.

---

#### More about configuration
In case you need to create custom operations for tests
add one more path to documents section in *codegen.ts* file
```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './schema.gql',
  documents: [
    'gql/autogenerated-operations/**/*.gql',
    'gql/custom-operations/**/*.gql',
  ],
  generates: {
    'gql/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: {
        scalars: {
          BigInt: 'bigint|number',
          Date: 'string',
        },
      },
    },
  },
};

export default config;
```

And it is recommended to put all dynamic generated files and directories into *.gitignore*.
```gitignore
gql/autogenerated-operations
gql/**/*.ts
gql/**/*.js
```

#### Graphql explorer
You can use [apollo explorer](https://studio.apollographql.com/sandbox/explorer) to create custom queries.

#### Code generation scripts
```json
  "scripts": {
    "generate:schema": "get-graphql-schema http://localhost:4000/api/graphql > schema.gql",
    "generate:operations": "gqlg --schemaFilePath ./schema.gql --destDirPath ./gql/autogenerated-operations --depthLimit 6",
    "generate:types": "graphql-codegen --config codegen.ts",
    "codegen": "npm run generate:schema && npm run generate:operations && npm run generate:types",
    "test": "npx playwright test"
  },
```

#### Operation options

Each generated operation accepts second optional parameter which represents options 
from [post method](https://playwright.dev/docs/api/class-apirequestcontext#api-request-context-post) 
in playwright except data and two extra options.

- `returnRawJson` to return full payload in JSON format.
- `failOnEmptyData` to not throw error in case of empty data. (Allows you to pars errors from payload)

That is how second parameter type is declared.
```ts
type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
} & Omit<PostOptionsType, 'data'>;
```

#### Negative test cases

By design graphql response has field *data*, and *data* is being converted to types.

In case of error graphql will not respond with 400x or 500x status codes but will add *errors* in to payload.
That is why we need to use option: `failOnEmptyData: false` to verify errors.

```ts
import { test, expect } from '@fixtures/gql';

test('playwright-graphql test negative', async ({ gql }) => {
    const res = await gql.getCityByName({
        name: 'Lviv'
    }, { failOnEmptyData: false });

    expect(res).toHaveProperty('errors[0].message');
})
```

---

### GraphQL Coverage Reporting

Track and visualize which GraphQL operations and arguments have been tested:

Playwright config file for the GraphQL coverage reporter:
1. **graphqlFilePath** (required): Path to the autogenerated GraphQL file with getSdk .
2. **coverageFilePath** (optional): Path for the coverage log file. Default: './gql-coverage.log'.
3. **htmlFilePath** (optional): Path for the HTML summary report. Default: './gql-coverage.html'.
4. **logUncoveredOperations** (optional): Whether to log uncovered operations. Default: false.
5. **minCoveragePerOperation** (optional): Minimum coverage percentage required per operation. Default: 100.
6. **saveGqlCoverageLog** (optional): Whether to save the detailed coverage log. Default: false.
7. **saveHtmlSummary** (optional): Whether to save the HTML summary report. Default: false.

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
    reporter: [
        ['list'],
        ['playwright-graphql/reporter', {
            graphqlFilePath: './gql/graphql.ts', 
            coverageFilePath: './coverage/gql-coverage.log',
            htmlFilePath: './coverage/gql-coverage.html',
            logUncoveredOperations: true,
            minCoveragePerOperation: 80,
            saveGqlCoverageLog: true,
            saveHtmlSummary: true
        }]
    ],
});

```

And add coverage logger to gql client:

*fixtures/gql.ts*
```ts
import { test as baseTest, expect, request, APIRequestContext } from '@playwright/test';
import { getSdkRequester, coverageLogger } from 'playwright-graphql';
import { getSdk } from '@gql';


const getClient = (apiContext: APIRequestContext) => coverageLogger(getSdk(getSdkRequester(apiContext)));
```

Template project: https://github.com/DanteUkraine/playwright-graphql-example