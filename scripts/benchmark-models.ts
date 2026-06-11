/**
 * Tako Model Benchmark — E2E 评测脚本
 *
 * 通过 Tako Provider API (Anthropic-compatible) 直接评测各模型。
 * 用法: bun run scripts/benchmark-models.ts
 */

import { join } from "path";
import { homedir } from "os";

// ── 模型列表（排除满血版） ────────────────────────────────────────────

const MODELS = [
  // 国产模型
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-3.2",
  "glm-5",
  "glm-5.1",
  "minimax-m2.5",
  "minimax-m3",
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "qwen3.7-max",
  // Claude 系列（非满血）
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  // GPT 系列
  "gpt-5.4",
  "gpt-5.5",
];

// ── Provider 配置 ────────────────────────────────────────────────────

const TAKO_API = "https://tako.shiroha.tech/api/v1/messages";

async function loadApiKey(): Promise<string> {
  const cfg = JSON.parse(await Bun.file(join(homedir(), ".tako/config.json")).text());
  if (!cfg.apiKey) throw new Error("No apiKey in ~/.tako/config.json");
  return cfg.apiKey;
}

async function callModel(model: string, prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(TAKO_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}

// ── 测试用例 ─────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  name: string;
  prompt: string;
  judge: (output: string) => "pass" | "partial" | "fail";
  difficulty: "easy" | "medium" | "hard";
}

