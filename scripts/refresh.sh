#!/bin/bash
# 手动刷新主逻辑：由 .github/workflows/refresh.yml 调用（GitHub Actions），本地也可直接执行
# 流程：限流检查 → 结算昨日 → 采集要闻/金价/VIX → 刷新基线 → 重建面板数据 → 推送部署 Pages
set -e
cd "$(dirname "$0")/.."
REPO="zhangjiayi03/gold-predictor"

echo "== 手动刷新开始 $(TZ=Asia/Shanghai date '+%F %T') =="

# ---- 限流：距上次“实际执行”的成功刷新不足 20 分钟则跳过 ----
# 跳过型运行耗时 <60s，用运行时长 >60s 过滤，避免跳过记录不断顺延限流窗口
if [ -n "$GH_TOKEN" ] && command -v gh >/dev/null 2>&1; then
  LAST=$(gh api "repos/$REPO/actions/workflows/refresh.yml/runs?status=success&per_page=8" \
    --jq '[.workflow_runs[] | select((.updated_at|fromdateiso8601) - (.created_at|fromdateiso8601) > 60)][0].created_at // empty' 2>/dev/null || true)
  if [ -n "$LAST" ]; then
    AGE=$(( ($(date -u +%s) - $(date -u -d "$LAST" +%s)) / 60 ))
    echo "上次实际刷新：$LAST（${AGE} 分钟前）"
    if [ "$AGE" -lt 20 ]; then
      echo "SKIP：距上次刷新不足 20 分钟，本次不做任何变更（面板数据仍为最新）。"
      exit 0
    fi
  fi
fi

# ---- 结算昨日预测（如有待结算行）----
python3 scripts/settle.py || echo "结算跳过（无待结算行或金价接口不可用）"

# ---- 采集最新数据（要闻 + VIX + 实时金价；缺 TAVILY_KEY 时自动降级只采价格）----
python3 scripts/collect.py
# 当天已有午后快照时再跑一次 --pm 合并，保证面板拿到最新实时价与午后动态
if [ -f "data/$(TZ=Asia/Shanghai date +%F)_pm_collect.json" ]; then python3 scripts/collect.py --pm; fi

# ---- 刷新价格基线（LBMA）----
python3 scripts/baseline.py || echo "基线刷新失败，沿用旧数据"

# ---- 重建面板数据 ----
python3 scripts/build_dashboard.py

# ---- 同步推送并部署 Pages ----
bash scripts/deploy_github.sh

echo "== 手动刷新完成 =="
