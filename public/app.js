import {
  state,
  VIEW_MODE_STORAGE_KEY,
  SOURCE_FILTER_STORAGE_KEY,
  SOURCE_CATEGORY_FILTER_STORAGE_KEY,
  SOURCE_CATEGORY_VISIBLE_LIMIT,
  SOURCE_CATEGORY_DEFINITIONS,
  SOURCE_CATEGORY_ORDER
} from "./js/state.js";
import { elements } from "./js/dom.js";
import { renderList, sortRecipes, deriveSourceCategory } from "./js/renderers.js";

function setViewMode(isDeveloperView) {
  state.showDeveloperDetails = Boolean(isDeveloperView);
  const mode = state.showDeveloperDetails ? "developer" : "standard";
  document.body.dataset.view = mode;
  if (elements.viewToggle) {
    elements.viewToggle.textContent = state.showDeveloperDetails ? "Hide developer details" : "Show developer details";
    elements.viewToggle.setAttribute("aria-pressed", state.showDeveloperDetails ? "true" : "false");
  }
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Failed to persist view mode", error);
  }
}

function restoreViewMode() {
  let storedMode = null;
  try {
    storedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to read view mode", error);
  }
  const isDeveloper = storedMode === "developer";
  setViewMode(isDeveloper);
}

function normalizeSourceKey(value) {
  if (!value) {
    return "__none__";
  }
  const trimmed = value.toString().trim();
  if (!trimmed.length) {
    return "__none__";
  }
  return trimmed.toLowerCase();
}

function sourceDisplayLabel(value) {
  if (!value || !value.toString().trim().length) {
    return "Unspecified";
  }
  return value.toString().trim();
}

function persistSourceFilters() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify(Array.from(state.sourceFilters.disabled));
    localStorage.setItem(SOURCE_FILTER_STORAGE_KEY, payload);
  } catch (error) {
    console.warn("Failed to persist source filters", error);
  }
}

function restoreSourceFilters() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const payload = localStorage.getItem(SOURCE_FILTER_STORAGE_KEY);
    if (!payload) {
      return;
    }
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      state.sourceFilters.disabled = new Set(parsed.map((entry) => normalizeSourceKey(entry)));
    }
  } catch (error) {
    console.warn("Failed to read source filters", error);
  }
}

function updateSourceControlsState() {
  if (elements.sourceList) {
    const buttons = elements.sourceList.querySelectorAll("button[data-source-key]");
    buttons.forEach((button) => {
      const key = button.dataset.sourceKey;
      const isEnabled = !state.sourceFilters.disabled.has(key);
      button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    });
  }
  if (elements.sourceToggleAll) {
    const shouldDisable = state.sourceFilters.disabled.size === 0;
    elements.sourceToggleAll.disabled = shouldDisable;
    elements.sourceToggleAll.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
  }
}

function persistSourceCategoryFilters() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify(Array.from(state.sourceCategoryFilters.disabled));
    localStorage.setItem(SOURCE_CATEGORY_FILTER_STORAGE_KEY, payload);
  } catch (error) {
    console.warn("Failed to persist source category filters", error);
  }
}

function restoreSourceCategoryFilters() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const payload = localStorage.getItem(SOURCE_CATEGORY_FILTER_STORAGE_KEY);
    if (!payload) {
      return;
    }
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((entry) => (entry == null ? "" : entry.toString().trim().toLowerCase()))
        .filter((entry) => entry.length);
      state.sourceCategoryFilters.disabled = new Set(normalized);
    }
  } catch (error) {
    console.warn("Failed to read source category filters", error);
  }
}

function updateSourceCategoryControlsState() {
  if (elements.sourceCategoryList) {
    const buttons = elements.sourceCategoryList.querySelectorAll("button[data-source-category-key]");
    buttons.forEach((button) => {
      const key = button.dataset.sourceCategoryKey;
      const isEnabled = !state.sourceCategoryFilters.disabled.has(key);
      button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    });
  }
  if (elements.sourceCategoryToggleAll) {
    const shouldDisable = state.sourceCategoryFilters.disabled.size === 0;
    elements.sourceCategoryToggleAll.disabled = shouldDisable;
    elements.sourceCategoryToggleAll.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
  }
}


