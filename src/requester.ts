import {
    APIRequestContext
} from 'playwright-core';
import { print, DocumentNode } from 'graphql';
import 'json-bigint-patch';

type PostOptionsType = NonNullable<Parameters<APIRequestContext['post']>[1]>;

type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
} & Omit<PostOptionsType, 'data'>;

type Requester<C = {}> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;

type RequesterOptions = { gqlEndpoint?: string, rawResponse?: boolean };

const defaultOptions: Required<RequesterOptions> = { gqlEndpoint: '/api/graphql', rawResponse: false };

const operationDefinition = 'OperationDefinition';
const subscription = 'subscription';
const validDocDefOps = ['mutation', 'query', subscription];

export function getSdkRequester(client: APIRequestContext, options: RequesterOptions = defaultOptions): Requester<PlaywrightRequesterOptions> {

    const requesterOptions = {
        ...defaultOptions,
        ...options,
    };

    return requesterOptions.rawResponse ?
        async <R, V>(
            doc: DocumentNode,
            variables: V,
            options?: PlaywrightRequesterOptions,
        ): Promise<R> => {
            validateDocument(doc);

            const response = await client.post(requesterOptions.gqlEndpoint, {
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
        }
    :
        async <R, V>(
            doc: DocumentNode,
            variables: V,
            options?: Omit<PostOptionsType, 'data'>,
        ): Promise<R> => {
            validateDocument(doc);

            const response = await client.post(requesterOptions.gqlEndpoint, {
                ...options,
                data: { variables, query: print(doc) },
            });

            try {
                return (await response.json());
            } catch (e) {
                throw new Error(
                    `${(e as Error).message}
                \nStatus code: ${response.status()}
                \nHeaders: ${JSON.stringify(response.headers())}
                \nResponse body is not a json but: ${await response.text()}`,
                );
            }
        };
}

function validateDocument(doc: DocumentNode): void {
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
}