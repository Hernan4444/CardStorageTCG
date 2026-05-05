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
  linkedImageUrl: "",      // external URL when upload source is link
  uploadMode: "image",    // 'image' or 'link'
  cards: [],
  gameNames: [],
  seriesNames: [],
  selectedGame: "",
  selectedSeries: [],
  currentPage: 1,
  totalPages: 1,
  isAdmin: false,
  adminPassword: localStorage.getItem("cardstorageAdminPassword") || "",
  editingCardId: null,
};

const DEFAULT_GAMES = ["Weiss", "Magic"];
const DEFAULT_SERIES = [];
const OTHER_GAME_VALUE = "__other__";
const OTHER_SERIES_VALUE = "__other_series__";
const ALLOWED_LANGUAGES = ["Español", "Ingles", "Japones", "Chino"];

// ─── 2. Gallery ──────────────────────────────────────────────────────────────

async function loadGallery() {
  if (!state.selectedGame) {
    state.cards = [];
    renderCards([]);
    renderPagination();
    updateSeriesFilter([]);
    return;
  }

  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");

  grid.innerHTML = '<div class="loading-spinner"></div>';
  empty.hidden = true;

  try {
    const result = await api.getCards({
      gameName: state.selectedGame,
      series: state.selectedSeries,
      page: state.currentPage,
      perPage: 20,
    });

    const cards = result.items || [];
    state.cards = cards;
    state.currentPage = result.pagination?.page || 1;
    state.totalPages = result.pagination?.total_pages || 1;

    populateGameOptions();
    populateSeriesOptions();
    populateEditGameOptions();
    populateEditSeriesOptions();

    updateSeriesFilter(result.available_animes || []);
    renderCards(cards);
    renderPagination();
  } catch (err) {
    state.cards = [];
    renderCards([], `Error al cargar las cartas: ${err.message}`);
    renderPagination();
  }
}

function renderCards(cards, errorMsg = "") {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");

  grid.innerHTML = "";
  empty.hidden = true;

  if (errorMsg) {
    grid.innerHTML = `<p class="error-msg">${escHtml(errorMsg)}</p>`;
    return;
  }

  if (!state.selectedGame) {
    empty.textContent = "Selecciona un juego para ver sus cartas.";
    empty.hidden = false;
    return;
  }

  if (cards.length === 0) {
    empty.textContent = "No hay cartas para este juego/filtro.";
    empty.hidden = false;
    return;
  }

  cards.forEach((card) => grid.appendChild(buildCardTile(card)));
}

function renderPagination() {
  const panel = document.getElementById("cards-pagination");
  const indicator = document.getElementById("page-indicator");
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  if (!state.selectedGame) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  indicator.textContent = `Página ${state.currentPage} de ${Math.max(1, state.totalPages)}`;
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= state.totalPages;
}

async function loadGameNames() {
  try {
    const games = await api.getGames();
    state.gameNames = [...new Set([...(games || []), ...DEFAULT_GAMES])]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "es"));
  } catch {
    state.gameNames = [...DEFAULT_GAMES];
  }

  renderGameList();
  populateGameOptions();
  populateEditGameOptions();
}

async function loadSeriesNames(gameName = "") {
  try {
    const series = await api.getSeries(gameName);
    state.seriesNames = [...new Set([...(series || []), ...DEFAULT_SERIES])]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "es"));
  } catch {
    state.seriesNames = [...DEFAULT_SERIES];
  }

  populateSeriesOptions();
  populateEditSeriesOptions();
}

function renderGameList() {
  const container = document.getElementById("game-list");
  if (!container) return;

  if (state.gameNames.length === 0) {
    container.innerHTML = '<p class="card-meta">No hay juegos disponibles aún.</p>';
    return;
  }

  container.innerHTML = "";
  state.gameNames.forEach((game) => {
    const btn = document.createElement("button");
    btn.className = `game-pill${state.selectedGame === game ? " active" : ""}`;
    btn.textContent = game;
    btn.addEventListener("click", () => selectGame(game));
    container.appendChild(btn);
  });
}

async function selectGame(gameName) {
  state.selectedGame = gameName;
  state.selectedSeries = [];
  state.currentPage = 1;
  renderGameList();
  await loadSeriesNames(gameName);
  await loadGallery();
  document.getElementById("cards-filter-panel").hidden = false;
}

function updateSeriesFilter(availableSeries) {
  const seriesFilter = document.getElementById("series-filter");
  if (!seriesFilter) return;

  const selected = new Set(state.selectedSeries);
  seriesFilter.innerHTML = (availableSeries || [])
    .map((serie) => `<option value="${escHtml(serie)}">${escHtml(serie)}</option>`)
    .join("");

  [...seriesFilter.options].forEach((option) => {
    option.selected = selected.has(option.value);
  });

  state.selectedSeries = [...seriesFilter.selectedOptions].map((option) => option.value);
}

