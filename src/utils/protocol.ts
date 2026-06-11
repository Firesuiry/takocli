import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export type RetryOptions = {
  maxAttempts?: number;
  minDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
};

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? Infinity;
  const minDelay = options?.minDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const shouldRetry = options?.shouldRetry ?? (() => true);
  const onRetry = options?.onRetry;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (!shouldRetry(error)) throw error;
      if (attempt >= maxAttempts) throw error;
      const exponentialDelay = minDelay * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelay);
      const jitter = Math.random() * 0.3 * cappedDelay;
      const nextDelayMs = Math.round(cappedDelay + jitter);
      if (onRetry) onRetry(error, attempt, nextDelayMs);
      await new Promise(r => setTimeout(r, nextDelayMs));
    }
  }
}

const isWindows = (): boolean => process.platform === 'win32';

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitForProcessToDie(pid: number, force: boolean): Promise<void> {
  const maxWait = 2000;
  const pollInterval = 20;
  let waited = 0;
  while (isProcessAlive(pid) && waited < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;
  }
  if (!force && isProcessAlive(pid)) {
    try { process.kill(pid, 'SIGKILL'); } catch { return; }
    waited = 0;
    while (isProcessAlive(pid) && waited < 1000) {
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;
    }
  }
}

function collectProcessTree(pid: number): number[] {
  const pids: number[] = [];
  try {
    const result = spawnSync('pgrep', ['-P', pid.toString()], { encoding: 'utf8' });
    if (result.stdout) {
      for (const childPid of result.stdout.trim().split('\n').filter(Boolean).map(Number)) {
        pids.push(...collectProcessTree(childPid));
      }
    }
  } catch {}
  pids.push(pid);
  return pids;
}

async function killProcessTree(pid: number, force: boolean): Promise<boolean> {
  const pids = collectProcessTree(pid);
  const signal = force ? 'SIGKILL' : 'SIGTERM';
  for (const p of pids) { try { process.kill(p, signal); } catch {} }
  for (const p of pids) { await waitForProcessToDie(p, force); }
  return true;
}

function killProcessWindows(pid: number, force: boolean): boolean {
  const args = ['/T', '/PID', pid.toString()];
  if (force) args.unshift('/F');
  try {
    return spawnSync('taskkill', args, { stdio: 'pipe' }).status === 0;
  } catch { return false; }
}

export async function killProcessByChildProcess(child: ChildProcess, force = false): Promise<boolean> {
  const pid = child.pid;
  if (!pid) return false;
  if (isWindows()) return killProcessWindows(pid, force);
  return killProcessTree(pid, force);
}