const TESTS: TestCase[] = [
  {
    id: "TP-AGENT-01",
    name: "Fibonacci 函数",
    difficulty: "easy",
    prompt: "Write a Python function called `fibonacci(n)` that returns the nth Fibonacci number. Use iterative approach. Only output the code, no explanation.",
    judge: (out) => {
      if (out.includes("def fibonacci") && out.includes("return") && (out.includes("for") || out.includes("while"))) return "pass";
      if (out.includes("fibonacci") || out.includes("fib")) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-02",
    name: "Bug 修复 (off-by-one)",
    difficulty: "easy",
    prompt: `Fix the bug in this code. Only output the corrected function:\n\`\`\`python\ndef get_last_n(items, n):\n    return items[len(items)-n-1:]\n\`\`\`\nThe function should return the last n elements of the list.`,
    judge: (out) => {
      if (out.includes("items[-n:]") || out.includes("len(items)-n:]") || (out.includes("items[") && !out.includes("-n-1"))) return "pass";
      if (out.includes("def get_last_n") && !out.includes("-n-1")) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-03",
    name: "代码解释",
    difficulty: "easy",
    prompt: `Explain what this TypeScript code does in 2-3 sentences:\n\`\`\`typescript\nfunction debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {\n  let timer: ReturnType<typeof setTimeout>;\n  return ((...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T;\n}\n\`\`\``,
    judge: (out) => {
      const lower = out.toLowerCase();
      if (lower.includes("debounce") && (lower.includes("delay") || lower.includes("wait") || lower.includes("timeout"))) return "pass";
      if (lower.includes("timer") || lower.includes("setTimeout") || lower.includes("function")) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-04",
    name: "函数拆分重构",
    difficulty: "medium",
    prompt: `Refactor this function into smaller functions. Output the refactored code:\n\`\`\`typescript\nfunction processOrder(order: any) {\n  if (!order.items || order.items.length === 0) throw new Error("Empty order");\n  if (!order.customerId) throw new Error("No customer");\n  let total = 0;\n  for (const item of order.items) { total += item.price * item.quantity; }\n  if (order.discount) { total *= (1 - order.discount); }\n  return { orderId: Date.now(), customerId: order.customerId, total: Math.round(total * 100) / 100, itemCount: order.items.length };\n}\n\`\`\``,
    judge: (out) => {
      const fnCount = (out.match(/function\s+\w+/g) || []).length + (out.match(/(?:const|let)\s+\w+\s*=\s*\(/g) || []).length;
      if (fnCount >= 3) return "pass";
      if (fnCount >= 2) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-05",
    name: "TypeScript 类型补充",
    difficulty: "medium",
    prompt: `Add proper TypeScript types to this code (replace all 'any' with correct types). Output the typed version:\n\`\`\`typescript\nfunction groupBy(items: any[], key: any): any {\n  return items.reduce((groups: any, item: any) => {\n    const val = item[key];\n    groups[val] = groups[val] || [];\n    groups[val].push(item);\n    return groups;\n  }, {});\n}\n\`\`\``,
    judge: (out) => {
      const hasGeneric = out.includes("<") && out.includes(">");
      const noAny = !out.includes(": any") || (out.match(/: any/g) || []).length <= 1;
      if (hasGeneric && noAny && out.includes("Record")) return "pass";
      if (hasGeneric || noAny) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-06",
    name: "观察者模式",
    difficulty: "hard",
    prompt: "Implement an EventEmitter class in TypeScript with: on(event, handler), off(event, handler), emit(event, ...args). Include proper typing with generics. Only output the code.",
    judge: (out) => {
      const hasOn = out.includes("on(") || out.includes("on <") || out.includes("on<");
      const hasOff = out.includes("off(");
      const hasEmit = out.includes("emit(");
      const hasGeneric = out.includes("<") && out.includes(">");
      if (hasOn && hasOff && hasEmit && hasGeneric) return "pass";
      if (hasOn && hasEmit) return "partial";
      return "fail";
    },
  },
  {
    id: "TP-AGENT-07",
    name: "多约束代码生成",
    difficulty: "hard",
    prompt: `Write a TypeScript function with these exact constraints:\n1. Name: parseConfig\n2. Parameter: raw (string)\n3. Return type: { host: string; port: number; ssl: boolean }\n4. Parse format: "host:port:ssl" where ssl is "true"/"false"\n5. Throw Error with message "Invalid config format" if format is wrong\n6. Port must be 1-65535, throw "Invalid port" otherwise\nOnly output the function, no explanation.`,
    judge: (out) => {
      const hasName = out.includes("parseConfig");
      const hasReturn = out.includes("host") && out.includes("port") && out.includes("ssl");
      const hasValidation = out.includes("Invalid config format") || out.includes("Invalid port");
      const hasThrow = out.includes("throw");
      if (hasName && hasReturn && hasValidation && hasThrow) return "pass";
      if (hasName && hasReturn) return "partial";
      return "fail";
    },
  },
];

// ── 主流程 ───────────────────────────────────────────────────────────

interface Result { model: string; task: string; verdict: "pass" | "partial" | "fail" | "error"; ms: number; error?: string }

async function runBenchmark() {
  const apiKey = await loadApiKey();
  const results: Result[] = [];

  console.log(`\n🚀 Tako Model Benchmark`);
  console.log("═".repeat(60));
  console.log(`Provider: ${TAKO_API.replace("/api/v1/messages", "")}`);
  console.log(`Models: ${MODELS.length}`);
  console.log(`Tasks: ${TESTS.length}`);
  console.log("═".repeat(60));

  for (const model of MODELS) {
    console.log(`\n▸ Testing: ${model}`);
    for (const test of TESTS) {
      process.stdout.write(`  ${test.id} ${test.name}... `);
      const t0 = Date.now();
      try {
        const output = await callModel(model, test.prompt, apiKey);
        const verdict = test.judge(output);
        const ms = Date.now() - t0;
        results.push({ model, task: test.id, verdict, ms });
        const icon = verdict === "pass" ? "✓" : verdict === "partial" ? "◐" : "✗";
        console.log(`${icon} ${verdict} (${ms}ms)`);
      } catch (e: any) {
        const ms = Date.now() - t0;
        results.push({ model, task: test.id, verdict: "error", ms, error: e.message });
        console.log(`⚠ error (${ms}ms): ${e.message.slice(0, 80)}`);
      }
    }
  }

  printSummary(results);
  await saveReport(results);
}

function printSummary(results: Result[]) {
  console.log("\n\n## Summary\n");
  const header = ["Model", ...TESTS.map(t => t.id)].join(" | ");
  console.log(`| ${header} |`);
  console.log(`| ${["Model", ...TESTS.map(() => "---")].join(" | ")} |`);

  for (const model of MODELS) {
    const row = TESTS.map(t => {
      const r = results.find(x => x.model === model && x.task === t.id);
      if (!r) return "-";
      if (r.verdict === "pass") return "✓";
      if (r.verdict === "partial") return "◐";
      if (r.verdict === "error") return "⚠";
      return "✗";
    });
    console.log(`| ${[model, ...row].join(" | ")} |`);
  }
}

async function saveReport(results: Result[]) {
  const dir = join(import.meta.dir, "../tests/_results");
  await Bun.write(join(dir, "benchmark-latest.json"), JSON.stringify({ date: new Date().toISOString(), models: MODELS, results }, null, 2));
  console.log(`\n📄 Report saved: tests/_results/benchmark-latest.json`);
}

runBenchmark().catch(e => { console.error(e); process.exit(1); });
