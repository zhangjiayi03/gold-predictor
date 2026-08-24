#!/usr/bin/env python3
"""刷新价格基线：LBMA PM 定盘价 → data/price_backfill.json
产出：近60日收盘序列 + 20日市况判定(>2%趋势涨/<-2%趋势跌/其余震荡) + 60日档位分布
用法: python3 baseline.py   （幂等，每日晨间流水线第3步）"""
import json, os, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根（git 克隆内运行，勿用绝对路径）
OUT = f"{ROOT}/data/price_backfill.json"

req = urllib.request.Request("https://prices.lbma.org.uk/json/gold_pm.json",
                             headers={"User-Agent": "Mozilla/5.0"})
raw = json.loads(urllib.request.urlopen(req, timeout=30).read())

# LBMA 返回 [{d: "YYYY-MM-DD", v: [price, ...]}, ...]，v[0] 为价格
rows = [{"date": r["d"], "close": round(float(r["v"][0]), 2)}
        for r in raw if r.get("d") and r.get("v")]
rows = rows[-60:]                                  # 近 60 日
closes = [r["close"] for r in rows]

# 日涨跌幅序列
chgs = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]

# 20 日市况
chg_20d = (closes[-1] - closes[-21]) / closes[-21] * 100 if len(closes) >= 21 else (closes[-1] - closes[0]) / closes[0] * 100
regime = "趋势涨" if chg_20d > 2 else ("趋势跌" if chg_20d < -2 else "震荡")
vol_20d = sum(abs(c) for c in chgs[-20:]) / min(20, len(chgs))

# 60 日档位分布（小≤0.3%＜中≤1%＜大），与预测口径一致
def band(c): return "小" if abs(c) <= 0.3 else ("中" if abs(c) <= 1.0 else "大")
dist = {"小": 0, "中": 0, "大": 0}
for c in chgs: dist[band(c)] += 1
n = len(chgs) or 1
band_dist = {k: f"{v}次 {round(v/n*100)}%" for k, v in dist.items()}

result = {
    "fetched_at": datetime.date.today().isoformat(),
    "series": rows,
    "baseline": {
        "last_close": closes[-1], "last_date": rows[-1]["date"],
        "regime_20d": regime, "chg_20d_pct": round(chg_20d, 2),
        "daily_vol_20d_pct": round(vol_20d, 3),
        "days_collected": len(rows),
        "band_dist_60d": band_dist,
    },
}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
b = result["baseline"]
print(f"基线已刷新: {b['days_collected']}日 末收${b['last_close']}({b['last_date']}) "
      f"20日{b['chg_20d_pct']}%→{b['regime_20d']} 档位分布{band_dist}")
