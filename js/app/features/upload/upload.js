/**
 * Upload modal flow and metadata form helpers.
 */

import { api } from "../../../api.js";
import { CARD_FIELDS } from "../../config/constants.js";
import { UI_TEXT } from "../../config/messages.js";
import { state } from "../../core/state.js";
import { escHtml, setUploadError } from "../../core/helpers.js";
import { loadGallery, loadGameNames, loadSeriesNames } from "../gallery/gallery.js";

export function openUploadModal() {
  if (!state.isAdmin || !state.adminPassword) {
    alert(UI_TEXT.admin.unlockToUpload);
    return;
  }

  resetUploadFlow();
  populateGameOptions();
  populateSeriesOptions();
  showStep("step-source");
  document.getElementById("upload-modal").classList.add("active");
}

export function closeUploadModal() {
  stopCamera();
  document.getElementById("upload-modal").classList.remove("active");
  resetUploadFlow();
}

export function resetUploadFlow() {
  state.capturedDataUrl = null;
  state.croppedDataUrl = null;
  state.linkedImageUrl = "";
  state.linkedImageUrls = [];
  state.uploadMode = "image";
  document.getElementById("camera-feed").srcObject = null;
  document.getElementById("step-source").hidden = true;
  document.getElementById("step-camera").hidden = true;
  document.getElementById("step-link").hidden = true;
  document.getElementById("step-preview").hidden = true;
  document.getElementById("step-metadata").hidden = true;
  document.getElementById("upload-error").textContent = "";
  document.getElementById("link_image_url").value = "";
  document.getElementById("link-batch-info").textContent = "";
  document.getElementById("metadata-form").reset();
  toggleOtherGameField();
  toggleOtherSeriesField();
}

export function showStep(stepId) {
  ["step-source", "step-camera", "step-link", "step-preview", "step-metadata"].forEach((id) => {
    document.getElementById(id).hidden = id !== stepId;
  });
}

export function openLinkStep() {
  setUploadError("");
  showStep("step-link");
}

function isValidHttpUrl(value) {
  return /^https?:\/\/.+/i.test(value);
}

function parseLinkLines(rawValue) {
  const urls = rawValue
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  urls.forEach((url) => {
    if (seen.has(url)) return;
    seen.add(url);
    deduped.push(url);
  });

  return deduped;
}

function updateLinkBatchInfo() {
  const linkCount = state.linkedImageUrls.length;
  const infoEl = document.getElementById("link-batch-info");
  if (!infoEl) return;

  if (linkCount <= 0) {
    infoEl.textContent = "";
    return;
  }

  if (linkCount === 1) {
    infoEl.textContent = UI_TEXT.upload.singleLinkReady;
    return;
  }

  infoEl.textContent = UI_TEXT.upload.multiLinksReady(linkCount);
}

export function confirmLinkImage() {
  const input = document.getElementById("link_image_url");
  const links = parseLinkLines(input.value);

  if (!links.length) {
    setUploadError(UI_TEXT.upload.missingLink);
    return;
  }

  const invalidLinks = links.filter((url) => !isValidHttpUrl(url));
  if (invalidLinks.length > 0) {
    setUploadError(UI_TEXT.upload.invalidLinkList(invalidLinks.length));
    return;
  }

  state.linkedImageUrls = links;
  state.linkedImageUrl = links[0];
  state.uploadMode = "link";
  updateLinkBatchInfo();

  const img = document.getElementById("preview-img");
  img.classList.add("loading");
  img.src = state.linkedImageUrl;
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
    setUploadError(UI_TEXT.upload.linkNotLoadable);
  };
}

let _stream = null;

export async function startCamera() {
  showStep("step-camera");
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    document.getElementById("camera-feed").srcObject = _stream;
  } catch {
    setUploadError(UI_TEXT.upload.cameraFallback);
    showStep("step-source");
  }
}

export function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
    _stream = null;
  }
}

export function capturePhoto() {
  const video = document.getElementById("camera-feed");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  state.capturedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  state.uploadMode = "image";
  state.linkedImageUrl = "";
  state.linkedImageUrls = [];
  stopCamera();
  processCapture();
}

export function handleFileInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setUploadError(UI_TEXT.upload.invalidImageFile);
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.capturedDataUrl = ev.target.result;
    state.uploadMode = "image";
    state.linkedImageUrl = "";
    state.linkedImageUrls = [];
    processCapture();
  };
  reader.readAsDataURL(file);
}

