/**
 * Shared mutable state.
 */

import { APP_CONFIG } from "../config/constants.js";

function readPageSize() {
  try {
    const savedPageSize = Number(localStorage.getItem(APP_CONFIG.gallery.pageSizeStorageKey));
    return APP_CONFIG.gallery.perPageOptions.includes(savedPageSize)
      ? savedPageSize
      : APP_CONFIG.gallery.perPage;
  } catch (error) {
    console.error("Could not read the saved page size.", error);
    return APP_CONFIG.gallery.perPage;
  }
}

export const state = {
  isBootstrapping: false,
  capturedDataUrl: null,
  croppedDataUrl: null,
  capturedDataUrls: [],
  croppedDataUrls: [],
  linkedImageUrl: "",
  linkedImageUrls: [],
  uploadMode: "image",
  cards: [],
  favoriteCount: 0,
  activeCollection: "all",
  gameNames: [],
  seriesNames: [],
  selectedGames: [],
  selectedSeries: [],
  selectedTags: [],
  availableTags: [],
  tagMatch: "OR",
  currentPage: 1,
  pageSize: readPageSize(),
  totalPages: 1,
  isAdmin: false,
  adminPassword: localStorage.getItem("cardstorageAdminPassword") || "",
  editingCardId: null,
};

export function savePageSize(pageSize) {
  if (!APP_CONFIG.gallery.perPageOptions.includes(pageSize)) {
    throw new RangeError("Unsupported page size");
  }

  localStorage.setItem(APP_CONFIG.gallery.pageSizeStorageKey, String(pageSize));
  state.pageSize = pageSize;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
