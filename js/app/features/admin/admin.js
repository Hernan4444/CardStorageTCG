/**
 * Admin auth and card edit flow.
 */

import { api } from "../../../api.js";
import { CARD_FIELDS } from "../../config/constants.js";
import { UI_TEXT } from "../../config/messages.js";
import { state } from "../../core/state.js";
import { escHtml, setAdminError, setEditError } from "../../core/helpers.js";
import { getTagPickerValues, initializeTagPicker, setTagPickerValues } from "../tags/tag-picker.js";
import { loadGallery, loadGameNames, loadSeriesNames } from "../gallery/gallery.js";
import { closeUploadModal } from "../upload/upload.js";

export function populateEditGameOptions(currentValue = "") {
  const gameSelect = document.getElementById("edit_game_name");
  if (!gameSelect) return;

  const allGames = [...(state.gameNames || [])];
  if (currentValue && currentValue !== CARD_FIELDS.otherGameValue) {
    allGames.push(currentValue);
  }

  const options = [...new Set([...allGames, ...CARD_FIELDS.defaultGames])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const previousValue = gameSelect.value;
  gameSelect.innerHTML = options
    .map((game) => `<option value="${escHtml(game)}">${escHtml(game)}</option>`)
    .join("");
  gameSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${CARD_FIELDS.otherGameValue}">Otro</option>`
  );

  const valueToSelect = currentValue || previousValue;
  if (valueToSelect && [...gameSelect.options].some((option) => option.value === valueToSelect)) {
    gameSelect.value = valueToSelect;
  }

  toggleEditOtherGameField();
}

export function populateEditSeriesOptions(currentValue = "") {
  const seriesSelect = document.getElementById("edit_series");
  if (!seriesSelect) return;

  const allSeries = [...(state.seriesNames || [])];
  if (currentValue && currentValue !== CARD_FIELDS.otherSeriesValue) {
    allSeries.push(currentValue);
  }

  const options = [...new Set([...allSeries, ...CARD_FIELDS.defaultSeries])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const previousValue = seriesSelect.value;
  seriesSelect.innerHTML = options
    .map((serie) => `<option value="${escHtml(serie)}">${escHtml(serie)}</option>`)
    .join("");
  seriesSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${CARD_FIELDS.otherSeriesValue}">Otro</option>`
  );

  const valueToSelect = currentValue || previousValue;
  if (valueToSelect && [...seriesSelect.options].some((option) => option.value === valueToSelect)) {
    seriesSelect.value = valueToSelect;
  }

  toggleEditOtherSeriesField();
}

