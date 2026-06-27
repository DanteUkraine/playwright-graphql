import { createServer, Server, IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
import { graphql, buildSchema, GraphQLSchema } from 'graphql';

// Types for request tracking
export interface RequestInfo {
    headers: IncomingHttpHeaders;
    body: string;
    timestamp: Date;
}

// Track all requests for debugging
export const receivedRequests: RequestInfo[] = [];

// Default schema - keep it simple for compatibility
const defaultSchema = buildSchema(`
  type Query {
    hello: String
  }
`);

const defaultRootValue = {
    hello: () => 'Hello from the fake GraphQL server!',
};

// Allow schema customization for different test scenarios
let currentSchema: GraphQLSchema = defaultSchema;
let currentRootValue: any = defaultRootValue;

// Server instance
let server: Server | null = null;
let currentPort: number | null = null;

// Track the last request headers for backwards compatibility
export let lastRequestHeaders: IncomingHttpHeaders | undefined;

/**
 * Sets a custom schema for the fake server
 * @param schemaString - GraphQL schema definition string
 * @param rootValue - Root value object for resolvers
 */
export function setFakeServerSchema(schemaString: string, rootValue: any = {}): void {
    currentSchema = buildSchema(schemaString);
    currentRootValue = { ...defaultRootValue, ...rootValue };
}

/**
 * Resets the schema to default
 */
export function resetFakeServerSchema(): void {
    currentSchema = defaultSchema;
    currentRootValue = defaultRootValue;
}

/**
 * Gets the current server port
 */
export function getCurrentPort(): number | null {
    return currentPort;
}

/**
 * Gets the server URL (e.g., 'http://localhost:4000')
 */
export function getServerUrl(): string | null {
    if (currentPort === null) return null;
    return `http://localhost:${currentPort}`;
}

/**
 * Starts the fake GraphQL server
 * @param port - Port to listen on (defaults to 0 for random port)
 * @returns Promise that resolves when server is ready
 */
export async function startFakeGraphQLServer(port: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
        // Reset tracking
        receivedRequests.length = 0;
        lastRequestHeaders = undefined;

        server = createServer((req: IncomingMessage, res: ServerResponse) => {
            // Track request headers
            lastRequestHeaders = req.headers;

            // Log the request for debugging
            const requestInfo: RequestInfo = {
                headers: req.headers,
                body: '',
                timestamp: new Date()
            };

            if (req.method === 'GET' && req.url === '/health') {
                // Health check endpoint
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
                return;
            }

            if (req.method === 'POST') {
                let body = '';

                req.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                    requestInfo.body = body;
                });

                req.on('end', async () => {
                    receivedRequests.push(requestInfo);

                    try {
                        // Parse JSON body
                        let requestBody: { query: string; variables?: any };
                        try {
                            requestBody = JSON.parse(body);
                        } catch (parseError) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                errors: [{ message: 'Invalid JSON body' }]
                            }));
                            return;
                        }

                        // Validate query exists
                        if (!requestBody.query) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                errors: [{ message: 'Missing query in request body' }]
                            }));
                            return;
                        }

                        // Execute GraphQL query - use same format as original
                        const result = await graphql({
                            schema: currentSchema,
                            source: requestBody.query,
                            rootValue: currentRootValue
                        });

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (error) {
                        console.error('GraphQL execution error:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            errors: [{ message: (error as Error).message }]
                        }));
                    }
                });
            } else if (req.method === 'GET') {
                // Handle GET requests to GraphQL endpoint
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    errors: [{ message: 'Method not allowed, use POST' }]
                }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    errors: [{ message: 'Not found' }]
                }));
            }
        });

        server.listen(port, () => {
            const address = server?.address();
            if (address && typeof address !== 'string') {
                currentPort = address.port;
            }
            resolve();
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error(`Port ${port} is already in use`));
            } else {
                console.error('Error starting server:', err);
                reject(err);
            }
        });
    });
}

/**
 * Stops the fake GraphQL server
 * @returns Promise that resolves when server is stopped
 */
export function stopFakeGraphQLServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!server) {
            currentPort = null;
            return resolve();
        }

        server.close((err?: Error) => {
            server = null;
            currentPort = null;
            if (err) {
                console.error('Error stopping server:', err);
                return reject(err);
            }
            resolve();
        });

        // Forcefully shutdown after timeout to prevent hangs
        setTimeout(() => {
            if (server) {
                server.removeAllListeners();
                server = null;
                currentPort = null;
                resolve();
            }
        }, 5000);
    });
}

/**
 * Clears all tracked requests
 */
export function clearReceivedRequests(): void {
    receivedRequests.length = 0;
}

/**
 * Gets all received requests for debugging
 */
export function getReceivedRequests(): RequestInfo[] {
    return [...receivedRequests];
}

/**
 * Gets the last received request
 */
export function getLastRequest(): RequestInfo | null {
    if (receivedRequests.length === 0) return null;
    return receivedRequests[receivedRequests.length - 1];
}
