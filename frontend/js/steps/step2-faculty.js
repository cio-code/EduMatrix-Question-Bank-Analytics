/**
 * Faculty side of Step 2: the "Contributor Repository" (Question Contribution Portal).
 * One expandable section per ILO showing its quota and the Easy / Average / Difficult counts,
 * a question form inside each section, and a contribution summary at the bottom.
 * It replaces js/steps/step2-pool.js for the faculty role (see app.js). Admin keeps step2-pool.js.
 */
(function () {
  const esc = UI.esc;
  const LEVELS = [
    { key: "Easy", label: "Easy (Remember / Understand)" },
    { key: "Average", label: "Average (Apply / Analyze)" },
    { key: "Difficult", label: "Difficult (Evaluate / Create)" }
  ];
  const TONE = {
    done: "bg-emerald-100 border-emerald-300 text-emerald-900",
    some: "bg-amber-100 border-amber-300 text-amber-900",
    none: "bg-slate-200 border-slate-300 text-slate-800"
  };

  let root, tos = null, questions = [], builtFor = "";
  const open = {};       // which ILO sections are expanded
  let counts = {};       // counts[iloCode][level] = my active questions

  // ------------------------------------------------------------------ counting
  const need = (t, level) => Number(t[level.toLowerCase()]) || 0;

  function countAll() {
    counts = {};
    tos.rows.forEach((t) => { counts[t.iloCode] = { Easy: 0, Average: 0, Difficult: 0 }; });
    questions.forEach((q) => {
      if (q.status !== "Disposed" && counts[q.iloCode]) counts[q.iloCode][q.category]++;
    });
  }

  // Only up to the quota counts as progress; extra questions are welcome but do not push the bar past 100%.
  const doneOf = (t) => LEVELS.reduce((s, L) => s + Math.min(counts[t.iloCode][L.key], need(t, L.key)), 0);
  const isComplete = (t) => LEVELS.every((L) => counts[t.iloCode][L.key] >= need(t, L.key));
  const toneOf = (t) => (isComplete(t) ? "done" : doneOf(t) > 0 ? "some" : "none");

  function chip(label, have, want) {
    const cls = have >= want ? "bg-emerald-600 text-white" : have > 0 ? "bg-amber-500 text-white" : "bg-slate-500 text-white";
    return `<span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}">${label} ${have}/${want}</span>`;
  }

  // ------------------------------------------------------------------ markup
  function sectionHtml(t, i) {
    const code = esc(t.iloCode);
    return `
    <section class="ilo" data-ilo="${code}">
      <button type="button" class="ilo-head w-full text-left rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-expanded="false"></button>
      <div class="ilo-body hidden bg-white border border-slate-200 rounded-b-lg px-4 py-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-5">
            <label class="lbl">Question</label>
            <textarea class="inp f-stem" rows="3" maxlength="1000" placeholder="Enter question stem here..."></textarea>
          </div>
          <div class="md:col-span-3">
            <label class="lbl">Cognitive Level</label>
            <select class="inp f-cat"></select>
          </div>
          <div class="md:col-span-4">
            <label class="lbl">AI Validation</label>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-light btn-ai">Run AI Check (Pass/Fail)</button>
              <span class="ai-dot inline-block w-3 h-3 rounded-full bg-slate-300" title="Not checked yet"></span>
            </div>
            <div class="ai-note text-xs mt-1 text-slate-500">Optional. The check is advice only; you can still submit.</div>
          </div>
        </div>

        <div>
          <label class="lbl">Options A-D</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            ${["A", "B", "C", "D"].map((l) => `
            <div class="flex items-center gap-2">
              <span class="font-semibold text-xs w-4">${l}:</span>
              <input class="inp f-opt" data-l="${l}" maxlength="300" placeholder="Option ${l}" aria-label="Option ${l}">
              <label class="flex items-center gap-1 text-xs whitespace-nowrap"><input type="radio" name="key-${i}" value="${l}"> Correct Key</label>
            </div>`).join("")}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-primary btn-submit">Submit to ${code} Bank</button>
          <button type="button" class="btn btn-light btn-cancel hidden">Cancel edit</button>
        </div>

        <div class="status rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs px-3 py-2"></div>

        <details class="mine">
          <summary class="text-xs font-semibold cursor-pointer text-slate-700">Your questions in ${code} (<span class="mine-n">0</span>)</summary>
          <div class="mine-list space-y-2 mt-2"></div>
        </details>
      </div>
    </section>`;
  }

  function shell() {
    return `
    <div id="fp-banner" class="rounded-xl text-white px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2 no-print" style="background:#14213d">
      <div class="flex items-center gap-2 text-sm">Course:
        <select id="fp-course" class="inp" style="width:auto;min-width:16rem;font-size:.8rem"></select>
      </div>
      <div class="text-sm">Academic Year: <span id="fp-year" class="font-semibold"></span></div>
      <div class="flex-1" style="min-width:16rem">
        <div id="fp-overall-text" class="text-sm font-semibold"></div>
        <div class="meter-track"><div id="fp-overall-bar" class="meter-fill" style="width:0%;background:#34d399"></div></div>
      </div>
    </div>

    <div id="fp-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm">
      There is no course yet. The administrator or GECAC creates a course in Step 1 (Course &amp; title and its TOS) before questions can be added.
    </div>

    <div id="fp-body" class="space-y-3">
      <p class="text-xs text-slate-500">Quota is the number of items the exam needs from each ILO and level. Only your own questions are counted. You may add more than the quota: extra questions give the curation more to choose from.</p>
      <div id="fp-accordion" class="space-y-3"></div>

      <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 class="text-sm font-bold text-slate-800 mb-2">Contribution Summary by ILO</h3>
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead><tr class="text-left text-slate-500">
            <th class="py-1 pr-3">ILO</th><th class="py-1 pr-3">Easy</th><th class="py-1 pr-3">Average</th><th class="py-1 pr-3">Difficult</th><th class="py-1">Total</th>
          </tr></thead>
          <tbody id="fp-summary"></tbody>
        </table></div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ rendering
  const secOf = (code) => [...root.querySelectorAll("section.ilo")].find((s) => s.dataset.ilo === code);

  function renderHead(sec) {
    const t = tos.rows.find((r) => r.iloCode === sec.dataset.ilo);
    const c = counts[t.iloCode], done = doneOf(t);
    const head = sec.querySelector(".ilo-head");
    head.className = "ilo-head w-full text-left rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm " + TONE[toneOf(t)];
    head.setAttribute("aria-expanded", open[t.iloCode] ? "true" : "false");
    head.innerHTML =
      `<span aria-hidden="true">${open[t.iloCode] ? "&#9662;" : "&#9656;"}</span>` +
      `<span class="font-semibold flex-1" style="min-width:14rem">${esc(t.iloCode)}. ${esc(t.ilo)} <span class="font-normal">(Quota: ${t.quota} items)</span></span>` +
      `<span class="flex flex-wrap items-center gap-1">${LEVELS.map((L) => chip(L.key, c[L.key], need(t, L.key))).join("")}</span>` +
      `<span class="font-bold text-sm">${done}/${t.quota}</span>`;
  }

  function renderLevels(sec) {
    const t = tos.rows.find((r) => r.iloCode === sec.dataset.ilo), c = counts[t.iloCode];
    const sel = sec.querySelector(".f-cat"), keep = sel.value || "Easy";
    sel.innerHTML = LEVELS.map((L) => `<option value="${L.key}">${esc(L.label)} - ${c[L.key]}/${need(t, L.key)}</option>`).join("");
    sel.value = keep;
  }

  function renderStatus(sec) {
    const t = tos.rows.find((r) => r.iloCode === sec.dataset.ilo), c = counts[t.iloCode], done = doneOf(t);
    sec.querySelector(".status").innerHTML =
      `Status: <strong>${done}/${t.quota}</strong> items for ${esc(t.iloCode)} completed. ` +
      LEVELS.map((L) => `${L.key} ${c[L.key]}/${need(t, L.key)}`).join(" &middot; ") +
      (isComplete(t) ? " &mdash; quota met." : "");
  }

  function renderList(sec) {
    const mine = questions.filter((q) => q.iloCode === sec.dataset.ilo);
    sec.querySelector(".mine-n").textContent = mine.length;
    sec.querySelector(".mine-list").innerHTML = mine.length ? mine.map((q) => `
      <div class="p-2 border rounded-lg bg-slate-50 text-xs space-y-1">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="flex items-center gap-2">${UI.badge(q.category, q.category === "Easy" ? "green" : q.category === "Average" ? "amber" : "red")}
            ${q.status === "Disposed" ? UI.badge("Disposed by admin", "red") : ""}</span>
          <span class="flex gap-3">
            <button type="button" class="link-btn text-indigo-600" data-edit="${esc(q.id)}">Edit</button>
            <button type="button" class="link-btn text-rose-600" data-del="${esc(q.id)}">Delete</button>
          </span>
        </div>
        <p class="font-medium text-slate-900">${esc(q.stem)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-slate-600">
          ${["A", "B", "C", "D"].map((l) => `<div class="${q.key === l ? "font-bold text-emerald-700" : ""}">${l}) ${esc(q.options[l])}</div>`).join("")}
        </div>
      </div>`).join("") : '<div class="text-xs text-slate-400">No questions yet in this ILO.</div>';
  }

  function renderSummary() {
    const bar = (have, want) => {
      const pct = want ? Math.min(100, Math.round(have / want * 100)) : 100;
      const color = have >= want ? "#10b981" : have > 0 ? "#f59e0b" : "#94a3b8";
      return `<div class="font-semibold">${have}/${want}</div><div class="meter-track" style="width:90px"><div class="meter-fill" style="width:${pct}%;background:${color}"></div></div>`;
    };
    let totalDone = 0, totalQuota = 0;
    const rows = tos.rows.map((t) => {
      const c = counts[t.iloCode], done = doneOf(t);
      totalDone += done; totalQuota += t.quota;
      return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-3 font-semibold">${esc(t.iloCode)}</td>` +
        LEVELS.map((L) => `<td class="py-1.5 pr-3">${bar(c[L.key], need(t, L.key))}</td>`).join("") +
        `<td class="py-1.5">${bar(done, t.quota)}</td></tr>`;
    }).join("");
    root.querySelector("#fp-summary").innerHTML = rows +
      `<tr class="border-t border-slate-300 font-bold"><td class="py-1.5 pr-3">All ILOs</td><td colspan="3"></td><td class="py-1.5">${totalDone}/${totalQuota}</td></tr>`;

    root.querySelector("#fp-overall-text").textContent = `Overall Progress: ${totalDone}/${totalQuota} Questions Contributed`;
    root.querySelector("#fp-overall-bar").style.width = (totalQuota ? Math.round(totalDone / totalQuota * 100) : 0) + "%";
  }

  /** Updates headers, counts, lists and the summary. It never touches what is typed in a form. */
  function renderAll() {
    countAll();
    root.querySelectorAll("section.ilo").forEach((sec) => { renderHead(sec); renderLevels(sec); renderStatus(sec); renderList(sec); });
    renderSummary();
  }

  function buildAccordion() {
    root.querySelector("#fp-accordion").innerHTML = tos.rows.map(sectionHtml).join("");
    Object.keys(open).forEach((k) => delete open[k]);
    countAll();
    const first = tos.rows.find((t) => !isComplete(t)) || tos.rows[0];   // start with the first ILO that still needs questions
    if (first) open[first.iloCode] = true;
    root.querySelectorAll("section.ilo").forEach(applyOpen);
  }

  function applyOpen(sec) {
    sec.querySelector(".ilo-body").classList.toggle("hidden", !open[sec.dataset.ilo]);
  }

  // ------------------------------------------------------------------ forms
  function readForm(sec) {
    const options = {};
    sec.querySelectorAll(".f-opt").forEach((i) => { options[i.dataset.l] = i.value; });
    const k = sec.querySelector('input[type="radio"]:checked');
    return { stem: sec.querySelector(".f-stem").value, category: sec.querySelector(".f-cat").value, options: options, key: k ? k.value : "" };
  }

  function setSubmitLabel(sec) {
    sec.querySelector(".btn-submit").textContent = sec._editing ? "Update question" : "Submit to " + sec.dataset.ilo + " Bank";
    sec.querySelector(".btn-cancel").classList.toggle("hidden", !sec._editing);
  }

  function setAi(sec, state, notes) {
    const dot = sec.querySelector(".ai-dot"), note = sec.querySelector(".ai-note");
    const map = {
      idle: ["bg-slate-300", "Optional. The check is advice only; you can still submit.", "text-slate-500"],
      run: ["bg-slate-300", "Checking...", "text-slate-500"],
      pass: ["bg-emerald-500", "Pass. " + (notes || "The question looks good."), "text-emerald-700"],
      revise: ["bg-amber-500", "Needs revision: " + (notes || "please review the wording."), "text-amber-700"],
      fail: ["bg-rose-500", "Fail: " + (notes || "serious problem found.") + " (Advice only; you can still submit.)", "text-rose-700"]
    };
    const m = map[state];
    dot.className = "ai-dot inline-block w-3 h-3 rounded-full " + m[0];
    dot.title = state === "idle" ? "Not checked yet" : state;
    note.className = "ai-note text-xs mt-1 " + m[2];
    note.textContent = m[1];
  }

  function resetForm(sec) {
    sec._editing = null;
    sec.querySelector(".f-stem").value = "";
    sec.querySelectorAll(".f-opt").forEach((i) => (i.value = ""));
    sec.querySelectorAll('input[type="radio"]').forEach((r) => (r.checked = false));
    setAi(sec, "idle");
    setSubmitLabel(sec);
  }

  function complete(f) {
    return f.stem.trim() && f.key && ["A", "B", "C", "D"].every((l) => (f.options[l] || "").trim());
  }

  async function submit(sec, btn) {
    const f = readForm(sec);
    if (!f.key) { UI.toast("Choose the correct key (A, B, C or D) before submitting.", "error"); return; }
    await UI.run(btn, async () => {
      const payload = { courseId: State.courseId, iloCode: sec.dataset.ilo, category: f.category, stem: f.stem, options: f.options, key: f.key };
      if (sec._editing) { payload.id = sec._editing; await API.call("updateQuestion", payload); UI.toast("Question updated.", "success"); }
      else { await API.call("addQuestion", payload); UI.toast("Question submitted to " + sec.dataset.ilo + " bank.", "success"); }
      resetForm(sec);
      questions = await Data.questions();
      renderAll();
    });
    setSubmitLabel(sec);   // UI.run puts the old button text back, so set the right one afterwards
  }

  async function aiCheck(sec, btn) {
    const f = readForm(sec);
    if (!complete(f)) { UI.toast("Fill in the question, all four options and the correct key first.", "error"); return; }
    setAi(sec, "run");
    await UI.run(btn, async () => {
      try {
        const r = await API.call("checkQuestion", { courseId: State.courseId, iloCode: sec.dataset.ilo, category: f.category, stem: f.stem, options: f.options, key: f.key });
        setAi(sec, r.result, r.notes);
      } catch (e) { setAi(sec, "idle"); throw e; }
    });
  }

  function startEdit(sec, id) {
    const q = questions.find((x) => x.id === id); if (!q) return;
    sec._editing = q.id;
    sec.querySelector(".f-stem").value = q.stem;
    sec.querySelector(".f-cat").value = q.category;
    sec.querySelectorAll(".f-opt").forEach((i) => (i.value = q.options[i.dataset.l]));
    sec.querySelectorAll('input[type="radio"]').forEach((r) => (r.checked = r.value === q.key));
    setAi(sec, "idle");
    setSubmitLabel(sec);
    sec.querySelector(".f-stem").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ------------------------------------------------------------------ loading
  async function loadCourse() {
    Data.fillCourseSelect(root.querySelector("#fp-course"));
    const has = !!State.courseId;
    root.querySelector("#fp-empty").classList.toggle("hidden", has);
    root.querySelector("#fp-body").classList.toggle("hidden", !has);
    if (!has) { root.querySelector("#fp-overall-text").textContent = ""; root.querySelector("#fp-year").textContent = ""; return; }
    tos = await Data.tos(true);
    questions = await Data.questions();
    root.querySelector("#fp-year").textContent = tos.course.schoolYear || "-";
    const signature = State.courseId + "|" + tos.rows.map((r) => r.iloCode).join(",");
    if (signature !== builtFor) { buildAccordion(); builtFor = signature; }   // a different course or ILO list: start fresh
    renderAll();
  }

  async function sync() { await Data.courses(); await loadCourse(); }

  window.Steps.pool = {
    mount(el) {
      root = el;
      root.innerHTML = shell();

      root.querySelector("#fp-course").onchange = function () { Data.setCourse(this.value); UI.run(null, loadCourse); };

      const acc = root.querySelector("#fp-accordion");
      acc.addEventListener("click", (e) => {
        const sec = e.target.closest("section.ilo"); if (!sec) return;
        if (e.target.closest(".ilo-head")) { open[sec.dataset.ilo] = !open[sec.dataset.ilo]; applyOpen(sec); renderHead(sec); return; }
        const btn = e.target.closest("button"); if (!btn) return;
        if (btn.classList.contains("btn-submit")) submit(sec, btn);
        else if (btn.classList.contains("btn-ai")) aiCheck(sec, btn);
        else if (btn.classList.contains("btn-cancel")) resetForm(sec);
        else if (btn.dataset.edit) startEdit(sec, btn.dataset.edit);
        else if (btn.dataset.del) {
          if (!confirm("Delete this question? This cannot be undone.")) return;
          const id = btn.dataset.del;
          UI.run(null, async () => {
            await API.call("deleteQuestion", { id: id });
            if (sec._editing === id) resetForm(sec);
            questions = await Data.questions(); renderAll();
            UI.toast("Question deleted.", "success");
          });
        }
      });
      // changing the question after an AI check makes the old result out of date
      acc.addEventListener("input", (e) => {
        const sec = e.target.closest("section.ilo");
        if (sec && (e.target.matches(".f-stem, .f-opt, .f-cat") || e.target.type === "radio")) setAi(sec, "idle");
      });
    },
    onShow() { UI.run(null, sync); }
  };
})();
