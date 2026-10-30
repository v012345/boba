#!/bin/sh
# 把 Creator 的 web-mobile 构建产物同步到 GitHub Pages 仓库并推送。
# 用法: tools/publish-pages.sh [构建产物目录] [Pages 仓库目录]
# 默认: build/web-mobile -> ~/Desktop/work/v012345.github.io
set -eu
BUILD="${1:-build/web-mobile}"
PAGES="${2:-$HOME/Desktop/work/v012345.github.io}"

[ -f "$BUILD/index.html" ] || { echo "✗ $BUILD/index.html 不存在，先在 Creator 里构建 web-mobile"; exit 1; }
[ -d "$PAGES/.git" ] || { echo "✗ $PAGES 不是 git 仓库"; exit 1; }

# .nojekyll 必须存在，否则 GitHub Pages 的 Jekyll 会丢掉 cocos-js/_virtual_cc-*.js，
# 页面白屏并在控制台报模块加载失败。这个文件不是构建产物，同步时必须保留。
touch "$PAGES/.nojekyll"

# --delete 让产物与线上完全一致；.git/.nojekyll/CNAME 不参与同步也不被删除。
# 注意 macOS 自带的是 openrsync，参数只用到 2.6.9 就有的部分。
rsync -a --delete --exclude '.git/' --exclude '.nojekyll' --exclude 'CNAME' "$BUILD/" "$PAGES/"

git -C "$PAGES" add -A
if git -C "$PAGES" diff --cached --quiet; then echo "· 产物无变化，跳过提交"; exit 0; fi
git -C "$PAGES" commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
git -C "$PAGES" push -q origin HEAD
echo "✓ 已推送，等 Pages 重新构建约 30-60 秒"
echo "  自检: curl -o /dev/null -w '%{http_code}\\n' https://v012345.github.io/cocos-js/_virtual_cc-C6aOtQS_.js"
