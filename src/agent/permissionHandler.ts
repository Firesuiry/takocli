import type { PermissionRequest, PermissionResponse } from './types';
import { log } from '../logger';

export type PermissionMode = 'auto-approve' | 'interactive';

export class PermissionHandler {
    private mode: PermissionMode;

    constructor(mode: PermissionMode = 'interactive') {
        this.mode = mode;
    }

    setMode(mode: PermissionMode): void {
        this.mode = mode;
    }

    async handle(request: PermissionRequest): Promise<PermissionResponse> {
        if (this.mode === 'auto-approve') {
            const allowOption = request.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always');
            if (allowOption) {
                return { outcome: 'selected', optionId: allowOption.optionId };
            }
            return { outcome: 'selected', optionId: request.options[0]?.optionId ?? 'allow' };
        }

        const toolName = request.title ?? request.kind ?? 'Unknown tool';
        log.info(`🔐 Permission required: ${toolName}`);

        if (request.rawInput) {
            const inputStr = typeof request.rawInput === 'string'
                ? request.rawInput
                : JSON.stringify(request.rawInput, null, 2);
            const truncated = inputStr.length > 200 ? inputStr.slice(0, 200) + '...' : inputStr;
            process.stderr.write(`   Input: ${truncated}\n`);
        }

        for (const option of request.options) {
            process.stderr.write(`   [${option.optionId}] ${option.name}\n`);
        }

        const response = await this.promptUser(request.options.map(o => o.optionId));
        if (!response) return { outcome: 'cancelled' };
        return { outcome: 'selected', optionId: response };
    }

    private async promptUser(validOptions: string[]): Promise<string | null> {
        const allowOption = validOptions.find(id => id.includes('allow') || id.startsWith('option-1'));
        process.stderr.write(`   [Enter=allow / n=reject]: `);

        return new Promise((resolve) => {
            const onData = (data: Buffer) => {
                const input = data.toString().trim().toLowerCase();
                process.stdin.removeListener('data', onData);
                if (process.stdin.isTTY) process.stdin.setRawMode(false);
                process.stdin.pause();

                if (input === 'n' || input === 'no') {
                    const rejectOption = validOptions.find(id => id.includes('reject'));
                    resolve(rejectOption ?? null);
                } else {
                    resolve(allowOption ?? validOptions[0] ?? null);
                }
            };

            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.once('data', onData);
        });
    }
}