function applySeriesFilter() {
  const seriesFilter = document.getElementById("series-filter");
  state.selectedSeries = [...seriesFilter.selectedOptions].map((option) => option.value);
  state.currentPage = 1;
  loadGallery();
}

function clearSeriesFilter() {
  const seriesFilter = document.getElementById("series-filter");
  [...seriesFilter.options].forEach((option) => {
    option.selected = false;
  });
  state.selectedSeries = [];
  state.currentPage = 1;
  loadGallery();
}

function goPrevPage() {
  if (state.currentPage <= 1) return;
  state.currentPage -= 1;
  loadGallery();
}

function goNextPage() {
  if (state.currentPage >= state.totalPages) return;
  state.currentPage += 1;
  loadGallery();
}

function getLanguageFlag(language) {
  const normalized = String(language || "").trim().toLowerCase();
  const flagMap = {
    "español": "1f1ea-1f1f8",
    "ingles": "1f1fa-1f1f8",
    "inglés": "1f1fa-1f1f8",
    "japones": "1f1ef-1f1f5",
    "japonés": "1f1ef-1f1f5",
    "chino": "1f1e8-1f1f3",
  };
  const code = flagMap[normalized] || "1f310";
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
}

function buildCardTile(card) {
  const article = document.createElement("article");
  article.className = "card-tile";
  article.dataset.id = card.id;
  const language = String(card.language || "").trim();
  const languageFlagSrc = getLanguageFlag(language);

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
      <span class="badge badge-language" title="${escHtml(language)}">
        <img src="${escHtml(languageFlagSrc)}" alt="${escHtml(language)}" class="badge-language-img" loading="lazy" />
      </span>
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
  const seriesSelect = document.getElementById("edit_series");
  const otherSeriesInput = document.getElementById("edit_other_series_name");

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

  populateEditSeriesOptions(card.anime || "");
  if ([...seriesSelect.options].some((option) => option.value === (card.anime || ""))) {
    seriesSelect.value = card.anime || "";
    otherSeriesInput.value = "";
  } else {
    seriesSelect.value = OTHER_SERIES_VALUE;
    otherSeriesInput.value = card.anime || "";
  }
  toggleEditOtherSeriesField();

  languageSelect.value = ALLOWED_LANGUAGES.includes(card.language) ? card.language : "Japones";
  cardTypeSelect.value = card.card_type === "foil" ? "foil" : "normal";

  form.dataset.cardId = String(card.id);
  document.getElementById("edit-modal").classList.add("active");
}

// ─── 3. Upload Flow ───────────────────────────────────────────────────────────

// -- Step A: Open upload modal and choose source (camera / file)
function openUploadModal() {
  if (!state.isAdmin || !state.adminPassword) {
    alert("Debes desbloquear el modo admin para subir cartas.");
    return;
  }

  resetUploadFlow();
  populateGameOptions();
  populateSeriesOptions();
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
  state.linkedImageUrl = "";
  state.uploadMode = "image";
  document.getElementById("camera-feed").srcObject = null;
  document.getElementById("step-source").hidden = true;
  document.getElementById("step-camera").hidden = true;
  document.getElementById("step-link").hidden = true;
  document.getElementById("step-preview").hidden = true;
  document.getElementById("step-metadata").hidden = true;
  document.getElementById("upload-error").textContent = "";
  document.getElementById("link_image_url").value = "";
  document.getElementById("metadata-form").reset();
  toggleOtherGameField();
  toggleOtherSeriesField();
}

function showStep(stepId) {
  ["step-source", "step-camera", "step-link", "step-preview", "step-metadata"].forEach(
    (id) => { document.getElementById(id).hidden = id !== stepId; }
  );
}

function openLinkStep() {
  setUploadError("");
  showStep("step-link");
}

