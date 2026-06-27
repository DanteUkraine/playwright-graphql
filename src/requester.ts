import { print, DocumentNode } from 'graphql';
import {
    APIRequestContext,
    APIResponse
} from 'playwright-core';
import 'json-bigint-patch';

type PostOptionsType = NonNullable<Parameters<APIRequestContext['post']>[1]>;

type PlaywrightRequesterOptions = {
    returnRawJson?: boolean;
    failOnEmptyData?: boolean;
} & Omit<PostOptionsType, 'data'>;

type Requester<C = Record<string, unknown>> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;

type RequesterOptions = { gqlEndpoint?: string, rawResponse?: boolean };

type GqlEndpoint = string;

type RequestOptions = {
    client: APIRequestContext,
    gqlEndpoint: string,
    variables: unknown,
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
        return (await response.json()) as R;
    } catch (e) {
        throw new Error(await buildMessage(e, response));
    }
}

const returnDataResponseStrategy = async <R>(
    response: APIResponse,
    options?: PlaywrightRequesterOptions,
): Promise<R> => {
    let json: unknown;
    try {
        json = await response.json();
    } catch (e) {
        throw new Error(await buildMessage(e, response));
    }

    const jsonObj = json as { data?: R | null | undefined; [key: string]: unknown };

    if (options?.returnRawJson) {
        return jsonObj as R;
    }

    if (jsonObj.data === undefined || jsonObj.data === null) {
        const failOnEmptyData: boolean = options?.failOnEmptyData ?? true;

        if (!failOnEmptyData) {
            return jsonObj as R;
        }

        const responseText = await response.text();
        const formattedJsonString = JSON.stringify(JSON.parse(responseText), null, '  ');

        throw new Error(`No data presented in the GraphQL response: ${formattedJsonString}`);
    }

    return jsonObj.data as R;
}



function doPostRequest(requestParams: RequestOptions): Promise<APIResponse> {
    return requestParams.client.post(requestParams.gqlEndpoint, {
        ...requestParams.options,
        data: { variables: requestParams.variables, query: print(requestParams.doc) },
    });
}

function initRequest(requestHandler?: (request: () => Promise<APIResponse>) => Promise<APIResponse>): (requestParams: RequestOptions) => Promise<APIResponse> {
    return requestHandler ?
        (requestParams: RequestOptions): Promise<APIResponse> => requestHandler(() => doPostRequest(requestParams)) :
        (requestParams: RequestOptions): Promise<APIResponse> => doPostRequest(requestParams);
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
    const operationDefinitions = doc.definitions.filter(
        (d) => (d.kind as string) === operationDefinition
    ) as Array<{ kind: string; operation: string; [key: string]: unknown }>;
    
    if (
        operationDefinitions.filter(
            (d) => validDocDefOps.includes(d.operation),
        ).length !== 1
    ) {
        throw new Error(
            'DocumentNode passed to Playwright Client must contain single query or mutation',
        );
    }

    const definition = operationDefinitions[0];

    // Valid document should contain *OperationDefinition*
    if ((definition.kind) !== operationDefinition) {
        throw new Error('DocumentNode passed to Playwright must contain single query or mutation');
    }

    if ((definition.operation) === subscription) {
        throw new Error('Subscription requests through SDK interface are not supported');
    }
}

async function buildMessage(e: unknown, response: APIResponse): Promise<string> {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return `${errorMessage}
                \nStatus code: ${response.status()}
                \nHeaders: ${JSON.stringify(response.headers())}
                \nResponse body is not a json but: ${await response.text()}`
}
