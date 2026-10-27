/** Step 1 - Courses and their TOS blueprint. Admin and GECAC can edit. The TOS is saved per Course & title. */
(function () {
  let root, rows = [], course = null, isNew = false, dirty = false, timer = null;

  const TEMPLATE = `
    <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div class="flex flex-wrap justify-between items-end gap-3 border-b pb-3">
        <div class="flex-1" style="min-width:18rem">
          <label for="tos-pick" class="lbl">Saved courses</label>
          <select id="tos-pick" class="inp" style="font-size:.875rem;padding:.5rem"></select>
          <p id="tos-mode" class="text-xs text-slate-500 mt-1"></p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="tos-new" class="btn btn-light">New course</button>
          <button id="tos-dup" class="btn btn-light" title="Start a new course with the same ILO rows">Duplicate as new</button>
          <button id="tos-add" class="btn btn-light">Add ILO row</button>
          <button id="tos-save" class="btn btn-primary">Save TOS</button>
          <button id="tos-del" class="btn btn-danger hidden">Delete course</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><label for="tos-course" class="lbl">Course code &amp; title</label><input id="tos-course" class="inp" maxlength="120" placeholder="e.g. GEC 108 - Assessment of Learning 1"></div>
        <div><label for="tos-sy" class="lbl">School year &amp; semester</label><input id="tos-sy" class="inp" maxlength="120" placeholder="e.g. S.Y. 2026-2027 / Second Semester"></div>
        <div><label for="tos-target" class="lbl">Target total exam items</label><input id="tos-target" class="inp font-bold" readonly></div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs border text-left">
          <thead class="bg-slate-100"><tr>
            <th class="p-2 border w-24">Code</th><th class="p-2 border">Intended learning outcome (ILO)</th>
            <th class="p-2 border w-20 text-center">Hours</th><th class="p-2 border w-20 text-center">Weight</th>
            <th class="p-2 border w-24 text-center">Easy</th><th class="p-2 border w-24 text-center">Average</th>
            <th class="p-2 border w-24 text-center">Difficult</th><th class="p-2 border w-20 text-center">Quota</th>
            <th class="p-2 border w-16"></th>
          </tr></thead>
          <tbody id="tos-body"></tbody>
          <tfoot id="tos-foot"></tfoot>
        </table>
      </div>
      <p class="text-xs text-slate-500">Weight is worked out from hours. Quota is Easy + Average + Difficult. The quotas must add up to the target number of items. Each course keeps its own TOS, question pool, exams and Form 4.</p>
      <div id="tos-status"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Teaching hours per ILO</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Hover to see the item quota</p>
        <div class="chart-box"><canvas id="c-tos-weight"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Cognitive mix per ILO</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Easy / Average / Difficult items required</p>
        <div class="chart-box"><canvas id="c-tos-cog"></canvas></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="text-xs font-bold text-slate-800">Hours vs. exam quota</h3>
        <p class="text-slate-500 mb-2" style="font-size:10px">Items should follow the time spent</p>
        <div class="chart-box"><canvas id="c-tos-hours"></canvas></div>
      </div>
    </div>`;

  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const target = () => (course && course.targetItems) || 70;
  const blankRow = (n) => ({ iloCode: "ILO-" + String(n).padStart(3, "0"), ilo: "", hours: 0, easy: 0, average: 0, difficult: 0 });

  function compute() {
    const totalHours = rows.reduce((s, r) => s + num(r.hours), 0);
    rows.forEach((r) => {
      r.hours = num(r.hours); r.easy = num(r.easy); r.average = num(r.average); r.difficult = num(r.difficult);
      r.quota = r.easy + r.average + r.difficult;
      r.weight = totalHours ? Math.round(r.hours / totalHours * 1000) / 10 : 0;
    });
  }

  function fillPick() {
    const sel = root.querySelector("#tos-pick");
    let html = State.courses.map((c) => `<option value="${UI.esc(c.courseId)}">${UI.esc(c.course)}</option>`).join("");
    if (isNew) html = '<option value="__new__">New course (not saved yet)</option>' + html;
    sel.innerHTML = html;
    sel.value = isNew ? "__new__" : course ? course.courseId : "";
    root.querySelector("#tos-mode").textContent = isNew
      ? "New course - it is saved under the Course code & title you type below."
      : "Editing the saved course. Changes are saved under this Course code & title.";
    root.querySelector("#tos-del").classList.toggle("hidden", isNew || State.session.role !== "admin");
  }

  function fillFields() {
    root.querySelector("#tos-course").value = course.course;
    root.querySelector("#tos-sy").value = course.schoolYear;
    root.querySelector("#tos-target").value = target();
  }

  function renderRows() {
    root.querySelector("#tos-body").innerHTML = rows.map((r, i) => `
      <tr>
        <td class="p-1 border"><input class="cell-input font-bold" data-i="${i}" data-f="iloCode" value="${UI.esc(r.iloCode)}" maxlength="20" aria-label="ILO code"></td>
        <td class="p-1 border"><input class="cell-input" data-i="${i}" data-f="ilo" value="${UI.esc(r.ilo)}" maxlength="200" aria-label="ILO description"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="hours" value="${r.hours}" aria-label="Hours"></td>
        <td class="p-2 border text-center" id="tos-w-${i}"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="easy" value="${r.easy}" aria-label="Easy items"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="average" value="${r.average}" aria-label="Average items"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="difficult" value="${r.difficult}" aria-label="Difficult items"></td>
        <td class="p-2 border text-center font-bold text-indigo-600" id="tos-q-${i}"></td>
        <td class="p-1 border text-center"><button class="link-btn text-rose-600" data-del="${i}">Remove</button></td>
      </tr>`).join("");
    refresh();
  }

  function refresh() {
    compute();
    rows.forEach((r, i) => {
      const w = root.querySelector("#tos-w-" + i), q = root.querySelector("#tos-q-" + i);
      if (w) w.textContent = r.weight + "%";
      if (q) q.textContent = r.quota;
    });
    const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
    const total = sum("quota"), goal = target();
    root.querySelector("#tos-foot").innerHTML = `<tr class="bg-slate-50 font-bold">
      <td class="p-2 border" colspan="2">Total</td><td class="p-2 border text-center">${sum("hours")}</td><td class="p-2 border text-center">100%</td>
      <td class="p-2 border text-center">${sum("easy")}</td><td class="p-2 border text-center">${sum("average")}</td>
      <td class="p-2 border text-center">${sum("difficult")}</td><td class="p-2 border text-center">${total}</td><td class="border"></td></tr>`;
    root.querySelector("#tos-status").innerHTML = total === goal
      ? UI.badge("Quotas add up to " + goal + " items", "green")
      : UI.badge("Quotas add up to " + total + " - they must equal " + goal + " (" + (total > goal ? "remove " + (total - goal) : "add " + (goal - total)) + ")", "red");
    clearTimeout(timer);
    timer = setTimeout(() => { if (UI.isVisible(root)) Charts.tos(rows); }, 200);
  }

  function showSaved(data) {
    course = Object.assign({}, data.course);
    rows = data.rows.map((r) => Object.assign({}, r));
    isNew = false; dirty = false;
    fillPick(); fillFields(); renderRows();
  }

  function startNew(copyRows) {
    isNew = true; dirty = false;
    const sy = course ? course.schoolYear : "";
    rows = copyRows ? rows.map((r) => Object.assign({}, r)) : [blankRow(1)];
    course = { courseId: "", course: "", schoolYear: sy, targetItems: 70 };
    fillPick(); fillFields(); renderRows();
    root.querySelector("#tos-course").focus();
  }

  async function loadCourse(id) {
    Data.setCourse(id);
    showSaved(await Data.tos(true));
  }

  async function init() {
    await Data.courses();
    if (!State.courseId) { startNew(false); return; }
    await loadCourse(State.courseId);
  }

  const confirmDiscard = () => !dirty || confirm("You have unsaved changes. Discard them?");

  window.Steps.tos = {
    mount(el) {
      root = el;
      root.innerHTML = TEMPLATE;

      root.querySelector("#tos-body").addEventListener("input", (e) => {
        const t = e.target; if (!t.dataset.f) return;
        rows[Number(t.dataset.i)][t.dataset.f] = t.value; dirty = true; refresh();
      });
      root.querySelector("#tos-body").addEventListener("click", (e) => {
        const i = e.target.dataset.del; if (i === undefined) return;
        rows.splice(Number(i), 1); dirty = true; renderRows();
      });
      ["#tos-course", "#tos-sy"].forEach((s) => root.querySelector(s).addEventListener("input", () => { dirty = true; }));

      root.querySelector("#tos-pick").onchange = function () {
        if (this.value === "__new__") return;
        if (!confirmDiscard()) { fillPick(); return; }
        UI.run(null, () => loadCourse(this.value));
      };
      root.querySelector("#tos-new").onclick = () => { if (confirmDiscard()) startNew(false); };
      root.querySelector("#tos-dup").onclick = () => { if (confirmDiscard()) startNew(true); };
      root.querySelector("#tos-add").onclick = () => { rows.push(blankRow(rows.length + 1)); dirty = true; renderRows(); };

      root.querySelector("#tos-save").onclick = function () {
        UI.run(this, async () => {
          const data = await API.call("saveTos", {
            courseId: isNew ? "" : course.courseId,
            course: root.querySelector("#tos-course").value,
            schoolYear: root.querySelector("#tos-sy").value,
            rows: rows.map((r) => ({ iloCode: r.iloCode, ilo: r.ilo, hours: r.hours, easy: r.easy, average: r.average, difficult: r.difficult }))
          });
          Data.setCourse(data.course.courseId);
          State.tos = data;
          await Data.courses();
          showSaved(data);
          UI.toast('Saved the TOS for "' + data.course.course + '".', "success");
        });
      };

      root.querySelector("#tos-del").onclick = function () {
        if (isNew || !course) return;
        if (!confirm('Delete the course "' + course.course + '" and its TOS? This cannot be undone.')) return;
        UI.run(this, async () => {
          await API.call("deleteCourse", { courseId: course.courseId });
          UI.toast("Course deleted.", "success");
          Data.setCourse("");
          await init();
        });
      };

      UI.run(null, init);
    },
    onShow() { if (rows.length && UI.isVisible(root)) Charts.tos(rows); }
  };
})();
