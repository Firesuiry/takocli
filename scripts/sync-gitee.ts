#!/usr/bin/env bun
/**
 * 同步安装脚本到 Gitee
 * 用于国内用户快速下载
 */

import { $ } from "bun";

const GITEE_REPO = "https://gitee.com/SHIR0HA/tako-cli.git";
const TEMP_DIR = "/tmp/tako-cli-gitee";

async function main() {
  console.log("同步安装脚本到 Gitee...\n");

  try {
    // 清理并克隆
    await $`rm -rf ${TEMP_DIR}`.quiet();
    await $`git clone ${GITEE_REPO} ${TEMP_DIR}`.quiet();

    // 复制文件
    await $`cp install.sh ${TEMP_DIR}/`.quiet();
    await $`cp install.ps1 ${TEMP_DIR}/`.quiet();

    // 读取版本号
    const pkg = await Bun.file("package.json").json();
    const version = pkg.version;

    // 检查是否有改动
    const status = await $`cd ${TEMP_DIR} && git status --porcelain`.text();

    if (!status.trim()) {
      console.log(`  ✓ Gitee 已是最新版本 (v${version})`);
      return;
    }

    // 提交并推送
    const commitMsg = `Update install scripts to v${version}`;
    await $`cd ${TEMP_DIR} && git add . && git commit -m ${commitMsg} && git push origin master`.quiet();

    console.log(`  ✓ 已同步到 Gitee (v${version})`);
    console.log(`\n国内安装命令:`);
    console.log(`  curl -fsSL https://gitee.com/SHIR0HA/tako-cli/raw/master/install.sh | bash`);
    console.log(`  irm https://gitee.com/SHIR0HA/tako-cli/raw/master/install.ps1 | iex`);
  } catch (error) {
    // 可能没有改动，忽略错误
    if (String(error).includes("nothing to commit")) {
      console.log("  ✓ Gitee 已是最新版本");
    } else {
      console.error("  ✗ Gitee 同步失败:", error);
    }
  } finally {
    // 清理
    await $`rm -rf ${TEMP_DIR}`.quiet();
  }
}

main();
