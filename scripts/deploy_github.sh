#!/bin/bash
# 同步项目到 GitHub（仓库=唯一事实源）：dashboard 构建产物复制到仓库根、提交全部变更、推送
# Pages 源=main 根目录（已验证可用；曾尝试 PATCH 切 /docs 返回 404，弃用该方案）
# 运行前提：当前目录是本仓库的 git 克隆（手动会话=/workspace/gold-predictor，定时会话=克隆目录）
# 密钥：环境变量 GH_TOKEN 优先，其次 config/gh.token（.gitignore 排除，不入库）
set -e
cd "$(dirname "$0")/.."
GH_TOKEN="${GH_TOKEN:-$(cat config/gh.token 2>/dev/null || true)}"
[ -z "$GH_TOKEN" ] && { echo "缺少 GH_TOKEN（环境变量或 config/gh.token）"; exit 1; }
REPO="zhangjiayi03/gold-predictor"
API="https://api.github.com/repos/$REPO"

# git 走环境代理（TRAE 沙盒已有 http_proxy/https_proxy 环境变量，git/libcurl 自动识别；
# GitHub Actions 运行器无代理环境变量则直连，均无需额外配置）

# 1. dashboard 构建产物 → 仓库根（Pages 源=根目录）
rm -rf docs
cp -f dashboard/dashboard.html dashboard.html
rm -f index.html && cp dashboard/dashboard.html index.html
mkdir -p assets _shared
cp -rf dashboard/assets/. assets/
cp -rf dashboard/_shared/. _shared/
touch .nojekyll   # 必须：否则 _shared 下划线目录被 Jekyll 忽略导致字体 404
printf '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/gold-predictor/"><title>跳转中</title></head><body></body></html>' > 404.html

# 2. 提交全部变更并推送（.gitignore 自动排除密钥）
git config user.name "gold-predictor-bot"
git config user.email "zhangjiayi03@users.noreply.github.com"
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
git add -A
git commit -qm "sync $(TZ=Asia/Shanghai date '+%F %T')" || echo "(无变更)"
git pull --rebase -q origin main || echo "(pull 跳过)"
git push -q origin main
echo "推送完成"

# 3. 确保 Pages 开启（源保持 main 根目录；已存在返回 409 属正常）
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" $API/pages)
if [ "$CODE" = "404" ]; then
  curl -s -o /dev/null -X POST -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" $API/pages -d '{"source":{"branch":"main","path":"/"}}'
fi
sleep 2
curl -s -H "Authorization: token $GH_TOKEN" $API/pages | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Pages 状态:', d.get('status','未知'), '| 源:', (d.get('source') or {}).get('path','?'))
print('>>> 永久链接:', d.get('html_url',''))
"
