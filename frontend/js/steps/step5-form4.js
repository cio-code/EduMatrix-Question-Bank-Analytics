/** Step 5 - Printable Form 4, per course. The header, logo and signature block live in templates/form4-template.html. */
(function () {
  let root, template = null, exams = [];

  const BODY = `
    <div class="flex flex-wrap justify-between items-center gap-3 no-print bg-white p-4 rounded-xl border">
      <div>
        <h3 class="font-bold text-slate-800 text-sm">JHCSC-CIO Form 4 final document</h3>
        <p class="text-xs text-slate-500">Ready for official submission and printing (Doc No. SASTOS-001).</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div><label for="f4-exam" class="lbl">Saved exam (this course)</label><select id="f4-exam" class="inp" style="min-width:16rem"></select></div>
        <label class="flex items-center gap-2 text-xs pb-2"><input id="f4-key" type="checkbox" checked> Highlight answer key</label>
        <button id="f4-print" class="btn btn-green">Print / export PDF</button>
      </div>
    </div>
    <div id="printable-form4-area" class="bg-white p-8 border border-slate-300 rounded shadow-sm text-black">
      <p class="text-sm text-slate-400 no-print">Save an exam for this course in Step 4, then pick it here.</p>
    </div>`;

  function fill(tpl, map) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m));
  }

  /** Uses the course and TOS that came with the exam, so the printout always matches that exam's course. */
  function build(exam, showKey) {
    const rows = exam.tos, course = exam.course;
    const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
    const tosRows = rows.map((t) => `<tr><td>${UI.esc(t.iloCode)}</td><td style="text-align:left">${UI.esc(t.ilo)}</td><td>${t.hours}</td><td>${t.weight}%</td><td>${t.easy}</td><td>${t.average}</td><td>${t.difficult}</td><td><strong>${t.quota}</strong></td></tr>`).join("") +
      `<tr style="font-weight:bold"><td colspan="2" style="text-align:right">TOTAL</td><td>${sum("hours")}</td><td>100%</td><td>${sum("easy")}</td><td>${sum("average")}</td><td>${sum("difficult")}</td><td>${sum("quota")}</td></tr>`;

    const qRows = exam.items.map((q) => `<tr>
      <td style="text-align:center;font-weight:bold">${q.position}</td><td style="text-align:center">${UI.esc(q.iloCode)}</td><td style="text-align:center">${UI.esc(q.category)}</td>
      <td>${UI.esc(q.stem)}</td>
      <td>${["A", "B", "C", "D"].map((l) => `<div class="${showKey && q.key === l ? "correct-key-highlight" : ""}">${l}) ${UI.esc(q.options[l])}</div>`).join("")}</td></tr>`).join("");

    return fill(template, {
      COURSE_UPPER: UI.esc(course.course.toUpperCase()), COURSE: UI.esc(course.course),
      SCHOOL_YEAR: UI.esc(course.schoolYear), EXAM_LABEL: UI.esc(exam.label),
      TOTAL_ITEMS: exam.items.length, TOS_ROWS: tosRows, QUESTION_ROWS: qRows
    });
  }

  async function show() {
    const id = root.querySelector("#f4-exam").value;
    const area = root.querySelector("#printable-form4-area");
    if (!id) { area.innerHTML = '<p class="text-sm text-slate-400 no-print">Save an exam for this course in Step 4, then pick it here.</p>'; return; }
    await UI.run(null, async () => {
      if (!template) {
        const res = await fetch("templates/form4-template.html");
        if (!res.ok) throw new Error("Could not load templates/form4-template.html. Open the app through http://localhost, not by double-clicking the file.");
        template = await res.text();
      }
      const exam = await API.call("getExam", { examId: id });
      area.innerHTML = build(exam, root.querySelector("#f4-key").checked);
    });
  }

  async function loadExams() {
    exams = await Data.exams();
    const sel = root.querySelector("#f4-exam");
    const prev = sel.value;
    sel.innerHTML = exams.length
      ? exams.map((e) => `<option value="${UI.esc(e.examId)}">${UI.esc(e.label)} (${e.count} items)</option>`).join("")
      : '<option value="">No saved exams for this course</option>';
    if (prev && exams.some((e) => e.examId === prev)) sel.value = prev;
  }

  async function loadCourse() {
    Data.fillCourseSelect(root.querySelector("#f4-course"));
    const has = !!State.courseId;
    root.querySelector("#f4-empty").classList.toggle("hidden", has);
    root.querySelector("#f4-body").classList.toggle("hidden", !has);
    if (!has) return;
    await loadExams();
    await show();
  }

  async function sync() { await Data.courses(); await loadCourse(); }

  window.Steps.form4 = {
    mount(el) {
      root = el;
      root.innerHTML = Data.courseBarHtml("f4-course") +
        '<div id="f4-empty" class="hidden p-8 text-center text-slate-500 bg-white border border-dashed rounded-xl text-sm no-print">There is no course yet. Create one in Step 1.</div>' +
        '<div id="f4-body" class="space-y-4">' + BODY + "</div>";
      root.querySelector("#f4-course").onchange = function () { Data.setCourse(this.value); UI.run(null, loadCourse); };
      root.querySelector("#f4-exam").onchange = show;
      root.querySelector("#f4-key").onchange = show;
      root.querySelector("#f4-print").onclick = () => {
        if (!root.querySelector("#f4-exam").value) { UI.toast("Save an exam for this course in Step 4 first.", "error"); return; }
        window.print();
      };
    },
    onShow() { UI.run(null, sync); }
  };
})();