export async function processCapture() {
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

export async function saveCard(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  if (!state.isAdmin || !state.adminPassword) {
    setUploadError(UI_TEXT.admin.unlockToUpload);
    return;
  }

  const gameName = getSelectedGameName(form);
  const series = getSelectedSeriesName(form);
  const language = form.language.value.trim();
  const cardType = form.card_type.value;

  if (!gameName || !series || !language) {
    setUploadError(UI_TEXT.upload.missingFields);
    return;
  }

  const linkUrls = state.linkedImageUrls.length
    ? state.linkedImageUrls
    : (state.linkedImageUrl ? [state.linkedImageUrl] : []);

  if (state.uploadMode === "link" && !linkUrls.length) {
    setUploadError(UI_TEXT.upload.missingLink);
    return;
  }

  if (state.uploadMode !== "link" && !state.croppedDataUrl) {
    setUploadError(UI_TEXT.upload.missingImage);
    return;
  }

  btn.disabled = true;
  btn.textContent =
    state.uploadMode === "link" && linkUrls.length > 1
      ? UI_TEXT.upload.batchSaveInProgress
      : UI_TEXT.admin.saveInProgress;

  try {
    if (state.uploadMode === "link") {
      if (linkUrls.length > 1) {
        const batchResult = await api.createCardsFromLinks(linkUrls, {
          game_name: gameName,
          series,
          language,
          card_type: cardType,
        });

        if (batchResult.failed_count > 0) {
          alert(UI_TEXT.upload.batchPartial(batchResult.created_count, batchResult.failed_count));
        } else {
          alert(UI_TEXT.upload.batchSuccess(batchResult.created_count));
        }
      } else {
        await api.createCardFromLink(linkUrls[0], {
          game_name: gameName,
          series,
          language,
          card_type: cardType,
        });
      }
    } else {
      await api.createCard(state.croppedDataUrl, {
        game_name: gameName,
        series,
        language,
        card_type: cardType,
      });
    }
    closeUploadModal();
    await loadGameNames();
    await loadSeriesNames(state.selectedGames);
    loadGallery();
  } catch (err) {
    setUploadError(UI_TEXT.upload.saveFailed(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = UI_TEXT.upload.saveAction;
  }
}

export function populateGameOptions() {
  const gameSelect = document.getElementById("game_name");
  if (!gameSelect) return;

  const options = [...new Set([...(state.gameNames || []), ...CARD_FIELDS.defaultGames])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const currentValue = gameSelect.value;

  gameSelect.innerHTML = options
    .map((game) => `<option value="${escHtml(game)}">${escHtml(game)}</option>`)
    .join("");

  gameSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${CARD_FIELDS.otherGameValue}">Otro</option>`
  );

  if (currentValue && [...gameSelect.options].some((option) => option.value === currentValue)) {
    gameSelect.value = currentValue;
  } else if ([...gameSelect.options].some((option) => option.value === "Weiss")) {
    gameSelect.value = "Weiss";
  }

  toggleOtherGameField();
}

export function populateSeriesOptions() {
  const seriesSelect = document.getElementById("series");
  if (!seriesSelect) return;

  const options = [...new Set([...(state.seriesNames || []), ...CARD_FIELDS.defaultSeries])]
    .sort((left, right) => left.localeCompare(right, "es"));

  const currentValue = seriesSelect.value;
  seriesSelect.innerHTML = options
    .map((serie) => `<option value="${escHtml(serie)}">${escHtml(serie)}</option>`)
    .join("");
  seriesSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${CARD_FIELDS.otherSeriesValue}">Otro</option>`
  );

  if (currentValue && [...seriesSelect.options].some((option) => option.value === currentValue)) {
    seriesSelect.value = currentValue;
  }

  toggleOtherSeriesField();
}

export function toggleOtherGameField() {
  const gameSelect = document.getElementById("game_name");
  const otherGroup = document.getElementById("other-game-group");
  const otherInput = document.getElementById("other_game_name");
  if (!gameSelect || !otherGroup || !otherInput) return;

  const showOther = gameSelect.value === CARD_FIELDS.otherGameValue;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

export function getSelectedGameName(form) {
  if (form.game_name.value !== CARD_FIELDS.otherGameValue) {
    return form.game_name.value.trim();
  }

  return form.other_game_name.value.trim();
}

export function toggleOtherSeriesField() {
  const seriesSelect = document.getElementById("series");
  const otherGroup = document.getElementById("other-series-group");
  const otherInput = document.getElementById("other_series_name");
  if (!seriesSelect || !otherGroup || !otherInput) return;

  const showOther = seriesSelect.value === CARD_FIELDS.otherSeriesValue;
  otherGroup.hidden = !showOther;
  otherInput.required = showOther;

  if (!showOther) {
    otherInput.value = "";
  }
}

export function getSelectedSeriesName(form) {
  if (form.series.value !== CARD_FIELDS.otherSeriesValue) {
    return form.series.value.trim();
  }

  return form.other_series_name.value.trim();
}
