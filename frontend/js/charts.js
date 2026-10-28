/** All Chart.js visuals. Each function expects the canvases that its step creates. */
(function () {
  const C = { indigo: "#4f46e5", indigoLight: "#a5b4fc", emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e", sky: "#0ea5e9", slate: "#94a3b8", violet: "#8b5cf6" };
  const CAT = { Easy: C.emerald, Average: C.amber, Difficult: C.rose };
  const ILO = [C.indigo, C.sky, C.violet, C.emerald, C.amber, C.rose];
  const cats = ["Easy", "Average", "Difficult"];

  if (window.Chart) {
    Chart.defaults.font.family = "Inter, system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = "#475569";
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
  }

  const live = {};
  function draw(id, config) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    if (live[id]) live[id].destroy();
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false }, config.options || {});
    live[id] = new Chart(el, config);
  }
  const legendBottom = { legend: { position: "bottom" } };

  function tos(rows) {
    const labels = rows.map(function (t) { return t.iloCode; });
    draw("c-tos-weight", {
      type: "doughnut",
      data: { labels: labels, datasets: [{ data: rows.map(function (t) { return t.hours; }), backgroundColor: ILO, borderWidth: 2, borderColor: "#fff" }] },
      options: { cutout: "60%", plugins: { legend: { position: "bottom" },
        tooltip: { callbacks: { label: function (c) { return " " + c.label + ": " + c.parsed + " h (" + rows[c.dataIndex].quota + " items)"; } } } } }
    });
    draw("c-tos-cog", {
      type: "bar",
      data: { labels: labels, datasets: cats.map(function (c) { return { label: c, data: rows.map(function (t) { return t[c.toLowerCase()]; }), backgroundColor: CAT[c] }; }) },
      options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legendBottom }
    });
    draw("c-tos-hours", {
      type: "bar",
      data: { labels: labels, datasets: [
        { label: "Hours", data: rows.map(function (t) { return t.hours; }), backgroundColor: C.indigoLight, yAxisID: "y" },
        { label: "Items", data: rows.map(function (t) { return t.quota; }), backgroundColor: C.indigo, yAxisID: "y1" }] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, position: "left", title: { display: true, text: "Hours" } },
        y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Items" } } }, plugins: legendBottom }
    });
  }

  function pool(questions, tosRows) {
    const active = questions.filter(function (q) { return q.status !== "Disposed"; });
    draw("c-pool-cov", {
      type: "bar",
      data: { labels: tosRows.map(function (t) { return t.iloCode; }), datasets: [
        { label: "Active items", data: tosRows.map(function (t) { return active.filter(function (q) { return q.iloCode === t.iloCode; }).length; }), backgroundColor: C.indigo },
        { label: "Items needed", data: tosRows.map(function (t) { return t.quota; }), backgroundColor: C.slate }] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legendBottom }
    });
    draw("c-pool-cat", {
      type: "doughnut",
      data: { labels: cats, datasets: [{ data: cats.map(function (c) { return active.filter(function (q) { return q.category === c; }).length; }), backgroundColor: cats.map(function (c) { return CAT[c]; }), borderWidth: 2, borderColor: "#fff" }] },
      options: { cutout: "60%", plugins: legendBottom }
    });
    const names = Array.from(new Set(questions.map(function (q) { return q.faculty; })));
    draw("c-pool-fac", {
      type: "bar",
      data: { labels: names.map(UI.shortName), datasets: [
        { label: "Active", data: names.map(function (f) { return questions.filter(function (q) { return q.faculty === f && q.status !== "Disposed"; }).length; }), backgroundColor: C.emerald },
        { label: "Disposed", data: names.map(function (f) { return questions.filter(function (q) { return q.faculty === f && q.status === "Disposed"; }).length; }), backgroundColor: C.rose }] },
      options: { indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false } } }, plugins: legendBottom }
    });
  }

  function analysis(questions) {
    const a = questions.filter(function (q) { return q.P !== null && q.D !== null; });
    if (!a.length) return;
    const kept = a.filter(function (q) { return q.status !== "Disposed"; });
    const bins = new Array(10).fill(0);
    a.forEach(function (q) { bins[Math.min(9, Math.floor(q.P * 10))]++; });
    draw("c-an-hist", {
      type: "bar",
      data: { labels: bins.map(function (_, i) { return (i / 10).toFixed(1) + "–" + ((i + 1) / 10).toFixed(1); }),
        datasets: [{ label: "Items", data: bins, backgroundColor: bins.map(function (_, i) { return i >= 3 && i <= 7 ? C.emerald : C.amber; }), borderRadius: 3 }] },
      options: { scales: { x: { grid: { display: false }, title: { display: true, text: "Difficulty index (P)" }, ticks: { maxRotation: 60, minRotation: 45 } },
        y: { beginAtZero: true, title: { display: true, text: "Items" }, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
    });
    const refLine = { id: "dLine", afterDraw: function (chart) {
      const ctx = chart.ctx, area = chart.chartArea, y = chart.scales.y.getPixelForValue(0.2);
      ctx.save(); ctx.strokeStyle = C.rose; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(area.left, y); ctx.lineTo(area.right, y); ctx.stroke(); ctx.restore();
    } };
    draw("c-an-scatter", {
      type: "scatter",
      data: { datasets: [
        { label: "Retained", data: kept.map(function (q) { return { x: q.P, y: q.D }; }), backgroundColor: C.emerald, pointRadius: 4 },
        { label: "Disposed", data: a.filter(function (q) { return q.status === "Disposed"; }).map(function (q) { return { x: q.P, y: q.D }; }), backgroundColor: C.rose, pointRadius: 4 }] },
      options: { scales: { x: { min: 0, max: 1, title: { display: true, text: "Difficulty (P)" } }, y: { min: -0.2, max: 0.8, title: { display: true, text: "Discrimination (D)" } } }, plugins: legendBottom },
      plugins: [refLine]
    });
    const names = Array.from(new Set(a.map(function (q) { return q.faculty; })));
    draw("c-an-fac", {
      type: "bar",
      data: { labels: names.map(UI.shortName), datasets: [
        { label: "Retained", data: names.map(function (f) { return a.filter(function (q) { return q.faculty === f && q.status !== "Disposed"; }).length; }), backgroundColor: C.emerald },
        { label: "Disposed", data: names.map(function (f) { return a.filter(function (q) { return q.faculty === f && q.status === "Disposed"; }).length; }), backgroundColor: C.rose }] },
      options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: legendBottom }
    });
  }

  function curation(items, tosRows) {
    draw("c-cur-quota", {
      type: "bar",
      data: { labels: tosRows.map(function (t) { return t.iloCode; }), datasets: [
        { label: "TOS quota", data: tosRows.map(function (t) { return t.quota; }), backgroundColor: C.slate },
        { label: "Selected", data: tosRows.map(function (t) { return items.filter(function (i) { return i.iloCode === t.iloCode; }).length; }), backgroundColor: C.indigo }] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: legendBottom }
    });
    draw("c-cur-cat", {
      type: "doughnut",
      data: { labels: cats, datasets: [{ data: cats.map(function (c) { return items.filter(function (i) { return i.category === c; }).length; }), backgroundColor: cats.map(function (c) { return CAT[c]; }), borderWidth: 2, borderColor: "#fff" }] },
      options: { cutout: "60%", plugins: legendBottom }
    });
    const names = Array.from(new Set(items.map(function (i) { return i.faculty; })));
    draw("c-cur-fac", {
      type: "bar",
      data: { labels: names.map(UI.shortName), datasets: [{ label: "Items in exam", data: names.map(function (f) { return items.filter(function (i) { return i.faculty === f; }).length; }), backgroundColor: C.violet, borderRadius: 3 }] },
      options: { indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
  }

  window.Charts = { tos: tos, pool: pool, analysis: analysis, curation: curation };
})();
