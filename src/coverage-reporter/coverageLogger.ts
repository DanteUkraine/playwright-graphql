import { writeFile } from 'fs/promises';
import { join } from 'path';

export function coverageLogger<T extends object>(obj: T, loggerStashDir: string): T {
    return new Proxy(obj, {
        get(target: T, prop: string) {
            const originalMethod = (target as any)[prop];

            if (typeof originalMethod === 'function') {
                return async function (...args: any[]) {
                    const logCoverage = writeFile(join(loggerStashDir, prop), `${JSON.stringify({ name: prop, inputParams: args })},`, { flag: 'a' });
                    const gqlResponse = await originalMethod.apply(target, args);
                    await logCoverage;
                    return gqlResponse;
                };
            }

            return originalMethod;
        },
    });
}