function confirmLinkImage() {
  const input = document.getElementById("link_image_url");
  const imageUrl = input.value.trim();

  if (!/^https?:\/\/.+/i.test(imageUrl)) {
    setUploadError("Ingresa un link valido que comience con http:// o https://.");
    return;
  }

  state.linkedImageUrl = imageUrl;
  state.uploadMode = "link";

  const img = document.getElementById("preview-img");
  img.classList.add("loading");
  img.src = imageUrl;
  img.onload = () => {
    img.classList.remove("loading");
    img.onload = null;
    img.onerror = null;
    setUploadError("");
    showStep("step-metadata");
  };
  img.onerror = () => {
    img.classList.remove("loading");
    img.onload = null;
    img.onerror = null;
    setUploadError("No se pudo cargar la imagen desde ese link.");
  };
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
  state.uploadMode = "image";
  state.linkedImageUrl = "";
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
    state.uploadMode = "image";
    state.linkedImageUrl = "";
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

  if (!state.isAdmin || !state.adminPassword) {
    setUploadError("Debes desbloquear el modo admin para subir cartas.");
    return;
  }

  const gameName = getSelectedGameName(form);
  const series = getSelectedSeriesName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !series || !language) {
    setUploadError("Completa todos los campos.");
    return;
  }

  if (state.uploadMode === "link" && !state.linkedImageUrl) {
    setUploadError("Debes ingresar un link de imagen valido.");
    return;
  }

  if (state.uploadMode !== "link" && !state.croppedDataUrl) {
    setUploadError("Primero debes seleccionar o capturar una imagen.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    if (state.uploadMode === "link") {
      await api.createCardFromLink(state.linkedImageUrl, {
        game_name: gameName,
        series,
        language: language,
        card_type: cardType,
      });
    } else {
      await api.createCard(state.croppedDataUrl, {
        game_name: gameName,
        series,
        language: language,
        card_type: cardType,
      });
    }
    closeUploadModal();
    await loadGameNames();
    await loadSeriesNames(state.selectedGame || "");
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

  const options = [...new Set([...(state.gameNames || []), ...DEFAULT_GAMES])]
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
  } else if ([...gameSelect.options].some((option) => option.value === "Weiss")) {
    gameSelect.value = "Weiss";
  }

  toggleOtherGameField();
}

