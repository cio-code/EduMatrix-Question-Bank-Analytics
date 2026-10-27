/** Admin - manage accounts and read the activity log. */
(function () {
  let root, users = [];
  const ROLE = EDU_CONFIG.ROLE_LABELS;

  const TEMPLATE = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 self-start">
        <h3 class="font-bold text-sm text-slate-800 border-b pb-2">Create account</h3>
        <div><label for="u-name" class="lbl">Username</label><input id="u-name" class="inp" maxlength="30" autocomplete="off"></div>
        <div><label for="u-full" class="lbl">Full name</label><input id="u-full" class="inp" maxlength="80" autocomplete="off"></div>
        <div><label for="u-role" class="lbl">Role</label>
          <select id="u-role" class="inp">
            <option value="faculty">Faculty — Step 2 only</option>
            <option value="gecac">GECAC — Step 1 only</option>
            <option value="admin">Administrator — all steps</option>
          </select></div>
        <div><label for="u-pass" class="lbl">Temporary password (8+ characters)</label><input id="u-pass" type="password" class="inp" autocomplete="new-password"></div>
        <button id="u-create" class="btn btn-primary w-full justify-center">Create account</button>
      </div>
      <div class="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 class="font-bold text-sm text-slate-800 border-b pb-2">Accounts</h3>
        <div class="overflow-x-auto"><table class="w-full text-xs border text-left">
          <thead class="bg-slate-100"><tr><th class="p-2 border">Username</th><th class="p-2 border">Name</th><th class="p-2 border">Role</th><th class="p-2 border">Status</th><th class="p-2 border">Actions</th></tr></thead>
          <tbody id="u-body"></tbody></table></div>
      </div>
    </div>
    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex justify-between items-center border-b pb-2"><h3 class="font-bold text-sm text-slate-800">Recent activity</h3><button id="log-refresh" class="btn btn-light">Refresh</button></div>
      <div class="overflow-x-auto max-h-80 overflow-y-auto"><table class="w-full text-xs border text-left">
        <thead class="bg-slate-100"><tr><th class="p-2 border">Time</th><th class="p-2 border">User</th><th class="p-2 border">Action</th></tr></thead>
        <tbody id="log-body"></tbody></table></div>
    </div>`;

  function renderUsers() {
    root.querySelector("#u-body").innerHTML = users.map((u) => `<tr>
      <td class="p-2 border font-semibold">${UI.esc(u.username)}</td><td class="p-2 border">${UI.esc(u.fullName)}</td>
      <td class="p-2 border">${UI.esc(ROLE[u.role] || u.role)}</td>
      <td class="p-2 border">${UI.badge(u.active ? "Active" : "Disabled", u.active ? "green" : "red")}</td>
      <td class="p-2 border"><span class="flex gap-3">
        <button class="link-btn text-indigo-600" data-reset="${UI.esc(u.username)}">Reset password</button>
        ${u.username === State.session.username ? "" : `<button class="link-btn text-rose-600" data-active="${UI.esc(u.username)}" data-to="${u.active ? "0" : "1"}">${u.active ? "Disable" : "Enable"}</button>`}
      </span></td></tr>`).join("");
  }

  async function loadUsers() { users = await API.call("listUsers"); renderUsers(); }
  async function loadLog() {
    const log = await API.call("getAuditLog", { limit: 100 });
    root.querySelector("#log-body").innerHTML = log.map((l) => `<tr><td class="p-2 border whitespace-nowrap">${UI.esc(new Date(l.time).toLocaleString())}</td><td class="p-2 border">${UI.esc(l.username)}</td><td class="p-2 border">${UI.esc(l.action)}</td></tr>`).join("")
      || '<tr><td colspan="3" class="p-3 text-center text-slate-400">No activity yet.</td></tr>';
  }

  window.Steps.users = {
    mount(el) {
      root = el;
      root.innerHTML = TEMPLATE;
      root.querySelector("#u-create").onclick = function () {
        UI.run(this, async () => {
          await API.call("createUser", {
            username: root.querySelector("#u-name").value, fullName: root.querySelector("#u-full").value,
            role: root.querySelector("#u-role").value, password: root.querySelector("#u-pass").value
          });
          ["#u-name", "#u-full", "#u-pass"].forEach((s) => (root.querySelector(s).value = ""));
          UI.toast("Account created.", "success");
          await loadUsers();
        });
      };
      root.querySelector("#u-body").addEventListener("click", (e) => {
        const t = e.target;
        if (t.dataset.reset) {
          const pw = prompt("New temporary password for " + t.dataset.reset + " (8+ characters):");
          if (!pw) return;
          UI.run(null, async () => { await API.call("resetPassword", { username: t.dataset.reset, newPassword: pw }); UI.toast("Password reset. They are signed out.", "success"); });
        } else if (t.dataset.active) {
          UI.run(null, async () => { await API.call("setUserActive", { username: t.dataset.active, active: t.dataset.to === "1" }); await loadUsers(); });
        }
      });
      root.querySelector("#log-refresh").onclick = function () { UI.run(this, loadLog); };
      UI.run(null, async () => { await loadUsers(); await loadLog(); });
    },
    onShow() { UI.run(null, async () => { await loadUsers(); await loadLog(); }); }
  };
})();
