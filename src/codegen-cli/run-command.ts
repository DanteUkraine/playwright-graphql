import { spawn } from 'child_process';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface RunCommandOptions {
    timeout?: number;
    shell?: boolean;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Executes a shell command with proper error handling and timeout support.
 * 
 * @param command - The command to execute
 * @param options - Optional configuration
 * @returns Promise with stdout, stderr, and exitCode
 * @throws Error if command fails or times out
 */
export function runCommand(
    command: string,
    options: RunCommandOptions = {}
): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const { timeout = DEFAULT_TIMEOUT, shell = true } = options;
        
        const child = spawn(command, { shell });
        
        const stdout: string[] = [];
        const stderr: string[] = [];
        
        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
        }, timeout);

        if (child.stdout) {
            child.stdout.on('data', (data: Buffer) => {
                stdout.push(data.toString());
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (data: Buffer) => {
                stderr.push(data.toString());
            });
        }

        child.on('error', (error) => {
            clearTimeout(timeoutId);
            if (!timedOut) {
                reject(new Error(`Command failed to spawn: ${error.message}`));
            }
        });

        child.on('close', (code) => {
            clearTimeout(timeoutId);
            
            if (timedOut) {
                return; // Already rejected by timeout
            }
            
            const exitCode = code ?? -1;
            const result: CommandResult = {
                stdout: stdout.join('\n'),
                stderr: stderr.join('\n'),
                exitCode
            };
            
            if (exitCode === 0) {
                resolve(result);
            } else {
                reject(new Error(
                    `Command "${command}" exited with code ${exitCode}.\n` +
                    `Stdout: ${result.stdout}\n` +
                    `Stderr: ${result.stderr}`
                ));
            }
        });
    });
}