function populateSeriesOptions() {
  const seriesSelect = document.getElementById("series");
  if (!seriesSelect) return;

  const options = [...new Set([...(state.seriesNames || []), ...DEFAULT_SERIES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const currentValue = seriesSelect.value;
  seriesSelect.innerHTML = options
    .map((serie) => `<option value="${escHtml(serie)}">${escHtml(serie)}</option>`)
    .join("");
  seriesSelect.insertAdjacentHTML("beforeend", `<option value="${OTHER_SERIES_VALUE}">Otro</option>`);

  if (currentValue && [...seriesSelect.options].some((option) => option.value === currentValue)) {
    seriesSelect.value = currentValue;
  }

  toggleOtherSeriesField();
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

function toggleOtherSeriesField() {
  const seriesSelect = document.getElementById("series");
  const otherGroup = document.getElementById("other-series-group");
  const otherInput = document.getElementById("other_series_name");
  if (!seriesSelect || !otherGroup || !otherInput) return;

  const showOther = seriesSelect.value === OTHER_SERIES_VALUE;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

function getSelectedSeriesName(form) {
  if (form.series.value !== OTHER_SERIES_VALUE) {
    return form.series.value.trim();
  }

  return form.other_series_name.value.trim();
}

function populateEditGameOptions(currentValue = "") {
  const gameSelect = document.getElementById("edit_game_name");
  if (!gameSelect) return;

  const allGames = [...(state.gameNames || [])];
  if (currentValue && currentValue !== OTHER_GAME_VALUE) {
    allGames.push(currentValue);
  }

  const options = [...new Set([...allGames, ...DEFAULT_GAMES])]
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

function populateEditSeriesOptions(currentValue = "") {
  const seriesSelect = document.getElementById("edit_series");
  if (!seriesSelect) return;

  const allSeries = [...(state.seriesNames || [])];
  if (currentValue && currentValue !== OTHER_SERIES_VALUE) {
    allSeries.push(currentValue);
  }

  const options = [...new Set([...allSeries, ...DEFAULT_SERIES])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const previousValue = seriesSelect.value;
  seriesSelect.innerHTML = options
    .map((serie) => `<option value="${escHtml(serie)}">${escHtml(serie)}</option>`)
    .join("");
  seriesSelect.insertAdjacentHTML("beforeend", `<option value="${OTHER_SERIES_VALUE}">Otro</option>`);

  const valueToSelect = currentValue || previousValue;
  if (valueToSelect && [...seriesSelect.options].some((option) => option.value === valueToSelect)) {
    seriesSelect.value = valueToSelect;
  }

  toggleEditOtherSeriesField();
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

function toggleEditOtherSeriesField() {
  const seriesSelect = document.getElementById("edit_series");
  const otherGroup = document.getElementById("edit-other-series-group");
  const otherInput = document.getElementById("edit_other_series_name");
  if (!seriesSelect || !otherGroup || !otherInput) return;

  const showOther = seriesSelect.value === OTHER_SERIES_VALUE;
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

function getSelectedEditSeriesName(form) {
  if (form.series.value !== OTHER_SERIES_VALUE) {
    return form.series.value.trim();
  }

  return form.other_series_name.value.trim();
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
  document.getElementById("edit_other_series_name").value = "";
  populateEditGameOptions();
  populateEditSeriesOptions();
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
  const series = getSelectedEditSeriesName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !series || !ALLOWED_LANGUAGES.includes(language) || !["normal", "foil"].includes(cardType)) {
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
        anime: series,
        language,
        card_type: cardType,
      },
      state.adminPassword
    );

    closeEditModal();
    await loadGameNames();
    await loadSeriesNames(state.selectedGame || "");
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
  const uploadButton = document.getElementById("open-upload-btn");
  const uploadModal = document.getElementById("upload-modal");
  if (!status || !toggleButton || !uploadButton) return;

  status.textContent = state.isAdmin ? "Modo admin activo" : "Modo lectura";
  status.classList.toggle("is-admin", state.isAdmin);
  toggleButton.textContent = state.isAdmin ? "Salir admin" : "Desbloquear admin";
  uploadButton.hidden = !state.isAdmin;

  if (!state.isAdmin && uploadModal?.classList.contains("active")) {
    closeUploadModal();
  }
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

  const hdButton = document.getElementById("detail-hd-btn");
  hdButton.dataset.id = id;
  hdButton.disabled = true;
  hdButton.hidden = true;
  hdButton.textContent = "Ver en HD";

  try {
    const card = await api.getCard(id);
    // Show thumbnail first; HD loads on demand
    img.src = card.thumbnail_url;
    img.classList.remove("loading");

    img.dataset.hdUrl = card.hd_url || "";
    hdButton.hidden = !card.hd_url;
    hdButton.disabled = !card.hd_url;

    info.innerHTML = `
      <h2>${escHtml(card.game_name)}</h2>
      <p><strong>Serie:</strong> ${escHtml(card.anime || "-")}</p>
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
  populateSeriesOptions();
  populateEditGameOptions();
  populateEditSeriesOptions();
  await restoreAdminSession();
  await loadGameNames();
  await loadSeriesNames();
  renderCards([]);
  renderPagination();

  // Upload modal controls
  document.getElementById("admin-toggle-btn").addEventListener("click", toggleAdminMode);
  document.getElementById("open-upload-btn").addEventListener("click", openUploadModal);
  document.getElementById("close-upload-btn").addEventListener("click", closeUploadModal);
  document.getElementById("use-camera-btn").addEventListener("click", startCamera);
  document.getElementById("use-link-btn").addEventListener("click", openLinkStep);
  document.getElementById("confirm-link-btn").addEventListener("click", confirmLinkImage);
  document.getElementById("cancel-link-btn").addEventListener("click", () => showStep("step-source"));
  document.getElementById("capture-btn").addEventListener("click", capturePhoto);
  document.getElementById("use-file-btn").addEventListener("click", () =>
    document.getElementById("file-input").click()
  );
  document.getElementById("file-input").addEventListener("change", handleFileInput);
  document.getElementById("retake-btn").addEventListener("click", () => {
    state.uploadMode = "image";
    state.linkedImageUrl = "";
    showStep("step-source");
  });
  document.getElementById("confirm-preview-btn").addEventListener("click", () =>
    showStep("step-metadata")
  );
  document.getElementById("metadata-form").addEventListener("submit", saveCard);
  document.getElementById("game_name").addEventListener("change", toggleOtherGameField);
  document.getElementById("series").addEventListener("change", toggleOtherSeriesField);
  document.getElementById("back-to-preview-btn").addEventListener("click", () =>
    showStep(state.uploadMode === "link" ? "step-link" : "step-preview")
  );

  // Browser controls
  document.getElementById("apply-series-filter-btn").addEventListener("click", applySeriesFilter);
  document.getElementById("clear-series-filter-btn").addEventListener("click", clearSeriesFilter);
  document.getElementById("prev-page-btn").addEventListener("click", goPrevPage);
  document.getElementById("next-page-btn").addEventListener("click", goNextPage);

  // Edit modal controls
  document.getElementById("close-edit-btn").addEventListener("click", closeEditModal);
  document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);
  document.getElementById("edit-form").addEventListener("submit", saveEditCard);
  document.getElementById("edit_game_name").addEventListener("change", toggleEditOtherGameField);
  document.getElementById("edit_series").addEventListener("change", toggleEditOtherSeriesField);

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
