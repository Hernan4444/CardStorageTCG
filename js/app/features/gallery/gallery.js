/**
 * Gallery, filters, pagination, and card tiles.
 */

import { api } from "../../../api.js";
import { APP_CONFIG, CARD_FIELDS } from "../../config/constants.js";
import { UI_TEXT } from "../../config/messages.js";
import { escHtml } from "../../core/helpers.js";
import { savePageSize, state, wait } from "../../core/state.js";
import { openDetailModal } from "../detail/detail.js";
import { populateGameOptions, populateSeriesOptions } from "../upload/upload.js";
import {
  confirmDelete,
  handleAdminRequestError,
  openEditCard,
  populateEditGameOptions,
  populateEditSeriesOptions,
} from "../admin/admin.js";

let galleryLoadSequence = 0;
let favoritesLoadSequence = 0;

export function renderGalleryLoading(message) {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");
  const pagination = document.getElementById("cards-pagination");
  if (!grid || !empty) return;

  grid.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">${escHtml(message)}</p>
    </div>
  `;
  empty.hidden = true;
  if (pagination) {
    pagination.hidden = true;
  }
}

export function setGalleryBootstrapping(isBootstrapping) {
  const filterPanel = document.getElementById("cards-filter-panel");
  const pagination = document.getElementById("cards-pagination");
  const empty = document.getElementById("empty-state");

  if (filterPanel) {
    filterPanel.hidden = isBootstrapping || state.activeCollection === "favorites";
  }
  if (pagination) {
    pagination.hidden = true;
  }
  if (empty) {
    empty.hidden = true;
  }
}

export async function loadGallery(options = {}) {
  const sequence = ++galleryLoadSequence;
  if (state.activeCollection === "favorites") {
    await loadFavorites();
    return;
  }

  const filterPanel = document.getElementById("cards-filter-panel");
  if (filterPanel) filterPanel.hidden = false;

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
        perPage: state.pageSize,
      });
      if (sequence !== galleryLoadSequence || state.activeCollection !== "all") return;

      const cards = result.items || [];
      state.cards = cards;
      state.currentPage = result.pagination?.page || 1;
      state.totalPages = result.pagination?.total_pages || 1;
      state.favoriteCount = result.favorite_count || 0;
      updateFavoritesCount();

      populateGameOptions();
      populateSeriesOptions();
      populateEditGameOptions();
      populateEditSeriesOptions();

      updateSeriesFilter(result.available_animes || []);
      renderCards(cards);
      renderPagination();
      return;
    } catch (err) {
      if (sequence !== galleryLoadSequence || state.activeCollection !== "all") return;
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

  if (sequence !== galleryLoadSequence || state.activeCollection !== "all") return;
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
    empty.textContent = state.activeCollection === "favorites"
      ? UI_TEXT.gallery.noFavorites
      : UI_TEXT.gallery.noCards;
    empty.hidden = false;
    return;
  }

  cards.forEach((card) => grid.appendChild(buildCardTile(card)));
}

export async function loadFavorites() {
  const sequence = ++favoritesLoadSequence;
  const pagination = document.getElementById("cards-pagination");
  const filterPanel = document.getElementById("cards-filter-panel");
  if (pagination) pagination.hidden = true;
  if (filterPanel) filterPanel.hidden = true;
  renderGalleryLoading(UI_TEXT.gallery.loading);
  updateFavoritesCount();

  try {
    const result = await api.getCards({
      page: state.currentPage,
      perPage: state.pageSize,
      favoritesOnly: true,
    });
    if (sequence !== favoritesLoadSequence || state.activeCollection !== "favorites") return;

    state.cards = result.items || [];
    state.currentPage = result.pagination?.page || 1;
    state.totalPages = result.pagination?.total_pages || 1;
    state.favoriteCount = result.favorite_count || 0;
    updateFavoritesCount();
    renderCards(state.cards);
    renderPagination();
  } catch (error) {
    if (sequence !== favoritesLoadSequence || state.activeCollection !== "favorites") return;
    state.cards = [];
    state.currentPage = 1;
    state.totalPages = 1;
    renderCards([], UI_TEXT.gallery.loadError(error.message));
    renderPagination();
  }
}

export function updateFavoritesCount() {
  const count = document.getElementById("favorites-count");
  if (count) count.textContent = String(state.favoriteCount);
}

export function changePageSize(value) {
  const pageSize = Number(value);
  const previousPageSize = state.pageSize;

  try {
    savePageSize(pageSize);
  } catch (error) {
    const select = document.getElementById("page-size-select");
    if (select) select.value = String(previousPageSize);
    alert(`No se pudo guardar la cantidad de cartas por página: ${error.message}`);
    return;
  }

  state.currentPage = 1;
  loadGallery();
}

export function showCollection(collection) {
  state.activeCollection = collection;

  const allCardsTab = document.getElementById("all-cards-tab");
  const favoritesTab = document.getElementById("favorites-tab");
  allCardsTab.classList.toggle("active", collection === "all");
  allCardsTab.setAttribute("aria-selected", String(collection === "all"));
  favoritesTab.classList.toggle("active", collection === "favorites");
  favoritesTab.setAttribute("aria-selected", String(collection === "favorites"));

  if (collection === "favorites") {
    state.currentPage = 1;
    loadFavorites();
    return;
  }

  favoritesLoadSequence += 1;
  state.currentPage = 1;
  loadGallery();
}

export async function toggleFavorite(id, button) {
  if (!state.isAdmin || !state.adminPassword) {
    alert(UI_TEXT.admin.unlockToFavorite);
    return;
  }

  const card = state.cards.find((item) => item.id === id);
  if (!card) return;

  const wasFavorite = Boolean(card.is_favorite);
  if (button) button.disabled = true;
  try {
    const updatedCard = await api.updateFavorite(id, !wasFavorite, state.adminPassword);
    if (typeof updatedCard.is_favorite !== "boolean") {
      throw new Error("El backend no devolvió el estado actualizado del favorito.");
    }

    card.is_favorite = updatedCard.is_favorite;
    state.favoriteCount = Math.max(
      0,
      state.favoriteCount + Number(updatedCard.is_favorite) - Number(wasFavorite)
    );
    updateFavoritesCount();

    if (state.activeCollection === "favorites" && wasFavorite && !updatedCard.is_favorite) {
      state.cards = state.cards.filter((item) => item.id !== id);
      button.closest(".card-tile")?.remove();
      state.totalPages = Math.max(
        1,
        Math.ceil(state.favoriteCount / state.pageSize)
      );

      if (state.cards.length === 0 && state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
        await loadFavorites();
        return;
      }
      if (state.cards.length === 0) {
        renderCards([]);
      }
    } else {
      button.classList.toggle("is-favorite", updatedCard.is_favorite);
      button.textContent = updatedCard.is_favorite ? "★" : "☆";
      button.setAttribute("aria-pressed", String(updatedCard.is_favorite));
      const label = updatedCard.is_favorite
        ? UI_TEXT.gallery.removeFavorite
        : UI_TEXT.gallery.addFavorite;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.disabled = false;
    }

    renderPagination();
  } catch (error) {
    handleAdminRequestError(error);
    alert(UI_TEXT.admin.favoriteUpdateFailed(error.message));
    if (button) button.disabled = false;
  }
}

export function renderPagination() {
  const panel = document.getElementById("cards-pagination");
  const indicator = document.getElementById("page-indicator");
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  if (!panel || !indicator || !prevBtn || !nextBtn) return;

  if (state.isBootstrapping) {
    panel.hidden = true;
    return;
  }

  if (!state.cards.length || state.totalPages <= 1) {
    panel.hidden = true;
    return;
  }

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
  if (card.card_type === "foil") article.classList.add("card-tile--foil");
  article.dataset.id = card.id;
  const language = String(card.language || "").trim();
  const languageFlagSrc = getLanguageFlag(language);

  const adminActions = state.isAdmin
    ? `
      <button class="btn btn-admin btn-edit" data-id="${card.id}">Editar</button>
      <button class="btn btn-delete btn-icon" data-id="${card.id}" title="Eliminar">✕</button>
    `
    : "";
  const isFavorite = Boolean(card.is_favorite);
  const favoriteLabel = isFavorite
    ? UI_TEXT.gallery.removeFavorite
    : UI_TEXT.gallery.addFavorite;
  const favoriteAction = state.isAdmin
    ? `
      <button
        class="favorite-toggle${isFavorite ? " is-favorite" : ""}"
        type="button"
        data-id="${escHtml(card.id)}"
        aria-label="${favoriteLabel}"
        aria-pressed="${isFavorite}"
        title="${favoriteLabel}"
      >${isFavorite ? "★" : "☆"}</button>
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
      ${favoriteAction}
    </div>
    <div class="card-actions">
      <button class="btn btn-detail" data-id="${card.id}">Ver detalle</button>
      ${adminActions}
    </div>
  `;

  article.querySelector(".btn-detail").addEventListener("click", () => openDetailModal(card.id));
  const favoriteButton = article.querySelector(".favorite-toggle");
  if (favoriteButton) {
    favoriteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(card.id, event.currentTarget);
    });
  }

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
