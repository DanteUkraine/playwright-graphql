import { join } from 'path';

export function getPathToTmpCoverageStash(path: string): string {
    const parts = path.split('/');
    const fileWithExtension = parts[parts.length - 1];

    return join(process.cwd(), `.${fileWithExtension.replace('.ts', '')}-coverage`);
}