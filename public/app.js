const state = {
  recipes: [],
  fetchedAt: null,
  recipeLookup: new Map(),
  showDeveloperDetails: false,
  sourceFilters: {
    disabled: new Set(),
    options: []
  },
  sourceCategoryFilters: {
    disabled: new Set(),
    options: [],
    searchTerm: "",
    showAll: false
  }
};

const VIEW_MODE_STORAGE_KEY = "ss13-barmen-ui:view-mode";
const SOURCE_FILTER_STORAGE_KEY = "ss13-barmen-ui:disabled-sources";
const SOURCE_CATEGORY_FILTER_STORAGE_KEY = "ss13-barmen-ui:disabled-source-categories";
const SOURCE_CATEGORY_VISIBLE_LIMIT = 18;
const DISPENSER_TIERS = new Set(["base", "upgrade1", "upgrade2", "upgrade3", "upgrade4", "emag"]);
const SOURCE_CATEGORY_DEFINITIONS = {
  dispenser: { key: "dispenser", label: "Dispenser" },
  supply: { key: "supply", label: "Supply Pack" },
  vendor: { key: "vendor", label: "Vendor (Bottle)" },
  other: { key: "other", label: "Other Sources" }
};
const SOURCE_CATEGORY_ORDER = ["dispenser", "supply", "vendor", "other"];

const elements = {
  search: document.getElementById("search"),
  alcoholic: document.getElementById("alcoholic"),
  nonAlcoholic: document.getElementById("nonAlcoholic"),
  ingredient: document.getElementById("ingredient"),
  sort: document.getElementById("sort"),
  recipeCount: document.getElementById("recipeCount"),
  fetchedAt: document.getElementById("fetchedAt"),
  status: document.getElementById("status"),
  recipeList: document.getElementById("recipeList"),
  template: document.getElementById("recipeTemplate"),
  viewToggle: document.getElementById("viewToggle"),
  sourceList: document.getElementById("sourceList"),
  sourceToggleAll: document.getElementById("sourceToggleAll"),
  sourceCategoryList: document.getElementById("sourceCategoryList"),
  sourceCategoryToggleAll: document.getElementById("sourceCategoryToggleAll"),
  sourceCategorySearch: document.getElementById("sourceCategorySearch"),
  sourceCategoryShowMore: document.getElementById("sourceCategoryShowMore")
};

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

function sanitizeMessage(message) {
  if (!message) {
    return "No mixing notes recorded.";
  }
  return message.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatQuantity(value) {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return `${value}x`;
    }
    return `${value}`;
  }
  if (!value) {
    return "1x";
  }
  return value.toString();
}

function createListItem(item) {
  const li = document.createElement("li");
  li.className = "ingredient";

  const row = document.createElement("div");
  row.className = "ingredient__row";

  const amount = document.createElement("span");
  amount.className = "ingredient__amount";
  amount.textContent = formatQuantity(item.quantity);
  row.appendChild(amount);

  const name = document.createElement("span");
  name.className = "ingredient__name";
  name.textContent = item.displayName;
  row.appendChild(name);

  li.appendChild(row);

  if (Array.isArray(item.sources) && item.sources.length) {
    const sourceList = document.createElement("div");
    sourceList.className = "ingredient__sources";
    item.sources.forEach((source) => {
      const badge = createSourceBadge(source);
      if (badge) {
        sourceList.appendChild(badge);
      }
    });
    if (sourceList.childElementCount) {
      li.appendChild(sourceList);
    }
  }

  return li;
}

function createBadge(label, variant = "accent") {
  const span = document.createElement("span");
  span.className = `badge badge--${variant}`;
  span.textContent = label;
  return span;
}

function sourceBadgeVariant(tier) {
  if (!tier) {
    return "neutral";
  }
  if (tier === "emag") {
    return "bold";
  }
  if (tier.startsWith("upgrade")) {
    return "soft";
  }
  if (tier === "vendor") {
    return "outline";
  }
  return "neutral";
}

