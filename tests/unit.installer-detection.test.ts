// 回归测试 — 2026-06-15 事故：codex/claude-code 启动 fallback 到全局安装
//
// 不变量 INV-INST-01：判定"已安装"必须看真正的包入口
//   node_modules/<package>/package.json，而非 tako 在 bun add 之前写的占位
//   <clientDir>/package.json。
//
// 事故根因：旧 isClientInstalled 只检查占位 package.json。更新流程"先删
// node_modules 再 bun add"中途失败后，留下"占位文件在、node_modules 没"的
// 半残状态，被误判为"已安装" → 永不重装 → 启动 fallback 到全局二进制。
//
// 这些用例锁住合约：占位文件存在 ≠ 已安装；只有包入口存在才算装好。

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isPackageInstalledAt, buildBunInstallEnv } from "../src/installer";
import { TAKO_BUN_CACHE_DIR } from "../src/config";

const PKG = "@openai/codex";

describe("installer/isPackageInstalledAt — INV-INST-01", () => {
  let clientDir: string;

  beforeEach(async () => {
    clientDir = await mkdtemp(join(tmpdir(), "tako-installer-test-"));
  });

  afterEach(async () => {
    await rm(clientDir, { recursive: true, force: true });
  });

  it("空目录 → 未安装", async () => {
    expect(await isPackageInstalledAt(clientDir, PKG)).toBe(false);
  });

  it("只有占位 package.json（无 node_modules）→ 未安装（事故现场）", async () => {
    // 还原事故：tako 写过占位文件，但 node_modules 被删
    await writeFile(
      join(clientDir, "package.json"),
      JSON.stringify({ name: "tako-codex", private: true, dependencies: { [PKG]: "^0.137.0" } }),
    );
    expect(await isPackageInstalledAt(clientDir, PKG)).toBe(false);
  });

  it("node_modules/<pkg>/package.json 存在 → 已安装", async () => {
    const pkgDir = join(clientDir, "node_modules", PKG);
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), JSON.stringify({ name: PKG, version: "0.139.0" }));
    expect(await isPackageInstalledAt(clientDir, PKG)).toBe(true);
  });

  it("node_modules 存在但目标包缺失 → 未安装", async () => {
    await mkdir(join(clientDir, "node_modules", "@openai", "other-pkg"), { recursive: true });
    expect(await isPackageInstalledAt(clientDir, PKG)).toBe(false);
  });
});

describe("installer/buildBunInstallEnv — INV-INST-02 cache 隔离", () => {
  it("注入独立 BUN_INSTALL_CACHE_DIR（指向 tako 专属 cache）", () => {
    const env = buildBunInstallEnv("https://registry.example.com");
    expect(env.BUN_INSTALL_CACHE_DIR).toBe(TAKO_BUN_CACHE_DIR);
  });

  it("cache dir 在 tako 目录下，与全局 ~/.bun/install/cache 隔离", () => {
    const env = buildBunInstallEnv("https://registry.example.com");
    expect(env.BUN_INSTALL_CACHE_DIR).toContain(".tako");
    expect(env.BUN_INSTALL_CACHE_DIR).not.toContain(".bun/install/cache");
  });

  it("透传 registry", () => {
    const env = buildBunInstallEnv("https://registry.example.com");
    expect(env.BUN_CONFIG_REGISTRY).toBe("https://registry.example.com");
  });
});