function updateSummary(total, fetchedAt) {
  elements.recipeCount.textContent = total.toString();
  elements.fetchedAt.textContent = fetchedAt ? new Date(fetchedAt).toLocaleString() : "-";
}

function populateIngredients(options) {
  const select = elements.ingredient;
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All ingredients";
  select.appendChild(defaultOption);
  options.forEach((ingredient) => {
    const option = document.createElement("option");
    option.value = ingredient.path;
    const label = ingredient.displayName ?? ingredient.name ?? ingredient.path;
    const details = [];
    details.push(`uses ${ingredient.uses ?? ingredient.count ?? 0}`);
    if (ingredient.boozePower != null) {
      details.push(`power ${ingredient.boozePower}`);
    }
    if (Array.isArray(ingredient.sources) && ingredient.sources.length) {
      const sourceCount = ingredient.sources.length;
      details.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
    }
    option.textContent = `${label} — ${details.join(" · ")}`;
    select.appendChild(option);
  });
}

function populateSources(recipes) {
  if (!Array.isArray(recipes) || !elements.sourceList) {
    return;
  }

  const counts = new Map();
  const labels = new Map();

  recipes.forEach((recipe) => {
    const key = normalizeSourceKey(recipe.source);
    const label = sourceDisplayLabel(recipe.source);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!labels.has(key)) {
      labels.set(key, label);
    }
  });

  const entries = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    count,
    label: labels.get(key) ?? "Unspecified"
  }));

  entries.sort((a, b) => {
    if (a.key === "__none__" && b.key === "__none__") {
      return 0;
    }
    if (a.key === "__none__") {
      return 1;
    }
    if (b.key === "__none__") {
      return -1;
    }
    return a.label.localeCompare(b.label);
  });

  state.sourceFilters.options = entries;
  const validKeys = new Set(entries.map((entry) => entry.key));
  state.sourceFilters.disabled = new Set(
    Array.from(state.sourceFilters.disabled).filter((key) => validKeys.has(key))
  );

  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-toggle";
    button.dataset.sourceKey = entry.key;

    const labelSpan = document.createElement("span");
    labelSpan.textContent = entry.label;
    const countSpan = document.createElement("span");
    countSpan.className = "chip-toggle__count";
    countSpan.textContent = entry.count.toString();

    button.append(labelSpan, countSpan);
    fragment.appendChild(button);
  });

  elements.sourceList.innerHTML = "";
  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "filters__hint";
    emptyState.textContent = "Sources will appear once recipes are loaded.";
    elements.sourceList.appendChild(emptyState);
  } else {
    elements.sourceList.appendChild(fragment);
  }

  updateSourceControlsState();
  persistSourceFilters();
}

function populateSourceCategories(recipes) {
  if (!Array.isArray(recipes)) {
    return;
  }

  const counts = new Map();
  const labels = new Map();

  const registerSource = (source) => {
    const category = deriveSourceCategory(source);
    if (!category || !category.key) {
      return;
    }
    const key = category.key;
    if (!key) {
      return;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!labels.has(key)) {
      labels.set(key, category.label);
    }
  };

  const collectFromItems = (items) => {
    if (!Array.isArray(items)) {
      return;
    }
    items.forEach((item) => {
      if (!Array.isArray(item.sources)) {
        return;
      }
      item.sources.forEach(registerSource);
    });
  };

  recipes.forEach((recipe) => {
    collectFromItems(recipe.requiredReagents);
    collectFromItems(recipe.results);
    collectFromItems(recipe.requiredCatalysts);
  });

  const entries = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    count,
    label: labels.get(key) ?? (SOURCE_CATEGORY_DEFINITIONS[key]?.label ?? "Other Sources")
  }));

  entries.sort((a, b) => {
    const orderA = SOURCE_CATEGORY_ORDER.indexOf(a.key);
    const orderB = SOURCE_CATEGORY_ORDER.indexOf(b.key);
    const safeA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
    const safeB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
    if (safeA !== safeB) {
      return safeA - safeB;
    }
    return a.label.localeCompare(b.label);
  });

  state.sourceCategoryFilters.options = entries;
  const validKeys = new Set(entries.map((entry) => entry.key));
  state.sourceCategoryFilters.disabled = new Set(
    Array.from(state.sourceCategoryFilters.disabled).filter((key) => validKeys.has(key))
  );
  state.sourceCategoryFilters.showAll = false;

  renderSourceCategoryList();
  persistSourceCategoryFilters();
}

