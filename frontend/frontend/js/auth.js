/** Login session (kept in sessionStorage, so it ends when the tab closes) and role -> steps map. */
(function () {
  const cfg = window.EDU_CONFIG;

  // Which steps each role may open. The server enforces the same rules - this only controls the menu.
  const ROLE_STEPS = {
    admin:   ["tos", "pool", "analysis", "curation", "form4", "users"],
    gecac:   ["tos"],
    faculty: ["pool"]
  };

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(cfg.SESSION_KEY));
      if (s && new Date(s.expiresAt) > new Date()) return s;
    } catch (e) { /* ignore */ }
    return null;
  }
  function setSession(s) { sessionStorage.setItem(cfg.SESSION_KEY, JSON.stringify(s)); }
  function clear() { sessionStorage.removeItem(cfg.SESSION_KEY); }

  async function login(username, password) {
    const data = await API.call("login", { username: username, password: password }, { noRedirect: true });
    setSession(data);
    return data;
  }

  async function logout() {
    try { await API.call("logout", {}, { noRedirect: true }); } catch (e) { /* ignore */ }
    clear();
    location.href = "index.html";
  }

  function requireLogin() {
    const s = getSession();
    if (!s) { location.href = "index.html"; return null; }
    return s;
  }

  function allowedSteps(role) { return ROLE_STEPS[role] || []; }

  window.Auth = { getSession: getSession, clear: clear, login: login, logout: logout, requireLogin: requireLogin, allowedSteps: allowedSteps };
})();
