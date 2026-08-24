#!/usr/bin/env python3
"""数据采集：Tavily 新闻搜索 + VIX + 实时金价 → data/日期(_pm)_collect.json
用法:
  python3 collect.py            晨间：5 组搜索，存 data/今天_collect.json
  python3 collect.py --pm       午后：2 组搜索，合并晨间快照存 data/今天_pm_collect.json
  python3 collect.py --out 路径  测试用：输出到指定文件，不动正式数据
注意：FRED/yfinance 本网络不可达，勿采集；gold-api 挂了退出码 2（任务层用 AgentEarth 兜底）。"""
import json, sys, os, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根（git 克隆内运行，勿用绝对路径）
BJ = datetime.timezone(datetime.timedelta(hours=8))
TODAY = datetime.datetime.now(BJ).date().isoformat()  # 北京时间日期（沙盒时钟为UTC，直接today()会差8小时）
PM = "--pm" in sys.argv
OUT = sys.argv[sys.argv.index("--out")+1] if "--out" in sys.argv else None

AM_GROUPS = [
    ("市场行情",   "gold price XAU/USD market analysis today", 5),
    ("美联储与美元", "Federal Reserve rate expectations dollar index gold", 5),
    ("地缘政治",   "geopolitical risk news gold safe haven this week", 5),
    ("央行与持仓", "central bank gold buying ETF holdings CFTC positioning", 5),
    ("中国经济",   "China gold demand PBOC gold reserves", 5),
]
PM_GROUPS = [
    ("午后动态", "gold price market now XAU/USD", 4),
    ("午后动态", "Federal Reserve dollar geopolitics gold afternoon", 4),
]

def fetch(url, data=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers=headers or {"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout).read()

# ---- 1. 实时金价 ----
try:
    price = json.loads(fetch("https://api.gold-api.com/price/XAU"))["price"]
    price_obj = {"price": price, "updatedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}
except Exception as e:
    print(f"GOLD_API_FAIL: {e}")
    raise SystemExit(2)

# ---- 2. VIX（CBOE CSV 取尾部 3 行）----
indicators = {"实时金价XAU": price_obj}
try:
    vix = fetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv").decode()
    indicators["VIX"] = [l for l in vix.strip().split("\n") if l][-3:]
except Exception as e:
    indicators["VIX"] = [f"fail: {e}"]

# ---- 3. Tavily 搜索 ----
key = os.environ.get("TAVILY_KEY") or open(f"{ROOT}/config/tavily.key").read().strip()
groups = PM_GROUPS if PM else AM_GROUPS
news = {}
for gname, q, n in groups:
    try:
        body = json.dumps({"query": q, "depth": "basic", "max_results": n}).encode()
        res = json.loads(fetch("https://api.tavily.com/search", data=body,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}))
        items = [{"title": r.get("title",""), "url": r.get("url",""),
                  "content": (r.get("content") or "")[:600]} for r in res.get("results", [])]
    except Exception as e:
        items = [f"fail: {e}"]
    news.setdefault(gname, []).extend(items)
    print(f"[{gname}] {q[:40]}... -> {len(items)} 条")

# ---- 4. 组装保存 ----
if PM:  # 午后：合并晨间快照（存在则继承其 news/indicators）
    src = f"{ROOT}/data/{TODAY}_collect.json"
    if os.path.exists(src):
        base = json.load(open(src))
        merged = {**base.get("news", {}), **news}
        merged_ind = {**base.get("indicators", {}), **indicators}
        news, indicators = merged, merged_ind
data = {"date": TODAY,
        "collected_at_utc": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
        "news": news, "indicators": indicators}
out = OUT or f"{ROOT}/data/{TODAY}{'_pm' if PM else ''}_collect.json"
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"已保存: {out} ｜ 实时金价 ${price:.2f} ｜ 新闻组 {list(news.keys())}")
