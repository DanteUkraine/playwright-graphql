import {
    APIRequestContext,
} from 'playwright-core';
import { print, DocumentNode } from 'graphql';
import 'json-bigint-patch';

type PostOptionsType = NonNullable<Parameters<APIRequestContext['post']>[1]>;

type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
    headers?: PostOptionsType['headers'];
} & Omit<PostOptionsType, 'data' | 'headers'>;

type Requester<C = {}> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;

export function getSdkRequester(client: APIRequestContext, gqlUrl: string = '/api/graphql'): Requester<PlaywrightRequesterOptions> {
    const validDocDefOps = ['mutation', 'query', 'subscription'];

    return async <R, V>(
        doc: DocumentNode,
        variables: V,
        options?: PlaywrightRequesterOptions,
    ): Promise<R> => {
        // Valid document should contain *single* query or mutation unless it's has a fragment
        if (
            doc.definitions.filter(
                (d) => d.kind === 'OperationDefinition' && validDocDefOps.includes(d.operation),
            ).length !== 1
        ) {
            throw new Error(
                'DocumentNode passed to Playwright Client must contain single query or mutation',
            );
        }

        const definition = doc.definitions[0];

        // Valid document should contain *OperationDefinition*
        if (definition.kind !== 'OperationDefinition') {
            throw new Error('DocumentNode passed to Playwright must contain single query or mutation');
        }

        if (definition.operation === 'subscription') {
            throw new Error('Subscription requests through SDK interface are not supported');
        }

        const response = await client.post(gqlUrl, {
            ...options,
            data: { variables, query: print(doc) },
        });

        let json;
        try {
            json = await response.json();
        } catch (e) {
            throw new Error(
                `${(e as Error).message}
        \nResponse body is not a json but: ${await response.text()}
        \nHeaders: ${JSON.stringify(response.headers())}`,
            );
        }

        if (options?.returnRawJson) {
            return json;
        }

        if (json.data === undefined || json.data === null) {
            const failOnEmptyData: boolean = options?.failOnEmptyData ?? true;

            if (!failOnEmptyData) {
                return json;
            }

            const formattedJsonString = JSON.stringify(JSON.parse(await response.text()), null, '  ');

            throw new Error(`No data presented in the GraphQL response: ${formattedJsonString}`);
        }

        return json.data;
    };
}