import { resolve } from 'path';

export function getPathToTmpCoverageStash(path: string): string {
    const parts = path.split('/');
    const fileWithExtension = parts[parts.length - 1];
    
    // Remove .ts extension using string methods instead of regex
    const fileWithoutExtension = fileWithExtension.endsWith('.ts') 
        ? fileWithExtension.slice(0, -3) 
        : fileWithExtension;

    return resolve(process.cwd(), `.${fileWithoutExtension}-coverage`);
}