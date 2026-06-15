#!/bin/bash
# release-gate.sh — 发布前触发三平台 e2e 并等待全部通过
# 用法：bash scripts/release-gate.sh
# 失败则 exit 1，阻止后续 publish。
set -e

REPO="Barrierml/tako-cli"
WORKFLOW="cli-installer-e2e.yml"

echo "🚀 触发 installer e2e (Linux + macOS + Windows)..."
gh workflow run "$WORKFLOW" --repo "$REPO"

# 等 run 出现（刚触发可能还没入队）
sleep 5
RUN_ID=$(gh run list --workflow="$WORKFLOW" --repo "$REPO" --limit 1 --json databaseId -q '.[0].databaseId')

if [ -z "$RUN_ID" ]; then
  echo "❌ 无法获取 run ID"
  exit 1
fi

echo "⏳ 等待 run #${RUN_ID} 完成（三平台并行，通常 2-3 分钟）..."
if gh run watch "$RUN_ID" --repo "$REPO" --exit-status; then
  echo "✅ 三平台 e2e 全部通过，可以发布"
else
  echo "❌ e2e 失败，中止发布。查看详情："
  echo "   gh run view $RUN_ID --repo $REPO --log-failed"
  exit 1
fi
