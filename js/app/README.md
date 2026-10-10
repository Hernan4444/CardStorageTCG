# Frontend App Architecture

This frontend now uses native ES modules with a single entrypoint.

## Entrypoint

- `frontend/js/app.js`: boots the app and calls `initializeApp()`.
- `frontend/index.html`: loads only `js/app.js` with `type="module"`.

## Structure

- `config/`
- `constants.js`: technical constants and app configuration.
- `messages.js`: user-facing UI text.
- `core/`
- `state.js`: shared mutable state and async helpers.
- `helpers.js`: DOM/error/escaping helpers.
- `init.js`: app bootstrap and event wiring.
- `features/gallery/`
- `gallery.js`: gallery rendering, filters, pagination, initial loading/retries.
- Favorites are stored with each card in the backend spreadsheet and shown in a separate tab.
- `features/upload/`
- `upload.js`: upload modal, source selection, capture, preview, metadata save.
- `features/admin/`
- `admin.js`: admin auth, edit modal, delete/edit actions, admin UI state.
- `features/detail/`
- `detail.js`: detail modal and HD loading.

## Dependency Direction

Keep imports flowing as follows whenever possible:

- `config -> core -> features -> app.js`
- feature-to-feature imports are allowed only when a behavior truly belongs to another domain.

## Guidelines

- Add new user-visible text in `config/messages.js`.
- Add repeated technical values in `config/constants.js`.
- Keep DOM wiring inside `core/init.js`.
- Put business behavior in the owning feature instead of `init.js`.
- If a feature grows too much, split it into submodules inside its domain folder.
