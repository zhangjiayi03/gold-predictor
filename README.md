# 黄金价格每日趋势预测系统

XAU/USD（伦敦金现）每日方向 + 幅度预测，人工审核修正，滚动计分。始建于 2026-08-21。

- **永久面板**：https://zhangjiayi03.github.io/gold-predictor/ （每日自动更新）
- **代码仓库**：https://github.com/zhangjiayi03/gold-predictor

---

## 一、预测口径（核心定义，勿随意改动）

| 项 | 规则 |
|------|------|
| 预测对象 | **当日趋势**：北京时间**当日 06:00 → 次日 06:00** 的 XAU/USD 价格变化（覆盖当日亚欧美全部交易时段，含隔夜美盘）。晨间采集昨夜信息后，预测的就是**"今天"**的走势 |
| 预测窗口 | 报告与日志均以**被预测日=生成当天**命名/记录；次晨 06:30 结算（settle.py 找目标日期=昨天的行回填实际价） |
| 方向 | 涨 / 跌 二分；实际恰好持平时记"平"，该日不计对错 |
| 幅度三档 | 小：\|涨跌幅\| ≤ 0.3%；中：0.3% < \|涨跌幅\| ≤ 1.0%；大：> 1.0% |
| 市况标签 | 按近 20 个交易日自动判定：趋势涨 / 趋势跌 / 震荡（仅分组分析用，不影响计分） |
| 计分规则 | "最终方向/最终幅度档" vs 实际：一致 √，不一致 ×；只算最终列（人工修正后的决策） |
| 留档列 | 模型原始方向/档位仅对照留档，不计分，用于分析模型与人工修正各自贡献 |
| 人工修正 | 报告发出后如改判：改"最终方向/最终幅度档"，并在"人工修正"列记"是" |
| 胜率目标 | 不设硬性目标，按 log.xlsx"统计"表滚动评估 |

## 二、目录结构

```
gold-predictor/
├── README.md                   ← 本手册（操作唯一权威来源）
├── config.json                 ← 参数配置（预测口径/数据源/流水线）
├── log.xlsx                    ← 主日志：预测日志 + 统计 + 说明 三张表
├── config/                     ← 密钥（勿提交、勿外传）
│   ├── tavily.key              ← Tavily 搜索 API key
│   └── gh.token                ← GitHub 令牌（自动部署用）
├── scripts/
│   ├── settle.py               ← 结算昨日预测（实时价→log.xlsx 自动计分+recalc）
│   ├── collect.py              ← 数据采集（--pm 为午后模式），Tavily+VIX+实时价
│   ├── baseline.py             ← 刷新价格基线（LBMA→60日序列+市况+档位分布）
│   ├── build_dashboard.py      ← 刷面板：读 log/data/predictions → 重写 dashboard/
│   └── deploy_github.sh        ← 推 GitHub Pages（令牌自动读 config/gh.token）
├── data/
│   ├── YYYY-MM-DD_collect.json ← 每日晨间采集快照（新闻+指标+实时价）
│   ├── YYYY-MM-DD_pm_collect.json ← 午后补采快照
│   ├── price_backfill.json     ← 近 60 日收盘序列 + 20 日市况 + 档位分布
│   └── usdcny_last.json        ← USD/CNY 汇率缓存
├── predictions/
│   └── YYYY-MM-DD.md           ← 每日预测报告（以被预测日=生成当天命名）
└── dashboard/                  ← 固定面板（构建产物，部署到线上）
    ├── dashboard.html          ← 主页面
    ├── assets/data.js          ← 图表数据（每次刷新重写）
    ├── assets/charts.js        ← 图表逻辑（勿改动）
    └── _shared/                ← 字体 + ECharts 库
```

## 三、每日晨间流水线（定时 06:30，北京时间）

