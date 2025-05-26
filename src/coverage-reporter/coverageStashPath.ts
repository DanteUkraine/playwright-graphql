import { resolve } from 'path';

export function getPathToTmpCoverageStash(path: string): string {
    const parts = path.split('/');
    const fileWithExtension = parts[parts.length - 1];

    return resolve(process.cwd(), `.${fileWithExtension.replace('.ts', '')}-coverage`);
}