import http from 'node:http';
import { AddressInfo } from 'node:net';
import { parse } from 'graphql';
import { getSdkRequester } from '../lib/index.js';
import { test, expect } from '@playwright/test';

// In-repo mock GraphQL endpoint — no external network required.
function startMockServer() {
    return http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            const { query } = JSON.parse(body);
            const doc = parse(query);
            const opName = doc.definitions
                .find((d) => d.kind === 'OperationDefinition')?.name?.value;
            const data = opName === 'getBook'
                ? { getBook: { id: '1', title: 'Dune' } }
                : opName === 'createBook'
                    ? { createBook: { id: '2', title: 'Foundation' } }
                    : {};
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ data }));
        });
    });
}

test.describe('playwright-graphql under the Bun runtime', () => {
    test('getSdkRequester runs a query through the request fixture', async ({ request }) => {
        const server = startMockServer();
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const { port } = server.address() as AddressInfo;
        try {
            const requester = getSdkRequester(request, { gqlEndpoint: `http://localhost:${port}/graphql` });
            const data = await requester(parse('query getBook($id: String) { getBook(id: $id) { id title } }'), { id: '1' });
            expect(data).toEqual({ getBook: { id: '1', title: 'Dune' } });
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    test('getSdkRequester runs a mutation through the request fixture', async ({ request }) => {
        const server = startMockServer();
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const { port } = server.address() as AddressInfo;
        try {
            const requester = getSdkRequester(request, { gqlEndpoint: `http://localhost:${port}/graphql` });
            const data = await requester(parse('mutation createBook($title: String) { createBook(title: $title) { id title } }'), { title: 'Foundation' });
            expect(data).toEqual({ createBook: { id: '2', title: 'Foundation' } });
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
