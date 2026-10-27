/** Step 2 - Question pool, per course. Faculty work only with their own items; admin sees everything. */
(function () {
  const CATS = EDU_CONFIG.CATEGORIES;
  let root, questions = [], tos = null, editingId = null, limit = 100, loadedCourseId = "";
  const filters = { text: "", ilo: "", status: "", cat: "" };
  const isAdmin = () => State.session.role === "admin";

  function template() {
    const admin = isAdmin();
    return Data.courseBarHtml("pool-course", '<div id="pool-info" class="text-xs text-slate-500 pb-2"></div>') + `
    <div id="pool-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm">
      There is no course yet. The administrator or GECAC creates a course in Step 1 (Course &amp; title and its TOS) before questions can be added.
    </div>
    <div id="pool-body" class="space-y-4">
    <div id="pool-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Coverage vs. TOS quota</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">${admin ? "Active items" : "Your active items"} per ILO against the items needed</p>
        <div class="chart-box-sm"><canvas id="c-pool-cov"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Cognitive level balance</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Active items by difficulty category</p>
        <div class="chart-box-sm"><canvas id="c-pool-cat"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">${admin ? "Contribution by faculty" : "Your items"}</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Active vs. disposed</p>
        <div class="chart-box-sm"><canvas id="c-pool-fac"></canvas></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      </div>

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
      </div>
    </div>
    </div>`;
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
    let html = UI.statCard(isAdmin() ? "Total items" : "My items", questions.length, "slate", names.size + (names.size === 1 ? " contributor" : " contributors")) +
      UI.statCard("Active items", active.length, "emerald", "available for curation") +
      UI.statCard("Disposed items", questions.length - active.length, questions.length - active.length ? "rose" : "slate", "excluded from exams");
    if (isAdmin()) {
      const goal = tos.course.targetItems, ok = active.length >= goal;
      html += UI.statCard("Ready for " + goal + "-item exam", ok ? "Yes" : "No", ok ? "emerald" : "amber", ok ? (active.length - goal) + " spare items" : "need " + (goal - active.length) + " more");
    } else {
      const needed = tos.rows.reduce((s, t) => s + t.quota, 0);
      html += UI.statCard("Items the exam needs", needed, "indigo", "across all ILOs of this course");
    }
    root.querySelector("#pool-stats").innerHTML = html;
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

  function draw() {
    renderStats(); renderList();
    if (UI.isVisible(root)) Charts.pool(questions, tos.rows);
  }

  function resetForm() {
    editingId = null;
    ["A", "B", "C", "D"].forEach((l) => (root.querySelector("#enc-" + l).value = ""));
    root.querySelector("#enc-stem").value = "";
    root.querySelector("#enc-title").textContent = "Add a question";
    root.querySelector("#enc-save").textContent = "Submit item to bank";
    root.querySelector("#enc-cancel").classList.add("hidden");
  }

  function readForm() {
    return {
      courseId: State.courseId,
      iloCode: root.querySelector("#enc-ilo").value, category: root.querySelector("#enc-cat").value,
      stem: root.querySelector("#enc-stem").value,
      options: { A: root.querySelector("#enc-A").value, B: root.querySelector("#enc-B").value, C: root.querySelector("#enc-C").value, D: root.querySelector("#enc-D").value },
      key: root.querySelector("#enc-key").value
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
  }

  async function reload() {
    questions = await Data.questions();
    draw();
  }

  async function sync() {
    await Data.courses();
    await loadCourse();
  }

  window.Steps.pool = {
    mount(el) {
      root = el;
      root.innerHTML = template();

      root.querySelector("#pool-course").onchange = function () {
        Data.setCourse(this.value);
        UI.run(null, loadCourse);
      };

      root.querySelector("#enc-save").onclick = function () {
        UI.run(this, async () => {
          const payload = readForm();
          if (editingId) { payload.id = editingId; await API.call("updateQuestion", payload); UI.toast("Question updated.", "success"); }
          else { await API.call("addQuestion", payload); UI.toast("Question added.", "success"); }
          resetForm();
          await reload();
        });
      };
      root.querySelector("#enc-cancel").onclick = resetForm;

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
          root.querySelector("#enc-title").textContent = "Edit question";
          root.querySelector("#enc-save").textContent = "Update item";
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
