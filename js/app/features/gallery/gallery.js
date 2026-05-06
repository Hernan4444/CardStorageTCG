/**
 * Gallery, filters, pagination, and card tiles.
 */

import { api } from "../../../api.js";
import { APP_CONFIG, CARD_FIELDS } from "../../config/constants.js";
import { UI_TEXT } from "../../config/messages.js";
import { escHtml } from "../../core/helpers.js";
import { state, wait } from "../../core/state.js";
import { openDetailModal } from "../detail/detail.js";
import { populateGameOptions, populateSeriesOptions } from "../upload/upload.js";
import {
  confirmDelete,
  openEditCard,
  populateEditGameOptions,
  populateEditSeriesOptions,
} from "../admin/admin.js";

export function renderGalleryLoading(message) {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");
  if (!grid || !empty) return;

  grid.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">${escHtml(message)}</p>
    </div>
  `;
  empty.hidden = true;
}

export function setGalleryBootstrapping(isBootstrapping) {
  const filterPanel = document.getElementById("cards-filter-panel");
  const pagination = document.getElementById("cards-pagination");
  const empty = document.getElementById("empty-state");

  if (filterPanel) {
    filterPanel.hidden = isBootstrapping;
  }
  if (pagination) {
    pagination.hidden = true;
  }
  if (empty) {
    empty.hidden = true;
  }
}

export async function loadGallery(options = {}) {
  const {
    retries = 1,
    retryDelayMs = 0,
    showRetryStatus = false,
  } = options;

  renderGalleryLoading(UI_TEXT.gallery.loading);

  let lastError = null;
  const maxAttempts = Math.max(1, Number(retries) || 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (showRetryStatus && attempt > 1) {
      renderGalleryLoading(UI_TEXT.gallery.connectingAttempt(attempt, maxAttempts));
    }

    try {
      const result = await api.getCards({
        gameNames: state.selectedGames,
        series: state.selectedSeries,
        page: state.currentPage,
        perPage: APP_CONFIG.gallery.perPage,
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
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        if (showRetryStatus) {
          renderGalleryLoading(
            UI_TEXT.gallery.retryingIn(Math.round(retryDelayMs / 1000), attempt, maxAttempts)
          );
        }
        if (retryDelayMs > 0) {
          await wait(retryDelayMs);
        }
        continue;
      }
    }
  }

  state.cards = [];
  state.currentPage = 1;
  state.totalPages = 1;
  const detail = lastError?.message || UI_TEXT.gallery.loadErrorFallback;
  renderCards([], UI_TEXT.gallery.loadError(detail));
  renderPagination();
}

export function renderCards(cards, errorMsg = "") {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");

  grid.innerHTML = "";
  empty.hidden = true;

  if (errorMsg) {
    grid.innerHTML = `<p class="error-msg">${escHtml(errorMsg)}</p>`;
    return;
  }

  if (cards.length === 0) {
    empty.textContent = UI_TEXT.gallery.noCards;
    empty.hidden = false;
    return;
  }

  cards.forEach((card) => grid.appendChild(buildCardTile(card)));
}

export function renderPagination() {
  const panel = document.getElementById("cards-pagination");
  const indicator = document.getElementById("page-indicator");
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  panel.hidden = false;
  indicator.textContent = UI_TEXT.gallery.pageIndicator(
    state.currentPage,
    Math.max(1, state.totalPages)
  );
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= state.totalPages;
}

export async function loadGameNames() {
  try {
    const games = await api.getGames();
    state.gameNames = [...new Set([...(games || []), ...CARD_FIELDS.defaultGames])]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "es"));
  } catch {
    state.gameNames = [...CARD_FIELDS.defaultGames];
  }

  populateGameFilterSelect();
  populateGameOptions();
  populateEditGameOptions();
}

export async function loadSeriesNames(gameNames = []) {
  try {
    const series = await api.getSeries(gameNames);
    state.seriesNames = [...new Set([...(series || []), ...CARD_FIELDS.defaultSeries])]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "es"));
  } catch {
    state.seriesNames = [...CARD_FIELDS.defaultSeries];
  }

  populateSeriesOptions();
  populateEditSeriesOptions();
}

export function populateGameFilterSelect() {
  const select = document.getElementById("game-filter");
  if (!select) return;

  const selected = new Set(state.selectedGames);
  select.innerHTML = state.gameNames
    .map((game) => `<option value="${escHtml(game)}"${selected.has(game) ? " selected" : ""}>${escHtml(game)}</option>`)
    .join("");
}

export function updateSeriesFilter(availableSeries) {
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

export async function applyFilter() {
  const gameSelect = document.getElementById("game-filter");
  const seriesFilter = document.getElementById("series-filter");

  state.selectedGames = [...gameSelect.selectedOptions].map((o) => o.value);
  state.selectedSeries = [...seriesFilter.selectedOptions].map((o) => o.value);
  state.currentPage = 1;

  await loadSeriesNames(state.selectedGames);
  loadGallery();
}

export function clearFilter() {
  const gameSelect = document.getElementById("game-filter");
  const seriesFilter = document.getElementById("series-filter");

  [...gameSelect.options].forEach((o) => {
    o.selected = false;
  });
  [...seriesFilter.options].forEach((o) => {
    o.selected = false;
  });

  state.selectedGames = [];
  state.selectedSeries = [];
  state.currentPage = 1;
  loadSeriesNames([]);
  loadGallery();
}

export function goPrevPage() {
  if (state.currentPage <= 1) return;
  state.currentPage -= 1;
  loadGallery();
}

export function goNextPage() {
  if (state.currentPage >= state.totalPages) return;
  state.currentPage += 1;
  loadGallery();
}

export function getLanguageFlag(language) {
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

export function buildCardTile(card) {
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