function deriveSourceCategory(source) {
  if (!source) {
    return SOURCE_CATEGORY_DEFINITIONS.other;
  }

  const tier = (source.tier ?? "").toLowerCase();
  const machineName = (source.machineName ?? "").toLowerCase();
  const machinePath = (source.machinePath ?? "").toLowerCase();
  const tierLabel = (source.tierLabel ?? "").toLowerCase();

  if (tier === "supply" || source.packCost != null || tierLabel.includes("supply")) {
    return SOURCE_CATEGORY_DEFINITIONS.supply;
  }

  if (
    tier === "vendor" ||
    machineName.includes("vendor") ||
    machinePath.includes("/vending/") ||
    machineName.includes("boozeomat")
  ) {
    return SOURCE_CATEGORY_DEFINITIONS.vendor;
  }

  if (DISPENSER_TIERS.has(tier)) {
    return SOURCE_CATEGORY_DEFINITIONS.dispenser;
  }

  if (
    machineName.includes("dispenser") ||
    machineName.includes("synth") ||
    machineName.includes("chem") ||
    machinePath.includes("chem_dispenser") ||
    machinePath.includes("reagent_dispenser")
  ) {
    return SOURCE_CATEGORY_DEFINITIONS.dispenser;
  }

  return SOURCE_CATEGORY_DEFINITIONS.other;
}

function formatSourceLabel(source) {
  const machineLabel = source.machineName ?? source.machinePath ?? "Unknown";
  const tierLabel = source.tierLabel || "Base";
  const parts = [`${machineLabel} · ${tierLabel}`];
  if (source.itemName) {
    parts.push(source.itemName);
  }
  if (source.quantity != null) {
    parts.push(`${source.quantity}u`);
  }
  if (source.packCost != null) {
    parts.push(`${source.packCost} pts`);
  }
  return parts.join(" • ");
}

function buildSourceCategoryKey(source) {
  const category = deriveSourceCategory(source);
  return category?.key ?? null;
}

function isSourceCategoryDisabled(source) {
  const key = buildSourceCategoryKey(source);
  if (!key) {
    return false;
  }
  return state.sourceCategoryFilters.disabled.has(key);
}

function createSourceBadge(source) {
  if (isSourceCategoryDisabled(source)) {
    return null;
  }
  const label = formatSourceLabel(source);
  return createBadge(label, sourceBadgeVariant(source.tier));
}

function badgeVariantForStrength(power) {
  if (power >= 70) {
    return "bold";
  }
  if (power >= 40) {
    return "accent";
  }
  return "soft";
}

function createMetaBadge(label, value, useCode = false) {
  const span = document.createElement("span");
  span.className = "recipe__meta-item";
  const title = document.createElement("strong");
  title.textContent = `${label}:`;
  span.appendChild(title);
  if (useCode) {
    const code = document.createElement("code");
    code.textContent = value;
    span.appendChild(code);
  } else {
    const text = document.createElement("span");
    text.textContent = value;
    span.appendChild(text);
  }
  return span;
}

