import { createServer, Server, IncomingHttpHeaders } from 'http';
import { graphql, buildSchema } from 'graphql';

const schema = buildSchema(`
  type Query {
    hello: String
  }
`);

const rootValue = {
    hello: () => 'Hello from the fake GraphQL server!',
};

let server: Server | null = null;
export let lastRequestHeaders: IncomingHttpHeaders | undefined;

export async function startFakeGraphQLServer(port: number = 4000): Promise<void> {

    return new Promise((resolve, reject) => {
        server = createServer((req, res) => {
            lastRequestHeaders = req.headers;

            if (req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                });

                req.on('end', async () => {
                    try {
                        const { query } = JSON.parse(body);

                        const result = await graphql({ schema, source: query, rootValue });

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (error) {

                        res.writeHead(500);
                        res.end(JSON.stringify({ error: (error as Error).message }));
                    }
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(port, () => {
            resolve();
        });

        server.on('error', (err) => {
            console.error('Error starting server:', err);
            reject(err);
        });
    });
}


export function stopFakeGraphQLServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!server) {
            return resolve();
        }
        server.close((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
