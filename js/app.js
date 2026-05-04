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
  cards: [],
  isAdmin: false,
  adminPassword: localStorage.getItem("cardstorageAdminPassword") || "",
  editingCardId: null,
};

const DEFAULT_GAMES = ["Magic", "Weiss"];
const DEFAULT_ANIMES = [];
const OTHER_GAME_VALUE = "__other__";
const OTHER_ANIME_VALUE = "__other_anime__";
const ALLOWED_LANGUAGES = ["Español", "Ingles", "Japones", "Chino"];

// ─── 2. Gallery ──────────────────────────────────────────────────────────────

async function loadGallery() {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");

  grid.innerHTML = '<div class="loading-spinner"></div>';
  empty.hidden = true;

  try {
    const cards = await api.getCards();
    state.cards = cards;
    populateGameOptions();
    populateAnimeOptions();
    populateEditGameOptions();
    populateEditAnimeOptions();

    grid.innerHTML = "";
    if (cards.length === 0) {
      empty.hidden = false;
      return;
    }

    cards.forEach((card) => grid.appendChild(buildCardTile(card)));
  } catch (err) {
    state.cards = [];
    populateGameOptions();
    populateAnimeOptions();
    populateEditGameOptions();
    populateEditAnimeOptions();
    grid.innerHTML = `<p class="error-msg">Error al cargar las cartas: ${err.message}</p>`;
  }
}

function buildCardTile(card) {
  const article = document.createElement("article");
  article.className = "card-tile";
  article.dataset.id = card.id;

  const adminActions = state.isAdmin
    ? `
      <button class="btn btn-admin btn-edit" data-id="${card.id}">Editar</button>
      <button class="btn btn-delete btn-icon" data-id="${card.id}" title="Eliminar">✕</button>
    `
    : "";

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
      ${adminActions}
    </div>
  `;

  article.querySelector(".btn-detail").addEventListener("click", () => openDetailModal(card.id));

  const editButton = article.querySelector(".btn-edit");
  if (editButton) {
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditCard(card);
    });
  }

  const deleteButton = article.querySelector(".btn-delete");
  if (deleteButton) {
    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDelete(card.id, card.game_name);
    });
  }

  return article;
}

async function confirmDelete(id, name) {
  if (!state.isAdmin || !state.adminPassword) {
    alert("Debes desbloquear el modo admin para eliminar cartas.");
    return;
  }

  if (!confirm(`¿Eliminar la carta "${name}"?`)) return;
  try {
    await api.deleteCard(id, state.adminPassword);
    loadGallery();
  } catch (err) {
    handleAdminRequestError(err);
    alert(`No se pudo eliminar: ${err.message}`);
  }
}

async function openEditCard(card) {
  if (!state.isAdmin || !state.adminPassword) {
    alert("Debes desbloquear el modo admin para editar cartas.");
    return;
  }

  state.editingCardId = card.id;

  const form = document.getElementById("edit-form");
  const gameSelect = document.getElementById("edit_game_name");
  const languageSelect = document.getElementById("edit_language");
  const cardTypeSelect = document.getElementById("edit_card_type");
  const otherGameInput = document.getElementById("edit_other_game_name");
  const animeSelect = document.getElementById("edit_anime");
  const otherAnimeInput = document.getElementById("edit_other_anime_name");

  setEditError("");
  populateEditGameOptions(card.game_name);

  if ([...gameSelect.options].some((option) => option.value === card.game_name)) {
    gameSelect.value = card.game_name;
    otherGameInput.value = "";
  } else {
    gameSelect.value = OTHER_GAME_VALUE;
    otherGameInput.value = card.game_name;
  }
  toggleEditOtherGameField();

  populateEditAnimeOptions(card.anime || "");
  if ([...animeSelect.options].some((option) => option.value === (card.anime || ""))) {
    animeSelect.value = card.anime || "";
    otherAnimeInput.value = "";
  } else {
    animeSelect.value = OTHER_ANIME_VALUE;
    otherAnimeInput.value = card.anime || "";
  }
  toggleEditOtherAnimeField();

  languageSelect.value = ALLOWED_LANGUAGES.includes(card.language) ? card.language : "Japones";
  cardTypeSelect.value = card.card_type === "foil" ? "foil" : "normal";

  form.dataset.cardId = String(card.id);
  document.getElementById("edit-modal").classList.add("active");
}

// ─── 3. Upload Flow ───────────────────────────────────────────────────────────

// -- Step A: Open upload modal and choose source (camera / file)
function openUploadModal() {
  resetUploadFlow();
  populateGameOptions();
  populateAnimeOptions();
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
  toggleOtherGameField();
  toggleOtherAnimeField();
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
  document.getElementById("preview-img").classList.add("loading");

  try {
    const result = await api.processImage(state.capturedDataUrl);
    state.croppedDataUrl = result.cropped_image;

    const img = document.getElementById("preview-img");
    img.src = state.croppedDataUrl;
    img.classList.remove("loading");
  } catch (err) {
    document.getElementById("preview-img").classList.remove("loading");
    setUploadError(err.message);
  }
}

// -- Step D: Metadata form → save
async function saveCard(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  const gameName = getSelectedGameName(form);
  const anime = getSelectedAnimeName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !anime || !language) {
    setUploadError("Completa todos los campos.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    await api.createCard(state.croppedDataUrl, {
      game_name: gameName,
      anime,
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

function setEditError(msg) {
  document.getElementById("edit-error").textContent = msg;
}

function setAdminError(msg) {
  document.getElementById("admin-error").textContent = msg;
}

function populateGameOptions() {
  const gameSelect = document.getElementById("game_name");
  if (!gameSelect) return;

  const existingGames = state.cards
    .map((card) => String(card.game_name || "").trim())
    .filter(Boolean);

  const options = [...new Set([...existingGames, ...DEFAULT_GAMES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const currentValue = gameSelect.value;

  gameSelect.innerHTML = options
    .map((game) => `<option value="${escHtml(game)}">${escHtml(game)}</option>`)
    .join("");

  gameSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${OTHER_GAME_VALUE}">Otro</option>`
  );

  if (currentValue && [...gameSelect.options].some((option) => option.value === currentValue)) {
    gameSelect.value = currentValue;
  }

  toggleOtherGameField();
}

