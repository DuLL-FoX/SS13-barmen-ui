export function stripByondFormatting(value) {
  if (typeof value !== "string" || !value.length) {
    return value;
  }
  return value
    .replace(/\\(?:improper|proper|the|an|a)\b\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toTitleCase(value) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function sanitizeIdentifier(value) {
  if (value == null) {
    return null;
  }
  let text = String(value).trim();
  if (!text.length) {
    return null;
  }
  const firstChar = text.charAt(0);
  const lastChar = text.charAt(text.length - 1);
  if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
    text = text.slice(1, -1).trim();
  }
  return text.length ? text : null;
}

export function identifierKey(value) {
  const sanitized = sanitizeIdentifier(value);
  if (!sanitized) {
    return null;
  }
  return sanitized.toLowerCase();
}

export function lastPathSegment(value) {
  const sanitized = sanitizeIdentifier(value);
  if (!sanitized) {
    return null;
  }
  const segments = sanitized.split("/").filter(Boolean);
  if (!segments.length) {
    return sanitized;
  }
  return segments[segments.length - 1];
}

export function deriveDisplayName(path, reagentIndex) {
  const entry = reagentIndex instanceof Map ? reagentIndex.get(path) : null;
  if (entry && entry.name) {
    return stripByondFormatting(entry.name);
  }
  const segments = path.split("/").filter(Boolean);
  const fallback = segments.length ? segments[segments.length - 1] : path;
  return toTitleCase(fallback.replace(/-/g, " "));
}

export function enrichComponent(component, reagentIndex, reagentSources) {
  return component.map((item) => {
    const displayName = deriveDisplayName(item.path, reagentIndex);
    const sources = (reagentSources?.get(item.path) ?? []).map((source) => ({ ...source }));
    return {
      ...item,
      displayName,
      sources
    };
  });
}

const DEFAULT_TAGS = {
  alcoholic: "Alcoholic",
  nonAlcoholic: "Non Alcoholic"
};

export function classifyRecipe(recipe, { strength } = {}) {
  let isAlcoholic = recipe.results.some((result) => result.path.includes("/ethanol"));
  const tags = new Set();
  tags.add(isAlcoholic ? DEFAULT_TAGS.alcoholic : DEFAULT_TAGS.nonAlcoholic);
  const lowerName = (recipe.name || "").toLowerCase();
  if (lowerName.includes("milkshake")) {
    tags.add("Milkshake");
  }
  if (lowerName.includes("tea")) {
    tags.add("Tea");
  }
  if (lowerName.includes("coffee")) {
    tags.add("Coffee");
  }
  if (lowerName.includes("smoothie") || lowerName.includes("juice")) {
    tags.add("Juice");
  }
  if (lowerName.includes("punch") || lowerName.includes("party")) {
    tags.add("Punch");
  }
  if (lowerName.includes("shot") || lowerName.includes("bomb")) {
    tags.add("Shot");
  }
  if (strength != null && strength <= 0) {
    if (isAlcoholic) {
      isAlcoholic = false;
      tags.delete(DEFAULT_TAGS.alcoholic);
      tags.add(DEFAULT_TAGS.nonAlcoholic);
    }
  }
  return {
    isAlcoholic,
    tags: Array.from(tags)
  };
}

function averageBoozePower(items, reagentIndex) {
  let weightedTotal = 0;
  let totalQuantity = 0;
  for (const item of items) {
    const reagent = reagentIndex.get(item.path);
    if (!reagent || reagent.boozePower == null) {
      continue;
    }
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    weightedTotal += reagent.boozePower * quantity;
    totalQuantity += quantity;
  }
  if (totalQuantity === 0) {
    return null;
  }
  return Math.round((weightedTotal / totalQuantity) * 10) / 10;
}

export function computeStrength(recipe, reagentIndex) {
  const resultStrength = averageBoozePower(recipe.results, reagentIndex);
  if (resultStrength != null) {
    return resultStrength;
  }
  return averageBoozePower(recipe.requiredReagents, reagentIndex);
}

function collectPrimaryResultKeys(recipe) {
  const keys = new Set();
  const idKey = identifierKey(recipe?.id);
  if (idKey) {
    keys.add(idKey);
    const idTailKey = identifierKey(lastPathSegment(recipe.id));
    if (idTailKey) {
      keys.add(idTailKey);
    }
  }
  const pathTailKey = identifierKey(lastPathSegment(recipe?.path));
  if (pathTailKey) {
    keys.add(pathTailKey);
  }
  return keys;
}

export function selectPrimaryResults(recipe) {
  if (!recipe || !Array.isArray(recipe.results)) {
    return [];
  }
  const primaryKeys = collectPrimaryResultKeys(recipe);
  const resultsWithKeys = recipe.results.filter((result) => identifierKey(result?.path));
  if (primaryKeys.size) {
    const matches = resultsWithKeys.filter((result) => {
      const directKey = identifierKey(result.path);
      if (directKey && primaryKeys.has(directKey)) {
        return true;
      }
      const tailKey = identifierKey(lastPathSegment(result.path));
      return tailKey ? primaryKeys.has(tailKey) : false;
    });
    if (matches.length) {
      return matches;
    }
  }
  if (resultsWithKeys.length) {
    return [resultsWithKeys[0]];
  }
  return [];
}

export function normalizeRecipe(definition, reagentIndex, reagentSources) {
  const rawName = definition.name ? stripByondFormatting(definition.name) : null;
  const normalizedName = rawName && rawName.toLowerCase() === rawName ? toTitleCase(rawName) : rawName;
  const required = enrichComponent(definition.requiredReagents, reagentIndex, reagentSources);
  const catalysts = enrichComponent(definition.requiredCatalysts, reagentIndex, reagentSources);
  const results = enrichComponent(definition.results, reagentIndex, reagentSources);
  const strength = computeStrength({ results, requiredReagents: required }, reagentIndex);
  const { isAlcoholic, tags } = classifyRecipe(definition, { strength });
  const tagSet = new Set(tags);
  if (strength != null) {
    if (strength >= 60) {
      tagSet.add("Strong");
    } else if (strength <= 20) {
      tagSet.add("Light");
    } else {
      tagSet.add("Balanced");
    }
  }
  return {
    id: sanitizeIdentifier(definition.id) ?? definition.path,
    path: definition.path,
    name: normalizedName ?? deriveDisplayName(definition.path, reagentIndex),
    results,
    requiredReagents: required,
    requiredCatalysts: catalysts,
    mixMessage: definition.mixMessage,
    mixSound: definition.mixSound,
    requiredTemp: definition.requiredTemp,
    requiredTempHigh: definition.requiredTempHigh,
    requiredPressure: definition.requiredPressure,
    requiredPhMin: definition.requiredPhMin,
    requiredPhMax: definition.requiredPhMax,
    notes: definition.notes,
    isAlcoholic,
    tags: Array.from(tagSet),
    strength,
    source: definition.source ?? null,
    requiredRecipes: [],
    dependentRecipes: []
  };
}

export function buildIngredientIndex(recipes, reagentIndex, reagentSources) {
  const index = new Map();
  for (const recipe of recipes) {
    for (const item of recipe.requiredReagents) {
      if (!index.has(item.path)) {
        const reagentDetails = reagentIndex.get(item.path);
        index.set(item.path, {
          path: item.path,
          displayName: item.displayName,
          uses: 0,
          boozePower: reagentDetails?.boozePower ?? null,
          sources: (reagentSources?.get(item.path) ?? []).map((source) => ({ ...source }))
        });
      }
      index.get(item.path).uses += 1;
    }
  }
  return Array.from(index.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
