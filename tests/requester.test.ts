import { APIRequestContext, APIResponse } from '@playwright/test';
import { DocumentNode, Kind, OperationTypeNode } from 'graphql';
import { getSdkRequester } from '../src';

describe('getSdkRequester', () => {
    test('should send a GraphQL query and return data', async () => {
        const mockResponse = {
            json: jest.fn().mockResolvedValue({ data: { user: { id: 1, name: 'Test User' } } }),
            text: jest.fn(),
            status: jest.fn(),
            headers: jest.fn(),
        } as unknown as jest.Mocked<APIResponse>;

        const mockClient = {
            post: jest.fn().mockResolvedValue(mockResponse),
        } as unknown as jest.Mocked<APIRequestContext>;

        const gqlEndpoint = '/api/graphql';
        const requester = getSdkRequester(mockClient, { gqlEndpoint });
        const mockDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [
                {
                    kind: Kind.OPERATION_DEFINITION,
                    operation: OperationTypeNode.QUERY,
                    selectionSet: {
                        kind: Kind.SELECTION_SET,
                        selections: []
                    }
                },
            ],
        };
        const variables = { id: 1 };

        const result = await requester(mockDoc, variables);

        expect(mockClient.post).toHaveBeenCalledWith(gqlEndpoint, {
            data: { variables, query: expect.any(String) },
        });
        expect(result).toEqual({ user: { id: 1, name: 'Test User' } });
    });

    test('should throw an error if the document is invalid', async () => {
        const mockClient = {
            post: jest.fn(),
        } as unknown as jest.Mocked<APIRequestContext>;

        const requester = getSdkRequester(mockClient);
        const invalidDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [],
        };

        await expect(requester(invalidDoc)).rejects.toThrow(
            'DocumentNode passed to Playwright Client must contain single query or mutation'
        );
    });

    test('should throw an error if no data is returned in the response', async () => {
        const mockResponse = {
            json: jest.fn().mockResolvedValue({}),
            text: jest.fn().mockResolvedValue('{}'),
            status: jest.fn(),
            headers: jest.fn(),
        } as unknown as jest.Mocked<APIResponse>;

        const mockClient = {
            post: jest.fn().mockResolvedValue(mockResponse),
        } as unknown as jest.Mocked<APIRequestContext>;

        const requester = getSdkRequester(mockClient);
        const mockDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [
                {
                    kind: Kind.OPERATION_DEFINITION,
                    operation: OperationTypeNode.QUERY,
                    selectionSet: {
                        kind: Kind.SELECTION_SET,
                        selections: []
                    }
                },
            ],
        };

        await expect(requester(mockDoc)).rejects.toThrow(
            /No data presented in the GraphQL response/
        );
    });

    test('should handle raw responses if rawResponse option is true', async () => {
        const mockResponse = {
            json: jest.fn().mockResolvedValue({ rawDataKey: 'rawDataValue' }),
            text: jest.fn(),
            status: jest.fn(),
            headers: jest.fn(),
        } as unknown as jest.Mocked<APIResponse>;

        const mockClient = {
            post: jest.fn().mockResolvedValue(mockResponse),
        } as unknown as jest.Mocked<APIRequestContext>;

        const gqlEndpoint = '/api/graphql';
        const requester = getSdkRequester(mockClient, { gqlEndpoint, rawResponse: true });
        const mockDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [
                {
                    kind: Kind.OPERATION_DEFINITION,
                    operation: OperationTypeNode.QUERY,
                    selectionSet: {
                        kind: Kind.SELECTION_SET,
                        selections: []
                    }
                },
            ],
        };
        const variables = { id: 1 };

        const result = await requester(mockDoc, variables);

        expect(mockClient.post).toHaveBeenCalledWith(gqlEndpoint, {
            data: { variables, query: expect.any(String) },
        });
        expect(result).toEqual({ rawDataKey: 'rawDataValue' });
    });

    test('should throw an error for unsupported subscription operations', async () => {
        const mockClient = {
            post: jest.fn(),
        } as unknown as jest.Mocked<APIRequestContext>;

        const requester = getSdkRequester(mockClient);
        const subscriptionDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [
                {
                    kind: Kind.OPERATION_DEFINITION,
                    operation: OperationTypeNode.SUBSCRIPTION,
                    selectionSet: {
                        kind: Kind.SELECTION_SET,
                        selections: []
                    }
                },
            ],
        };

        await expect(requester(subscriptionDoc)).rejects.toThrow(
            'Subscription requests through SDK interface are not supported'
        );
    });

    test('should handle errors in request handler', async () => {
        const mockResponse = {
            json: jest.fn().mockResolvedValue({ data: null, errors: [{ message: 'API Error' }] }),
            status: jest.fn().mockReturnValue(400),
        } as unknown as jest.Mocked<APIResponse>;

        const mockClient = {
            post: jest.fn().mockResolvedValue(mockResponse),
        } as unknown as jest.Mocked<APIRequestContext>;

        const requestHandlerCallback = async (request: () => Promise<APIResponse>) => {
            const res = await request();
            if (res.status() >= 400) {
                throw new Error(`API call failed with status ${res.status()}`);
            }
            return res;
        };

        const requester = getSdkRequester(mockClient, { gqlEndpoint: '/graphql' }, requestHandlerCallback);

        const mockDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [{
                kind: Kind.OPERATION_DEFINITION,
                operation: OperationTypeNode.QUERY,
                selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: []
                }
            }]
        };

        await expect(requester(mockDoc)).rejects.toThrow('API call failed with status 400');
    });

    test('should allow request modification in handler', async () => {
        const mockResponse = {
            json: jest.fn().mockResolvedValue({ data: { user: { id: 1 } } }),
            status: jest.fn().mockReturnValue(200),
        } as unknown as jest.Mocked<APIResponse>;

        const mockClient = {
            post: jest.fn().mockResolvedValue(mockResponse),
        } as unknown as jest.Mocked<APIRequestContext>;

        let requestCount = 0;
        const requestHandlerCallback = async (request: () => Promise<APIResponse>) => {
            requestCount++;
            if (requestCount === 1) {
                // Simulate retry logic
                await request(); // First attempt
                return request(); // Retry
            }
            return request();
        };

        const requester = getSdkRequester(mockClient, { gqlEndpoint: '/graphql' }, requestHandlerCallback);

        const mockDoc: DocumentNode = {
            kind: Kind.DOCUMENT,
            definitions: [{
                kind: Kind.OPERATION_DEFINITION,
                operation: OperationTypeNode.QUERY,
                selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: []
                }
            }]
        };

        await requester(mockDoc);
        expect(mockClient.post).toHaveBeenCalledTimes(2); // Verify retry happened
    });
});
