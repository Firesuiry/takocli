import { runAgent } from './runAgent';
import { selectProviderForClient } from '../ui/providers';
import type { PermissionMode } from './permissionHandler';

export async function runAgentCommand(args: string[]): Promise<void> {
    let modelMode: string | undefined;
    let permissionMode: PermissionMode = 'interactive';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--model' && args[i + 1]) {
            modelMode = args[++i];
        } else if (args[i] === '--yolo' || args[i] === '--dangerously-skip-permissions') {
            permissionMode = 'auto-approve';
        }
    }

    const provider = await selectProviderForClient('claude-code');
    if (!provider) {
        console.error('未配置可用的服务商。请先运行 tako 配置 Provider。');
        process.exit(1);
    }

    await runAgent({
        provider,
        modelMode: modelMode ?? provider.model,
        permissionMode,
    });
}
