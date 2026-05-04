/**
 * app.js — main application logic.
 *
 * Sections:
 *   1. State
 *   2. Gallery
 *   3. Upload flow  (capture → preview → metadata → save)
 *   4. Detail modal (HD view)
 *   5. Initialization
 */

// ─── 1. State ────────────────────────────────────────────────────────────────

const state = {
  capturedDataUrl: null,   // raw photo taken by the user
  croppedDataUrl: null,    // result of /api/process-image
};

// ─── 2. Gallery ──────────────────────────────────────────────────────────────

async function loadGallery() {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");

  grid.innerHTML = '<div class="loading-spinner"></div>';
  empty.hidden = true;

  try {
    const cards = await api.getCards();

    grid.innerHTML = "";
    if (cards.length === 0) {
      empty.hidden = false;
      return;
    }

    cards.forEach((card) => grid.appendChild(buildCardTile(card)));
  } catch (err) {
    grid.innerHTML = `<p class="error-msg">Error al cargar las cartas: ${err.message}</p>`;
  }
}

function buildCardTile(card) {
  const article = document.createElement("article");
  article.className = "card-tile";
  article.dataset.id = card.id;

  article.innerHTML = `
    <div class="card-img-wrap">
      <img
        src="${escHtml(card.thumbnail_url)}"
        alt="${escHtml(card.game_name)}"
        loading="lazy"
        class="card-thumb"
      />
      ${card.card_type === "foil" ? '<span class="badge badge-foil">Foil</span>' : ""}
    </div>
    <div class="card-info">
      <h3 class="card-title">${escHtml(card.game_name)}</h3>
      <p class="card-meta">${escHtml(card.language)}</p>
    </div>
    <div class="card-actions">
      <button class="btn btn-detail" data-id="${card.id}">Ver detalle</button>
      <button class="btn btn-delete btn-icon" data-id="${card.id}" title="Eliminar">✕</button>
    </div>
  `;

  article.querySelector(".btn-detail").addEventListener("click", () => openDetailModal(card.id));
  article.querySelector(".btn-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    confirmDelete(card.id, card.game_name);
  });

  return article;
}

async function confirmDelete(id, name) {
  if (!confirm(`¿Eliminar la carta "${name}"?`)) return;
  try {
    await api.deleteCard(id);
    loadGallery();
  } catch (err) {
    alert(`No se pudo eliminar: ${err.message}`);
  }
}

// ─── 3. Upload Flow ───────────────────────────────────────────────────────────

// -- Step A: Open upload modal and choose source (camera / file)
function openUploadModal() {
  resetUploadFlow();
  showStep("step-source");
  document.getElementById("upload-modal").classList.add("active");
}

function closeUploadModal() {
  stopCamera();
  document.getElementById("upload-modal").classList.remove("active");
  resetUploadFlow();
}

function resetUploadFlow() {
  state.capturedDataUrl = null;
  state.croppedDataUrl = null;
  document.getElementById("camera-feed").srcObject = null;
  document.getElementById("step-source").hidden = true;
  document.getElementById("step-camera").hidden = true;
  document.getElementById("step-preview").hidden = true;
  document.getElementById("step-metadata").hidden = true;
  document.getElementById("upload-error").textContent = "";
  document.getElementById("metadata-form").reset();
}

function showStep(stepId) {
  ["step-source", "step-camera", "step-preview", "step-metadata"].forEach(
    (id) => { document.getElementById(id).hidden = id !== stepId; }
  );
}

// -- Step B: Camera
let _stream = null;

async function startCamera() {
  showStep("step-camera");
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    document.getElementById("camera-feed").srcObject = _stream;
  } catch {
    setUploadError("No se pudo acceder a la cámara. Usa 'Subir archivo' en su lugar.");
    showStep("step-source");
  }
}

function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
    _stream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById("camera-feed");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  state.capturedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  stopCamera();
  processCapture();
}

function handleFileInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setUploadError("Por favor selecciona una imagen.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.capturedDataUrl = ev.target.result;
    processCapture();
  };
  reader.readAsDataURL(file);
}

