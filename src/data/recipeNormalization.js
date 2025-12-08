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
  if (strength > 0) {
    isAlcoholic = true;
  }
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
  if (definition.requiredTemp) {
    if (definition.isColdRecipe) {
      tagSet.add("Requires Cooling");
    } else {
      tagSet.add("Requires Heating");
    }
  }

  const primaryResults = selectPrimaryResults({ ...definition, results });
  const resultReagentDetails = primaryResults
    .map((r) => reagentIndex.get(r.path))
    .filter(Boolean);

  const specialProperties = [];
  for (const reagent of resultReagentDetails) {
    if (reagent.addictionThreshold) {
      specialProperties.push({ type: "addiction", value: reagent.addictionThreshold, label: `Addictive (${reagent.addictionThreshold}u threshold)` });
    }
    if (reagent.overdoseThreshold) {
      specialProperties.push({ type: "overdose", value: reagent.overdoseThreshold, label: `Overdose at ${reagent.overdoseThreshold}u` });
    }
    if (reagent.quality) {
      const qualityLabels = {
        "NICE": "Good Quality",
        "GOOD": "Great Quality",
        "VERYGOOD": "Excellent Quality",
        "FANTASTIC": "Fantastic Quality"
      };
      const qualityLabel = qualityLabels[reagent.quality] || reagent.quality;
      specialProperties.push({ type: "quality", value: reagent.quality, label: qualityLabel });
    }
    
    if (Array.isArray(reagent.effects) && reagent.effects.length > 0) {
      for (const effect of reagent.effects) {
        const effectCondition = typeof effect.condition === "string" && effect.condition.trim().length ? effect.condition.trim() : null;
        switch (effect.type) {
          case "heal":
            if (effect.brute > 0 || effect.burn > 0) {
              const parts = [];
              if (effect.brute > 0) parts.push(`${effect.brute} brute`);
              if (effect.burn > 0) parts.push(`${effect.burn} burn`);
              specialProperties.push({ type: "healing", value: effect, label: `Heals ${parts.join(", ")}`, condition: effectCondition ?? undefined });
            }
            break;
          case "heal_brute":
            specialProperties.push({ type: "healing", value: effect.amount, label: `Heals ${effect.amount} brute`, condition: effectCondition ?? undefined });
            break;
          case "heal_burn":
            specialProperties.push({ type: "healing", value: effect.amount, label: `Heals ${effect.amount} burn`, condition: effectCondition ?? undefined });
            break;
          case "heal_toxin":
            specialProperties.push({ type: "healing", value: effect.amount, label: `Heals ${effect.amount} toxin`, condition: effectCondition ?? undefined });
            break;
          case "heal_oxygen":
            specialProperties.push({ type: "healing", value: effect.amount, label: `Heals ${effect.amount} suffocation`, condition: effectCondition ?? undefined });
            break;
          case "heal_liver":
            specialProperties.push({ type: "healing", value: effect.amount, label: `Heals liver (${effect.amount})`, condition: effectCondition ?? undefined });
            break;
          case "warming":
            specialProperties.push({ type: "effect", value: "warming", label: "Warms body", condition: effectCondition ?? undefined });
            break;
          case "cooling":
            specialProperties.push({ type: "effect", value: "cooling", label: "Cools body", condition: effectCondition ?? undefined });
            break;
          case "reduces_drowsiness":
            specialProperties.push({ type: "effect", value: "alertness", label: "Reduces drowsiness", condition: effectCondition ?? undefined });
            break;
          case "reduces_dizziness":
            specialProperties.push({ type: "effect", value: "stability", label: "Reduces dizziness", condition: effectCondition ?? undefined });
            break;
          case "prevents_sleep":
            specialProperties.push({ type: "effect", value: "wakefulness", label: "Prevents sleep", condition: effectCondition ?? undefined });
            break;
          case "hallucinogenic":
            specialProperties.push({ type: "effect", value: "hallucinogenic", label: "Hallucinogenic", condition: effectCondition ?? undefined });
            break;
          case "causes_jitter":
            specialProperties.push({ type: "effect", value: "jitter", label: "Causes jitters", condition: effectCondition ?? undefined });
            break;
        }
      }
    }
  }
  
  const seenLabels = new Set();
  const uniqueProperties = specialProperties.filter(prop => {
    const key = prop.condition ? `${prop.label}__${prop.condition}` : prop.label;
    if (seenLabels.has(key)) return false;
    seenLabels.add(key);
    return true;
  });

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
    isColdRecipe: definition.isColdRecipe ?? false,
    requiredPressure: definition.requiredPressure,
    requiredPhMin: definition.requiredPhMin,
    requiredPhMax: definition.requiredPhMax,
    specialProperties: uniqueProperties,
    notes: definition.notes,
    isAlcoholic,
    tags: Array.from(tagSet),
    strength,
    source: definition.source ?? null,
    requiredRecipes: [],
    dependentRecipes: []
  };
}

export function attachSpecialPropertySimilarities(recipes, { maxEntries = 4 } = {}) {
  if (!Array.isArray(recipes) || !recipes.length) {
    return;
  }

  const propertyIndex = new Map();
  for (const recipe of recipes) {
    if (!Array.isArray(recipe.specialProperties) || recipe.specialProperties.length === 0) {
      continue;
    }
    for (const prop of recipe.specialProperties) {
      if (!prop || !prop.label) {
        continue;
      }
      const key = `${prop.type ?? "unknown"}::${prop.label}`;
      if (!propertyIndex.has(key)) {
        propertyIndex.set(key, []);
      }
      propertyIndex.get(key).push({
        id: recipe.id,
        name: recipe.name,
        path: recipe.path
      });
    }
  }

  for (const recipe of recipes) {
    if (!Array.isArray(recipe.specialProperties) || recipe.specialProperties.length === 0) {
      continue;
    }
    for (const prop of recipe.specialProperties) {
      if (!prop || !prop.label) {
        continue;
      }
      const key = `${prop.type ?? "unknown"}::${prop.label}`;
      const matches = (propertyIndex.get(key) ?? []).filter((entry) => entry.id !== recipe.id);
      if (!matches.length) {
        delete prop.similarRecipes;
        delete prop.similarRecipeCount;
        continue;
      }
      prop.similarRecipeCount = matches.length;
      prop.similarRecipes = matches.slice(0, Math.max(1, maxEntries));
    }
  }
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
