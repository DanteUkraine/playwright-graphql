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
        //console.log('Starting fake GraphQL server...');
        server = createServer((req, res) => {
            //console.log('Received request:', req.method, req.url);
            lastRequestHeaders = req.headers;
            console.log('Request headers:', req.headers);
            if (req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                });

                req.on('end', async () => {
                    //console.log('Request body:', body);

                    try {
                        const { query } = JSON.parse(body);
                        //console.log('Parsed query:', query);

                        const result = await graphql({ schema, source: query, rootValue });
                        //console.log('GraphQL execution result:', result);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (error) {
                        //console.error('Error processing request:', error);

                        res.writeHead(500);
                        res.end(JSON.stringify({ error: (error as Error).message }));
                    }
                });
            } else {
                //console.log('Unhandled request method or URL');
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(port, () => {
            //console.log(`Fake GraphQL server started on port ${port}`);
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
            //console.log('Fake GraphQL server stopped.');
            resolve();
        });
    });
}
