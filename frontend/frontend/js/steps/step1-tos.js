/**
 * Step 1 - Courses and their TOS (Table of Specifications).
 *   Course list    - every course with its TOS date; red when the TOS is older than the limit (3 years).
 *   TOS editor     - course code, title, TOS date, prepared by, ILO rows. Admin edits freely; GECAC may create a new course,
 *                    but a SAVED TOS is locked until the admin approves a permission request.
 *   Edit requests  - admin approves or denies; GECAC sees the status of their own requests.
 */
(function () {
  const esc = UI.esc;
  const isAdmin = () => State.session.role === "admin";
  const isGecac = () => State.session.role === "gecac";

  let root, tab = "list";
  let courses = [], requests = [];
  let rows = [], course = null, edit = null, isNew = false, dirty = false, timer = null;

  // ---------------------------------------------------------------- small helpers
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const fmtDay = (s) => { if (!s) return "-"; const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); };
  const fmtStamp = (iso) => { if (!iso) return "-"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const target = () => (course && course.targetItems) || 70;
  const blankRow = (n) => ({ iloCode: "ILO-" + String(n).padStart(3, "0"), ilo: "", hours: 0, easy: 0, average: 0, difficult: 0 });
  const canEdit = () => isNew || isAdmin() || (isGecac() && !!edit && edit.allowed);
  const $ = (sel) => root.querySelector(sel);

  // ---------------------------------------------------------------- markup
  const TEMPLATE = `
    <div class="flex flex-wrap items-end gap-1 border-b border-slate-300" role="tablist" id="t1-tabs">
      <button type="button" data-t1="list"></button>
      <button type="button" data-t1="editor"></button>
      <button type="button" data-t1="requests"></button>
    </div>

    <!-- ===================== COURSE LIST ===================== -->
    <section id="t1-list" class="space-y-4">
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 class="text-base font-bold text-slate-800">Course list</h2>
            <p class="text-xs text-slate-500">Every course keeps its own TOS.
              <span class="text-rose-700 font-semibold">Red</span> = the TOS is older than <span id="t1-years">3</span> years.
              <span class="text-amber-700 font-semibold">Amber</span> = it expires within 6 months.</p>
          </div>
          <div class="flex items-center gap-3">
            <span id="t1-summary" class="text-xs font-semibold"></span>
            <button id="t1-list-new" class="btn btn-primary">New course</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border text-left">
            <thead class="bg-slate-100"><tr>
              <th class="p-2 border">Course code</th><th class="p-2 border">Course title</th><th class="p-2 border">School year</th>
              <th class="p-2 border">TOS date created</th><th class="p-2 border">Age / valid until</th><th class="p-2 border">Status</th>
              <th class="p-2 border">Prepared by</th><th class="p-2 border">Last edited</th><th class="p-2 border"></th>
            </tr></thead>
            <tbody id="t1-list-body"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ===================== TOS EDITOR ===================== -->
    <section id="t1-editor" class="hidden space-y-4">
      <div id="t1-lock" class="hidden"></div>

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
          <div><label for="t1-code" class="lbl">Course code</label><input id="t1-code" class="inp" maxlength="20" placeholder="e.g. GEE 101"></div>
          <div class="md:col-span-2"><label for="t1-title" class="lbl">Course title</label><input id="t1-title" class="inp" maxlength="120" placeholder="e.g. Gender and Society"></div>
          <div><label for="t1-sy" class="lbl">School year &amp; semester</label><input id="t1-sy" class="inp" maxlength="120" placeholder="e.g. S.Y. 2026-2027 / Second Semester"></div>
          <div><label for="t1-date" class="lbl">TOS date created</label><input id="t1-date" type="date" class="inp"></div>
          <div><label for="t1-prep" class="lbl">Prepared by</label><input id="t1-prep" class="inp" maxlength="80"></div>
          <div><label for="tos-target" class="lbl">Target total exam items</label><input id="tos-target" class="inp font-bold" readonly></div>
          <div class="md:col-span-2"><label for="t1-edited" class="lbl">Last edited by</label><input id="t1-edited" class="inp" readonly></div>
        </div>
        <div id="t1-renew-row" class="hidden rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <label class="flex items-center gap-2 font-semibold"><input id="t1-renew" type="checkbox">
            Renew: set the TOS date to today. <span class="font-normal">This TOS is old; tick this once its content has been reviewed and updated.</span></label>
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
      </div>
    </section>

    <!-- ===================== EDIT REQUESTS ===================== -->
    <section id="t1-requests" class="hidden space-y-4">
      <div id="t1-pending-card" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div><h2 class="text-base font-bold text-slate-800">Waiting for your decision</h2>
          <p class="text-xs text-slate-500">GECAC asks permission before editing a saved TOS. Approve to open it for the number of days you choose; it locks again after one save.</p></div>
        <div class="overflow-x-auto"><table class="w-full text-xs border text-left">
          <thead class="bg-slate-100"><tr><th class="p-2 border">Sent</th><th class="p-2 border">By</th><th class="p-2 border">Course</th><th class="p-2 border">Reason</th><th class="p-2 border">Decision</th></tr></thead>
          <tbody id="t1-pending-body"></tbody></table></div>
      </div>
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div><h2 id="t1-hist-title" class="text-base font-bold text-slate-800">Request history</h2></div>
        <div class="overflow-x-auto"><table class="w-full text-xs border text-left">
          <thead class="bg-slate-100"><tr><th class="p-2 border">Sent</th><th class="p-2 border">By</th><th class="p-2 border">Course</th><th class="p-2 border">Reason</th><th class="p-2 border">Status</th><th class="p-2 border">Decided</th><th class="p-2 border">Note</th></tr></thead>
          <tbody id="t1-hist-body"></tbody></table></div>
      </div>
    </section>`;

  // ---------------------------------------------------------------- tabs
  function paintTabs() {
    const pending = isAdmin() ? requests.filter((r) => r.status === "Pending").length : 0;
    const labels = { list: "Course list", editor: "TOS editor", requests: (isAdmin() ? "Edit requests" : "My edit requests") };
    root.querySelectorAll("#t1-tabs button").forEach((b) => {
      const on = b.dataset.t1 === tab;
      b.className = "px-4 py-2 text-sm font-semibold rounded-t-lg border " +
        (on ? "bg-white text-indigo-700 border-slate-300 -mb-px" : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200");
      b.style.borderBottomColor = on ? "#fff" : "";
      const extra = b.dataset.t1 === "requests" && pending ? ` <span class="inline-block text-xs font-bold bg-rose-600 text-white rounded-full px-2">${pending}</span>` : "";
      b.innerHTML = labels[b.dataset.t1] + extra;
    });
    const nav = document.getElementById("tab-tos");        // also show the number on the main tab
    if (nav) { if (!nav.dataset.base) nav.dataset.base = nav.textContent; nav.textContent = nav.dataset.base + (pending ? " (" + pending + ")" : ""); }
  }

  async function showTab(name) {
    tab = name;
    ["list", "editor", "requests"].forEach((t) => $("#t1-" + t).classList.toggle("hidden", t !== name));
    paintTabs();
    if (name === "editor") {
      if (!isNew && !dirty && course) await loadIntoEditor(course.courseId);   // refresh the lock state
      if (UI.isVisible(root)) Charts.tos(rows);
    }
    if (name === "requests") await loadRequests();
  }

  // ---------------------------------------------------------------- course list
  function statusBadge(c) {
    if (c.status === "Expired") return UI.badge("Over " + c.maxYears + " years", "red");
    if (c.status === "Expiring") return UI.badge("Expires " + fmtDay(c.expiresOn), "amber");
    if (c.status === "NoDate") return UI.badge("No date", "slate");
    return UI.badge("Valid until " + fmtDay(c.expiresOn), "green");
  }

  function editChip(c) {
    if (!isGecac() || !c.edit) return "";
    const e = c.edit;
    if (e.state === "approved") return " " + UI.badge("Approved until " + fmtDay((e.validUntil || "").slice(0, 10)), "green");
    if (e.state === "pending") return " " + UI.badge("Request pending", "amber");
    if (e.state === "denied") return " " + UI.badge("Request denied", "red");
    return " " + UI.badge("Locked", "slate");
  }

  function renderList() {
    const body = $("#t1-list-body");
    if (!courses.length) {
      body.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-400">No course yet. Click "New course" to create the first one.</td></tr>';
      $("#t1-summary").textContent = "";
      return;
    }
    $("#t1-years").textContent = courses[0].maxYears || 3;
    body.innerHTML = courses.map((c) => {
      const tone = c.status === "Expired" ? "bg-rose-50 text-rose-900" : c.status === "Expiring" ? "bg-amber-50 text-amber-900" : "";
      const edge = c.status === "Expired" ? "border-l-4 border-l-rose-500" : c.status === "Expiring" ? "border-l-4 border-l-amber-400" : "";
      return `<tr class="${tone}">
        <td class="p-2 border font-semibold ${edge}">${esc(c.courseCode) || "-"}</td>
        <td class="p-2 border ${c.status === "Expired" ? "font-bold" : ""}">${esc(c.courseTitle)}</td>
        <td class="p-2 border">${esc(c.schoolYear) || "-"}</td>
        <td class="p-2 border whitespace-nowrap">${fmtDay(c.tosDate)}</td>
        <td class="p-2 border whitespace-nowrap">${esc(c.ageText) || "-"}${c.expiresOn ? '<div class="text-slate-500" style="font-size:10px">until ' + fmtDay(c.expiresOn) + "</div>" : ""}</td>
        <td class="p-2 border">${statusBadge(c)}</td>
        <td class="p-2 border">${esc(c.preparedBy) || "-"}</td>
        <td class="p-2 border">${c.editedBy ? esc(c.editedBy) + '<div class="text-slate-500" style="font-size:10px">' + fmtDay((c.editedAt || "").slice(0, 10)) + "</div>" : "-"}</td>
        <td class="p-2 border whitespace-nowrap"><button class="link-btn text-indigo-600" data-open="${esc(c.courseId)}">${isAdmin() || !isGecac() ? "Open" : "Open / request edit"}</button>${editChip(c)}</td>
      </tr>`;
    }).join("");
    const expired = courses.filter((c) => c.status === "Expired").length, soon = courses.filter((c) => c.status === "Expiring").length;
    const sum = $("#t1-summary");
    sum.innerHTML = (expired ? `<span class="text-rose-700">${expired} over ${courses[0].maxYears} years</span>` : '<span class="text-emerald-700">No expired TOS</span>') +
      (soon ? ` · <span class="text-amber-700">${soon} expiring soon</span>` : "");
  }

  async function refreshCourses() {
    await Data.courses();
    courses = State.courses;
    renderList();
  }

  // ---------------------------------------------------------------- editor
  function compute() {
    const totalHours = rows.reduce((s, r) => s + num(r.hours), 0);
    rows.forEach((r) => {
      r.hours = num(r.hours); r.easy = num(r.easy); r.average = num(r.average); r.difficult = num(r.difficult);
      r.quota = r.easy + r.average + r.difficult;
      r.weight = totalHours ? Math.round(r.hours / totalHours * 1000) / 10 : 0;
    });
  }

  function fillPick() {
    const sel = $("#tos-pick");
    let html = State.courses.map((c) => `<option value="${esc(c.courseId)}">${c.status === "Expired" ? "&#9888; " : ""}${esc(c.course)}</option>`).join("");
    if (isNew) html = '<option value="__new__">New course (not saved yet)</option>' + html;
    sel.innerHTML = html;
    sel.value = isNew ? "__new__" : course ? course.courseId : "";
    $("#tos-mode").textContent = isNew
      ? "New course - it is saved under the course code and title you type below."
      : canEdit() ? "Editing the saved course." : "Saved course (read only).";
    $("#tos-del").classList.toggle("hidden", isNew || !isAdmin());
  }

  function fillFields() {
    $("#t1-code").value = course.courseCode || "";
    $("#t1-title").value = course.courseTitle || "";
    $("#t1-sy").value = course.schoolYear || "";
    $("#t1-date").value = course.tosDate || "";
    $("#t1-prep").value = course.preparedBy || "";
    $("#tos-target").value = target();
    $("#t1-edited").value = course.editedBy ? course.editedBy + " - " + fmtStamp(course.editedAt) : "-";
    const old = !isNew && (course.status === "Expired" || course.status === "Expiring");
    $("#t1-renew-row").classList.toggle("hidden", !old);
    $("#t1-renew").checked = false;
  }

  function renderLock() {
    const box = $("#t1-lock");
    if (isNew || !isGecac() || !course) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    const e = edit || { state: "locked" };
    if (e.state === "approved") {
      box.innerHTML = `<div class="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Permission approved.</strong>
        You may edit this TOS until <strong>${fmtStamp(e.validUntil)}</strong>. Saving it uses up the permission and the TOS locks again.</div>`;
    } else if (e.state === "pending") {
      box.innerHTML = `<div class="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Request sent.</strong>
        Waiting for the administrator (sent ${fmtStamp(e.requestedAt)}).<div class="text-xs mt-1">Your reason: ${esc(e.reason)}</div></div>`;
    } else {
      box.innerHTML = `<div class="rounded-xl border-2 border-slate-300 bg-white p-4 text-sm text-slate-800 space-y-2">
        <div><strong>This saved TOS is locked.</strong> The administrator must give permission before GECAC can edit it.</div>
        ${e.state === "denied" ? `<div class="text-xs text-rose-700">Your last request was denied: ${esc(e.note || "no note")}</div>` : ""}
        <label for="t1-reason" class="lbl">Why does this TOS need to be edited?</label>
        <textarea id="t1-reason" class="inp" rows="2" maxlength="300" placeholder="e.g. The TOS is more than 3 years old and the outcomes were revised."></textarea>
        <button type="button" id="t1-ask" class="btn btn-primary">Request permission to edit</button></div>`;
    }
  }

  function applyEditable() {
    const ok = canEdit();
    ["#t1-code", "#t1-title", "#t1-sy", "#t1-prep", "#tos-add"].forEach((s) => { $(s).disabled = !ok; });
    $("#tos-save").disabled = !ok;
    $("#t1-renew").disabled = !ok;
    // the TOS date: free for a new course; for a saved one only the admin may correct it (GECAC use "Renew")
    $("#t1-date").disabled = !ok || (!isNew && !isAdmin()) || $("#t1-renew").checked;
    $("#tos-body").querySelectorAll("input, button").forEach((el) => { el.disabled = !ok; });
    $("#tos-mode").textContent = isNew ? "New course - it is saved under the course code and title you type below." : ok ? "Editing the saved course." : "Saved course (read only).";
  }

  function renderRows() {
    $("#tos-body").innerHTML = rows.map((r, i) => `
      <tr>
        <td class="p-1 border"><input class="cell-input font-bold" data-i="${i}" data-f="iloCode" value="${esc(r.iloCode)}" maxlength="20" aria-label="ILO code"></td>
        <td class="p-1 border"><input class="cell-input" data-i="${i}" data-f="ilo" value="${esc(r.ilo)}" maxlength="200" aria-label="ILO description"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="hours" value="${r.hours}" aria-label="Hours"></td>
        <td class="p-2 border text-center" id="tos-w-${i}"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="easy" value="${r.easy}" aria-label="Easy items"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="average" value="${r.average}" aria-label="Average items"></td>
        <td class="p-1 border"><input class="cell-input text-center" type="number" min="0" data-i="${i}" data-f="difficult" value="${r.difficult}" aria-label="Difficult items"></td>
        <td class="p-2 border text-center font-bold text-indigo-600" id="tos-q-${i}"></td>
        <td class="p-1 border text-center"><button class="link-btn text-rose-600" data-del="${i}">Remove</button></td>
      </tr>`).join("");
    refresh();
    applyEditable();
  }

  function refresh() {
    compute();
    rows.forEach((r, i) => {
      const w = $("#tos-w-" + i), q = $("#tos-q-" + i);
      if (w) w.textContent = r.weight + "%";
      if (q) q.textContent = r.quota;
    });
    const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
    const total = sum("quota"), goal = target();
    $("#tos-foot").innerHTML = `<tr class="bg-slate-50 font-bold">
      <td class="p-2 border" colspan="2">Total</td><td class="p-2 border text-center">${sum("hours")}</td><td class="p-2 border text-center">100%</td>
      <td class="p-2 border text-center">${sum("easy")}</td><td class="p-2 border text-center">${sum("average")}</td>
      <td class="p-2 border text-center">${sum("difficult")}</td><td class="p-2 border text-center">${total}</td><td class="border"></td></tr>`;
    $("#tos-status").innerHTML = total === goal
      ? UI.badge("Quotas add up to " + goal + " items", "green")
      : UI.badge("Quotas add up to " + total + " - they must equal " + goal + " (" + (total > goal ? "remove " + (total - goal) : "add " + (goal - total)) + ")", "red");
    clearTimeout(timer);
    timer = setTimeout(() => { if (UI.isVisible(root) && tab === "editor") Charts.tos(rows); }, 200);
  }

  function showSaved(data) {
    course = Object.assign({}, data.course);
    rows = data.rows.map((r) => Object.assign({}, r));
    edit = data.edit || null;
    isNew = false; dirty = false;
    fillPick(); fillFields(); renderRows(); renderLock();
  }

  function startNew(copyRows) {
    isNew = true; dirty = false; edit = null;
    const sy = course ? course.schoolYear : "";
    rows = copyRows ? rows.map((r) => Object.assign({}, r)) : [blankRow(1)];
    course = { courseId: "", courseCode: "", courseTitle: "", schoolYear: sy, targetItems: 70, tosDate: todayStr(), preparedBy: State.session.fullName };
    fillPick(); fillFields(); renderRows(); renderLock();
  }

  async function loadIntoEditor(id) {
    Data.setCourse(id);
    showSaved(await Data.tos(true));
  }

  async function openCourse(id) {
    await loadIntoEditor(id);
    await showTab("editor");
  }

  const confirmDiscard = () => !dirty || confirm("You have unsaved changes. Discard them?");

  async function save(btn) {
    const wasNew = isNew;
    await UI.run(btn, async () => {
      const data = await API.call("saveTos", {
        courseId: isNew ? "" : course.courseId,
        courseCode: $("#t1-code").value, courseTitle: $("#t1-title").value, schoolYear: $("#t1-sy").value,
        tosDate: $("#t1-date").value, preparedBy: $("#t1-prep").value, renew: $("#t1-renew").checked,
        rows: rows.map((r) => ({ iloCode: r.iloCode, ilo: r.ilo, hours: r.hours, easy: r.easy, average: r.average, difficult: r.difficult }))
      });
      Data.setCourse(data.course.courseId);
      State.tos = data;
      await refreshCourses();
      showSaved(data);
      await loadRequests();
      UI.toast('Saved the TOS for "' + data.course.course + '".' + (isGecac() && !wasNew && !data.edit.allowed ? " It is locked again." : ""), "success");
    });
  }

  // ---------------------------------------------------------------- edit requests
  async function loadRequests() {
    if (!isAdmin() && !isGecac()) return;
    try { requests = await API.call("listEditRequests"); } catch (e) { requests = []; }
    renderRequests();
    paintTabs();
  }

  const reqBadge = (s) => UI.badge(s, s === "Approved" ? "green" : s === "Pending" ? "amber" : s === "Denied" || s === "Expired" ? "red" : "slate");

  function renderRequests() {
    const pending = requests.filter((r) => r.status === "Pending");
    $("#t1-pending-card").classList.toggle("hidden", !isAdmin());
    $("#t1-pending-body").innerHTML = pending.length ? pending.map((r) => `<tr>
      <td class="p-2 border whitespace-nowrap">${fmtStamp(r.requestedAt)}</td>
      <td class="p-2 border">${esc(r.requestedByName)}</td><td class="p-2 border font-semibold">${esc(r.course)}</td>
      <td class="p-2 border">${esc(r.reason)}</td>
      <td class="p-2 border whitespace-nowrap">
        <span class="inline-flex items-center gap-2">
          <select class="inp" data-days style="width:auto" aria-label="Days of permission"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option></select>
          <button class="btn btn-green" data-approve="${esc(r.requestId)}">Approve</button>
          <button class="btn btn-danger" data-deny="${esc(r.requestId)}">Deny</button>
        </span></td></tr>`).join("") : '<tr><td colspan="5" class="p-4 text-center text-slate-400">No request is waiting.</td></tr>';

    const hist = isAdmin() ? requests.filter((r) => r.status !== "Pending") : requests;
    $("#t1-hist-title").textContent = isAdmin() ? "Request history" : "My requests";
    $("#t1-hist-body").innerHTML = hist.length ? hist.map((r) => `<tr>
      <td class="p-2 border whitespace-nowrap">${fmtStamp(r.requestedAt)}</td><td class="p-2 border">${esc(r.requestedByName)}</td>
      <td class="p-2 border">${esc(r.course)}</td><td class="p-2 border">${esc(r.reason)}</td>
      <td class="p-2 border">${reqBadge(r.status)}${r.status === "Approved" ? '<div class="text-slate-500" style="font-size:10px">until ' + fmtStamp(r.validUntil) + "</div>" : ""}</td>
      <td class="p-2 border">${r.decidedBy ? esc(r.decidedBy) + '<div class="text-slate-500" style="font-size:10px">' + fmtStamp(r.decidedAt) + "</div>" : "-"}</td>
      <td class="p-2 border">${esc(r.decisionNote) || "-"}</td></tr>`).join("")
      : '<tr><td colspan="7" class="p-4 text-center text-slate-400">No requests yet.</td></tr>';
  }

  // ---------------------------------------------------------------- mount
  async function init() {
    await refreshCourses();
    await loadRequests();
    if (!courses.length) { startNew(false); await showTab("editor"); return; }
    await loadIntoEditor(State.courseId || courses[0].courseId);
    await showTab("list");
  }

  window.Steps.tos = {
    mount(el) {
      root = el;
      root.innerHTML = TEMPLATE;
      paintTabs();

      root.querySelector("#t1-tabs").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-t1]");
        if (b) UI.run(null, () => showTab(b.dataset.t1));
      });

      // ---- course list
      $("#t1-list-new").onclick = () => { if (confirmDiscard()) { startNew(false); showTab("editor"); } };
      $("#t1-list-body").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-open]"); if (!b) return;
        if (!confirmDiscard()) return;
        UI.run(null, () => openCourse(b.dataset.open));
      });

      // ---- editor
      $("#tos-body").addEventListener("input", (e) => {
        const t = e.target; if (!t.dataset.f) return;
        rows[Number(t.dataset.i)][t.dataset.f] = t.value; dirty = true; refresh();
      });
      $("#tos-body").addEventListener("click", (e) => {
        const i = e.target.dataset.del; if (i === undefined || !canEdit()) return;
        rows.splice(Number(i), 1); dirty = true; renderRows();
      });
      ["#t1-code", "#t1-title", "#t1-sy", "#t1-date", "#t1-prep"].forEach((s) => $(s).addEventListener("input", () => { dirty = true; }));
      $("#t1-renew").addEventListener("change", function () {
        const d = $("#t1-date");
        if (this.checked) { d.value = todayStr(); } else { d.value = course.tosDate || ""; }
        dirty = true; applyEditable();
      });

      $("#tos-pick").onchange = function () {
        if (this.value === "__new__") return;
        if (!confirmDiscard()) { fillPick(); return; }
        UI.run(null, () => loadIntoEditor(this.value));
      };
      $("#tos-new").onclick = () => { if (confirmDiscard()) startNew(false); };
      $("#tos-dup").onclick = () => { if (confirmDiscard()) startNew(true); };
      $("#tos-add").onclick = () => { if (!canEdit()) return; rows.push(blankRow(rows.length + 1)); dirty = true; renderRows(); };
      $("#tos-save").onclick = function () { save(this); };

      $("#tos-del").onclick = function () {
        if (isNew || !course) return;
        if (!confirm('Delete the course "' + course.course + '" and its TOS? This cannot be undone.')) return;
        UI.run(this, async () => {
          await API.call("deleteCourse", { courseId: course.courseId });
          UI.toast("Course deleted.", "success");
          Data.setCourse("");
          course = null;
          await init();
        });
      };

      // GECAC: ask the admin for permission to edit a saved TOS
      $("#t1-lock").addEventListener("click", (e) => {
        const btn = e.target.closest("#t1-ask"); if (!btn) return;
        const reason = $("#t1-reason").value.trim();
        if (reason.length < 5) { UI.toast("Please write a short reason (at least 5 characters).", "error"); return; }
        UI.run(btn, async () => {
          await API.call("requestTosEdit", { courseId: course.courseId, reason: reason });
          UI.toast("Request sent to the administrator.", "success");
          await loadIntoEditor(course.courseId);
          await refreshCourses();
          await loadRequests();
        });
      });

      // ---- requests (admin)
      $("#t1-pending-body").addEventListener("click", (e) => {
        const ap = e.target.closest("button[data-approve]"), de = e.target.closest("button[data-deny]");
        if (ap) {
          const days = Number(ap.closest("tr").querySelector("[data-days]").value);
          UI.run(ap, async () => { await API.call("decideEditRequest", { requestId: ap.dataset.approve, decision: "Approve", days: days }); UI.toast("Approved for " + days + " day(s).", "success"); await loadRequests(); await refreshCourses(); });
        } else if (de) {
          const note = prompt("Why is this request denied? GECAC will see this note.");
          if (note === null) return;
          if (note.trim().length < 3) { UI.toast("Please write a short note.", "error"); return; }
          UI.run(de, async () => { await API.call("decideEditRequest", { requestId: de.dataset.deny, decision: "Deny", note: note }); UI.toast("Request denied.", "success"); await loadRequests(); await refreshCourses(); });
        }
      });

      UI.run(null, init);
    },
    onShow() {
      UI.run(null, async () => {
        await refreshCourses();
        await loadRequests();
        if (tab === "editor" && rows.length) Charts.tos(rows);
      });
    }
  };
})();