/** Step 4 - Select the best items of one course so the exam matches its TOS, optionally reviewed by Groq AI (admin). */
(function () {
  let root, result = null, labelTouched = false;

  const BODY = `
    <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div class="border-b pb-3">
        <h2 class="text-base font-bold text-slate-800">Curation &amp; selection</h2>
        <p class="text-xs text-slate-500">Picks the exam items from the active questions of the selected course so that every ILO and level quota in its TOS is met.</p>
      </div>

      <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 space-y-1">
        <p class="font-bold">How items are chosen</p>
        <ul class="list-disc pl-5 space-y-0.5">
          <li>Only questions of this course are used. Disposed items are never used.</li>
          <li>For each ILO and level, the items with the highest discrimination (D) are taken first; difficulty closest to 0.55 breaks ties.</li>
          <li>If a group does not have enough items, the gap is filled from other levels or ILOs and a warning is shown.</li>
          <li>With AI review on, Groq flags unclear or wrongly keyed items and weak ones are swapped for the next best item.</li>
        </ul>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div class="md:col-span-2"><label for="cur-label" class="lbl">Exam label (used when saving)</label><input id="cur-label" class="inp" maxlength="120"></div>
        <div class="space-y-1 text-xs">
          <label class="flex items-center gap-2"><input id="cur-order" type="checkbox" checked> Shuffle question order</label>
          <label class="flex items-center gap-2"><input id="cur-opts" type="checkbox"> Shuffle option letters</label>
          <label class="flex items-center gap-2"><input id="cur-ai" type="checkbox"> Review with Groq AI (free plan)</label>
        </div>
        <button id="cur-run" class="btn btn-primary justify-center">Run curation</button>
      </div>
      <p class="text-xs text-slate-500">Shuffling option letters is not suitable for items such as "All of the above". The first AI review of 70 items takes about 2 to 4 minutes because the free plan limits tokens per minute; finished reviews are remembered, so later runs are fast. If it pauses, just run curation again.</p>

      <div id="cur-warn"></div>
      <div id="cur-visuals" class="hidden space-y-4">
        <div id="cur-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="border border-slate-200 rounded-xl p-4"><h3 class="text-xs font-bold text-slate-800">Selected vs. TOS quota</h3><p class="text-slate-500 mb-2" style="font-size:10px">How closely the exam matches the blueprint</p><div class="chart-box-sm"><canvas id="c-cur-quota"></canvas></div></div>
          <div class="border border-slate-200 rounded-xl p-4"><h3 class="text-xs font-bold text-slate-800">Level of selected items</h3><p class="text-slate-500 mb-2" style="font-size:10px">Easy / Average / Difficult</p><div class="chart-box-sm"><canvas id="c-cur-cat"></canvas></div></div>
          <div class="border border-slate-200 rounded-xl p-4"><h3 class="text-xs font-bold text-slate-800">Items per contributor</h3><p class="text-slate-500 mb-2" style="font-size:10px">Faculty representation in the exam</p><div class="chart-box-sm"><canvas id="c-cur-fac"></canvas></div></div>
        </div>
        <div class="flex justify-end"><button id="cur-save" class="btn btn-green">Save as exam</button></div>
      </div>

      <div id="cur-list" class="space-y-3"></div>
    </div>`;

  const PLACEHOLDER = '<div class="p-8 text-center text-slate-400 border border-dashed rounded text-sm">Click <strong>Run curation</strong> to build the balanced exam set for this course.</div>';

  function defaultLabel() {
    const name = State.tos ? State.tos.course.course : "Exam";
    return name + " - " + new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function clearResult() {
    result = null;
    root.querySelector("#cur-visuals").classList.add("hidden");
    root.querySelector("#cur-warn").innerHTML = "";
    root.querySelector("#cur-list").innerHTML = PLACEHOLDER;
  }

  function render() {
    const tos = State.tos.rows, items = result.items, sum = result.summary;
    const matches = tos.every((t) => items.filter((i) => i.slotIlo === t.iloCode).length === t.quota);
    const withD = items.filter((i) => i.D !== null);
    const avgD = withD.length ? (withD.reduce((s, i) => s + i.D, 0) / withD.length).toFixed(2) : "N/A";
    const names = new Set(items.map((i) => i.faculty));

    root.querySelector("#cur-warn").innerHTML = result.warnings.length
      ? '<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">' + result.warnings.map((w) => "<div>" + UI.esc(w) + "</div>").join("") + "</div>" : "";

    root.querySelector("#cur-visuals").classList.remove("hidden");
    root.querySelector("#cur-stats").innerHTML =
      UI.statCard("Items selected", items.length, items.length === sum.target ? "emerald" : "amber", "target: " + sum.target) +
      UI.statCard("TOS alignment", matches ? "Exact" : "Adjusted", matches ? "emerald" : "amber", matches ? "all ILO quotas met" : "some gaps filled from other items") +
      UI.statCard("Avg. discrimination", avgD, "indigo", "of selected items") +
      UI.statCard(sum.ai.used ? "AI-reviewed" : "Contributors", sum.ai.used ? sum.ai.reviewed + " new" : names.size, "slate", sum.ai.used ? sum.ai.replaced + " items swapped" : "represented in exam");

    root.querySelector("#cur-list").innerHTML = items.map((q, i) => `
      <div class="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
        <div class="flex flex-wrap justify-between gap-2 font-bold text-slate-800">
          <span>#${i + 1}. [${UI.esc(q.iloCode)}] ${UI.esc(q.category)}</span>
          <span class="flex items-center gap-2 text-indigo-600 font-semibold">Key: ${UI.esc(q.key)} | P: ${q.P === null ? "N/A" : q.P} | D: ${q.D === null ? "N/A" : q.D} | ${UI.esc(q.faculty)}
            ${q.aiVerdict ? UI.badge("AI: " + q.aiVerdict, q.aiVerdict === "ok" ? "green" : q.aiVerdict === "revise" ? "amber" : "red") : ""}</span>
        </div>
        <div class="text-slate-900 font-medium">${UI.esc(q.stem)}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-slate-600">
          ${["A", "B", "C", "D"].map((l) => `<div class="${q.key === l ? "font-bold text-emerald-700" : ""}">${l}) ${UI.esc(q.options[l])}</div>`).join("")}
        </div>
        ${q.aiNotes ? `<div class="text-amber-700">AI note: ${UI.esc(q.aiNotes)}</div>` : ""}
      </div>`).join("");

    if (UI.isVisible(root)) Charts.curation(items.map((i) => Object.assign({}, i, { iloCode: i.slotIlo })), tos);
  }

  async function loadCourse(changed) {
    Data.fillCourseSelect(root.querySelector("#cur-course"));
    const has = !!State.courseId;
    root.querySelector("#cur-empty").classList.toggle("hidden", has);
    root.querySelector("#cur-body").classList.toggle("hidden", !has);
    if (!has) return;
    await Data.tos(true);
    if (changed || (result && result.summary.courseId !== State.courseId)) { clearResult(); labelTouched = false; }
    if (!labelTouched) root.querySelector("#cur-label").value = defaultLabel();
    if (result) render();
  }

  async function sync() { await Data.courses(); await loadCourse(false); }

  window.Steps.curation = {
    mount(el) {
      root = el;
      root.innerHTML = Data.courseBarHtml("cur-course") +
        '<div id="cur-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm">There is no course yet. Create one in Step 1.</div>' +
        '<div id="cur-body">' + BODY + "</div>";
      root.querySelector("#cur-list").innerHTML = PLACEHOLDER;
      root.querySelector("#cur-label").addEventListener("input", () => { labelTouched = true; });

      root.querySelector("#cur-course").onchange = function () {
        Data.setCourse(this.value);
        UI.run(null, () => loadCourse(true));
      };

      root.querySelector("#cur-run").onclick = function () {
        UI.run(this, async () => {
          await Data.tos(true);
          result = await API.call("curate", {
            courseId: State.courseId,
            useAi: root.querySelector("#cur-ai").checked,
            shuffleOrder: root.querySelector("#cur-order").checked,
            shuffleOptions: root.querySelector("#cur-opts").checked
          });
          render();
          UI.toast(result.items.length + " items selected for " + result.summary.course + ".", "success");
        });
      };
      root.querySelector("#cur-save").onclick = function () {
        if (!result) return;
        const label = root.querySelector("#cur-label").value.trim();
        if (!label) { UI.toast("Give the exam a label first.", "error"); return; }
        UI.run(this, async () => {
          const r = await API.call("saveExam", {
            courseId: result.summary.courseId,
            label: label,
            items: result.items.map((i) => ({ questionId: i.questionId, options: i.options, key: i.key }))
          });
          UI.toast("Saved \"" + r.label + "\" as " + r.docNo + " (" + r.count + " items). Open Step 5 to print it.", "success");
        });
      };
    },
    onShow() { UI.run(null, sync); }
  };
})();
