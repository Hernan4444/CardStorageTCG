/**
 * api.js — thin wrapper around the CardStorage REST API.
 */

import { CONFIG } from "../config.js";

export const api = (() => {
  const base = () => CONFIG.API_BASE_URL;

  async function _request(method, path, body = null, headers = {}) {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(`${base()}${path}`, opts);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  }

  return {
    /** Detect and crop the card in a photo.  Returns { cropped_image, card_detected } */
    processImage(imageDataUrl) {
      return _request("POST", "/api/process-image", { image: imageDataUrl });
    },

    /** Upload cropped image + metadata. Returns the saved Card object. */
    createCard(imageDataUrl, { game_name, series, language, card_type }) {
      return _request("POST", "/api/cards", {
        image: imageDataUrl,
        game_name,
        anime: series,
        language,
        card_type,
      });
    },

    /** Save metadata + external image URL (without Cloudinary upload). */
    createCardFromLink(imageUrl, { game_name, series, language, card_type }) {
      return _request("POST", "/api/cards", {
        image_url: imageUrl,
        game_name,
        anime: series,
        language,
        card_type,
      });
    },

    /** List existing game names. */
    getGames() {
      return _request("GET", "/api/games");
    },

    /** List existing series names, optionally filtered by one or more games. */
    getSeries(gameNames = []) {
      const games = Array.isArray(gameNames) ? gameNames : (gameNames ? [gameNames] : []);
      const params = new URLSearchParams();
      games.forEach((g) => params.append("game_name", g));
      const qs = params.toString();
      return _request("GET", `/api/animes${qs ? `?${qs}` : ""}`);
    },

    /** List cards filtered by games/series and paginated. */
    getCards({ gameNames = [], series = [], page = 1, perPage = 20 } = {}) {
      const params = new URLSearchParams();
      gameNames.forEach((g) => params.append("game_name", g));
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      series.forEach((serie) => params.append("anime", serie));
      return _request("GET", `/api/cards?${params.toString()}`);
    },

    /** Get a single card including the HD URL. */
    getCard(id) {
      return _request("GET", `/api/cards/${encodeURIComponent(id)}`);
    },

    /** Check whether the provided admin password is valid. */
    verifyAdmin(password) {
      return _request("POST", "/api/admin/verify", { password });
    },

    /** Update metadata fields on an existing card. */
    updateCard(id, fields, adminPassword) {
      return _request("PATCH", `/api/cards/${encodeURIComponent(id)}`, fields, {
        "X-Admin-Password": adminPassword,
      });
    },

    /** Delete a card (also removes it from Cloudinary). */
    deleteCard(id, adminPassword) {
      return _request("DELETE", `/api/cards/${encodeURIComponent(id)}`, null, {
        "X-Admin-Password": adminPassword,
      });
    },
  };
})();
