import { UI_TEXT } from "../../config/messages.js";
import { escHtml } from "../../core/helpers.js";

const selections = new WeakMap();
const TAG_PATTERN = /^[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*$/u;
const MAX_TAG_LENGTH = 40;

export function setTagSuggestions(tags) {
  const datalist = document.getElementById("tag-suggestions");
  if (!datalist) return;

  datalist.replaceChildren(
    ...tags.map((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      return option;
    })
  );
}

export function addTagPickerInput(containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  return !container || !input || addTag(container, input);
}

export function initializeTagPicker(containerId, inputId, addButtonId, initialTags = []) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  const addButton = document.getElementById(addButtonId);
  if (!container || !input || !addButton) return;

  if (!container.dataset.tagPickerInitialized) {
    addButton.addEventListener("click", () => addTag(container, input));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(container, input);
      }
    });
    container.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".tag-chip-remove");
      if (!removeButton) return;
      const currentTags = selections.get(container) || [];
      const index = Number(removeButton.dataset.index);
      if (!Number.isInteger(index)) return;
      currentTags.splice(index, 1);
      selections.set(container, currentTags);
      renderTags(container);
    });
    container.dataset.tagPickerInitialized = "true";
  }

  setTagPickerValues(containerId, initialTags);
}

export function setTagPickerValues(containerId, tags) {
  const container = document.getElementById(containerId);
  if (!container) return;
  selections.set(container, normalizeTags(tags));
  renderTags(container);
}

export function getTagPickerValues(containerId) {
  const container = document.getElementById(containerId);
  return container ? [...(selections.get(container) || [])] : [];
}

function addTag(container, input) {
  const tag = input.value.trim();
  if (!tag) return true;

  if (tag.length > MAX_TAG_LENGTH || !TAG_PATTERN.test(tag)) {
    input.setCustomValidity(UI_TEXT.gallery.invalidTag);
    input.reportValidity();
    input.setCustomValidity("");
    return false;
  }

  const currentTags = selections.get(container) || [];
  if (!currentTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
    currentTags.push(tag);
    selections.set(container, currentTags);
    renderTags(container);
  }
  input.value = "";
  input.focus();
  return true;
}

function normalizeTags(tags) {
  const normalized = [];
  const seen = new Set();
  tags.forEach((tag) => {
    if (typeof tag !== "string") return;
    const value = tag.trim();
    const key = value.toLocaleLowerCase();
    if (
      value &&
      value.length <= MAX_TAG_LENGTH &&
      TAG_PATTERN.test(value) &&
      !seen.has(key)
    ) {
      seen.add(key);
      normalized.push(value);
    }
  });
  return normalized;
}

function renderTags(container) {
  const tags = selections.get(container) || [];
  container.replaceChildren(
    ...tags.map((tag, index) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `${escHtml(tag)}<button type="button" class="tag-chip-remove" data-index="${index}" aria-label="Quitar tag ${escHtml(tag)}">×</button>`;
      return chip;
    })
  );
}