> ⚠️ **时区警告**：沙盒系统时钟是 UTC（比北京时间慢 8 小时）。所有"今天/星期几"判断必须用 `TZ=Asia/Shanghai date` 的结果，禁止直接 `date`，否则周一早晨会被误判成周日。所有日期相关脚本已按北京时间处理。

**周末守卫（最先判断，用 TZ=Asia/Shanghai date +%A）**：黄金周六 05:00 收盘至周一约 06:00 休市。
- 今天是**周六**：只做第 1 步结算 + 第 6 步刷面板部署 + 第 7 步简报（跳过 2-5）
- 今天是**周日**：直接结束
- 周一至周五：完整流程（周一晨结算的是周五的行）

**运行日志**：任务开始时先执行 `echo "$(TZ=Asia/Shanghai date '+%F %T') 晨间任务开始" >> data/runs.log`，每步完成后再追加进度标记——用于诊断定时会话是否真的在工作区执行过。

1. **结算昨日预测**：`python3 scripts/settle.py`——取实时金价填入 log.xlsx"预测日志"中**目标日期=昨天（北京时间）**的行 I 列，J-N 公式自动计分并跑 recalc。无待结算行自动跳过（幂等）。脚本退出码 2 = gold-api 挂了，用 AgentEarth 兜底取价后手动填入。
2. **采集**：`python3 scripts/collect.py`——Tavily 跑 5 组搜索（市场行情/美联储与美元/地缘政治/央行与持仓/中国经济，各 max_results=5）+ VIX 尾部 3 行 + 实时金价，存 `data/今天_collect.json`。退出码 2 = gold-api 挂了，AgentEarth 兜底。FRED/yfinance 本网络不可达，脚本已不采集。
3. **刷新价格基线**：`python3 scripts/baseline.py`——LBMA 重建 `price_backfill.json`（近 60 日收盘 + 20 日市况判定：涨跌幅 >2% 趋势涨、<-2% 趋势跌、其余震荡 + 60 日档位分布）。
4. **推理**：综合价格/指标/新闻/基线，输出对"当日交易日"的预测：方向 + 幅度档 + 置信度 + 驱动摘要。归因参考 WGC：动能 24% / 风险 17% / 汇率利率 14% / 经济 12%，央行购金为结构性支撑。
5. **写报告 + 写日志**：写 `predictions/今天.md`（被预测日=生成当天），小节顺序固定、标题一字不差（构建脚本按标题解析）：
   - `## 📊 预测结论`（结论表）
   - `## 💬 大白话解读`（开头"今天为什么看涨/看跌，讲人话就是："；3-5 条编号理由，每条加粗短语开头 + 通俗类比；最后一条以"要留个心眼"讲最大风险；严禁行话）
   - `## 🔍 信号分解`（利多/利空逐条 + 幅度档依据）
   - `## ⚠️ 人工审核区`
   - `## 数据快照`（注明时间窗口=今天06:00→明晨06:00）

   同时在 log.xlsx"预测日志"下一空行写：**目标日期=今天（被预测的交易日）**、生成时间、基准价=实时价、最终方向/档位、模型原始方向/档位（同值）、人工修正=否、市况标签、驱动摘要。跑 recalc 确保零公式错误。
6. **刷面板 + 部署**：`python3 scripts/build_dashboard.py`（自动取 USD/CNY 汇率换算人民币克价，"大白话解读"渲染到页面顶部）→ `bash scripts/deploy_github.sh` 推 GitHub Pages。部署失败不影响本地，简报注明即可。
7. **简报**：昨日结算结果 + 今日新预测（方向/档位/置信度/一句话理由 + 人民币克价）。

## 四、每日午后复核（定时 15:35，北京时间）

**只复核不新预测、不改日志、不建新日志行。**

**周末守卫（用 TZ=Asia/Shanghai date 判断星期）**：周六/周日，或找不到目标日期=**今天**的在途预测行（今晨生成的当日趋势预测）→ 简报"周末休市，无在途预测"后结束。

