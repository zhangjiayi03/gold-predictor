#!/bin/bash
# 手动刷新主逻辑：由 .github/workflows/refresh.yml 调用（GitHub Actions），本地也可直接执行
# 流程：限流检查 → 结算昨日 → 采集要闻/金价/VIX → 刷新基线 → 重建面板数据 → 推送部署 Pages
set -e
cd "$(dirname "$0")/.."
REPO="zhangjiayi03/gold-predictor"

echo "== 手动刷新开始 $(TZ=Asia/Shanghai date '+%F %T') =="

# ---- 限流：距上次“实际执行”的成功刷新不足 20 分钟则跳过 ----
# 标记文件 data/last_refresh.json 随数据一起提交，跨运行可靠（勿依赖运行时长判断——实际刷新仅约20秒）
if [ -f data/last_refresh.json ]; then
  LAST_TS=$(python3 -c "import json; print(int(json.load(open('data/last_refresh.json')).get('ts', 0)))" 2>/dev/null || echo 0)
  if [ "$LAST_TS" -gt 0 ]; then
    AGE=$(( ($(date -u +%s) - LAST_TS) / 60 ))
    echo "上次实际刷新：${AGE} 分钟前"
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

# ---- 写刷新标记（随本次数据一起提交，供下次限流判断；部署失败则标记不入库，下次可重试）----
python3 -c "import json, time; json.dump({'ts': int(time.time()), 'time': '$(TZ=Asia/Shanghai date '+%F %T')'}, open('data/last_refresh.json', 'w'), ensure_ascii=False)"

# ---- 同步推送并部署 Pages ----
bash scripts/deploy_github.sh

echo "== 手动刷新完成 =="
