/**
 * EduMatrix - frontend settings.
 * Paste the Apps Script "Web app" URL (it ends with /exec) between the quotes.
 */
window.EDU_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbznVd_GVNxiI7JAzAM9S3o1Dh2NMAtCBHdk88Yy_cVGYuWA0pTzFHRxAIen-M43dB6U/exec",
  // Where the app is published. The QR code on a certificate opens verify.html at this address.
  // Use the address people can reach (for example your GitHub Pages site), NOT localhost. Keep the slash at the end.
    PUBLIC_URL: "https://cio-code.github.io/EduMatrix-Question-Bank-Analytics/frontend/",
  SESSION_KEY: "edumatrix.session",
  CATEGORIES: ["Easy", "Average", "Difficult"],
  ROLE_LABELS: { admin: "Administrator", gecac: "GECAC", faculty: "Faculty" }
};
