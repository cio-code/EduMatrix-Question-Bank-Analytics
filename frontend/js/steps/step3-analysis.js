/** Step 3 - Post-exam item analysis (admin), per course. Upload the students' answers, get P and D per item. */
(function () {
  let root, exams = [], pending = null, questions = [];

  const TEMPLATE_BODY = `
    <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div class="flex flex-wrap justify-between items-start gap-3 border-b pb-3">
        <div>
          <h2 class="text-base font-bold text-slate-800">Post-exam item analysis &amp; response sheet import</h2>
          <p class="text-xs text-slate-500">Upload the students' answers to compute difficulty (P) and discrimination (D) with the upper and lower 27% method.</p>
        </div>
        <button id="an-sim" class="btn btn-light" title="Assigns made-up P and D values to every item of this course so you can test Steps 4 and 5">Simulate analysis (testing)</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div><label for="an-exam" class="lbl">Exam that was given (this course)</label><select id="an-exam" class="inp"></select></div>
        <div class="flex gap-2">
          <button id="an-template" class="btn btn-light">Download CSV template</button>
          <button id="an-pick" class="btn btn-light">Choose CSV file</button>
          <input id="an-file" type="file" accept=".csv,text/csv" class="hidden">
        </div>
        <div class="flex items-center gap-2">
          <button id="an-run" class="btn btn-green" disabled>Run analysis</button>
          <span id="an-file-name" class="text-xs text-slate-500"></span>
        </div>
      </div>
      <p class="text-xs text-slate-500">CSV format: first column <code>Student Name</code>, then <code>Q1, Q2, … Qn</code> holding each student's chosen letter (A–D). Needs at least 10 students. Letters refer to the option layout printed on that exam.</p>

      <div id="an-stats" class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="border border-slate-200 rounded-xl p-4">
          <h3 class="text-xs font-bold text-slate-800">Difficulty index (P) distribution</h3>
          <p class="text-slate-500 mb-2" style="font-size:10px">Green bars fall in the ideal 0.30 – 0.80 band</p>
          <div class="chart-box"><canvas id="c-an-hist"></canvas><div class="empty-chart an-empty">Run the analysis to see the distribution.</div></div>
        </div>
        <div class="border border-slate-200 rounded-xl p-4">
          <h3 class="text-xs font-bold text-slate-800">Difficulty vs. discrimination</h3>
          <p class="text-slate-500 mb-2" style="font-size:10px">Each dot is one item. Dashed line marks D = 0.20.</p>
          <div class="chart-box"><canvas id="c-an-scatter"></canvas><div class="empty-chart an-empty">Run the analysis to see item quality.</div></div>
        </div>
        <div class="border border-slate-200 rounded-xl p-4">
          <h3 class="text-xs font-bold text-slate-800">Retention by contributor</h3>
          <p class="text-slate-500 mb-2" style="font-size:10px">Items kept vs. disposed per instructor</p>
          <div class="chart-box"><canvas id="c-an-fac"></canvas><div class="empty-chart an-empty">Run the analysis to compare contributors.</div></div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs border text-left">
          <thead class="bg-slate-100"><tr>
            <th class="p-2 border">#</th><th class="p-2 border">Contributor</th><th class="p-2 border">ILO</th><th class="p-2 border">Level</th>
            <th class="p-2 border text-center">Difficulty (P)</th><th class="p-2 border text-center">Discrimination (D)</th>
            <th class="p-2 border text-center">Status</th><th class="p-2 border text-center">Action</th>
          </tr></thead>
          <tbody id="an-body"></tbody>
        </table>
      </div>
    </div>`;

  const EMPTY_ROW = '<tr><td colspan="8" class="p-4 text-center text-slate-400">No analysis yet for this course. Upload a CSV or use "Simulate analysis".</td></tr>';

  function analyzed() { return questions.filter((q) => q.P !== null && q.D !== null); }

  function render() {
    const a = analyzed();
    root.querySelectorAll(".an-empty").forEach((e) => (e.style.display = a.length ? "none" : "flex"));
    if (!a.length) {
      root.querySelector("#an-stats").innerHTML = "";
      root.querySelector("#an-body").innerHTML = EMPTY_ROW;
      return;
    }
    const kept = a.filter((q) => q.status !== "Disposed").length, dropped = a.length - kept;
    const meanP = a.reduce((s, q) => s + q.P, 0) / a.length, meanD = a.reduce((s, q) => s + q.D, 0) / a.length;
    root.querySelector("#an-stats").innerHTML =
      UI.statCard("Items analyzed", a.length, "slate") +
      UI.statCard("Retained", kept, "emerald", Math.round(kept / a.length * 100) + "% of items") +
      UI.statCard("Disposed", dropped, dropped ? "rose" : "slate", Math.round(dropped / a.length * 100) + "% of items") +
      UI.statCard("Mean difficulty (P)", meanP.toFixed(2), "indigo", meanP > 0.8 ? "too easy" : meanP < 0.3 ? "too hard" : "within ideal band") +
      UI.statCard("Mean discrimination (D)", meanD.toFixed(2), meanD >= 0.2 ? "emerald" : "amber", meanD >= 0.3 ? "good" : meanD >= 0.2 ? "acceptable" : "weak");

    root.querySelector("#an-body").innerHTML = a.map((q, i) => {
      const d = q.status === "Disposed";
      return `<tr class="${d ? "bg-rose-50" : ""}">
        <td class="p-2 border font-bold">${i + 1}</td><td class="p-2 border">${UI.esc(q.faculty)}</td>
        <td class="p-2 border">${UI.esc(q.iloCode)}</td><td class="p-2 border">${UI.esc(q.category)}</td>
        <td class="p-2 border text-center font-mono">${q.P}</td><td class="p-2 border text-center font-mono">${q.D}</td>
        <td class="p-2 border text-center"><span class="${d ? "text-rose-700" : "text-emerald-700"} font-bold">${d ? "Poor / Disposed" : "Good item"}</span></td>
        <td class="p-2 border text-center"><button class="link-btn text-indigo-600" data-id="${UI.esc(q.id)}" data-to="${d ? "Active" : "Disposed"}">${d ? "Re-activate" : "Dispose"}</button></td></tr>`;
    }).join("");
    if (UI.isVisible(root)) Charts.analysis(questions);
  }

  async function loadExams() {
    exams = await Data.exams();
    const sel = root.querySelector("#an-exam");
    sel.innerHTML = exams.length
      ? exams.map((e) => `<option value="${UI.esc(e.examId)}">${UI.esc((e.docNo ? e.docNo + " - " : "") + e.label)} (${e.count} items)</option>`).join("")
      : '<option value="">No saved exams for this course - save one in Step 4</option>';
  }

  async function loadCourse() {
    Data.fillCourseSelect(root.querySelector("#an-course"));
    const has = !!State.courseId;
    root.querySelector("#an-empty").classList.toggle("hidden", has);
    root.querySelector("#an-body-wrap").classList.toggle("hidden", !has);
    if (!has) return;
    pending = null;
    root.querySelector("#an-file-name").textContent = "";
    root.querySelector("#an-run").disabled = true;
    await loadExams();
    questions = await Data.questions();
    render();
  }

  async function sync() { await Data.courses(); await loadCourse(); }

  window.Steps.analysis = {
    mount(el) {
      root = el;
      root.innerHTML = Data.courseBarHtml("an-course") +
        '<div id="an-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm">There is no course yet. Create one in Step 1.</div>' +
        '<div id="an-body-wrap">' + TEMPLATE_BODY + "</div>";

      root.querySelector("#an-course").onchange = function () { Data.setCourse(this.value); UI.run(null, loadCourse); };

      root.querySelector("#an-template").onclick = () => {
        const e = exams.find((x) => x.examId === root.querySelector("#an-exam").value);
        if (!e) { UI.toast("Save an exam for this course in Step 4 first.", "error"); return; }
        const head = ["Student Name"].concat(Array.from({ length: e.count }, (_, i) => "Q" + (i + 1)));
        UI.download("responses-template.csv", head.join(",") + "\r\n");
      };
      root.querySelector("#an-pick").onclick = () => root.querySelector("#an-file").click();
      root.querySelector("#an-file").onchange = (ev) => {
        const f = ev.target.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          const table = UI.parseCsv(reader.result);
          if (table.length < 2) { UI.toast("The CSV needs a header row and student rows.", "error"); return; }
          pending = { header: table[0].map((h) => h.trim()), rows: table.slice(1) };
          root.querySelector("#an-file-name").textContent = f.name + " - " + pending.rows.length + " students";
          root.querySelector("#an-run").disabled = false;
        };
        reader.readAsText(f);
      };
      root.querySelector("#an-run").onclick = function () {
        const examId = root.querySelector("#an-exam").value;
        if (!examId) { UI.toast("Choose the exam that was given.", "error"); return; }
        if (!pending) return;
        UI.run(this, async () => {
          const r = await API.call("runAnalysis", { examId: examId, header: pending.header, rows: pending.rows });
          UI.toast("Analyzed " + r.students + " students (groups of " + r.groupSize + "). " + r.disposed + " items disposed.", "success");
          questions = await Data.questions(); render();
        });
      };
      root.querySelector("#an-sim").onclick = function () {
        if (!confirm("This overwrites P and D on every item of this course with made-up test values. Continue?")) return;
        UI.run(this, async () => {
          const r = await API.call("simulateAnalysis", { courseId: State.courseId });
          UI.toast("Simulated " + r.items + " items; " + r.disposed + " disposed.", "success");
          questions = await Data.questions(); render();
        });
      };
      root.querySelector("#an-body").addEventListener("click", (e) => {
        const id = e.target.dataset.id; if (!id) return;
        UI.run(null, async () => { await API.call("setQuestionStatus", { id: id, status: e.target.dataset.to }); questions = await Data.questions(); render(); });
      });
    },
    onShow() { UI.run(null, sync); }
  };
})();
