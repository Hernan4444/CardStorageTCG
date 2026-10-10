/**
 * Shared mutable state.
 */

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
  currentPage: 1,
  totalPages: 1,
  isAdmin: false,
  adminPassword: localStorage.getItem("cardstorageAdminPassword") || "",
  editingCardId: null,
};

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