function populateAnimeOptions() {
  const animeSelect = document.getElementById("anime");
  if (!animeSelect) return;

  const existingAnimes = state.cards
    .map((card) => String(card.anime || "").trim())
    .filter(Boolean);

  const options = [...new Set([...existingAnimes, ...DEFAULT_ANIMES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const currentValue = animeSelect.value;
  animeSelect.innerHTML = options
    .map((anime) => `<option value="${escHtml(anime)}">${escHtml(anime)}</option>`)
    .join("");
  animeSelect.insertAdjacentHTML("beforeend", `<option value="${OTHER_ANIME_VALUE}">Otro</option>`);

  if (currentValue && [...animeSelect.options].some((option) => option.value === currentValue)) {
    animeSelect.value = currentValue;
  }

  toggleOtherAnimeField();
}

function toggleOtherGameField() {
  const gameSelect = document.getElementById("game_name");
  const otherGroup = document.getElementById("other-game-group");
  const otherInput = document.getElementById("other_game_name");
  if (!gameSelect || !otherGroup || !otherInput) return;

  const showOther = gameSelect.value === OTHER_GAME_VALUE;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

function getSelectedGameName(form) {
  if (form.game_name.value !== OTHER_GAME_VALUE) {
    return form.game_name.value.trim();
  }

  return form.other_game_name.value.trim();
}

function toggleOtherAnimeField() {
  const animeSelect = document.getElementById("anime");
  const otherGroup = document.getElementById("other-anime-group");
  const otherInput = document.getElementById("other_anime_name");
  if (!animeSelect || !otherGroup || !otherInput) return;

  const showOther = animeSelect.value === OTHER_ANIME_VALUE;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

function getSelectedAnimeName(form) {
  if (form.anime.value !== OTHER_ANIME_VALUE) {
    return form.anime.value.trim();
  }

  return form.other_anime_name.value.trim();
}

function populateEditGameOptions(currentValue = "") {
  const gameSelect = document.getElementById("edit_game_name");
  if (!gameSelect) return;

  const existingGames = state.cards
    .map((card) => String(card.game_name || "").trim())
    .filter(Boolean);

  if (currentValue && currentValue !== OTHER_GAME_VALUE) {
    existingGames.push(currentValue);
  }

  const options = [...new Set([...existingGames, ...DEFAULT_GAMES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const previousValue = gameSelect.value;
  gameSelect.innerHTML = options
    .map((game) => `<option value="${escHtml(game)}">${escHtml(game)}</option>`)
    .join("");
  gameSelect.insertAdjacentHTML("beforeend", `<option value="${OTHER_GAME_VALUE}">Otro</option>`);

  const valueToSelect = currentValue || previousValue;
  if (valueToSelect && [...gameSelect.options].some((option) => option.value === valueToSelect)) {
    gameSelect.value = valueToSelect;
  }

  toggleEditOtherGameField();
}

function populateEditAnimeOptions(currentValue = "") {
  const animeSelect = document.getElementById("edit_anime");
  if (!animeSelect) return;

  const existingAnimes = state.cards
    .map((card) => String(card.anime || "").trim())
    .filter(Boolean);

  if (currentValue && currentValue !== OTHER_ANIME_VALUE) {
    existingAnimes.push(currentValue);
  }

  const options = [...new Set([...existingAnimes, ...DEFAULT_ANIMES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const previousValue = animeSelect.value;
  animeSelect.innerHTML = options
    .map((anime) => `<option value="${escHtml(anime)}">${escHtml(anime)}</option>`)
    .join("");
  animeSelect.insertAdjacentHTML("beforeend", `<option value="${OTHER_ANIME_VALUE}">Otro</option>`);

  const valueToSelect = currentValue || previousValue;
  if (valueToSelect && [...animeSelect.options].some((option) => option.value === valueToSelect)) {
    animeSelect.value = valueToSelect;
  }

  toggleEditOtherAnimeField();
}

function toggleEditOtherGameField() {
  const gameSelect = document.getElementById("edit_game_name");
  const otherGroup = document.getElementById("edit-other-game-group");
  const otherInput = document.getElementById("edit_other_game_name");
  if (!gameSelect || !otherGroup || !otherInput) return;

  const showOther = gameSelect.value === OTHER_GAME_VALUE;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

function toggleEditOtherAnimeField() {
  const animeSelect = document.getElementById("edit_anime");
  const otherGroup = document.getElementById("edit-other-anime-group");
  const otherInput = document.getElementById("edit_other_anime_name");
  if (!animeSelect || !otherGroup || !otherInput) return;

  const showOther = animeSelect.value === OTHER_ANIME_VALUE;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

function getSelectedEditGameName(form) {
  if (form.game_name.value !== OTHER_GAME_VALUE) {
    return form.game_name.value.trim();
  }

  return form.other_game_name.value.trim();
}

function getSelectedEditAnimeName(form) {
  if (form.anime.value !== OTHER_ANIME_VALUE) {
    return form.anime.value.trim();
  }

  return form.other_anime_name.value.trim();
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.remove("active");
  resetEditForm();
}

function resetEditForm() {
  const form = document.getElementById("edit-form");
  if (!form) return;

  form.reset();
  form.dataset.cardId = "";
  state.editingCardId = null;
  setEditError("");
  document.getElementById("edit_other_game_name").value = "";
  document.getElementById("edit_other_anime_name").value = "";
  populateEditGameOptions();
  populateEditAnimeOptions();
}

async function saveEditCard(e) {
  e.preventDefault();
  if (!state.isAdmin || !state.adminPassword) {
    setEditError("Debes desbloquear el modo admin para editar cartas.");
    return;
  }

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  const gameName = getSelectedEditGameName(form);
  const anime = getSelectedEditAnimeName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !anime || !ALLOWED_LANGUAGES.includes(language) || !["normal", "foil"].includes(cardType)) {
    setEditError("Completa todos los campos correctamente.");
    return;
  }

  if (!state.editingCardId) {
    setEditError("No se encontró la carta a editar.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando…";
  setEditError("");

  try {
    await api.updateCard(
      state.editingCardId,
      {
        game_name: gameName,
        anime,
        language,
        card_type: cardType,
      },
      state.adminPassword
    );

    closeEditModal();
    loadGallery();
  } catch (err) {
    handleAdminRequestError(err);
    setEditError(`No se pudo guardar: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
  }
}

async function toggleAdminMode() {
  if (state.isAdmin) {
    closeEditModal();
    closeAdminModal();
    clearAdminSession();
    renderAdminState();
    loadGallery();
    return;
  }

  openAdminModal();
}

function openAdminModal() {
  const form = document.getElementById("admin-form");
  const input = document.getElementById("admin_password");

  form.reset();
  setAdminError("");
  document.getElementById("admin-modal").classList.add("active");
  input.focus();
}

function closeAdminModal() {
  document.getElementById("admin-modal").classList.remove("active");
  document.getElementById("admin-form").reset();
  setAdminError("");
}

async function submitAdminLogin(e) {
  e.preventDefault();

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const password = form.admin_password.value.trim();

  if (!password) {
    setAdminError("Ingresa la contraseña admin.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Validando…";
  setAdminError("");

  try {
    await api.verifyAdmin(password);
    state.isAdmin = true;
    state.adminPassword = password;
    localStorage.setItem("cardstorageAdminPassword", password);
    closeAdminModal();
    renderAdminState();
    loadGallery();
  } catch (err) {
    clearAdminSession();
    renderAdminState();
    setAdminError(`Contraseña incorrecta: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

async function restoreAdminSession() {
  if (!state.adminPassword) {
    renderAdminState();
    return;
  }

  try {
    await api.verifyAdmin(state.adminPassword);
    state.isAdmin = true;
  } catch {
    clearAdminSession();
  }

  renderAdminState();
}

function clearAdminSession() {
  state.isAdmin = false;
  state.adminPassword = "";
  localStorage.removeItem("cardstorageAdminPassword");
}

function renderAdminState() {
  const status = document.getElementById("admin-status");
  const toggleButton = document.getElementById("admin-toggle-btn");
  if (!status || !toggleButton) return;

  status.textContent = state.isAdmin ? "Modo admin activo" : "Modo lectura";
  status.classList.toggle("is-admin", state.isAdmin);
  toggleButton.textContent = state.isAdmin ? "Salir admin" : "Desbloquear admin";
}

function handleAdminRequestError(err) {
  if (!String(err.message).includes("Admin password required")) {
    return;
  }

  closeEditModal();
  closeAdminModal();
  clearAdminSession();
  renderAdminState();
  loadGallery();
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
      <p><strong>Anime:</strong> ${escHtml(card.anime || "-")}</p>
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

document.addEventListener("DOMContentLoaded", async () => {
  // Gallery
  populateGameOptions();
  populateAnimeOptions();
  populateEditGameOptions();
  populateEditAnimeOptions();
  await restoreAdminSession();
  loadGallery();

  // Upload modal controls
  document.getElementById("admin-toggle-btn").addEventListener("click", toggleAdminMode);
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
  document.getElementById("game_name").addEventListener("change", toggleOtherGameField);
  document.getElementById("anime").addEventListener("change", toggleOtherAnimeField);
  document.getElementById("back-to-preview-btn").addEventListener("click", () =>
    showStep("step-preview")
  );

  // Edit modal controls
  document.getElementById("close-edit-btn").addEventListener("click", closeEditModal);
  document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);
  document.getElementById("edit-form").addEventListener("submit", saveEditCard);
  document.getElementById("edit_game_name").addEventListener("change", toggleEditOtherGameField);
  document.getElementById("edit_anime").addEventListener("change", toggleEditOtherAnimeField);

  // Admin modal controls
  document.getElementById("close-admin-btn").addEventListener("click", closeAdminModal);
  document.getElementById("cancel-admin-btn").addEventListener("click", closeAdminModal);
  document.getElementById("admin-form").addEventListener("submit", submitAdminLogin);

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
  document.getElementById("edit-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeEditModal();
  });
  document.getElementById("admin-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAdminModal();
  });
});