1. **午后补采 + 更新快照**：`python3 scripts/collect.py --pm`——取实时金价 + Tavily 跑 2 组（`gold price market now XAU/USD`、`Federal Reserve dollar geopolitics gold afternoon`，max_results=4），自动合并晨间快照（更新实时金价、news 加"午后动态"分组），存 `data/今天_pm_collect.json`。退出码 2 = gold-api 挂了，AgentEarth 兜底。关注当日重大事件落地（FOMC/数据/地缘突发）。
2. 读 log.xlsx 找"目标日期"=**今天**的行（今晨生成的当日趋势预测），取基准价 C、最终方向 D、最终幅度档 E。
3. 计算追踪：当前涨跌幅 =(实时价-基准价)/基准价；方向是否一致、幅度处于哪档、距今日收盘（明晨 06:00）还有约 14.5 小时。
4. 在 `predictions/今天.md` 末尾追加 `### 午后复核` 小节（≤8 行）：复核时间、实时价($与¥/克)、当前涨跌幅、追踪结论（在轨/偏离）、午后新信号一句话、结论（维持原判/建议关注人工修正）。
5. 刷面板 + 部署（同晨间第 6 步）。
6. 简报（≤6 行）：实时价$+¥/克、距基准涨跌%、预测追踪、午后新信号、维持或建议关注。**除非用户明确要求，不得改动 log.xlsx。**

## 五、数据源清单

| 用途 | 来源 | 状态 |
|------|------|------|
| 新闻搜索（主力） | Tavily API（免费 1000 次/月） | ✅ 每日 7 组 |
| 实时金价 | `api.gold-api.com/price/XAU` | ✅ |
| 历史价格基线 | LBMA `prices.lbma.org.uk/json/gold_pm.json` | ✅ |
| VIX | CBOE CSV | ✅ |
| 实际利率 / 美元指数 | FRED DFII10 / yfinance | ❌ 本网络不可达（用新闻替代） |
| 央行购金 | WGC / SAFE 公告（经新闻获取） | ✅ |
| 仓位数据 | CFTC COT（经新闻获取） | ✅ |
| 汇率 USD/CNY | `open.er-api.com`（frankfurter 备用） | ✅ 面板构建时自动取 |
| 兜底 | AgentEarth 插件（按次 credit，仅 gold-api 挂时） | 备用 |

## 六、部署与线上更新

- 部署脚本：`scripts/deploy_github.sh`（令牌读 `config/gh.token`，无需传参）
- 脚本动作：验证令牌 → 仓库存在检查（无则创建）→ 复制 dashboard/ → 补 index.html / 404.html / **.nojekyll**（必须，否则 `_shared` 下划线目录被 Jekyll 忽略导致字体 404）→ 推 main → 确保 Pages 开启
- 线上地址构建约 1-2 分钟生效；晨间/午后任务跑完会自动推送
- **令牌有效期**：若建 token 时选 90 天，约 2026-11 中旬自动部署会失败（面板停更），届时在 GitHub 重新生成并替换 `config/gh.token` 即可；选"永不过期"则无需理会

## 七、维护备忘

- 改动面板样式 → 改 `dashboard/dashboard.html` 或 `assets/charts.js`，再跑 build + deploy
- 改动预测口径 / 档位阈值 → 同步改本 README、config.json、log.xlsx"说明"表、两个定时任务描述（四处保持一致）
- **定时任务"执行了但没产出"的诊断**：先看 `data/runs.log` 有无当天条目——无条目说明定时会话根本没碰过工作区（环境问题）；有条目但中断，按最后标记的步骤排查。当前已知坑：沙盒 UTC 时钟（已全链路改用北京时间判断）
- `dashboard/assets/data.js` 是构建产物，手改会被下次刷新覆盖
- log.xlsx 公式异常时跑：`python3 /data/user/builtin/work/default/skills/xlsx/scripts/recalc.py /workspace/gold-predictor/log.xlsx`
