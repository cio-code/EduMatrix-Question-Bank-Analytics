/** Builds the app shell for the signed-in role and loads only the step scripts that role may use. */
(async function () {
  const session = Auth.requireLogin();
  if (!session) return;
  State.session = session;

  const META = {
    tos:      { label: "1. TOS blueprint",       file: "step1-tos" },
    pool:     { label: "2. Question pool",       file: "step2-pool" },
    analysis: { label: "3. Post-exam analysis",  file: "step3-analysis" },
    curation: { label: "4. AI curation",         file: "step4-curation" },
    form4:    { label: "5. Printable Form 4",    file: "step5-form4" },
    users:    { label: "Users & activity log",   file: "admin-users" }
  };

  document.getElementById("user-name").textContent = session.fullName;
  document.getElementById("user-role").textContent = EDU_CONFIG.ROLE_LABELS[session.role] || session.role;
  document.getElementById("btn-logout").onclick = function () { Auth.logout(); };
  initPasswordModal();

  const steps = Auth.allowedSteps(session.role);
  const nav = document.getElementById("nav-tabs");
  const main = document.getElementById("step-container");

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src)); };
      document.body.appendChild(s);
    });
  }

  function show(id) {
    steps.forEach(function (sid) {
      document.getElementById("step-" + sid).classList.toggle("hidden", sid !== id);
      const b = document.getElementById("tab-" + sid);
      b.classList.toggle("tab-active", sid === id);
    });
    const step = Steps[id];
    if (step && step.onShow) step.onShow();
    location.hash = id;
  }

  try {
    for (const id of steps) await loadScript("js/steps/" + META[id].file + ".js");
  } catch (e) {
    main.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">' + UI.esc(e.message) + "</div>";
    return;
  }

  steps.forEach(function (id) {
    const btn = document.createElement("button");
    btn.id = "tab-" + id;
    btn.className = "tab-btn";
    btn.textContent = META[id].label;
    btn.onclick = function () { show(id); };
    nav.appendChild(btn);

    const sec = document.createElement("section");
    sec.id = "step-" + id;
    sec.className = "hidden space-y-4";
    main.appendChild(sec);
    Steps[id].mount(sec);
  });

  const wanted = location.hash.replace("#", "");
  show(steps.indexOf(wanted) >= 0 ? wanted : steps[0]);

  function initPasswordModal() {
    const modal = document.getElementById("pw-modal");
    const open = function () { modal.classList.remove("hidden"); modal.classList.add("flex"); document.getElementById("pw-old").focus(); };
    const close = function () { modal.classList.add("hidden"); modal.classList.remove("flex"); ["pw-old", "pw-new", "pw-new2"].forEach(function (i) { document.getElementById(i).value = ""; }); };
    document.getElementById("btn-password").onclick = open;
    document.getElementById("pw-cancel").onclick = close;
    document.getElementById("pw-save").onclick = function () {
      const btn = this;
      const n1 = document.getElementById("pw-new").value;
      if (n1 !== document.getElementById("pw-new2").value) { UI.toast("The new passwords do not match.", "error"); return; }
      UI.run(btn, async function () {
        await API.call("changePassword", { oldPassword: document.getElementById("pw-old").value, newPassword: n1 });
        UI.toast("Password changed.", "success");
        close();
      });
    };
  }
})();
