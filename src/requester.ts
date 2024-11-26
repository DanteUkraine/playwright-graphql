import {
    APIRequestContext,
} from 'playwright-core';
import { print, DocumentNode } from 'graphql';
import 'json-bigint-patch';

type PostOptionsType = NonNullable<Parameters<APIRequestContext['post']>[1]>;

type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
} & Omit<PostOptionsType, 'data'>;

type Requester<C = {}> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;

const operationDefinition = 'OperationDefinition';
const subscription = 'subscription';

export function getSdkRequester(client: APIRequestContext, gqlEndpoint: string = '/api/graphql'): Requester<PlaywrightRequesterOptions> {
    const validDocDefOps = ['mutation', 'query', subscription];

    return async <R, V>(
        doc: DocumentNode,
        variables: V,
        options?: PlaywrightRequesterOptions,
    ): Promise<R> => {
        // Valid document should contain *single* query or mutation unless it's has a fragment
        if (
            doc.definitions.filter(
                (d) => d.kind === operationDefinition && validDocDefOps.includes(d.operation),
            ).length !== 1
        ) {
            throw new Error(
                'DocumentNode passed to Playwright Client must contain single query or mutation',
            );
        }

        const definition = doc.definitions[0];

        // Valid document should contain *OperationDefinition*
        if (definition.kind !== operationDefinition) {
            throw new Error('DocumentNode passed to Playwright must contain single query or mutation');
        }

        if (definition.operation === subscription) {
            throw new Error('Subscription requests through SDK interface are not supported');
        }

        const response = await client.post(gqlEndpoint, {
            ...options,
            data: { variables, query: print(doc) },
        });

        let json;
        try {
            json = await response.json();
        } catch (e) {
            throw new Error(
                `${(e as Error).message}
                \nStatus code: ${response.status()}
                \nHeaders: ${JSON.stringify(response.headers())}
                \nResponse body is not a json but: ${await response.text()}`,
            );
        }

        if (options?.returnRawJson) {
            return json;
        }

        if ([undefined, null].includes(json.data)) {
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