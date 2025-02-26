import { spawn } from 'child_process';

export function runCommand(
    command: string,
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {

        const child = spawn(command, { shell: true });

        const stdout: string[] = [];
        const stderr: string[] = [];

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
            reject(error);
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: stdout.join('\n'), stderr: stderr.join('\n') });
            } else {
                reject(new Error(`Command "${command}" exited with code ${code}.\nStderr: ${stderr}`));
            }
        });
    });
}