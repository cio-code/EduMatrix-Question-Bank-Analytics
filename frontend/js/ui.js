/** Small UI helpers shared by every step. */
(function () {
  function esc(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toast(message, type) {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      box.className = "no-print";
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, type === "error" ? 7000 : 3500);
  }

  /** Runs fn() while disabling the button; shows errors as a toast instead of crashing. */
  async function run(btn, fn) {
    let label = "";
    if (btn) { label = btn.textContent; btn.disabled = true; btn.textContent = "Working…"; }
    try { return await fn(); }
    catch (e) { toast(e.message || String(e), "error"); }
    finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }

  function statCard(label, value, tone, sub) {
    const tones = { slate: "text-slate-800", indigo: "text-indigo-700", emerald: "text-emerald-600", rose: "text-rose-600", amber: "text-amber-600" };
    return '<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">' +
      '<div class="text-xs text-slate-500">' + esc(label) + "</div>" +
      '<div class="text-2xl font-bold ' + (tones[tone] || tones.slate) + '">' + esc(value) + "</div>" +
      (sub ? '<div class="text-xs text-slate-400">' + esc(sub) + "</div>" : "") + "</div>";
  }

  function badge(text, tone) {
    const tones = {
      green: "bg-emerald-100 text-emerald-700", red: "bg-rose-100 text-rose-700",
      amber: "bg-amber-100 text-amber-700", slate: "bg-slate-100 text-slate-600", indigo: "bg-indigo-100 text-indigo-700"
    };
    return '<span class="inline-block text-xs font-semibold px-2 py-0.5 rounded ' + (tones[tone] || tones.slate) + '">' + esc(text) + "</span>";
  }

  function isVisible(el) { return !!el && el.offsetParent !== null; }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /** Minimal CSV parser (handles quotes, commas and line breaks inside quotes). */
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
    return rows;
  }

  function shortName(n) { return String(n || "").replace(/^(Prof\.|Dr\.)\s*/, ""); }

  window.UI = { esc: esc, toast: toast, run: run, statCard: statCard, badge: badge, isVisible: isVisible, download: download, parseCsv: parseCsv, shortName: shortName };
})();
