#!/bin/bash
# 同步安装脚本到 Gitee（用于国内用户快速下载）

set -e

GITEE_REPO="https://gitee.com/SHIR0HA/tako-cli.git"
TEMP_DIR="/tmp/tako-cli-gitee"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "同步安装脚本到 Gitee..."
echo

# 清理并克隆
rm -rf "$TEMP_DIR"
git clone "$GITEE_REPO" "$TEMP_DIR"

# 复制文件
cp "$SCRIPT_DIR/install.sh" "$TEMP_DIR/"
cp "$SCRIPT_DIR/install.ps1" "$TEMP_DIR/"

# 读取版本号
VERSION=$(grep '"version"' "$SCRIPT_DIR/package.json" | sed 's/.*: "\(.*\)".*/\1/')

# 检查是否有改动
cd "$TEMP_DIR"
if [ -z "$(git status --porcelain)" ]; then
    echo "  ✓ Gitee 已是最新版本 (v$VERSION)"
    rm -rf "$TEMP_DIR"
    exit 0
fi

# 提交并推送
git add .
git commit -m "Update install scripts to v$VERSION"
git push origin master

echo "  ✓ 已同步到 Gitee (v$VERSION)"
echo
echo "国内安装命令:"
echo "  curl -fsSL https://gitee.com/SHIR0HA/tako-cli/raw/master/install.sh | bash"
echo "  irm https://gitee.com/SHIR0HA/tako-cli/raw/master/install.ps1 | iex"

# 清理
rm -rf "$TEMP_DIR"
