/**
 * config.js
 *
 * Set API_BASE_URL to your Render backend URL once deployed.
 * Frontend deployed on: https://hernan4444.github.io/CardStorageTCG/
 * This works the same when frontend is hosted on GitHub Pages.
 * For local development leave it as-is.
 */
export const CONFIG = {
  API_BASE_URL:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:5000"
      : "https://cardstoragetcg-backend.onrender.com", // ← update after deploy
};