export function toggleEditOtherGameField() {
  const gameSelect = document.getElementById("edit_game_name");
  const otherGroup = document.getElementById("edit-other-game-group");
  const otherInput = document.getElementById("edit_other_game_name");
  if (!gameSelect || !otherGroup || !otherInput) return;

  const showOther = gameSelect.value === CARD_FIELDS.otherGameValue;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

export function toggleEditOtherSeriesField() {
  const seriesSelect = document.getElementById("edit_series");
  const otherGroup = document.getElementById("edit-other-series-group");
  const otherInput = document.getElementById("edit_other_series_name");
  if (!seriesSelect || !otherGroup || !otherInput) return;

  const showOther = seriesSelect.value === CARD_FIELDS.otherSeriesValue;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

export function getSelectedEditGameName(form) {
  if (form.game_name.value !== CARD_FIELDS.otherGameValue) {
    return form.game_name.value.trim();
  }

  return form.other_game_name.value.trim();
}

export function getSelectedEditSeriesName(form) {
  if (form.series.value !== CARD_FIELDS.otherSeriesValue) {
    return form.series.value.trim();
  }

  return form.other_series_name.value.trim();
}

export function closeEditModal() {
  document.getElementById("edit-modal").classList.remove("active");
  resetEditForm();
}

export function resetEditForm() {
  const form = document.getElementById("edit-form");
  if (!form) return;

  form.reset();
  form.dataset.cardId = "";
  state.editingCardId = null;
  setEditError("");
  document.getElementById("edit_other_game_name").value = "";
  document.getElementById("edit_other_series_name").value = "";
  setTagPickerValues("edit-tag-chips", []);
  populateEditGameOptions();
  populateEditSeriesOptions();
}

export async function saveEditCard(e) {
  e.preventDefault();
  if (!state.isAdmin || !state.adminPassword) {
    setEditError(UI_TEXT.admin.unlockToEdit);
    return;
  }

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  const gameName = getSelectedEditGameName(form);
  const series = getSelectedEditSeriesName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;
  const tags = getTagPickerValues("edit-tag-chips");

  if (
    !gameName ||
    !series ||
    !CARD_FIELDS.allowedLanguages.includes(language) ||
    !["normal", "foil"].includes(cardType)
  ) {
    setEditError(UI_TEXT.admin.editInvalidFields);
    return;
  }

  if (!state.editingCardId) {
    setEditError(UI_TEXT.admin.editMissingCard);
    return;
  }

  btn.disabled = true;
  btn.textContent = UI_TEXT.admin.saveInProgress;
  setEditError("");

  try {
    await api.updateCard(
      state.editingCardId,
      {
        game_name: gameName,
        anime: series,
        language,
        card_type: cardType,
        tags,
      },
      state.adminPassword
    );

    closeEditModal();
    await loadGameNames();
    await loadSeriesNames(state.selectedGames);
    loadGallery();
  } catch (err) {
    handleAdminRequestError(err);
    setEditError(UI_TEXT.upload.saveFailed(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = UI_TEXT.admin.saveChanges;
  }
}

export async function toggleAdminMode() {
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

export function openAdminModal() {
  const form = document.getElementById("admin-form");
  const input = document.getElementById("admin_password");

  form.reset();
  setAdminError("");
  document.getElementById("admin-modal").classList.add("active");
  input.focus();
}

export function closeAdminModal() {
  document.getElementById("admin-modal").classList.remove("active");
  document.getElementById("admin-form").reset();
  setAdminError("");
}

export async function submitAdminLogin(e) {
  e.preventDefault();

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const password = form.admin_password.value.trim();

  if (!password) {
    setAdminError(UI_TEXT.admin.enterPassword);
    return;
  }

  btn.disabled = true;
  btn.textContent = UI_TEXT.admin.validating;
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
    setAdminError(UI_TEXT.admin.wrongPassword(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = UI_TEXT.admin.loginAction;
  }
}

export async function restoreAdminSession() {
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

export function clearAdminSession() {
  state.isAdmin = false;
  state.adminPassword = "";
  localStorage.removeItem("cardstorageAdminPassword");
}

export function renderAdminState() {
  const status = document.getElementById("admin-status");
  const toggleButton = document.getElementById("admin-toggle-btn");
  const uploadButton = document.getElementById("open-upload-btn");
  const uploadModal = document.getElementById("upload-modal");
  if (!status || !toggleButton || !uploadButton) return;

  status.textContent = state.isAdmin ? UI_TEXT.admin.statusAdmin : UI_TEXT.admin.statusReadOnly;
  status.classList.toggle("is-admin", state.isAdmin);
  toggleButton.textContent = state.isAdmin
    ? UI_TEXT.admin.actionExitAdmin
    : UI_TEXT.admin.actionUnlockAdmin;
  uploadButton.hidden = !state.isAdmin;

  if (!state.isAdmin && uploadModal?.classList.contains("active")) {
    closeUploadModal();
  }
}

export function handleAdminRequestError(err) {
  if (!String(err.message).includes(UI_TEXT.admin.adminRequiredDetail)) {
    return;
  }

  closeEditModal();
  closeAdminModal();
  clearAdminSession();
  renderAdminState();
  loadGallery();
}

export async function confirmDelete(id, name) {
  if (!state.isAdmin || !state.adminPassword) {
    alert(UI_TEXT.admin.unlockToDelete);
    return;
  }

  if (!confirm(`¿Eliminar la carta "${name}"?`)) return;
  try {
    await api.deleteCard(id, state.adminPassword);
    loadGallery();
  } catch (err) {
    handleAdminRequestError(err);
    alert(UI_TEXT.admin.deleteFailed(err.message));
  }
}

export async function openEditCard(card) {
  if (!state.isAdmin || !state.adminPassword) {
    alert(UI_TEXT.admin.unlockToEdit);
    return;
  }

  state.editingCardId = card.id;
  initializeTagPicker("edit-tag-chips", "edit-tag-input", "add-edit-tag-btn", card.tags || []);

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
    gameSelect.value = CARD_FIELDS.otherGameValue;
    otherGameInput.value = card.game_name;
  }
  toggleEditOtherGameField();

  populateEditSeriesOptions(card.anime || "");
  if ([...seriesSelect.options].some((option) => option.value === (card.anime || ""))) {
    seriesSelect.value = card.anime || "";
    otherSeriesInput.value = "";
  } else {
    seriesSelect.value = CARD_FIELDS.otherSeriesValue;
    otherSeriesInput.value = card.anime || "";
  }
  toggleEditOtherSeriesField();

  languageSelect.value = CARD_FIELDS.allowedLanguages.includes(card.language)
    ? card.language
    : "Japones";
  cardTypeSelect.value = card.card_type === "foil" ? "foil" : "normal";

  form.dataset.cardId = String(card.id);
  document.getElementById("edit-modal").classList.add("active");
}