// -- Step C: Send to backend for card detection
async function processCapture() {
  showStep("step-preview");
  document.getElementById("preview-img").src = "";
  document.getElementById("preview-detected").textContent = "";
  document.getElementById("preview-img").classList.add("loading");

  try {
    const result = await api.processImage(state.capturedDataUrl);
    state.croppedDataUrl = result.cropped_image;

    const img = document.getElementById("preview-img");
    img.src = state.croppedDataUrl;
    img.classList.remove("loading");

    document.getElementById("preview-detected").textContent = result.card_detected
      ? "✔ Carta detectada correctamente"
      : "⚠ No se detectó la carta automáticamente — se usará la imagen original";
    document.getElementById("preview-detected").className = result.card_detected
      ? "detected-ok"
      : "detected-warn";
  } catch (err) {
    setUploadError(`Error al procesar la imagen: ${err.message}`);
    showStep("step-source");
  }
}

// -- Step D: Metadata form → save
async function saveCard(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  const gameName = form.game_name.value.trim();
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !language) {
    setUploadError("Completa todos los campos.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    await api.createCard(state.croppedDataUrl, {
      game_name: gameName,
      language: language,
      card_type: cardType,
    });
    closeUploadModal();
    loadGallery();
  } catch (err) {
    setUploadError(`No se pudo guardar: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar carta";
  }
}

function setUploadError(msg) {
  document.getElementById("upload-error").textContent = msg;
}

// ─── 4. Detail Modal (HD view) ────────────────────────────────────────────────

async function openDetailModal(id) {
  const modal = document.getElementById("detail-modal");
  modal.classList.add("active");

  const img = document.getElementById("detail-img");
  const info = document.getElementById("detail-info");

  img.src = "";
  img.classList.add("loading");
  info.innerHTML = "<p>Cargando…</p>";

  document.getElementById("detail-hd-btn").dataset.id = id;
  document.getElementById("detail-hd-btn").disabled = false;
  document.getElementById("detail-hd-btn").textContent = "Ver en HD";

  try {
    const card = await api.getCard(id);
    // Show thumbnail first; HD loads on demand
    img.src = card.thumbnail_url;
    img.classList.remove("loading");

    img.dataset.hdUrl = card.hd_url;

    info.innerHTML = `
      <h2>${escHtml(card.game_name)}</h2>
      <p><strong>Idioma:</strong> ${escHtml(card.language)}</p>
      <p><strong>Tipo:</strong> ${escHtml(card.card_type)}</p>
      <p class="card-date">Subida: ${new Date(card.created_at).toLocaleDateString("es")}</p>
    `;
  } catch (err) {
    info.innerHTML = `<p class="error-msg">Error: ${err.message}</p>`;
    img.classList.remove("loading");
  }
}

function loadHD() {
  const img = document.getElementById("detail-img");
  const btn = document.getElementById("detail-hd-btn");
  if (!img.dataset.hdUrl) return;

  btn.disabled = true;
  btn.textContent = "Cargando HD…";
  img.classList.add("loading");

  const hdImg = new Image();
  hdImg.onload = () => {
    img.src = hdImg.src;
    img.classList.remove("loading");
    btn.textContent = "HD cargada ✔";
  };
  hdImg.onerror = () => {
    btn.disabled = false;
    btn.textContent = "Error — reintentar";
    img.classList.remove("loading");
  };
  hdImg.src = img.dataset.hdUrl;
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.remove("active");
  document.getElementById("detail-img").src = "";
  document.getElementById("detail-img").dataset.hdUrl = "";
}

// ─── 5. Helpers ───────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── 6. Initialization ────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Gallery
  loadGallery();

  // Upload modal controls
  document.getElementById("open-upload-btn").addEventListener("click", openUploadModal);
  document.getElementById("close-upload-btn").addEventListener("click", closeUploadModal);
  document.getElementById("use-camera-btn").addEventListener("click", startCamera);
  document.getElementById("capture-btn").addEventListener("click", capturePhoto);
  document.getElementById("use-file-btn").addEventListener("click", () =>
    document.getElementById("file-input").click()
  );
  document.getElementById("file-input").addEventListener("change", handleFileInput);
  document.getElementById("retake-btn").addEventListener("click", () => showStep("step-source"));
  document.getElementById("confirm-preview-btn").addEventListener("click", () =>
    showStep("step-metadata")
  );
  document.getElementById("metadata-form").addEventListener("submit", saveCard);
  document.getElementById("back-to-preview-btn").addEventListener("click", () =>
    showStep("step-preview")
  );

  // Detail modal controls
  document.getElementById("close-detail-btn").addEventListener("click", closeDetailModal);
  document.getElementById("detail-hd-btn").addEventListener("click", loadHD);

  // Close modals on backdrop click
  document.getElementById("upload-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeUploadModal();
  });
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeDetailModal();
  });
});
