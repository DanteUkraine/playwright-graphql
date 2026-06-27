import { writeFile } from 'fs/promises';
import { resolve } from 'path';

export function coverageLogger<T extends Record<string, unknown>>(obj: T, loggerStashDir: string): T {
    return new Proxy(obj, {
        get(target: T, prop: string): unknown {
            const originalMethod = (target as Record<string, unknown>)[prop];

            if (typeof originalMethod === 'function') {
                return async function (...args: unknown[]) {
                    const logCoverage = writeFile(resolve(loggerStashDir, prop), `${JSON.stringify({ name: prop, inputParams: args })},`, { flag: 'a' });
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