function renderSourceCategoryList() {
  if (!elements.sourceCategoryList) {
    return;
  }

  if (elements.sourceCategorySearch) {
    const currentValue = elements.sourceCategorySearch.value ?? "";
    if (currentValue !== state.sourceCategoryFilters.searchTerm) {
      elements.sourceCategorySearch.value = state.sourceCategoryFilters.searchTerm;
    }
  }

  const { options, searchTerm, showAll } = state.sourceCategoryFilters;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  let entries = options;
  if (normalizedSearch.length) {
    entries = options.filter((entry) => entry.label.toLowerCase().includes(normalizedSearch));
  }

  const shouldLimit = !showAll && !normalizedSearch.length && entries.length > SOURCE_CATEGORY_VISIBLE_LIMIT;
  const visibleEntries = shouldLimit ? entries.slice(0, SOURCE_CATEGORY_VISIBLE_LIMIT) : entries;

  elements.sourceCategoryList.innerHTML = "";

  if (!visibleEntries.length) {
    const message = document.createElement("p");
    message.className = "filters__hint";
    message.textContent = options.length
      ? "No categories match your search."
      : "Source categories will appear once recipe data is loaded.";
    elements.sourceCategoryList.appendChild(message);
    updateSourceCategoryShowMore(entries.length);
    updateSourceCategoryControlsState();
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleEntries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-toggle";
    button.dataset.sourceCategoryKey = entry.key;
    button.title = entry.label;

    const labelSpan = document.createElement("span");
    labelSpan.textContent = entry.label;
    const countSpan = document.createElement("span");
    countSpan.className = "chip-toggle__count";
    countSpan.textContent = entry.count.toString();

    button.append(labelSpan, countSpan);
    fragment.appendChild(button);
  });

  elements.sourceCategoryList.appendChild(fragment);
  updateSourceCategoryControlsState();
  updateSourceCategoryShowMore(entries.length);
}

function updateSourceCategoryShowMore(totalEntries) {
  if (!elements.sourceCategoryShowMore) {
    return;
  }
  const hasSearch = state.sourceCategoryFilters.searchTerm.trim().length > 0;
  if (totalEntries <= SOURCE_CATEGORY_VISIBLE_LIMIT || hasSearch) {
    elements.sourceCategoryShowMore.hidden = true;
    elements.sourceCategoryShowMore.setAttribute("aria-expanded", "false");
    return;
  }
  elements.sourceCategoryShowMore.hidden = false;
  elements.sourceCategoryShowMore.textContent = state.sourceCategoryFilters.showAll
    ? "Show less"
    : `Show all (${totalEntries})`;
  elements.sourceCategoryShowMore.setAttribute(
    "aria-expanded",
    state.sourceCategoryFilters.showAll ? "true" : "false"
  );
}

