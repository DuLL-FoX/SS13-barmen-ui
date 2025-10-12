import { getRecipeDataset } from "../data/loadData.js";

function normalizeQueryValue(value) {
  if (value == null) {
    return "";
  }
  return value.toString().trim().toLowerCase();
}

function normalizeSourceFilters(rawSource) {
  if (rawSource == null) {
    return null;
  }

  const values = Array.isArray(rawSource) ? rawSource : [rawSource];
  const collected = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const segments = value.split(",");
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (trimmed.length) {
        collected.push(trimmed.toLowerCase());
      }
    }
  }

  if (!collected.length) {
    return null;
  }

  return new Set(collected);
}

function matchesSearchTerm(recipe, term) {
  const lowerName = (recipe.name ?? "").toLowerCase();
  if (lowerName.includes(term)) {
    return true;
  }
  return recipe.requiredReagents.some((item) => {
    const name = (item.displayName ?? "").toLowerCase();
    return name.includes(term);
  });
}

function matchesIngredient(recipe, ingredient) {
  return recipe.requiredReagents.some((item) => {
    const name = (item.displayName ?? "").toLowerCase();
    const path = (item.path ?? "").toLowerCase();
    return name.includes(ingredient) || path.includes(ingredient);
  });
}

function matchesSource(recipe, sourceFilters) {
  if (!sourceFilters || !sourceFilters.size) {
    return true;
  }
  if (!recipe.source) {
    return sourceFilters.has("__none__");
  }
  const recipeSource = (recipe.source ?? "").toLowerCase();
  return sourceFilters.has(recipeSource);
}

function matchesAlcoholic(recipe, alcoholicFilter) {
  if (alcoholicFilter === "true") {
    return recipe.isAlcoholic;
  }
  if (alcoholicFilter === "false") {
    return !recipe.isAlcoholic;
  }
  return true;
}

export function filterRecipes(recipes, { search, ingredient, alcoholic, source } = {}) {
  const list = Array.isArray(recipes) ? [...recipes] : [];
  const searchTerm = normalizeQueryValue(search);
  const ingredientTerm = normalizeQueryValue(ingredient);
  const alcoholicFilter = normalizeQueryValue(alcoholic);
  const sourceFilters = normalizeSourceFilters(source);

  let filtered = list;

  if (searchTerm) {
    filtered = filtered.filter((recipe) => matchesSearchTerm(recipe, searchTerm));
  }

  if (ingredientTerm) {
    filtered = filtered.filter((recipe) => matchesIngredient(recipe, ingredientTerm));
  }

  if (sourceFilters) {
    filtered = filtered.filter((recipe) => matchesSource(recipe, sourceFilters));
  }

  if (alcoholicFilter) {
    filtered = filtered.filter((recipe) => matchesAlcoholic(recipe, alcoholicFilter));
  }

  return filtered;
}

export async function fetchDataset() {
  return getRecipeDataset();
}

export async function preloadDataset() {
  return fetchDataset();
}
