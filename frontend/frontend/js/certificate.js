/**
 * Certificate of Contribution - draws the certificate (light-ink design) as a vector image and shows it
 * in a preview window with buttons to download it (PDF or PNG image) or print it.
 * Needs js/vendor/qrcode.js (loaded first). Used by the faculty page and by the admin certificate list.
 *
 *   Certificate.show({ serial, name, course, items, issuedAt })
 */
(function () {
  const EVER = "#344C3D", SAGE = "#8EA58C", MOSS = "#738A6E", INK = "#2B3A30";
  const SERIF = "Cambria, Caladea, Georgia, 'Times New Roman', serif";
  const SANS = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
  const W = 2400, H = 1350;

  const esc = (v) => String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const logoPath = () => (window.EDU_CONFIG && EDU_CONFIG.LOGO) || "assets/logo.png";

  /** The address a scanned QR code opens. Set PUBLIC_URL in js/config.js to the address where the app is published. */
  function verifyUrl(serial) {
    let base = (window.EDU_CONFIG && EDU_CONFIG.PUBLIC_URL) || "";
    if (!base) base = new URL(".", location.href).href;
    if (base.charAt(base.length - 1) !== "/") base += "/";
    return base + "verify.html?s=" + encodeURIComponent(serial);
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
  }

  /** The QR code as SVG path data (one square per dark module). */
  function qrSvg(text, x, y, size) {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount(), quiet = 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
    const total = n + quiet * 2;
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
      `<rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="${EVER}"/></svg>`;
  }

  /** Text helper: every line of the certificate is drawn with this. */
  function T(x, y, text, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" text-anchor="${o.anchor || "middle"}" font-family="${o.font || SANS}" font-size="${o.size || 40}"` +
      ` font-weight="${o.weight || 400}" font-style="${o.style || "normal"}" fill="${o.fill || INK}" letter-spacing="${o.ls || 0}">${esc(text)}</text>`;
  }

  function svg(c) {
    const cx = 1200;
    const name = String(c.name || "");
    const course = String(c.course || "");
    const nameSize = Math.max(70, Math.min(132, Math.floor(1900 / (Math.max(name.length, 1) * 0.5))));
    const nameW = Math.min(2000, Math.max(860, name.length * nameSize * 0.5 + 140));
    const courseLine = course + " Question Bank,";
    const courseSize = Math.max(26, Math.min(42, Math.floor(2000 / (courseLine.length * 0.52))));
    const logo = esc(logoPath());

    // bold corner accents
    let corners = "";
    [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]].forEach(function (k) {
      const x = k[0], y = k[1], dx = k[2], dy = k[3];
      corners += `<rect x="${Math.min(x, x + dx * 130)}" y="${Math.min(y, y + dy * 12)}" width="130" height="12" fill="${EVER}"/>` +
                 `<rect x="${Math.min(x, x + dx * 12)}" y="${Math.min(y, y + dy * 130)}" width="12" height="130" fill="${EVER}"/>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" role="img" aria-label="Certificate of Contribution for ${esc(name)}">` +
      `<rect width="${W}" height="${H}" fill="#fff"/>` +
      `<rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="${EVER}" stroke-width="4"/>` +
      `<rect x="63" y="63" width="${W - 126}" height="${H - 126}" fill="none" stroke="${SAGE}" stroke-width="2"/>` +
      corners +
      `<image href="${logo}" xlink:href="${logo}" x="${cx - 60}" y="96" width="120" height="120"/>` +
      T(cx, 272, "J.H. CERILLES STATE COLLEGE", { size: 30, weight: 700, fill: EVER, ls: 7 }) +
      T(cx, 396, "CERTIFICATE OF CONTRIBUTION", { size: 104, font: SERIF, fill: EVER, ls: 7 }) +
      T(cx, 456, "DEPARTMENTAL EXAM QUESTION BANK", { size: 32, fill: MOSS, ls: 9 }) +
      `<line x1="${cx - 360}" y1="504" x2="${cx + 360}" y2="504" stroke="${SAGE}" stroke-width="2"/>` +
      T(cx, 590, "PRESENTED TO", { size: 28, weight: 700, fill: MOSS, ls: 8 }) +
      T(cx, 726, name, { size: nameSize, font: SERIF, style: "italic", fill: EVER }) +
      `<line x1="${cx - nameW / 2}" y1="756" x2="${cx + nameW / 2}" y2="756" stroke="${SAGE}" stroke-width="2"/>` +
      T(cx, 840, "in recognition of your valuable contribution as an Item Writer to the", { size: 40 }) +
      T(cx, 898, courseLine, { size: courseSize, weight: 700, fill: EVER }) +
      T(cx, 956, "having submitted all " + (c.items || "") + " required questions across every learning outcome.", { size: 40 }) +
      `<line x1="130" y1="1062" x2="${W - 130}" y2="1062" stroke="${SAGE}" stroke-width="2"/>` +
      T(150, 1138, "ISSUED ON", { size: 25, weight: 700, fill: MOSS, ls: 5, anchor: "start" }) +
      T(150, 1198, fmtDate(c.issuedAt), { size: 48, font: SERIF, fill: EVER, anchor: "start" }) +
      T(cx, 1134, "DIGITALLY VERIFIABLE", { size: 26, weight: 700, fill: EVER, ls: 5 }) +
      T(cx, 1186, "Certificate Serial No.  " + (c.serial || ""), { size: 36, fill: EVER, ls: 2 }) +
      T(cx, 1236, "Scan the QR code to confirm this certificate", { size: 25, fill: MOSS }) +
      (c.serial ? qrSvg(verifyUrl(c.serial), W - 150 - 186, 1082, 186) : "") +
      `</svg>`;
  }

  // ---------------------------------------------------------------- downloading (PNG image or PDF)

  /** The school seal as a data address, so it travels inside the saved file. */
  async function logoDataUrl() {
    const res = await fetch(logoPath());
    if (!res.ok) throw new Error("Could not read the school logo.");
    const blob = await res.blob();
    return new Promise(function (resolve, reject) {
      const fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error("Could not read the school logo.")); };
      fr.readAsDataURL(blob);
    });
  }

  /** The certificate as a stand-alone SVG (seal embedded, size set) that can be turned into a picture. */
  async function exportSvg(cert) {
    let s = svg(cert);
    const data = await logoDataUrl();
    s = s.split('href="' + esc(logoPath()) + '"').join('href="' + data + '"');
    return s.replace("<svg ", '<svg width="' + W + '" height="' + H + '" ');
  }

  async function toCanvas(cert) {
    const markup = await exportSvg(cert);
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = await new Promise(function (resolve, reject) {
        const im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { reject(new Error("Could not draw the certificate.")); };
        im.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("Could not create the file.")); }, type, quality);
    });
  }

  function saveBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  /** A one-page A4 landscape PDF that holds the certificate picture (JPEG bytes). */
  function makePdf(jpeg, w, h) {
    const enc = new TextEncoder();
    const parts = [], offsets = [];
    let len = 0;
    const push = function (x) { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = function (n, body) { offsets[n] = len; push(n + " 0 obj\n" + body + "\nendobj\n"); };

    const pageW = 842, pageH = 595, imgW = 800;
    const imgH = Math.round(imgW * h / w * 100) / 100;
    const x = (pageW - imgW) / 2, y = Math.round((pageH - imgH) / 2 * 100) / 100;

    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageW + " " + pageH + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    offsets[4] = len;
    push("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
    push(jpeg);
    push("\nendstream\nendobj\n");
    const content = "q " + imgW + " 0 0 " + imgH + " " + x + " " + y + " cm /Im0 Do Q";
    obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");

    const xref = len;
    let t = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) t += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    t += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    push(t);

    const out = new Uint8Array(len);
    let p = 0;
    parts.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  const fileBase = (cert) => "Certificate-of-Contribution-" + String(cert.serial || "").replace(/[^A-Za-z0-9-]/g, "");

  async function downloadPng(cert) {
    const canvas = await toCanvas(cert);
    saveBlob(await canvasBlob(canvas, "image/png"), fileBase(cert) + ".png");
  }

  async function downloadPdf(cert) {
    const canvas = await toCanvas(cert);
    const jpeg = await canvasBlob(canvas, "image/jpeg", 0.95);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    saveBlob(new Blob([makePdf(bytes, W, H)], { type: "application/pdf" }), fileBase(cert) + ".pdf");
  }

  // ---------------------------------------------------------------- preview window, buttons and printing
  const CSS = `
    .cert-overlay { position: fixed; inset: 0; background: rgba(20,30,24,.74); z-index: 80; overflow: auto; padding: 18px; }
    .cert-bar { max-width: 1000px; margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; color: #fff; }
    .cert-bar .cert-title { font-weight: 700; font-size: 15px; }
    .cert-bar .cert-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .cert-sheet { max-width: 1000px; margin: 0 auto; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.35); page: cert; }
    .cert-sheet svg { display: block; width: 100%; height: auto; }
    .cert-note { max-width: 1000px; margin: 10px auto 0; color: #dbe7dc; font-size: 12px; }
    @page cert { size: A4 landscape; margin: 8mm; }
    @media print {
      body.cert-open > *:not(.cert-overlay) { display: none !important; }
      body.cert-open .cert-overlay { position: static !important; background: none !important; padding: 0 !important; overflow: visible !important; }
      body.cert-open .cert-bar, body.cert-open .cert-note { display: none !important; }
      body.cert-open .cert-sheet { box-shadow: none !important; max-width: none !important; margin: 0 !important; width: 100%; }
    }
  `;

  function ensureStyle() {
    if (document.getElementById("cert-style")) return;
    const st = document.createElement("style");
    st.id = "cert-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function close() {
    const ov = document.querySelector(".cert-overlay");
    if (ov) ov.remove();
    document.body.classList.remove("cert-open");
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function say(message, type) {
    if (window.UI && UI.toast) UI.toast(message, type);
    else alert(message);
  }

  /** Runs a download while the button shows "Preparing..." */
  async function withButton(btn, job) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparing...";
    try {
      await job();
      say("Saved to your Downloads folder.", "success");
    } catch (e) {
      say((e && e.message ? e.message : "Could not save the file.") + ' You can also use Print and choose "Save as PDF".', "error");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function show(cert) {
    ensureStyle();
    close();
    const ov = document.createElement("div");
    ov.className = "cert-overlay";
    ov.innerHTML =
      '<div class="cert-bar"><span class="cert-title">Certificate of Contribution</span>' +
      '<span class="cert-actions">' +
      '<button type="button" class="btn btn-green" id="cert-pdf">Download PDF</button>' +
      '<button type="button" class="btn btn-primary" id="cert-png">Download image (PNG)</button>' +
      '<button type="button" class="btn btn-light" id="cert-print">Print</button>' +
      '<button type="button" class="btn btn-light" id="cert-close">Close</button></span></div>' +
      '<div class="cert-sheet">' + svg(cert) + "</div>" +
      '<p class="cert-note">Download saves a copy on this computer. To save ink when printing, choose Draft/Economy mode and keep the scale at 100%.</p>';
    document.body.appendChild(ov);
    document.body.classList.add("cert-open");
    ov.querySelector("#cert-pdf").onclick = function () { withButton(this, () => downloadPdf(cert)); };
    ov.querySelector("#cert-png").onclick = function () { withButton(this, () => downloadPng(cert)); };
    ov.querySelector("#cert-print").onclick = function () { window.print(); };
    ov.querySelector("#cert-close").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", onKey);
  }

  window.Certificate = { show: show, close: close, svg: svg, verifyUrl: verifyUrl, _exportSvg: exportSvg, _makePdf: makePdf };
})();