function applyFilters() {
  const searchTerm = elements.search.value.trim().toLowerCase();
  const selectedIngredient = elements.ingredient.value;
  const alcoholicOnly = elements.alcoholic.checked;
  const nonAlcoholicOnly = elements.nonAlcoholic.checked;

  let filtered = [...state.recipes];
  if (searchTerm) {
    filtered = filtered.filter((recipe) => {
      if (recipe.name.toLowerCase().includes(searchTerm)) {
        return true;
      }
      return recipe.requiredReagents.some((item) => item.displayName.toLowerCase().includes(searchTerm));
    });
  }
  if (selectedIngredient) {
    filtered = filtered.filter((recipe) =>
      recipe.requiredReagents.some((item) => item.path === selectedIngredient)
    );
  }
  if (state.sourceFilters.disabled.size) {
    filtered = filtered.filter((recipe) => {
      const key = normalizeSourceKey(recipe.source);
      return !state.sourceFilters.disabled.has(key);
    });
  }
  if (alcoholicOnly && !nonAlcoholicOnly) {
    filtered = filtered.filter((recipe) => recipe.isAlcoholic);
  } else if (nonAlcoholicOnly && !alcoholicOnly) {
    filtered = filtered.filter((recipe) => !recipe.isAlcoholic);
  }
  const sorted = sortRecipes(filtered);
  renderList(sorted);
}

function toggleSourceFilter(key) {
  if (!key) {
    return;
  }
  const normalized = normalizeSourceKey(key);
  if (state.sourceFilters.disabled.has(normalized)) {
    state.sourceFilters.disabled.delete(normalized);
  } else {
    state.sourceFilters.disabled.add(normalized);
  }
  updateSourceControlsState();
  persistSourceFilters();
  applyFilters();
}

function resetSourceFilters() {
  if (!state.sourceFilters.disabled.size) {
    return;
  }
  state.sourceFilters.disabled = new Set();
  updateSourceControlsState();
  persistSourceFilters();
  applyFilters();
}

function handleSourceToggleClick(event) {
  const button = event.target.closest("button[data-source-key]");
  if (!button) {
    return;
  }
  event.preventDefault();
  toggleSourceFilter(button.dataset.sourceKey);
}

function toggleSourceCategoryFilter(key) {
  if (!key) {
    return;
  }
  const normalized = key.toString().trim().toLowerCase();
  if (!normalized.length) {
    return;
  }
  if (state.sourceCategoryFilters.disabled.has(normalized)) {
    state.sourceCategoryFilters.disabled.delete(normalized);
  } else {
    state.sourceCategoryFilters.disabled.add(normalized);
  }
  updateSourceCategoryControlsState();
  persistSourceCategoryFilters();
  applyFilters();
}

function resetSourceCategoryFilters() {
  const hadDisabled = state.sourceCategoryFilters.disabled.size > 0;
  const hadSearch = Boolean(state.sourceCategoryFilters.searchTerm);
  const hadShowAll = state.sourceCategoryFilters.showAll;
  if (!hadDisabled && !hadSearch && !hadShowAll) {
    return;
  }
  state.sourceCategoryFilters.disabled = new Set();
  state.sourceCategoryFilters.searchTerm = "";
  state.sourceCategoryFilters.showAll = false;
  renderSourceCategoryList();
  persistSourceCategoryFilters();
  if (hadDisabled) {
    applyFilters();
  }
}

function handleSourceCategoryToggleClick(event) {
  const button = event.target.closest("button[data-source-category-key]");
  if (!button) {
    return;
  }
  event.preventDefault();
  toggleSourceCategoryFilter(button.dataset.sourceCategoryKey);
}

function handleSourceCategorySearch(event) {
  state.sourceCategoryFilters.searchTerm = event.target.value ?? "";
  state.sourceCategoryFilters.showAll = false;
  renderSourceCategoryList();
}

function toggleSourceCategoryShowAll() {
  state.sourceCategoryFilters.showAll = !state.sourceCategoryFilters.showAll;
  renderSourceCategoryList();
}

