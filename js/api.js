/**
 * api.js — thin wrapper around the CardStorage REST API.
 */

const api = (() => {
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
    createCard(imageDataUrl, { game_name, anime, language, card_type }) {
      return _request("POST", "/api/cards", {
        image: imageDataUrl,
        game_name,
        anime,
        language,
        card_type,
      });
    },

    /** List all cards (thumbnail URLs). */
    getCards() {
      return _request("GET", "/api/cards");
    },

    /** Get a single card including the HD URL. */
    getCard(id) {
      return _request("GET", `/api/cards/${id}`);
    },

    /** Check whether the provided admin password is valid. */
    verifyAdmin(password) {
      return _request("POST", "/api/admin/verify", { password });
    },

    /** Update metadata fields on an existing card. */
    updateCard(id, fields, adminPassword) {
      return _request("PATCH", `/api/cards/${id}`, fields, {
        "X-Admin-Password": adminPassword,
      });
    },

    /** Delete a card (also removes it from Cloudinary). */
    deleteCard(id, adminPassword) {
      return _request("DELETE", `/api/cards/${id}`, null, {
        "X-Admin-Password": adminPassword,
      });
    },
  };
})();
