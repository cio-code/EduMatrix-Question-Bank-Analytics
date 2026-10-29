/** One function talks to the backend: API.call(action, payload). */
(function () {
  const cfg = window.EDU_CONFIG;

  async function call(action, payload, opts) {
    opts = opts || {};
    if (!cfg.API_URL || cfg.API_URL.indexOf("PASTE_") === 0) {
      throw new Error("API_URL is not set. Open frontend/js/config.js and paste your Apps Script web app URL.");
    }
    const session = Auth.getSession();
    let res;
    try {
      res = await fetch(cfg.API_URL, {
        method: "POST",
        // text/plain avoids a CORS preflight, which Apps Script cannot answer
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, token: session ? session.token : null, payload: payload || {} })
      });
    } catch (e) {
      throw new Error("Cannot reach the server. Check your internet connection and the API_URL.");
    }
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error("Unexpected reply from the server. Re-deploy the web app and make sure the URL ends with /exec."); }

    if (!json.ok) {
      if (json.error === "SESSION_EXPIRED") {
        Auth.clear();
        if (!opts.noRedirect) location.href = "index.html?expired=1";
        throw new Error("Your session expired. Please sign in again.");
      }
      throw new Error(json.error || "Request failed.");
    }
    return json.data;
  }

  window.API = { call: call };
})();
