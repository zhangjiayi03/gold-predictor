#!/bin/bash
# 同步项目到 GitHub（仓库=唯一事实源）：dashboard→docs、提交全部变更、推送、确保 Pages(main /docs)
# 运行前提：当前目录是本仓库的 git 克隆（手动会话=/workspace/gold-predictor，定时会话=克隆目录）
# 密钥：环境变量 GH_TOKEN 优先，其次 config/gh.token（两文件均被 .gitignore 排除，不入库）
set -e
cd "$(dirname "$0")/.."
GH_TOKEN="${GH_TOKEN:-$(cat config/gh.token 2>/dev/null || true)}"
[ -z "$GH_TOKEN" ] && { echo "缺少 GH_TOKEN（环境变量或 config/gh.token）"; exit 1; }
REPO="zhangjiayi03/gold-predictor"
API="https://api.github.com/repos/$REPO"

# git 代理：沙盒环境变量已有则用之，否则回退本地代理端口
if [ -z "${http_proxy:-}${https_proxy:-}${HTTP_PROXY:-}${HTTPS_PROXY:-}" ]; then
  export http_proxy=http://127.0.0.1:18080 https_proxy=http://127.0.0.1:18080
fi

# 1. dashboard → docs（Pages 源目录，仅支持根目录或 /docs）
rm -rf docs && mkdir -p docs
cp -r dashboard/. docs/
rm -f docs/index.html   # dashboard/ 里的 index.html 是符号链接，替换为真实文件更稳
cp docs/dashboard.html docs/index.html
touch docs/.nojekyll   # 必须：否则 _shared 下划线目录被 Jekyll 忽略导致字体 404

# 2. 提交全部变更并推送（.gitignore 自动排除密钥）
git config user.name "gold-predictor-bot"
git config user.email "zhangjiayi03@users.noreply.github.com"
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
git add -A
git commit -qm "sync $(TZ=Asia/Shanghai date '+%F %T')" || echo "(无变更)"
git pull --rebase -q origin main || echo "(pull 跳过)"
git push -q origin main
echo "推送完成"

# 3. 确保 Pages 开启且源=main /docs（已存在则 PATCH 切换，不存在则 POST 创建）
BODY='{"source":{"branch":"main","path":"/docs"}}'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" $API/pages)
if [ "$CODE" = "200" ]; then
  curl -s -o /dev/null -X PATCH -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" $API/pages -d "$BODY"
else
  curl -s -o /dev/null -X POST -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" $API/pages -d "$BODY"
fi
sleep 2
curl -s -H "Authorization: token $GH_TOKEN" $API/pages | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Pages 状态:', d.get('status','未知'), '| 源:', (d.get('source') or {}).get('path','?'))
print('>>> 永久链接:', d.get('html_url',''))
"
