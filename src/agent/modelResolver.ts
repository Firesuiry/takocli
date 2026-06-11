import { getModelEntry } from '../models';
import type { ProviderContext } from '../providers/types';
import { appendOneMTagIfNeeded } from '../clients/claude-code';

export function resolveModelForAgent(modelMode: string | undefined, provider: ProviderContext): string[] {
    if (!modelMode) return [];
    const tagged = appendOneMTagIfNeeded(modelMode);
    return ['--model', tagged];
}

export function buildAgentEnv(provider: ProviderContext, modelMode?: string): Record<string, string> {
    const env: Record<string, string> = { ...process.env as Record<string, string> };

    switch (provider.type) {
        case 'tako':
            env.ANTHROPIC_BASE_URL = `${provider.baseUrl}/api`;
            env.ANTHROPIC_AUTH_TOKEN = provider.apiKey!;
            break;
        case 'anthropic':
            env.ANTHROPIC_API_KEY = provider.apiKey!;
            break;
        case 'custom':
            env.ANTHROPIC_BASE_URL = provider.baseUrl!;
            env.ANTHROPIC_AUTH_TOKEN = provider.apiKey!;
            break;
        default:
            break;
    }

    // model 只通过 --model 参数传给子进程，不设 ANTHROPIC_MODEL env var
    delete env.ANTHROPIC_MODEL;

    return env;
}
