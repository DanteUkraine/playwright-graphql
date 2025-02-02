import {
    APIRequestContext,
    APIResponse
} from '@playwright/test';
import { print, DocumentNode } from 'graphql';
import 'json-bigint-patch';

type PostOptionsType = NonNullable<Parameters<APIRequestContext['post']>[1]>;

type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
} & Omit<PostOptionsType, 'data'>;

type Requester<C = {}> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;

type RequesterOptions = { gqlEndpoint?: string, rawResponse?: boolean };

type GqlEndpoint = string;

type RequestOptions = {
    client: APIRequestContext,
    gqlEndpoint: string,
    variables: any,
    doc: DocumentNode,
    options?: Omit<PostOptionsType, 'data'>
};

const defaultOptions: Required<RequesterOptions> = { gqlEndpoint: '/api/graphql', rawResponse: false };

const operationDefinition = 'OperationDefinition';
const subscription = 'subscription';
const validDocDefOps = ['mutation', 'query', subscription];

const returnRawResponseStrategy = async <R>(
    response: APIResponse,
): Promise<R> => {
    try {
        return (await response.json());
    } catch (e) {
        throw new Error(await buildMessage(e, response));
    }
}

const returnDataResponseStrategy = async <R>(
    response: APIResponse,
    options?: PlaywrightRequesterOptions,
): Promise<R> => {
    let json;
    try {
        json = await response.json();
    } catch (e) {
        throw new Error(await buildMessage(e, response));
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



function doPostRequest(requestParams: RequestOptions): Promise<APIResponse> {
    return requestParams.client.post(requestParams.gqlEndpoint, {
        ...requestParams.options,
        data: { variables: requestParams.variables, query: print(requestParams.doc) },
    });
}

function initRequest(requestHandler?: (request: () => Promise<APIResponse>) => Promise<APIResponse>): (requestParams: RequestOptions) => Promise<APIResponse> {
    return requestHandler ?
        (requestParams: RequestOptions) => requestHandler(() => doPostRequest(requestParams)) :
        (requestParams: RequestOptions) => doPostRequest(requestParams);
}

export function getSdkRequester(
    client: APIRequestContext,
    options: RequesterOptions | GqlEndpoint = defaultOptions,
    requestHandler?: (request: () => Promise<APIResponse>) => Promise<APIResponse>
): Requester<PlaywrightRequesterOptions> {

    const requesterOptions = {
        ...defaultOptions,
        ...(typeof options === 'string' ? { gqlEndpoint: options } : options)
    };

    const doRequest = initRequest(requestHandler);

    return requesterOptions.rawResponse ?
        async <R, V>(
            doc: DocumentNode,
            variables: V,
            options?: Omit<PostOptionsType, 'data'>,
        ): Promise<R> => {
            validateDocument(doc);

            const request = doRequest({ client, gqlEndpoint: requesterOptions.gqlEndpoint, variables, doc, options });

            const response = await request;

            return returnRawResponseStrategy<R>(response);
        }
    :
        async <R, V>(
            doc: DocumentNode,
            variables: V,
            options?: PlaywrightRequesterOptions,
        ): Promise<R> => {
            validateDocument(doc);

            const request = doRequest({ client, gqlEndpoint: requesterOptions.gqlEndpoint, variables, doc, options });

            const response = await request;

            return returnDataResponseStrategy<R>(response, options);
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

async function buildMessage(e: any, response: APIResponse): Promise<string> {
    return `${(e as Error).message}
                \nStatus code: ${response.status()}
                \nHeaders: ${JSON.stringify(response.headers())}
                \nResponse body is not a json but: ${await response.text()}`
}