function createRelationItem(entry) {
  const li = document.createElement("li");
  const recipe = state.recipeLookup.get(entry.id);
  if (!recipe) {
    const label = document.createElement("span");
    label.textContent = entry.name;
    const code = document.createElement("code");
    code.textContent = entry.path;
    li.append(label, code);
    return li;
  }

  const details = document.createElement("details");
  details.className = "relation__details";

  const summary = document.createElement("summary");
  summary.className = "relation__summary";
  const title = document.createElement("span");
  title.className = "relation__summary-title";
  title.textContent = recipe.name;
  summary.appendChild(title);
  if (recipe.strength != null) {
    summary.appendChild(createBadge(`Power ${recipe.strength}`, badgeVariantForStrength(recipe.strength)));
  }
  if (recipe.source) {
    summary.appendChild(createBadge(recipe.source, "neutral"));
  }
  details.appendChild(summary);

  const content = document.createElement("div");
  content.className = "relation__content";

  const pathLine = document.createElement("div");
  pathLine.className = "relation__path";
  const pathCode = document.createElement("code");
  pathCode.textContent = recipe.path;
  pathLine.appendChild(pathCode);
  content.appendChild(pathLine);

  if (recipe.mixMessage) {
    const note = document.createElement("p");
    note.className = "relation__note";
    note.textContent = sanitizeMessage(recipe.mixMessage);
    content.appendChild(note);
  }

  if (recipe.requiredReagents.length) {
    const label = document.createElement("span");
    label.className = "relation__label";
    label.textContent = "Ingredients";
    content.appendChild(label);

    const ingredientList = document.createElement("ul");
    ingredientList.className = "relation__ingredients";
    recipe.requiredReagents.forEach((item) => {
      ingredientList.appendChild(createListItem(item));
    });
    content.appendChild(ingredientList);
  }

  if (recipe.requiredRecipes.length) {
    const craftingLabel = document.createElement("span");
    craftingLabel.className = "relation__label";
    craftingLabel.textContent = "Crafted From";
    content.appendChild(craftingLabel);

    content.appendChild(createDependencyTree(recipe));
  }

  details.appendChild(content);
  li.appendChild(details);
  return li;
}

function createDependencyTree(recipe, visited = new Set()) {
  const list = document.createElement("ul");
  list.className = "relation-tree";
  const nextVisited = new Set(visited);
  nextVisited.add(recipe.id);

  recipe.requiredRecipes.forEach((entry) => {
    const item = document.createElement("li");
    item.appendChild(createDependencyBranch(entry, nextVisited));
    list.appendChild(item);
  });

  return list;
}

function createDependencyBranch(entry, visited) {
  const targetRecipe = state.recipeLookup.get(entry.id);
  if (!targetRecipe) {
    const fallback = document.createElement("div");
    fallback.className = "relation-tree__missing";
    const label = document.createElement("span");
    label.textContent = entry.name;
    const code = document.createElement("code");
    code.textContent = entry.path;
    fallback.append(label, code);
    return fallback;
  }

  const branch = document.createElement("details");
  branch.className = "relation-tree__branch";
  branch.open = true;

  const summary = document.createElement("summary");
  summary.className = "relation-tree__summary";
  const title = document.createElement("span");
  title.className = "relation-tree__summary-title";
  title.textContent = targetRecipe.name;
  summary.appendChild(title);
  if (targetRecipe.strength != null) {
    summary.appendChild(createBadge(`Power ${targetRecipe.strength}`, badgeVariantForStrength(targetRecipe.strength)));
  }
  if (targetRecipe.source) {
    summary.appendChild(createBadge(targetRecipe.source, "neutral"));
  }
  branch.appendChild(summary);

  const body = document.createElement("div");
  body.className = "relation-tree__content";

  const pathLine = document.createElement("div");
  pathLine.className = "relation-tree__path";
  const pathCode = document.createElement("code");
  pathCode.textContent = targetRecipe.path;
  pathLine.appendChild(pathCode);
  body.appendChild(pathLine);

  if (targetRecipe.mixMessage) {
    const note = document.createElement("p");
    note.className = "relation-tree__note";
    note.textContent = sanitizeMessage(targetRecipe.mixMessage);
    body.appendChild(note);
  }

  if (targetRecipe.requiredReagents.length) {
    const label = document.createElement("span");
    label.className = "relation-tree__label";
    label.textContent = "Ingredients";
    body.appendChild(label);

    const ingredientList = document.createElement("ul");
    ingredientList.className = "relation-tree__ingredients";
    targetRecipe.requiredReagents.forEach((ingredient) => {
      ingredientList.appendChild(createListItem(ingredient));
    });
    body.appendChild(ingredientList);
  }

  if (targetRecipe.requiredRecipes.length) {
    if (visited.has(targetRecipe.id)) {
      const cycle = document.createElement("div");
      cycle.className = "relation-tree__cycle";
      cycle.textContent = "Cycle detected. Further dependencies hidden.";
      body.appendChild(cycle);
    } else {
      const nestedVisited = new Set(visited);
      nestedVisited.add(targetRecipe.id);
      const nestedLabel = document.createElement("span");
      nestedLabel.className = "relation-tree__label";
      nestedLabel.textContent = "Crafted From";
      body.appendChild(nestedLabel);
      body.appendChild(createDependencyTree(targetRecipe, nestedVisited));
    }
  }

  branch.appendChild(body);
  return branch;
}

