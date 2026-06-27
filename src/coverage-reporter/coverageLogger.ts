import { writeFile } from 'fs/promises';
import { resolve } from 'path';

export interface CoverageCall {
    name: string;
    inputParams: unknown[];
}

export function coverageLogger<T extends Record<string, unknown>>(obj: T, loggerStashDir: string): T {
    return new Proxy(obj, {
        get(target: T, prop: string): unknown {
            const originalMethod = (target as Record<string, unknown>)[prop];

            if (typeof originalMethod === 'function') {
                return async function (...args: unknown[]) {
                    const coverageEntry: CoverageCall = { name: prop, inputParams: args };
                    const logCoverage = writeFile(resolve(loggerStashDir, prop), JSON.stringify(coverageEntry) + '\n', { flag: 'a' });
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    const gqlResponse = await (originalMethod as (...args: unknown[]) => Promise<unknown>).apply(target, args);
                    await logCoverage;
                    return gqlResponse;
                };
            }

            return originalMethod;
        },
    });
}