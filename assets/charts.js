window.DASH_DATA_RENDER = function () {
  var D = window.DASH_DATA || {};
  var s = getComputedStyle(document.documentElement);
  var accent = s.getPropertyValue("--accent").trim();
  var accent2 = s.getPropertyValue("--accent2").trim();
  var ink = s.getPropertyValue("--ink").trim();
  var muted = s.getPropertyValue("--muted").trim();
  var rule = s.getPropertyValue("--rule").trim();
  var bg2 = s.getPropertyValue("--bg2").trim();
  var up = s.getPropertyValue("--up").trim();
  var down = s.getPropertyValue("--down").trim();
  var FONT = '"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';

  function el(id) { return document.getElementById(id); }
  /* 重复渲染前清理旧 DOM 与图表实例（"立即刷新"按钮场景） */
  try {
    ["bull-list", "bear-list", "news-grid"].forEach(function (id) { var e = el(id); if (e) e.innerHTML = ""; });
    var _tb = document.querySelector("#hist-table tbody"); if (_tb) _tb.innerHTML = "";
    Array.prototype.forEach.call(document.querySelectorAll(".pm-box"), function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
    ["chart-price", "chart-change", "chart-accuracy"].forEach(function (id) {
      var e = el(id);
      if (e) { e.innerHTML = ""; if (window.echarts && echarts.getInstanceByDom(e)) { echarts.getInstanceByDom(e).dispose(); } }
    });
  } catch (err) { /* 首次渲染时元素尚不存在，忽略 */ }
  function tag(dir) { return dir === "涨" ? '<span class="tag up">涨</span>' : dir === "跌" ? '<span class="tag down">跌</span>' : '<span class="tag wait">' + dir + "</span>"; }
  function mark(v) { return v === "√" ? '<span class="ok">√</span>' : v === "×" ? '<span class="bad">×</span>' : '<span class="tag wait">待结算</span>'; }
  function bandText(dir, band) {
    if (!band) return "";
    if (band === "小") return dir === "跌" ? "微跌（<0.3%）" : dir === "涨" ? "微涨（<0.3%）" : "小波动";
    if (band === "中") return (dir === "跌" ? "跌" : dir === "涨" ? "涨" : "波动") + " 0.3~1%";
    if (band === "大") return (dir === "跌" ? "大跌" : dir === "涨" ? "大涨" : "波动") + "（>1%）";
    return band;
  }
  var baseAxis = {
    axisLine: { lineStyle: { color: rule } },
    axisLabel: { color: muted, fontFamily: FONT, fontSize: 10 },
    splitLine: { lineStyle: { color: rule, opacity: 0.45 } },
  };

  /* ---------- KPI ---------- */
  var P = D.prediction || {};
  var OZ = 31.1035;
  var FX = D.live && D.live.usdcny ? D.live.usdcny : null;
  function rmb(usd) { return FX && usd ? usd * FX / OZ : null; }
  function weekday(ds) {
    if (!ds) return "";
    var w = ["周日","周一","周二","周三","周四","周五","周六"][new Date(ds).getDay()];
    return isNaN(new Date(ds).getDate()) ? "" : w;
  }
  function prevDay(ds) {
    var d = new Date(ds); if (isNaN(d.getDate())) return "";
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  var tgt = D.nextTarget || "";
  var win0 = tgt ? prevDay(tgt) : "";
  var genDate = (D.history && D.history[0] && D.history[0].gen) ? String(D.history[0].gen).slice(0, 10) : "";
  el("updated").textContent = "更新于 " + (D.updated || "");
  el("next-target").innerHTML = tgt && win0
    ? "最新预测 <b style='color:var(--ink)'>" + win0.slice(5) + "（" + weekday(win0) + "）交易日</b> · " + win0.slice(5) + " 06:00 → " + tgt.slice(5) + " 06:00 收盘结算"
    : "";
  var kv = el("kpi-pred");
  var bt = bandText(P.dir, P.band);
  kv.innerHTML = (P.dir === "涨" ? '<span style="color:var(--up)">↑ 涨</span>' : P.dir === "跌" ? '<span style="color:var(--down)">↓ 跌</span>' : "—") +
    (bt ? '<span style="font-size:.58em;color:var(--muted);margin-left:.35em">' + bt + "</span>" : "");
  kv.className = "val " + (P.dir === "涨" ? "up" : P.dir === "跌" ? "down" : "");
  var predRmb = rmb(P.base);
  el("kpi-pred-sub").textContent = "置信度 " + (P.conf || "—") + "%（模型把握）｜ 基准 $" + (P.base ? P.base.toFixed(0) : "—") + (predRmb ? " ≈ ¥" + predRmb.toFixed(1) + "/克" : "");
  el("kpi-live").innerHTML = D.live && D.live.price ? "$" + D.live.price.toFixed(2) + '<span style="font-size:.62em;color:var(--muted)"> /oz</span>' : "—";
  var liveRmb = rmb(D.live && D.live.price);
  el("kpi-live-sub").innerHTML = (liveRmb ? "<b style='color:var(--ink);font-family:var(--mono)'>¥" + liveRmb.toFixed(2) + "</b> /克 ｜ " : "") + "汇率 " + (FX ? FX.toFixed(4) : "—") + (D.live && D.live.time ? " ｜ " + D.live.time.replace("T", " ").replace("Z", " UTC") : "");
  var rg = P.regime || "—";
  el("kpi-regime").textContent = rg;
  el("kpi-regime").className = "val " + (rg === "趋势涨" ? "up" : rg === "趋势跌" ? "down" : "gold");
  el("kpi-regime-sub").textContent = D.baseline ? "近20日累计 " + D.baseline.chg_20d_pct + "% · 判定：累计涨跌超 ±2% 算趋势市" : "";
  var st = D.stats || {};
  el("kpi-score").textContent = st.settled ? st.dirOK + "/" + st.settled : "待结算";
  el("kpi-score-sub").textContent = st.settled
    ? "方向猜对 " + st.dirOK + " 次 · 幅度档猜对 " + st.bandOK + " 次（共 " + st.settled + " 次已出结果）"
    : "已有 " + (st.total || 0) + " 条预测，第一条结果明天早上出炉";

  /* ---------- 大白话解读（顶部） ---------- */
  var plainBox = el("plain-box");
  if (plainBox) {
    var pt = el("plain-title"), pl = el("plain-list");
    var dirCn = P.dir === "涨" ? "看涨" : P.dir === "跌" ? "看跌" : "—";
    pt.innerHTML = "💬 今天为什么" + dirCn + "？" + tag(P.dir || "—") + ' <span class="tag regime">置信度 ' + (P.conf || "—") + "%</span>";
    pl.innerHTML = "";
    var plainSrc = P.plain || P.drivers || "";
    if (plainSrc) {
      plainSrc.split("｜").forEach(function (t) {
        t = t.replace(/^\d+\.\s*/, "").trim();
        if (!t || t.indexOf("今天为什么") === 0) return;
        var li = document.createElement("li");
        if (/要留个心眼|风险|留神|小心/.test(t)) li.className = "risk";
        pl.appendChild(li).textContent = t;
      });
      if (!pl.children.length) pl.innerHTML = "<li>" + plainSrc + "</li>";
    } else {
      pl.innerHTML = "<li style='color:var(--muted)'>当日大白话解读尚未生成，详见下方预测依据。</li>";
    }
  }

  /* ---------- 预测详情 ---------- */
  var dirWord = P.dir === "涨" ? '<span style="color:var(--up)">上涨</span>' : P.dir === "跌" ? '<span style="color:var(--down)">下跌</span>' : (P.dir || "—");
  var magWord = { 小: "幅度很小（±0.3% 以内）", 中: "幅度中等（0.3% ~ 1%）", 大: "幅度较大（超过 1%）" }[P.band] || "";
  el("pred-head").innerHTML =
    "<b style='font-size:1.06em;color:var(--ink)'>" + (win0 || tgt) + "（" + weekday(win0 || tgt) + "）预计：" + dirWord + "</b>" +
    (magWord ? "，" + magWord : "") + " · 置信度 " + (P.conf || "—") + "%" +
    ((P.mdir && (P.mdir !== P.dir || P.mband !== P.band)) ? ' <span class="tag wait">人工修正自：' + P.mdir + "/" + P.mband + "</span>" : "") +
    (win0 && tgt ? '<br><span style="font-size:.78rem;color:var(--muted)">结算区间：' + win0 + " 06:00 → " + tgt + " 06:00（北京时间，覆盖当天亚欧美全部交易时段）· 当前市况：" + (P.regime || "—") + "</span>" : "");
  el("pred-drivers").textContent = ""; /* 专业摘要默认不展示，大白话见顶部解读框，术语见词典 */
  if (P.pm) {
    var pmBox = document.createElement("div");
    pmBox.className = "pm-box";
    pmBox.style.cssText = "margin-top:.7rem;padding:.55rem .75rem;border:1px dashed var(--accent);border-radius:8px;font-size:.8rem;line-height:1.55";
    pmBox.innerHTML = "<b style='color:var(--accent)'>☀ 午后复核</b>｜" + P.pm;
    el("pred-drivers").parentNode.appendChild(pmBox);
  }
  /* ---------- 预测依据 ---------- */
  var newsGroups = (D.news || []).length;
  var newsTotal = (D.news || []).reduce(function (n, g) { return n + (g.items || []).length; }, 0);
  var B = D.baseline || {};
  var bd = B.band_dist_60d || {};
  var facts = [];
  if (newsTotal) facts.push("<b>" + newsGroups + " 组信息流</b>，共 <b>" + newsTotal + " 条</b>要闻（原文链接见页面底部）");
  if (B.chg_20d_pct != null) facts.push("近 20 日累计 <b>" + (B.chg_20d_pct > 0 ? "+" : "") + B.chg_20d_pct + "%</b>，市况判定「" + (B.regime_20d || "—") + "」" + (B.daily_vol_20d_pct != null ? "，平均日波动 " + B.daily_vol_20d_pct + "%" : ""));
  if (bd["大"]) facts.push("近 60 交易日幅度分布：大波动日 <b>" + bd["大"] + "</b>、中 " + (bd["中"] || "—") + "、小 " + (bd["小"] || "—") + "（幅度档判断的历史参照）");
  facts.push("信号清单：利多 <b>" + (P.bulls || []).length + " 条</b> · 利空 <b>" + (P.bears || []).length + " 条</b>（见下方）");
  if (D.live && D.live.price) { var lr = rmb(D.live.price); facts.push("实时锚点 <b>$" + D.live.price.toFixed(0) + "</b>" + (lr ? " ≈ ¥" + lr.toFixed(1) + "/克" : "") + "，预测基准价 <b>$" + (P.base ? P.base.toFixed(0) : "—") + "</b>"); }
  el("basis-data").innerHTML = facts.map(function (t) { return "<li>" + t + "</li>"; }).join("");
  el("bull-cnt").textContent = "（" + (P.bulls || []).length + " 条）";
  el("bear-cnt").textContent = "（" + (P.bears || []).length + " 条）";
  el("basis-conclusion").textContent = P.drivers || "（暂无专业摘要）";
  var repLink = el("basis-report");
  if (tgt) { repLink.href = "../predictions/" + tgt + ".md"; repLink.textContent = "查看 " + tgt + " 完整分析报告 →"; }

  (P.bulls || []).forEach(function (t) { var li = document.createElement("li"); li.innerHTML = "<b>▲</b> " + t; el("bull-list").appendChild(li); });
  (P.bears || []).forEach(function (t) { var li = document.createElement("li"); li.innerHTML = "<b>▼</b> " + t; el("bear-list").appendChild(li); });
  if (!(P.bulls || []).length) el("bull-list").innerHTML = '<li style="color:var(--muted)">暂未解析到结构化利多条目，理由见上方驱动摘要</li>';
  if (!(P.bears || []).length) el("bear-list").innerHTML = '<li style="color:var(--muted)">暂未解析到结构化利空条目，理由见上方驱动摘要</li>';

  /* ---------- 历史表 ---------- */
  var tb = document.querySelector("#hist-table tbody");
  (D.history || []).forEach(function (r) {
    var tr = document.createElement("tr");
    function duo(usd) { return usd ? "$" + usd.toFixed(0) + (rmb(usd) ? '<br><span style="color:var(--muted);font-size:.9em">¥' + rmb(usd).toFixed(1) + "/克</span>" : "") : "—"; }
    tr.innerHTML = "<td>" + r.date + "</td>" +
      "<td>" + tag(r.fdir) + ' <b style="color:var(--accent)">' + (r.fband || "—") + "</b>" +
        (r.manual === "是" ? ' <span class="tag wait" title="你在模型判断基础上手动改过">人工改</span>' : "") +
        ((r.mdir && (r.mdir !== r.fdir || r.mband !== r.fband)) ? '<br><span style="color:var(--muted);font-size:.9em">模型原判 ' + r.mdir + "/" + r.mband + "</span>" : "") +
      "</td>" +
      "<td class='num'>" + duo(r.base) + "</td>" +
      "<td class='num'>" + duo(r.actual) + "</td>" +
      "<td class='num' style='color:" + (r.pct > 0 ? up : r.pct < 0 ? down : muted) + "'>" + (r.pct != null ? (r.pct > 0 ? "+" : "") + r.pct + "%" : "—") + "</td>" +
      "<td style='white-space:nowrap'>方向 " + mark(r.dok) + " ｜ 幅度 " + mark(r.bok) + "</td>" +
      "<td><span class='tag regime'>" + (r.regime || "—") + "</span></td>" +
      "<td class='drv'>" + (r.drivers || "") + "</td>";
    tb.appendChild(tr);
  });

  /* ---------- 新闻 ---------- */
  (D.news || []).forEach(function (g) {
    var div = document.createElement("div");
    div.className = "card news";
    var h = document.createElement("h3"); h.textContent = g.cat; div.appendChild(h);
    g.items.forEach(function (n) {
      var a = document.createElement("a");
      a.href = n.u; a.target = "_blank"; a.rel = "noopener"; a.textContent = n.t; a.title = n.t;
      div.appendChild(a);
    });
    el("news-grid").appendChild(div);
  });

  /* ---------- 图1 价格 ---------- */
  var ps = D.priceSeries || [];
  var priceData = ps.map(function (x) { return [x.date, x.close]; });
  if (D.live && D.live.price) {
    var ld = (D.live.time || "").slice(0, 10);
    if (ld) priceData.push([ld + " 实时", D.live.price]);
  }
  var c1 = echarts.init(el("chart-price"), null, { renderer: "svg" });
  var closes = priceData.map(function (d) { return d[1]; });
  var pMin = Math.min.apply(null, closes), pMax = Math.max.apply(null, closes);
  var pad = (pMax - pMin) * 0.06 || pMax * 0.02;
  pMin -= pad; pMax += pad;
  c1.setOption({
    animation: false, textStyle: { fontFamily: FONT },
    grid: { left: 58, right: 64, top: 18, bottom: 44 },
    tooltip: { trigger: "axis", appendToBody: true, backgroundColor: "#12141b", borderColor: "#2a2f3d", textStyle: { color: ink, fontFamily: FONT, fontSize: 12 },
      formatter: function (ps) { var p = ps[0]; var v = p.value; var y = rmb(v); return p.name + "<br><b>$" + v.toFixed(2) + "</b> /盎司" + (y ? "<br><b style='color:" + accent + "'>¥" + y.toFixed(2) + "</b> /克" : ""); } },
    xAxis: { type: "category", data: priceData.map(function (d) { return d[0]; }), axisLine: baseAxis.axisLine, axisLabel: { color: muted, fontFamily: FONT, fontSize: 11, interval: Math.max(0, Math.floor(priceData.length / 6) - 1) }, axisTick: { show: false } },
    yAxis: [
      { type: "value", min: pMin, max: pMax, axisLabel: { color: muted, fontFamily: FONT, fontSize: 10, formatter: "${value}" }, splitLine: baseAxis.splitLine },
      { type: "value", min: rmb(pMin), max: rmb(pMax), axisLabel: { color: accent, fontFamily: FONT, fontSize: 10, formatter: function (v) { return "¥" + v.toFixed(0); } }, splitLine: { show: false } }
    ],
    series: [{
      type: "line", data: closes, smooth: true, symbol: "none",
      lineStyle: { color: accent, width: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: accent + "55" }, { offset: 1, color: accent + "05" }] } },
      markPoint: { data: [{ type: "max", name: "高" }, { type: "min", name: "低" }], itemStyle: { color: accent2 }, label: { color: ink, fontFamily: FONT, fontSize: 10, formatter: function (p) { return p.value.toFixed(0); } } },
    }],
  });

  /* ---------- 图2 涨跌幅 ---------- */
  var ch = D.dailyChanges || [];
  var c2 = echarts.init(el("chart-change"), null, { renderer: "svg" });
  c2.setOption({
    animation: false, textStyle: { fontFamily: FONT },
    grid: { left: 44, right: 12, top: 18, bottom: 44 },
    tooltip: { trigger: "axis", appendToBody: true, backgroundColor: "#12141b", borderColor: "#2a2f3d", textStyle: { color: ink, fontFamily: FONT, fontSize: 12 }, formatter: function (p) { return p[0].name + "<br>" + (p[0].value > 0 ? "+" : "") + p[0].value + "%"; } },
    xAxis: { type: "category", data: ch.map(function (d) { return d[0]; }), axisLine: baseAxis.axisLine, axisLabel: { color: muted, fontFamily: FONT, fontSize: 9, interval: Math.max(0, Math.floor(ch.length / 5) - 1), rotate: 30 }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: baseAxis.axisLabel, splitLine: baseAxis.splitLine },
    series: [{
      type: "bar", data: ch.map(function (d) { return d[1]; }),
      itemStyle: { color: function (p) { return p.value >= 0 ? up : down; } },
      barWidth: "62%",
    }],
  });

  /* ---------- 图3 正确率 ---------- */
  var A = D.accuracy || {};
  var target = el("chart-accuracy");
  if ((A.dates || []).length) {
    var c3 = echarts.init(target, null, { renderer: "svg" });
    c3.setOption({
      animation: false, textStyle: { fontFamily: FONT },
      grid: { left: 44, right: 16, top: 30, bottom: 30 },
      legend: { data: ["方向正确率", "档位正确率"], textStyle: { color: muted, fontFamily: FONT, fontSize: 11 }, top: 0 },
      tooltip: { trigger: "axis", appendToBody: true, backgroundColor: "#12141b", borderColor: "#2a2f3d", textStyle: { color: ink, fontFamily: FONT, fontSize: 12 } },
      xAxis: { type: "category", data: A.dates, axisLine: baseAxis.axisLine, axisLabel: baseAxis.axisLabel, axisTick: { show: false } },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: baseAxis.axisLabel, splitLine: baseAxis.splitLine },
      series: [
        { name: "方向正确率", type: "line", data: A.dir, smooth: true, symbolSize: 6, lineStyle: { color: accent, width: 2 }, itemStyle: { color: accent } },
        { name: "档位正确率", type: "line", data: A.band, smooth: true, symbolSize: 6, lineStyle: { color: accent2, width: 2 }, itemStyle: { color: accent2 }, markLine: { silent: true, symbol: "none", lineStyle: { color: muted, type: "dashed" }, data: [{ yAxis: 50, label: { formatter: "50% 基准", color: muted, fontFamily: FONT, fontSize: 10 } }] } },
      ],
    });
    window.addEventListener("resize", function () { c3.resize(); });
  } else {
    target.innerHTML = '<div class="empty-note">首条预测（' + (D.nextTarget || "") + '）结算后，此处开始绘制累计正确率曲线。<br>虚线为 50% 随机基准——长期跑赢它，系统才算有效。</div>';
  }

  [c1, c2].forEach(function (c) { window.addEventListener("resize", function () { c.resize(); }); });
};

/* 兼容旧加载顺序：若 data.js 先于本脚本加载则立即渲染一次；新加载器会主动调用 window.DASH_DATA_RENDER() */
if (window.DASH_DATA) { try { window.DASH_DATA_RENDER(); } catch (e) { console.error(e); } }