function renderRelation(wrapper, entries) {
  if (!wrapper) {
    return;
  }
  const list = wrapper.querySelector("ul");
  list.innerHTML = "";
  if (!entries || !entries.length) {
    wrapper.classList.add("is-hidden");
    return;
  }
  wrapper.classList.remove("is-hidden");
  entries.forEach((entry) => {
    list.appendChild(createRelationItem(entry));
  });
}

function sortRecipes(recipes) {
  if (!elements.sort) {
    return recipes;
  }
  const mode = elements.sort.value;
  const sorted = [...recipes];
  if (mode === "strength-desc") {
    sorted.sort((a, b) => {
      const bStrength = b.strength ?? -Infinity;
      const aStrength = a.strength ?? -Infinity;
      if (bStrength === aStrength) {
        return a.name.localeCompare(b.name);
      }
      return bStrength - aStrength;
    });
  } else if (mode === "strength-asc") {
    sorted.sort((a, b) => {
      const aStrength = a.strength ?? Infinity;
      const bStrength = b.strength ?? Infinity;
      if (aStrength === bStrength) {
        return a.name.localeCompare(b.name);
      }
      return aStrength - bStrength;
    });
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

function renderRecipe(recipe) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.querySelector(".recipe__title").textContent = recipe.name;

  const badges = node.querySelector(".recipe__badges");
  badges.innerHTML = "";
  badges.appendChild(createBadge(recipe.isAlcoholic ? "Alcoholic" : "Non-alcoholic", recipe.isAlcoholic ? "accent" : "neutral"));
  const seen = new Set(["alcoholic", "non alcoholic", "non-alcoholic"]);
  recipe.tags.forEach((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    badges.appendChild(createBadge(tag, "outline"));
  });
  if (recipe.strength != null) {
    badges.appendChild(createBadge(`Power ${recipe.strength}`, badgeVariantForStrength(recipe.strength)));
  }

  const media = node.querySelector(".recipe__media");
  if (media) {
    const image = media.querySelector(".recipe__image");
    const label = media.querySelector(".recipe__media-label");
    const source = media.querySelector(".recipe__media-source");
    if (recipe.icon?.src && image) {
      media.classList.remove("is-hidden");
      const width = Number.isFinite(recipe.icon.width) ? recipe.icon.width : null;
      const height = Number.isFinite(recipe.icon.height) ? recipe.icon.height : null;
      if (width) {
        media.style.setProperty("--icon-width", `${width}px`);
      } else {
        media.style.setProperty("--icon-width", "32px");
      }
      if (height) {
        media.style.setProperty("--icon-height", `${height}px`);
      } else {
        media.style.setProperty("--icon-height", "32px");
      }
      image.src = recipe.icon.src;
      const altLabel = recipe.icon.label ?? recipe.name;
      image.alt = altLabel ? `${altLabel} sprite` : `${recipe.name} sprite`;
      if (label) {
        label.textContent = altLabel ?? "";
      }
      if (source) {
        const parts = [];
        if (recipe.icon.sourceIcon) {
          parts.push(recipe.icon.sourceIcon);
        }
        if (recipe.icon.state) {
          parts.push(`state: ${recipe.icon.state}`);
        }
        if (recipe.icon.sourcePath) {
          const originLabel = recipe.icon.origin ? recipe.icon.origin : "source";
          parts.push(`${originLabel}: ${recipe.icon.sourcePath}`);
        }
        if (recipe.icon.attribution) {
          parts.push(recipe.icon.attribution);
        }
        if (recipe.icon.license) {
          parts.push(`license: ${recipe.icon.license}`);
        }
        source.textContent = parts.join(" • ");
      }
    } else {
      media.classList.add("is-hidden");
      media.style.removeProperty("--icon-width");
      media.style.removeProperty("--icon-height");
      if (image) {
        image.removeAttribute("src");
        image.alt = "";
      }
      if (label) {
        label.textContent = "";
      }
      if (source) {
        source.textContent = "";
      }
    }
  }

  node.querySelector(".recipe__message").textContent = sanitizeMessage(recipe.mixMessage);

  const ingredientList = node.querySelector(".recipe__ingredients");
  ingredientList.innerHTML = "";
  recipe.requiredReagents.forEach((item) => {
    ingredientList.appendChild(createListItem(item));
  });

  const resultList = node.querySelector(".recipe__results");
  resultList.innerHTML = "";
  recipe.results.forEach((item) => {
    resultList.appendChild(createListItem(item));
  });

  renderRelation(node.querySelector('.recipe__relation[data-role="requires"]'), recipe.requiredRecipes);
  renderRelation(node.querySelector('.recipe__relation[data-role="usedby"]'), recipe.dependentRecipes);

  const meta = node.querySelector(".recipe__meta");
  meta.innerHTML = "";
  meta.appendChild(createMetaBadge("Path", recipe.path, true));
  meta.appendChild(createMetaBadge("ID", recipe.id, true));
  if (recipe.strength != null) {
    meta.appendChild(createMetaBadge("Strength", recipe.strength));
  }
  if (recipe.requiredTemp) {
    meta.appendChild(createMetaBadge("Temp", `${recipe.requiredTemp}K`));
  }
  if (recipe.requiredTempHigh) {
    meta.appendChild(createMetaBadge("Temp High", `${recipe.requiredTempHigh}K`));
  }
  if (recipe.requiredPressure) {
    meta.appendChild(createMetaBadge("Pressure", recipe.requiredPressure));
  }
  if (recipe.requiredPhMin || recipe.requiredPhMax) {
    meta.appendChild(createMetaBadge("pH", `${recipe.requiredPhMin ?? "?"} - ${recipe.requiredPhMax ?? "?"}`));
  }
  if (recipe.requiredCatalysts.length) {
    const catalysts = recipe.requiredCatalysts.map((item) => item.displayName).join(", ");
    meta.appendChild(createMetaBadge("Catalysts", catalysts));
  }
  if (recipe.source) {
    meta.appendChild(createMetaBadge("Source", recipe.source));
  }

  return node;
}

function renderList(recipes) {
  elements.recipeList.innerHTML = "";
  if (!recipes.length) {
    elements.status.textContent = "No recipes found for the current filters.";
    elements.recipeList.classList.add("recipe-list--empty");
    return;
  }
  elements.recipeList.classList.remove("recipe-list--empty");
  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => {
    fragment.appendChild(renderRecipe(recipe));
  });
  elements.recipeList.appendChild(fragment);
  const totalSources = state.sourceFilters.options.length;
  const enabledSources = totalSources - state.sourceFilters.disabled.size;
  const parts = [`Showing ${recipes.length} of ${state.recipes.length} recipe${recipes.length === 1 ? "" : "s"}.`];
  if (totalSources > 0) {
    parts.push(`${enabledSources}/${totalSources} sources enabled.`);
  }
  const totalCategories = state.sourceCategoryFilters.options.length;
  if (totalCategories > 0) {
    const enabledCategories = totalCategories - state.sourceCategoryFilters.disabled.size;
    parts.push(`${enabledCategories}/${totalCategories} source categories visible.`);
  }
  elements.status.textContent = parts.join(" ");
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
