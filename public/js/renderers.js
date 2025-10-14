import {
  state,
  DISPENSER_TIERS,
  SOURCE_CATEGORY_DEFINITIONS
} from "./state.js";
import { elements } from "./dom.js";

const RENDER_BATCH_SIZE = 30;
let renderSequence = 0;

export function sanitizeMessage(message) {
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

export function deriveSourceCategory(source) {
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

export function sortRecipes(recipes) {
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

export function renderRecipe(recipe) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.querySelector(".recipe__title").textContent = recipe.name;

  const badges = node.querySelector(".recipe__badges");
  badges.innerHTML = "";
  badges.appendChild(
    createBadge(recipe.isAlcoholic ? "Alcoholic" : "Non-alcoholic", recipe.isAlcoholic ? "accent" : "neutral")
  );
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
      media.style.setProperty("--icon-width", width ? `${width}px` : "32px");
      media.style.setProperty("--icon-height", height ? `${height}px` : "32px");
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

export function renderList(recipes) {
  const sequence = ++renderSequence;
  elements.recipeList.innerHTML = "";
  if (!recipes.length) {
    elements.status.textContent = "No recipes found for the current filters.";
    elements.recipeList.classList.add("recipe-list--empty");
    return;
  }

  elements.recipeList.classList.remove("recipe-list--empty");
  elements.status.textContent = `Rendering ${recipes.length} recipes...`;

  const total = recipes.length;
  let index = 0;

  const finalizeStatus = () => {
    if (renderSequence !== sequence) {
      return;
    }
    const totalSources = state.sourceFilters.options.length;
    const enabledSources = totalSources - state.sourceFilters.disabled.size;
    const parts = [`Showing ${total} of ${state.recipes.length} recipe${total === 1 ? "" : "s"}.`];
    if (totalSources > 0) {
      parts.push(`${enabledSources}/${totalSources} sources enabled.`);
    }
    const totalCategories = state.sourceCategoryFilters.options.length;
    if (totalCategories > 0) {
      const enabledCategories = totalCategories - state.sourceCategoryFilters.disabled.size;
      parts.push(`${enabledCategories}/${totalCategories} source categories visible.`);
    }
    elements.status.textContent = parts.join(" ");
  };

  const renderNextBatch = () => {
    if (renderSequence !== sequence) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const end = Math.min(index + RENDER_BATCH_SIZE, total);
    for (; index < end; index += 1) {
      fragment.appendChild(renderRecipe(recipes[index]));
    }
    elements.recipeList.appendChild(fragment);

    if (index < total) {
      requestAnimationFrame(renderNextBatch);
      return;
    }

    finalizeStatus();
  };

  requestAnimationFrame(renderNextBatch);
}
