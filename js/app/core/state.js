/**
 * Shared mutable state.
 */

export const state = {
  isBootstrapping: false,
  capturedDataUrl: null,
  croppedDataUrl: null,
  linkedImageUrl: "",
  linkedImageUrls: [],
  uploadMode: "image",
  cards: [],
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
