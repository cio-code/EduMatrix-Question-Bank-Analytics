/** Step 2 - Question pool, per course. Faculty ("Contributor Repository") work only with their own items and see the number of items needed per ILO; admin sees everything with analytics. */
(function () {
  const CATS = EDU_CONFIG.CATEGORIES;
  let root, questions = [], tos = null, editingId = null, limit = 100, loadedCourseId = "";
  const filters = { text: "", ilo: "", status: "", cat: "" };
  const isAdmin = () => State.session.role === "admin";

  // ---------------------------------------------------------------- big, easy-to-read styling for faculty
  // Sizes for the faculty page. Make a number bigger/smaller here to change the whole page.
  const ELDER_CSS = `
    .elder .lbl { font-size: 12px; font-weight: 700; margin-bottom: 3px; color: #1e293b; }
    .elder .inp { font-size: 13px; padding: 6px 9px; border: 1.5px solid #94a3b8; border-radius: 7px; }
    .elder .inp:focus { border-color: #4f46e5; outline: 2px solid #c7d2fe; }
    .elder .inp[readonly] { background: #f1f5f9; color: #334155; }
    .elder #pool-course { font-size: 13px !important; padding: 6px 9px !important; }
    .elder .btn { font-size: 13px; padding: 8px 14px; border-radius: 7px; }
    .elder .btn-save-big { width: 100%; justify-content: center; font-size: 14px; padding: 10px 16px; }
    .elder .step-no { display: inline-flex; width: 20px; height: 20px; border-radius: 9999px; background: #4f46e5; color: #fff; font-weight: 700; align-items: center; justify-content: center; margin-right: 5px; font-size: 11px; }
    .elder .opt-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 4px 6px; background: #f8fafc; margin-bottom: 6px; }
    .elder .opt-row:has(input[type="radio"]:checked) { border-color: #10b981; background: #ecfdf5; }
    .elder .opt-row .inp { flex: 1 1 160px; min-width: 0; }
    .elder .opt-letter { width: 24px; height: 24px; border-radius: 9999px; background: #e0e7ff; color: #3730a3; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 12px; flex: none; }
    .elder .opt-correct { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; color: #065f46; }
    .elder .opt-correct input { width: 16px; height: 16px; accent-color: #059669; cursor: pointer; }
    .elder .need-table { font-size: 12px; }
    .elder #need-body td { padding-top: 4px; padding-bottom: 4px; }
    .elder #pool-list .text-xs { font-size: 12px; }
    .elder #pool-list .font-medium { font-size: 13px; line-height: 1.4; }
    .elder .link-btn { font-size: 12px; padding: 2px 5px; }
    .elder #pool-count { font-size: 12px; }
    #toast-box .toast { font-size: 13px; padding: 10px 14px; }
  `;
  function applyElderStyle() {
    if (document.getElementById("elder-style")) return;
    const st = document.createElement("style");
    st.id = "elder-style";
    st.textContent = ELDER_CSS;
    document.head.appendChild(st);
  }

  const SAVE_TEXT = () => (isAdmin() ? "Submit item to bank" : "Save this question");
  const UPDATE_TEXT = () => (isAdmin() ? "Update item" : "Save changes");

  // ---------------------------------------------------------------- page pieces
  function analyticsHtml() {
    return `
    <div id="pool-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Coverage vs. TOS quota</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Active items per ILO against the items needed</p>
        <div class="chart-box-sm"><canvas id="c-pool-cov"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Cognitive level balance</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Active items by difficulty category</p>
        <div class="chart-box-sm"><canvas id="c-pool-cat"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Contribution by faculty</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Active vs. disposed</p>
        <div class="chart-box-sm"><canvas id="c-pool-fac"></canvas></div>
      </div>
    </div>`;
  }

  function neededPanelHtml() {
    return `
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div class="flex flex-wrap justify-between items-baseline gap-2 mb-2">
        <h3 class="text-sm font-bold text-slate-800">Items needed per ILO</h3>
        <span id="need-total" class="text-xs font-semibold text-slate-600"></span>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-xs need-table">
        <thead><tr class="text-left text-slate-500">
          <th class="py-1 pr-3">ILO</th><th class="py-1 text-center">Easy</th><th class="py-1 text-center">Average</th><th class="py-1 text-center">Difficult</th><th class="py-1 text-center">Total</th>
        </tr></thead>
        <tbody id="need-body"></tbody>
      </table></div>
      <p class="text-slate-500 mt-2 text-xs">Each box shows your saved questions / items needed by the exam. Green means enough. You may save more than needed: extra questions give the curation more to choose from.</p>
    </div>`;
  }

  /** Compact form for admin (unchanged). */
  function adminFormHtml() {
    return `
      <div class="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 self-start">
        <h3 id="enc-title" class="font-bold text-sm text-slate-800 border-b pb-2">Add a question</h3>
        <div><label class="lbl">Contributor</label><input class="inp" value="${UI.esc(State.session.fullName)}" readonly></div>
        <div><label class="lbl">Course &amp; title</label><input id="enc-course" class="inp" readonly></div>
        <div><label for="enc-ilo" class="lbl">Target ILO (from this course)</label><select id="enc-ilo" class="inp"></select></div>
        <div><label for="enc-cat" class="lbl">Cognitive level</label>
          <select id="enc-cat" class="inp">
            <option value="Easy">Easy (Remember / Understand)</option>
            <option value="Average">Average (Apply / Analyze)</option>
            <option value="Difficult">Difficult (Evaluate / Create)</option>
          </select></div>
        <div><label for="enc-stem" class="lbl">Question statement</label><textarea id="enc-stem" rows="3" class="inp" maxlength="1000" placeholder="Enter the question stem…"></textarea></div>
        <div class="space-y-1">
          ${["A", "B", "C", "D"].map((l) => `<input id="enc-${l}" class="inp" maxlength="300" placeholder="Option ${l}" aria-label="Option ${l}">`).join("")}
        </div>
        <div><label for="enc-key" class="lbl">Correct key</label>
          <select id="enc-key" class="inp"><option>A</option><option>B</option><option>C</option><option>D</option></select></div>
        <div class="flex gap-2">
          <button id="enc-save" class="btn btn-primary flex-1 justify-center">Submit item to bank</button>
          <button id="enc-cancel" class="btn btn-light hidden">Cancel</button>
        </div>
      </div>`;
  }

  /** Big, step-by-step form for faculty. */
  function facultyFormHtml() {
    return `
    <div class="bg-white rounded-xl border-2 border-indigo-400 shadow-sm overflow-hidden">
      <div class="px-4 py-2 bg-indigo-600 text-white">
        <h3 id="enc-title" class="text-base font-bold">Add a question</h3>
        <p class="text-indigo-100 text-xs">Follow the numbered steps, then press the big green button to save.</p>
      </div>
      <div class="p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label class="lbl">Contributor</label><input class="inp" value="${UI.esc(State.session.fullName)}" readonly></div>
          <div><label class="lbl">Course &amp; title</label><input id="enc-course" class="inp" readonly></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div><label for="enc-ilo" class="lbl"><span class="step-no">1</span>Choose the ILO</label><select id="enc-ilo" class="inp"></select></div>
            <div><label for="enc-cat" class="lbl"><span class="step-no">2</span>Choose how hard the question is</label>
              <select id="enc-cat" class="inp">
                <option value="Easy">Easy (Remember / Understand)</option>
                <option value="Average">Average (Apply / Analyze)</option>
                <option value="Difficult">Difficult (Evaluate / Create)</option>
              </select></div>
            <div><label for="enc-stem" class="lbl"><span class="step-no">3</span>Type the question</label>
              <textarea id="enc-stem" rows="3" class="inp" maxlength="1000" placeholder="Type your question here..."></textarea></div>
          </div>
          <div>
            <label class="lbl"><span class="step-no">4</span>Type the four choices, then tick the correct answer</label>
            ${["A", "B", "C", "D"].map((l) => `
            <div class="opt-row">
              <span class="opt-letter">${l}</span>
              <input id="enc-${l}" class="inp" maxlength="300" placeholder="Choice ${l}" aria-label="Choice ${l}">
              <label class="opt-correct"><input type="radio" name="enc-key-radio" value="${l}"> Correct answer</label>
            </div>`).join("")}
            <select id="enc-key" class="hidden" aria-hidden="true"><option>A</option><option>B</option><option>C</option><option>D</option></select>
            <div class="mt-3">
              <label class="lbl"><span class="step-no">5</span>Save your question</label>
              <button id="enc-save" class="btn btn-green btn-save-big">Save this question</button>
              <button id="enc-cancel" class="btn btn-light hidden" style="margin-top:6px;width:100%;justify-content:center">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function listCardHtml(admin) {
    return `
      <div class="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
          <div>
            <h3 class="font-bold text-sm text-slate-800">${admin ? "Question bank pool" : "My questions"} <span id="pool-title" class="font-normal text-slate-500"></span></h3>
            <p class="text-xs text-slate-500">${admin ? "Questions submitted by all subject faculty for this course." : "Only you can see and change these."}</p>
          </div>
          ${admin ? `<div class="flex gap-2">
            <button id="pool-seed" class="btn btn-light">Add 120 sample items</button>
            <button id="pool-clear" class="btn btn-danger">Remove sample items</button></div>` : ""}
        </div>
        <div class="grid grid-cols-2 md:grid-cols-${admin ? 5 : 4} gap-2">
          <input id="f-text" class="inp md:col-span-2" placeholder="Search question text…" aria-label="Search">
          <select id="f-ilo" class="inp" aria-label="Filter by ILO"></select>
          <select id="f-cat" class="inp" aria-label="Filter by level"><option value="">All levels</option>${CATS.map((c) => `<option>${c}</option>`).join("")}</select>
          ${admin ? `<select id="f-status" class="inp" aria-label="Filter by status"><option value="">All status</option><option>Active</option><option>Disposed</option></select>` : ""}
        </div>
        <div id="pool-list" class="space-y-2 max-h-[600px] overflow-y-auto pr-1"></div>
        <div id="pool-count" class="text-xs text-slate-500"></div>
      </div>`;
  }

  function template() {
    const admin = isAdmin();
    const top = Data.courseBarHtml("pool-course", '<div id="pool-info" class="text-xs text-slate-500 pb-2"></div>') + `
    <div id="pool-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm">
      There is no course yet. The administrator or GECAC creates a course in Step 1 (Course &amp; title and its TOS) before questions can be added.
    </div>`;
    if (admin) {
      return top + `<div id="pool-body" class="space-y-4">${analyticsHtml()}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">${adminFormHtml()}${listCardHtml(true)}</div></div>`;
    }
    // faculty: the form comes first and is big; then the items needed; then their own questions
    return top + `<div id="pool-body" class="space-y-3">${facultyFormHtml()}${neededPanelHtml()}<div id="cert-box" class="hidden"></div>${listCardHtml(false)}</div>`;
  }

  function fillSelects() {
    const opts = tos.rows.map((t) => `<option value="${UI.esc(t.iloCode)}">${UI.esc(t.iloCode)}: ${UI.esc(t.ilo)}</option>`).join("");
    const cur = root.querySelector("#enc-ilo").value;
    root.querySelector("#enc-ilo").innerHTML = opts;
    if (cur && tos.rows.some((t) => t.iloCode === cur)) root.querySelector("#enc-ilo").value = cur;
    const f = root.querySelector("#f-ilo");
    f.innerHTML = '<option value="">All ILOs</option>' + tos.rows.map((t) => `<option>${UI.esc(t.iloCode)}</option>`).join("");
    filters.ilo = ""; 
    root.querySelector("#enc-course").value = tos.course.course;
    root.querySelector("#pool-info").textContent = (tos.course.schoolYear ? tos.course.schoolYear + " · " : "") + "Exam target: " + tos.course.targetItems + " items";
    root.querySelector("#pool-title").textContent = "- " + tos.course.course;
  }

  function renderStats() {
    const active = questions.filter((q) => q.status !== "Disposed");
    const names = new Set(questions.map((q) => q.faculty));
    const goal = tos.course.targetItems, ok = active.length >= goal;
    root.querySelector("#pool-stats").innerHTML =
      UI.statCard("Total items", questions.length, "slate", names.size + (names.size === 1 ? " contributor" : " contributors")) +
      UI.statCard("Active items", active.length, "emerald", "available for curation") +
      UI.statCard("Disposed items", questions.length - active.length, questions.length - active.length ? "rose" : "slate", "excluded from exams") +
      UI.statCard("Ready for " + goal + "-item exam", ok ? "Yes" : "No", ok ? "emerald" : "amber", ok ? (active.length - goal) + " spare items" : "need " + (goal - active.length) + " more");
  }

  function filtered() {
    const t = filters.text.toLowerCase();
    return questions.filter((q) =>
      (!t || q.stem.toLowerCase().includes(t)) && (!filters.ilo || q.iloCode === filters.ilo) &&
      (!filters.cat || q.category === filters.cat) && (!filters.status || q.status === filters.status));
  }

  function renderList() {
    const list = filtered();
    const box = root.querySelector("#pool-list");
    if (!questions.length) {
      box.innerHTML = '<div class="p-8 text-center text-slate-400 border border-dashed rounded text-sm">No questions in this course yet. Use the form to add the first one.</div>';
      root.querySelector("#pool-count").textContent = "";
      return;
    }
    box.innerHTML = list.slice(0, limit).map((q, idx) => {
      const disposed = q.status === "Disposed";
      const own = isAdmin() || q.owner === State.session.username;
      return `<div class="p-3 border rounded-lg text-xs space-y-1 ${disposed ? "bg-rose-50/50 opacity-75" : "bg-slate-50"}">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="font-bold text-slate-800">#${idx + 1} [${UI.esc(q.iloCode)}] · ${UI.esc(q.category)}</span>
          <div class="flex items-center gap-2">
            ${isAdmin() ? `<span class="text-slate-500">By: ${UI.esc(q.faculty)}</span>` : ""}
            ${UI.badge(disposed ? "Disposed" : "Active", disposed ? "red" : "green")}
            ${q.aiVerdict ? UI.badge("AI: " + q.aiVerdict, q.aiVerdict === "ok" ? "green" : q.aiVerdict === "revise" ? "amber" : "red") : ""}
          </div>
        </div>
        <p class="text-slate-900 font-medium">${UI.esc(q.stem)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-slate-600">
          ${["A", "B", "C", "D"].map((l) => `<div class="${q.key === l ? "font-bold text-emerald-700" : ""}">${l}) ${UI.esc(q.options[l])}</div>`).join("")}
        </div>
        ${q.aiNotes ? `<div class="text-amber-700">AI note: ${UI.esc(q.aiNotes)}</div>` : ""}
        <div class="flex flex-wrap justify-between items-center gap-2 text-slate-500 pt-1">
          <span>Key: <strong>${UI.esc(q.key)}</strong> | P: ${q.P === null ? "N/A" : q.P} | D: ${q.D === null ? "N/A" : q.D}</span>
          <span class="flex gap-3">
            ${own ? `<button class="link-btn text-indigo-600" data-edit="${UI.esc(q.id)}">Edit</button><button class="link-btn text-rose-600" data-del="${UI.esc(q.id)}">Delete</button>` : ""}
            ${isAdmin() ? `<button class="link-btn text-slate-600" data-toggle="${UI.esc(q.id)}" data-to="${disposed ? "Active" : "Disposed"}">${disposed ? "Restore" : "Dispose"}</button>` : ""}
          </span>
        </div>
      </div>`;
    }).join("") || '<div class="p-6 text-center text-slate-400 text-sm">No questions match these filters.</div>';
    root.querySelector("#pool-count").textContent = list.length > limit
      ? "Showing " + limit + " of " + list.length + " - narrow the filters to see the rest."
      : "Showing " + list.length + " of " + questions.length + " questions.";
  }

  // ---- faculty: how many items each ILO still needs (from the TOS), compared with my own active questions
  const LEVELS = [
    { key: "Easy", label: "Easy (Remember / Understand)" },
    { key: "Average", label: "Average (Apply / Analyze)" },
    { key: "Difficult", label: "Difficult (Evaluate / Create)" }
  ];
  const needOf = (t, level) => Number(t[level.toLowerCase()]) || 0;

  function countMine() {
    const c = {};
    tos.rows.forEach((t) => { c[t.iloCode] = { Easy: 0, Average: 0, Difficult: 0 }; });
    questions.forEach((q) => { if (q.status !== "Disposed" && c[q.iloCode]) c[q.iloCode][q.category]++; });
    return c;
  }
  // Only up to the number needed counts as progress; extra questions do not push a box past "done".
  const doneOf = (t, c) => LEVELS.reduce((s, L) => s + Math.min(c[t.iloCode][L.key], needOf(t, L.key)), 0);

  function renderNeeded() {
    const c = countMine();
    let totalDone = 0, totalNeed = 0;
    const cell = (have, want) => `<td class="py-1.5 text-center ${have >= want ? "text-emerald-700 font-bold" : have > 0 ? "text-amber-600 font-semibold" : "text-slate-500"}">${have}/${want}${have >= want ? " &#10003;" : ""}</td>`;
    const short = (x) => (x.length > 70 ? x.slice(0, 67) + "..." : x);
    const rows = tos.rows.map((t) => {
      const d = doneOf(t, c);
      totalDone += d; totalNeed += t.quota;
      return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-3"><span class="font-semibold">${UI.esc(t.iloCode)}</span> <span class="text-slate-500">${UI.esc(short(t.ilo))}</span></td>` +
        LEVELS.map((L) => cell(c[t.iloCode][L.key], needOf(t, L.key))).join("") + cell(d, t.quota) + "</tr>";
    }).join("");
    root.querySelector("#need-body").innerHTML = rows +
      `<tr class="border-t border-slate-300 font-bold"><td class="py-1.5 pr-3">All ILOs</td><td colspan="3"></td><td class="py-1.5 text-center">${totalDone}/${totalNeed}</td></tr>`;
    root.querySelector("#need-total").textContent = "Your progress: " + totalDone + " of " + totalNeed + " items needed";
  }

  /** Shows the numbers inside the form's dropdowns too: "ILO-001: ... (7/12)" and "Easy ... - 2/4". */
  function updateLevels(c) {
    const t = tos.rows.find((r) => r.iloCode === root.querySelector("#enc-ilo").value);
    if (!t) return;
    const cc = c || countMine();
    const sel = root.querySelector("#enc-cat"), keep = sel.value || "Easy";
    sel.innerHTML = LEVELS.map((L) => `<option value="${L.key}">${L.label} - ${cc[t.iloCode][L.key]}/${needOf(t, L.key)}</option>`).join("");
    sel.value = keep;
  }

  function refreshHints() {
    const c = countMine();
    const sel = root.querySelector("#enc-ilo"), keep = sel.value;
    sel.innerHTML = tos.rows.map((t) => `<option value="${UI.esc(t.iloCode)}">${UI.esc(t.iloCode)}: ${UI.esc(t.ilo)} (${doneOf(t, c)}/${t.quota})</option>`).join("");
    if (keep && tos.rows.some((t) => t.iloCode === keep)) sel.value = keep;
    updateLevels(c);
  }

  // ---- faculty: Certificate of Contribution (unlocks when every box in "Items needed per ILO" is filled)
  let certState = null;
  const loadedScripts = {};
  function loadScriptOnce(src) {
    if (!loadedScripts[src]) {
      loadedScripts[src] = new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src; el.onload = resolve; el.onerror = () => reject(new Error("Could not load " + src));
        document.body.appendChild(el);
      });
    }
    return loadedScripts[src];
  }
  async function ensureCertificate() {
    await loadScriptOnce("js/vendor/qrcode.js");
    await loadScriptOnce("js/certificate.js");
  }

  async function loadCertificate() {
    if (isAdmin() || !State.courseId) return;
    try { certState = await API.call("getCertificate", { courseId: State.courseId }); } catch (e) { certState = null; }
    renderCertBox();
  }

  function renderCertBox() {
    const box = root.querySelector("#cert-box");
    if (!box) return;
    if (!certState) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const c = certState, cert = c.certificate;
    if (cert && cert.status === "Revoked") {
      box.innerHTML = `<div class="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-800"><strong>Certificate of Contribution</strong> - this certificate was revoked. Please contact the administrator.</div>`;
    } else if (cert) {
      box.innerHTML = `<div class="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div><div class="font-bold text-emerald-900">Your Certificate of Contribution is ready</div>
        <div class="text-xs text-emerald-800 mt-0.5">Serial number ${UI.esc(cert.serial)}</div></div>
        <button class="btn btn-green" data-cert="view">View / Print certificate</button></div>`;
    } else if (c.eligible) {
      box.innerHTML = `<div class="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div><div class="font-bold text-emerald-900">You completed all the required questions. Thank you!</div>
        <div class="text-xs text-emerald-800 mt-0.5">Get your Certificate of Contribution.</div></div>
        <button class="btn btn-green" data-cert="get">Get my certificate</button></div>`;
    } else {
      box.innerHTML = `<div class="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        <strong class="text-slate-800">Certificate of Contribution</strong> - fill every box in "Items needed per ILO" to unlock it
        (${c.done} of ${c.total} done).</div>`;
    }
  }

  function draw() {
    renderList();
    if (isAdmin()) {
      renderStats();
      if (UI.isVisible(root)) Charts.pool(questions, tos.rows);
    } else {                               // faculty: items needed per ILO and level
      renderNeeded();
      refreshHints();
    }
  }

  function setSaveLabel() {
    root.querySelector("#enc-save").textContent = editingId ? UPDATE_TEXT() : SAVE_TEXT();
  }

  function resetForm() {
    editingId = null;
    ["A", "B", "C", "D"].forEach((l) => (root.querySelector("#enc-" + l).value = ""));
    root.querySelector("#enc-stem").value = "";
    root.querySelectorAll('input[name="enc-key-radio"]').forEach((r) => (r.checked = false));
    root.querySelector("#enc-title").textContent = "Add a question";
    setSaveLabel();
    root.querySelector("#enc-cancel").classList.add("hidden");
  }

  function readForm() {
    // admin picks the key in a dropdown; faculty tick the "Correct answer" box next to a choice
    const ticked = root.querySelector('input[name="enc-key-radio"]:checked');
    return {
      courseId: State.courseId,
      iloCode: root.querySelector("#enc-ilo").value, category: root.querySelector("#enc-cat").value,
      stem: root.querySelector("#enc-stem").value,
      options: { A: root.querySelector("#enc-A").value, B: root.querySelector("#enc-B").value, C: root.querySelector("#enc-C").value, D: root.querySelector("#enc-D").value },
      key: isAdmin() ? root.querySelector("#enc-key").value : (ticked ? ticked.value : "")
    };
  }

  /** (Re)loads everything for the selected course. */
  async function loadCourse() {
    const sel = root.querySelector("#pool-course");
    Data.fillCourseSelect(sel);
    const has = !!State.courseId;
    root.querySelector("#pool-empty").classList.toggle("hidden", has);
    root.querySelector("#pool-body").classList.toggle("hidden", !has);
    if (!has) return;
    if (State.courseId !== loadedCourseId) resetForm();   // keep a half-typed question when only coming back to this tab
    loadedCourseId = State.courseId;
    tos = await Data.tos(true);
    questions = await Data.questions();
    fillSelects();
    draw();
    loadCertificate();
  }

  async function reload() {
    questions = await Data.questions();
    draw();
    loadCertificate();
  }

  async function sync() {
    await Data.courses();
    await loadCourse();
  }

  window.Steps.pool = {
    mount(el) {
      root = el;
      if (!isAdmin()) { applyElderStyle(); root.classList.add("elder"); }   // larger text and buttons for faculty
      root.innerHTML = template();

      root.querySelector("#pool-course").onchange = function () {
        Data.setCourse(this.value);
        UI.run(null, loadCourse);
      };

      root.querySelector("#enc-save").onclick = async function () {
        if (!isAdmin() && !root.querySelector('input[name="enc-key-radio"]:checked')) {
          UI.toast("Please tick the correct answer (A, B, C or D) before saving.", "error");
          return;
        }
        await UI.run(this, async () => {
          const payload = readForm();
          if (editingId) { payload.id = editingId; await API.call("updateQuestion", payload); UI.toast(isAdmin() ? "Question updated." : "Saved. Your question was updated.", "success"); }
          else { await API.call("addQuestion", payload); UI.toast(isAdmin() ? "Question added." : "Saved. Your question was added.", "success"); }
          resetForm();
          await reload();
        });
        setSaveLabel();   // UI.run puts the old button text back, so show the right one afterwards
      };
      root.querySelector("#enc-cancel").onclick = resetForm;
      if (!isAdmin()) root.querySelector("#enc-ilo").addEventListener("change", () => updateLevels());
      if (!isAdmin()) {
        root.querySelector("#cert-box").addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-cert]"); if (!btn) return;
          UI.run(btn, async () => {
            await ensureCertificate();
            if (btn.dataset.cert === "get") {
              const cert = await API.call("issueCertificate", { courseId: State.courseId });
              certState = Object.assign({}, certState, { certificate: cert });
              renderCertBox();
              Certificate.show(cert);
            } else {
              Certificate.show(certState.certificate);
            }
          });
        });
      }

      const bindFilter = (id, key) => { const e = root.querySelector(id); if (e) e.addEventListener("input", () => { filters[key] = e.value; limit = 100; renderList(); }); };
      bindFilter("#f-text", "text"); bindFilter("#f-ilo", "ilo"); bindFilter("#f-cat", "cat"); bindFilter("#f-status", "status");

      root.querySelector("#pool-list").addEventListener("click", (e) => {
        const t = e.target;
        if (t.dataset.edit) {
          const q = questions.find((x) => x.id === t.dataset.edit); if (!q) return;
          editingId = q.id;
          root.querySelector("#enc-ilo").value = q.iloCode; root.querySelector("#enc-cat").value = q.category;
          root.querySelector("#enc-stem").value = q.stem; root.querySelector("#enc-key").value = q.key;
          ["A", "B", "C", "D"].forEach((l) => (root.querySelector("#enc-" + l).value = q.options[l]));
          root.querySelectorAll('input[name="enc-key-radio"]').forEach((r) => (r.checked = r.value === q.key));
          root.querySelector("#enc-title").textContent = "Edit question";
          setSaveLabel();
          root.querySelector("#enc-cancel").classList.remove("hidden");
          root.querySelector("#enc-stem").scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (t.dataset.del) {
          if (!confirm("Delete this question? This cannot be undone.")) return;
          UI.run(null, async () => { await API.call("deleteQuestion", { id: t.dataset.del }); if (editingId === t.dataset.del) resetForm(); await reload(); UI.toast("Question deleted.", "success"); });
        } else if (t.dataset.toggle) {
          UI.run(null, async () => { await API.call("setQuestionStatus", { id: t.dataset.toggle, status: t.dataset.to }); await reload(); });
        }
      });

      const seed = root.querySelector("#pool-seed");
      if (seed) {
        seed.onclick = function () {
          if (!confirm('Add 120 sample questions to "' + tos.course.course + '" for testing? You can remove them later.')) return;
          UI.run(this, async () => { const r = await API.call("seedSampleQuestions", { courseId: State.courseId }); await reload(); UI.toast(r.added + " sample items added.", "success"); });
        };
        root.querySelector("#pool-clear").onclick = function () {
          if (!confirm("Remove the sample items of this course (items already used in a saved exam are kept)?")) return;
          UI.run(this, async () => { const r = await API.call("clearSampleQuestions", { courseId: State.courseId }); await reload(); UI.toast(r.removed + " sample items removed.", "success"); });
        };
      }

    },
    onShow() { UI.run(null, sync); }
  };
})();
