const state = {
  recipes: [],
  fetchedAt: null,
  recipeLookup: new Map(),
  showDeveloperDetails: false
};

const VIEW_MODE_STORAGE_KEY = "ss13-barmen-ui:view-mode";

const elements = {
  search: document.getElementById("search"),
  alcoholic: document.getElementById("alcoholic"),
  nonAlcoholic: document.getElementById("nonAlcoholic"),
  ingredient: document.getElementById("ingredient"),
  source: document.getElementById("source"),
  sort: document.getElementById("sort"),
  recipeCount: document.getElementById("recipeCount"),
  fetchedAt: document.getElementById("fetchedAt"),
  status: document.getElementById("status"),
  recipeList: document.getElementById("recipeList"),
  template: document.getElementById("recipeTemplate"),
  viewToggle: document.getElementById("viewToggle")
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
      sourceList.appendChild(createSourceBadge(source));
    });
    li.appendChild(sourceList);
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

function createSourceBadge(source) {
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
  const label = parts.join(" • ");
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
  elements.status.textContent = `Showing ${recipes.length} of ${state.recipes.length} recipe${recipes.length === 1 ? "" : "s"}.`;
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
  const select = elements.source;
  if (!select) {
    return;
  }
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All sources";
  select.appendChild(defaultOption);

  const counts = new Map();
  let unspecifiedCount = 0;
  recipes.forEach((recipe) => {
    const key = (recipe.source ?? "").trim();
    if (!key) {
      unspecifiedCount += 1;
      return;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([source, count]) => {
      const option = document.createElement("option");
      option.value = source;
      option.textContent = `${source} — ${count} recipe${count === 1 ? "" : "s"}`;
      select.appendChild(option);
    });

  if (unspecifiedCount > 0) {
    const option = document.createElement("option");
    option.value = "__none__";
    option.textContent = `Unspecified — ${unspecifiedCount} recipe${unspecifiedCount === 1 ? "" : "s"}`;
    select.appendChild(option);
  }
}

function applyFilters() {
  const searchTerm = elements.search.value.trim().toLowerCase();
  const selectedIngredient = elements.ingredient.value;
  const selectedSource = elements.source ? elements.source.value : "";
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
  if (selectedSource) {
    if (selectedSource === "__none__") {
      filtered = filtered.filter((recipe) => !recipe.source);
    } else {
      const lowered = selectedSource.toLowerCase();
      filtered = filtered.filter((recipe) => recipe.source && recipe.source.toLowerCase() === lowered);
    }
  }
  if (alcoholicOnly && !nonAlcoholicOnly) {
    filtered = filtered.filter((recipe) => recipe.isAlcoholic);
  } else if (nonAlcoholicOnly && !alcoholicOnly) {
    filtered = filtered.filter((recipe) => !recipe.isAlcoholic);
  }
  const sorted = sortRecipes(filtered);
  renderList(sorted);
}

async function loadDataset() {
  const hasExistingData = state.recipes.length > 0;
  const currentFilters = hasExistingData
    ? {
        search: elements.search.value,
        ingredient: elements.ingredient.value,
        source: elements.source ? elements.source.value : "",
        alcoholic: elements.alcoholic.checked,
        nonAlcoholic: elements.nonAlcoholic.checked,
        sort: elements.sort ? elements.sort.value : "name-asc"
      }
    : {
        search: "",
        ingredient: "",
        source: "",
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
    if (elements.source) {
      const availableSources = new Set(Array.from(elements.source.options).map((option) => option.value));
      if (availableSources.has(currentFilters.source)) {
        elements.source.value = currentFilters.source;
      } else {
        elements.source.value = "";
      }
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
  if (elements.source) {
    elements.source.addEventListener("change", () => applyFilters());
  }
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
}

restoreViewMode();
bindEvents();
loadDataset();
