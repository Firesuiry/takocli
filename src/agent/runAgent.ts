import { AgentRegistry } from './AgentRegistry';
import { PermissionHandler, type PermissionMode } from './permissionHandler';
import { resolveModelForAgent, buildAgentEnv } from './modelResolver';
import { AcpSdkBackend } from './backends/acp';
import type { AgentMessage, PromptContent } from './types';
import type { ProviderContext } from '../providers/types';
import { log } from '../logger';
import { getClientBinPath } from '../clients/base';
import { getAllClients } from '../clients';

export interface RunAgentOptions {
    provider: ProviderContext;
    modelMode?: string;
    permissionMode?: PermissionMode;
    cwd?: string;
    resumeSessionId?: string;
}

function registerClaudeBackend(provider: ProviderContext, modelMode?: string, cwd?: string): void {
    AgentRegistry.register('claude', () => {
        const clients = getAllClients();
        const claudeClient = clients.find(c => c.id === 'claude-code');
        if (!claudeClient) throw new Error('Claude Code client not found');

        const binPath = getClientBinPath(claudeClient);
        const modelArgs = resolveModelForAgent(modelMode, provider);
        const args = ['mcp', 'serve', ...modelArgs];
        const env = buildAgentEnv(provider, modelMode);

        return new AcpSdkBackend({ command: binPath, args, env });
    });
}

function renderAgentMessage(message: AgentMessage): void {
    switch (message.type) {
        case 'text':
            process.stdout.write(message.text);
            break;
        case 'tool_call':
            process.stderr.write(`\n🔧 ${message.name} [${message.status}]\n`);
            break;
        case 'tool_result':
            if (message.status === 'failed') {
                process.stderr.write(`❌ Tool failed\n`);
            }
            break;
        case 'plan':
            process.stderr.write(`\n📋 Plan:\n`);
            for (const item of message.items) {
                const icon = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '▸' : '○';
                process.stderr.write(`  ${icon} ${item.content}\n`);
            }
            break;
        case 'turn_complete':
            process.stdout.write('\n');
            break;
        case 'error':
            process.stderr.write(`\n❌ ${message.message}\n`);
            break;
    }
}

function readLine(): Promise<string | null> {
    return new Promise((resolve) => {
        if (!process.stdin.isTTY) {
            let data = '';
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', (chunk) => { data += chunk; });
            process.stdin.on('end', () => resolve(data.trim() || null));
            return;
        }

        const rl = require('node:readline').createInterface({
            input: process.stdin,
            output: process.stderr,
        });
        rl.question('> ', (answer: string) => {
            rl.close();
            resolve(answer.trim() || null);
        });
    });
}

export async function runAgent(options: RunAgentOptions): Promise<void> {
    const cwd = options.cwd ?? process.cwd();
    const permissionHandler = new PermissionHandler(options.permissionMode ?? 'interactive');

    registerClaudeBackend(options.provider, options.modelMode, cwd);

    const backend = AgentRegistry.create('claude');

    backend.onPermissionRequest(async (request) => {
        const response = await permissionHandler.handle(request);
        await backend.respondToPermission('', request, response);
    });

    log.info('Initializing agent...');
    await backend.initialize();

    const sessionId = await backend.newSession({ cwd, mcpServers: [] });
    log.success('Agent ready. Type your message (Ctrl+C to exit).');

    let shouldExit = false;

    const cleanup = async () => {
        if (shouldExit) return;
        shouldExit = true;
        await backend.disconnect();
    };

    process.on('SIGINT', async () => {
        process.stderr.write('\n');
        await cleanup();
        process.exit(0);
    });
    process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });

    while (!shouldExit) {
        const input = await readLine();
        if (input === null) { await cleanup(); break; }
        if (input === '/exit' || input === '/quit') { await cleanup(); break; }

        const promptContent: PromptContent[] = [{ type: 'text', text: input }];

        try {
            await backend.prompt(sessionId, promptContent, renderAgentMessage);
        } catch (error) {
            log.error(`Prompt failed: ${error instanceof Error ? error.message : error}`);
        }
    }
}
