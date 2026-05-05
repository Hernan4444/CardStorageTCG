/**
 * Detail modal and HD loading.
 */

import { api } from "../../../api.js";
import { UI_TEXT } from "../../config/messages.js";
import { escHtml } from "../../core/helpers.js";

export async function openDetailModal(id) {
  const modal = document.getElementById("detail-modal");
  modal.classList.add("active");

  const img = document.getElementById("detail-img");
  const info = document.getElementById("detail-info");

  img.src = "";
  img.classList.add("loading");
  info.innerHTML = UI_TEXT.detail.loading;

  const hdButton = document.getElementById("detail-hd-btn");
  hdButton.dataset.id = id;
  hdButton.disabled = true;
  hdButton.hidden = true;
  hdButton.textContent = UI_TEXT.detail.hdAction;

  try {
    const card = await api.getCard(id);
    img.src = card.thumbnail_url;
    img.classList.remove("loading");

    img.dataset.hdUrl = card.hd_url || "";
    hdButton.hidden = !card.hd_url;
    hdButton.disabled = !card.hd_url;

    info.innerHTML = `
      <h2>${escHtml(card.game_name)}</h2>
      <p><strong>${UI_TEXT.detail.seriesLabel}:</strong> ${escHtml(card.anime || "-")}</p>
      <p><strong>${UI_TEXT.detail.languageLabel}:</strong> ${escHtml(card.language)}</p>
      <p><strong>${UI_TEXT.detail.typeLabel}:</strong> ${escHtml(card.card_type)}</p>
      <p class="card-date">${UI_TEXT.detail.uploadDateLabel}: ${new Date(card.created_at).toLocaleDateString("es")}</p>
    `;
  } catch (err) {
    info.innerHTML = UI_TEXT.detail.loadError(err.message);
    img.classList.remove("loading");
  }
}

export function loadHD() {
  const img = document.getElementById("detail-img");
  const btn = document.getElementById("detail-hd-btn");
  if (!img.dataset.hdUrl) return;

  btn.disabled = true;
  btn.textContent = UI_TEXT.detail.hdLoading;
  img.classList.add("loading");

  const hdImg = new Image();
  hdImg.onload = () => {
    img.src = hdImg.src;
    img.classList.remove("loading");
    btn.textContent = UI_TEXT.detail.hdLoaded;
  };
  hdImg.onerror = () => {
    btn.disabled = false;
    btn.textContent = UI_TEXT.detail.hdRetry;
    img.classList.remove("loading");
  };
  hdImg.src = img.dataset.hdUrl;
}

export function closeDetailModal() {
  document.getElementById("detail-modal").classList.remove("active");
  document.getElementById("detail-img").src = "";
  document.getElementById("detail-img").dataset.hdUrl = "";
}