async function loadDataset() {
  const hasExistingData = state.recipes.length > 0;
  const currentFilters = hasExistingData
    ? {
        search: elements.search.value,
        ingredient: elements.ingredient.value,
        alcoholic: elements.alcoholic.checked,
        nonAlcoholic: elements.nonAlcoholic.checked,
        sort: elements.sort ? elements.sort.value : "name-asc"
      }
    : {
        search: "",
        ingredient: "",
        alcoholic: false,
        nonAlcoholic: false,
        sort: elements.sort ? elements.sort.value || "name-asc" : "name-asc"
      };
  elements.status.textContent = "Loading recipes...";
  elements.recipeList.innerHTML = "";
  try {
    const [recipeResponse, ingredientResponse] = await Promise.all([
      fetch("/api/recipes"),
      fetch("/api/ingredients")
    ]);
    if (!recipeResponse.ok) {
      throw new Error(`Recipe request failed: ${recipeResponse.status}`);
    }
    if (!ingredientResponse.ok) {
      throw new Error(`Ingredient request failed: ${ingredientResponse.status}`);
    }
    const recipeData = await recipeResponse.json();
    const ingredientData = await ingredientResponse.json();
    state.recipes = recipeData.recipes ?? [];
    state.fetchedAt = recipeData.fetchedAt;
    state.recipeLookup = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
    populateIngredients(ingredientData.ingredients ?? []);
    populateSources(state.recipes);
    populateSourceCategories(state.recipes);
    updateSummary(state.recipes.length, state.fetchedAt);
    if (elements.sort) {
      const sortOptions = Array.from(elements.sort.options).map((option) => option.value);
      if (sortOptions.includes(currentFilters.sort)) {
        elements.sort.value = currentFilters.sort;
      } else if (!elements.sort.value) {
        elements.sort.value = "name-asc";
      }
    }
    elements.search.value = currentFilters.search;
    elements.alcoholic.checked = currentFilters.alcoholic;
    elements.nonAlcoholic.checked = currentFilters.nonAlcoholic;
    const availableIngredientPaths = new Set((ingredientData.ingredients ?? []).map((ingredient) => ingredient.path));
    if (currentFilters.ingredient && availableIngredientPaths.has(currentFilters.ingredient)) {
      elements.ingredient.value = currentFilters.ingredient;
    } else {
      elements.ingredient.value = "";
    }
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.status.textContent = "Failed to load recipes. Please try again.";
  }
}

function bindEvents() {
  elements.search.addEventListener("input", () => applyFilters());
  elements.ingredient.addEventListener("change", () => applyFilters());
  elements.alcoholic.addEventListener("change", (event) => {
    if (event.target.checked) {
      elements.nonAlcoholic.checked = false;
    }
    applyFilters();
  });
  elements.nonAlcoholic.addEventListener("change", (event) => {
    if (event.target.checked) {
      elements.alcoholic.checked = false;
    }
    applyFilters();
  });
  if (elements.sort) {
    elements.sort.addEventListener("change", () => applyFilters());
  }
  if (elements.viewToggle) {
    elements.viewToggle.addEventListener("click", () => setViewMode(!state.showDeveloperDetails));
  }
  if (elements.sourceList) {
    elements.sourceList.addEventListener("click", handleSourceToggleClick);
  }
  if (elements.sourceToggleAll) {
    elements.sourceToggleAll.addEventListener("click", () => resetSourceFilters());
  }
  if (elements.sourceCategoryList) {
    elements.sourceCategoryList.addEventListener("click", handleSourceCategoryToggleClick);
  }
  if (elements.sourceCategoryToggleAll) {
    elements.sourceCategoryToggleAll.addEventListener("click", () => resetSourceCategoryFilters());
  }
  if (elements.sourceCategorySearch) {
    elements.sourceCategorySearch.addEventListener("input", handleSourceCategorySearch);
  }
  if (elements.sourceCategoryShowMore) {
    elements.sourceCategoryShowMore.addEventListener("click", toggleSourceCategoryShowAll);
  }
}

restoreViewMode();
restoreSourceFilters();
restoreSourceCategoryFilters();
renderSourceCategoryList();
bindEvents();
loadDataset();
