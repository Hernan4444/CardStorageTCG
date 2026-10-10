/**
 * Wire up events and bootstrap app on page load.
 */

import { APP_CONFIG } from "../config/constants.js";
import { state } from "./state.js";
import {
  loadGallery,
  loadGameNames,
  loadSeriesNames,
  renderGalleryLoading,
  renderPagination,
  setGalleryBootstrapping,
  applyFilter,
  clearFilter,
  goPrevPage,
  goNextPage,
  showCollection,
  updateFavoritesCount,
  changePageSize,
} from "../features/gallery/gallery.js";
import {
  openUploadModal,
  closeUploadModal,
  startCamera,
  openLinkStep,
  confirmLinkImage,
  showStep,
  capturePhoto,
  handleFileInput,
  saveCard,
  toggleOtherGameField,
  toggleOtherSeriesField,
  populateGameOptions,
  populateSeriesOptions,
} from "../features/upload/upload.js";
import {
  populateEditGameOptions,
  populateEditSeriesOptions,
  toggleAdminMode,
  closeEditModal,
  saveEditCard,
  toggleEditOtherGameField,
  toggleEditOtherSeriesField,
  closeAdminModal,
  submitAdminLogin,
  restoreAdminSession,
} from "../features/admin/admin.js";
import { closeDetailModal, loadHD } from "../features/detail/detail.js";
import { initializeTagPicker } from "../features/tags/tag-picker.js";

export function initializeApp() {
  document.addEventListener("DOMContentLoaded", async () => {
    state.isBootstrapping = true;
    updateFavoritesCount();
    document.getElementById("page-size-select").value = String(state.pageSize);
    initializeTagPicker("filter-tag-chips", "tag-filter-input", "add-filter-tag-btn");
    initializeTagPicker("upload-tag-chips", "upload-tag-input", "add-upload-tag-btn");
    initializeTagPicker("edit-tag-chips", "edit-tag-input", "add-edit-tag-btn");
    setGalleryBootstrapping(true);
    renderGalleryLoading("Conectando con el backend...");

    populateGameOptions();
    populateSeriesOptions();
    populateEditGameOptions();
    populateEditSeriesOptions();
    await restoreAdminSession();

    try {
      await loadGameNames();
      await loadSeriesNames([]);
      await loadGallery({
        retries: APP_CONFIG.gallery.initialLoadRetries,
        retryDelayMs: APP_CONFIG.gallery.initialLoadRetryDelayMs,
        showRetryStatus: true,
      });
    } finally {
      state.isBootstrapping = false;
      setGalleryBootstrapping(false);
    }

    renderPagination();

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
      state.capturedDataUrl = null;
      state.croppedDataUrl = null;
      state.capturedDataUrls = [];
      state.croppedDataUrls = [];
      state.linkedImageUrl = "";
      state.linkedImageUrls = [];
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

    document.getElementById("apply-filter-btn").addEventListener("click", applyFilter);
    document.getElementById("clear-filter-btn").addEventListener("click", clearFilter);
    document.getElementById("prev-page-btn").addEventListener("click", goPrevPage);
    document.getElementById("next-page-btn").addEventListener("click", goNextPage);
    document.getElementById("all-cards-tab").addEventListener("click", () => showCollection("all"));
    document.getElementById("favorites-tab").addEventListener("click", () => showCollection("favorites"));
    document.getElementById("page-size-select").addEventListener("change", (event) =>
      changePageSize(event.currentTarget.value)
    );

    document.getElementById("close-edit-btn").addEventListener("click", closeEditModal);
    document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);
    document.getElementById("edit-form").addEventListener("submit", saveEditCard);
    document.getElementById("edit_game_name").addEventListener("change", toggleEditOtherGameField);
    document.getElementById("edit_series").addEventListener("change", toggleEditOtherSeriesField);

    document.getElementById("close-admin-btn").addEventListener("click", closeAdminModal);
    document.getElementById("cancel-admin-btn").addEventListener("click", closeAdminModal);
    document.getElementById("admin-form").addEventListener("submit", submitAdminLogin);

    document.getElementById("close-detail-btn").addEventListener("click", closeDetailModal);
    document.getElementById("detail-hd-btn").addEventListener("click", loadHD);

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
}
