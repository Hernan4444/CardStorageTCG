/**
 * Generic DOM and rendering helpers.
 */

export function setUploadError(msg) {
  document.getElementById("upload-error").textContent = msg;
}

export function setEditError(msg) {
  document.getElementById("edit-error").textContent = msg;
}

export function setAdminError(msg) {
  document.getElementById("admin-error").textContent = msg;
}

export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}
