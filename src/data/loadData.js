import { createDataSource, SOURCES } from "./dataSource.js";
import {
  parseChemicalReactions,
  parseReagents,
  parseChemDispenserSources,
  parseStructureReagentDispensers,
  parseDrinkContainers,
  parseVendingMachines,
  parseSupplyPacks
} from "./parsers.js";
import { loadIconManifest, resolveIconAsset } from "./iconManifest.js";
import {
  normalizeRecipe,
  buildIngredientIndex,
  selectPrimaryResults,
  deriveDisplayName,
  identifierKey,
  attachSpecialPropertySimilarities,
  stripByondFormatting,
  toTitleCase
} from "./recipeNormalization.js";

const CACHE_TTL_MS = 15 * 60 * 1000;
let datasetCache = null;
let cacheTimestamp = 0;
let inflightRequest = null;
let usingLocalData = false;

function mergeReagentMaps(...maps) {
  const combined = new Map();
  for (const map of maps) {
    for (const [key, value] of map.entries()) {
      if (!combined.has(key)) combined.set(key, value);
    }
  }
  return combined;
}

function describeSource(pathOrUrl) {
  if (pathOrUrl.includes("modular_splurt")) return "Modular Splurt";
  if (pathOrUrl.includes("modular_sand")) return "Modular Sand";
  if (pathOrUrl.includes("modular_bluemoon")) return "Modular BlueMoon";
  return "Core Station";
}

function isDrinkRecipe(recipe, reagentIndex) {
  if (!recipe) return false;
  const primaryResults = selectPrimaryResults(recipe);
  if (!primaryResults.length) return false;

  const normalizedPaths = primaryResults.map((r) => (r.path ?? "").toLowerCase()).filter(Boolean);
  if (!normalizedPaths.length) return false;

  if (normalizedPaths.every((p) => p.includes("/datum/reagent/drug/") || p.includes("/datum/reagent/medicine/") || p.includes("/datum/reagent/bio/"))) {
    return false;
  }

  if (normalizedPaths.some((p) =>
    p.includes("/datum/reagent/consumable/") || p.includes("/datum/reagent/food/") ||
    p.includes("/datum/reagent/ethanol/") || p.includes("/datum/reagent/drink/") ||
    p.includes("/obj/item/reagent_containers/food/drinks") || p.includes("/obj/item/food/drinks")
  )) {
    return true;
  }

  if (reagentIndex instanceof Map) {
    for (const result of primaryResults) {
      const reagent = reagentIndex.get(result.path);
      if (!reagent) continue;
      const reagentPath = (reagent.path ?? "").toLowerCase();
      if (reagent.glassIcon || reagent.glassIconState || reagent.icon || reagent.iconState ||
          reagent.boozePower != null || reagentPath.includes("drink") ||
          reagentPath.includes("cocktail") || reagentPath.includes("juice") || reagentPath.includes("smoothie")) {
        return true;
      }
    }
  }
  return false;
}

const SOURCE_TIERS = [
  { key: "base", label: "Base", order: 0 },
  { key: "upgrade1", label: "Upgrade Tier 1", order: 1 },
  { key: "upgrade2", label: "Upgrade Tier 2", order: 2 },
  { key: "upgrade3", label: "Upgrade Tier 3", order: 3 },
  { key: "upgrade4", label: "Upgrade Tier 4", order: 4 },
  { key: "emag", label: "Emag", order: 5 }
];

function deriveMachineDisplayName(path, explicitName) {
  if (explicitName) return stripByondFormatting(explicitName);
  const segments = path.split("/").filter(Boolean);
  const fallback = segments.length ? segments[segments.length - 1] : path;
  return toTitleCase(fallback.replace(/[-_]+/g, " "));
}

function tierOrder(key) {
  return SOURCE_TIERS.find((t) => t.key === key)?.order ?? SOURCE_TIERS.length + 1;
}

function tierLabel(key) {
  return SOURCE_TIERS.find((t) => t.key === key)?.label ?? toTitleCase(key.replace(/\d+/g, (m) => ` ${m}`));
}

function buildReagentSourceIndex(machines) {
  const map = new Map();
  for (const machine of machines) {
    if (!machine.tiers?.length) continue;
    const machineName = deriveMachineDisplayName(machine.path, machine.name);
    for (const tier of machine.tiers) {
      if (!tier.reagents?.length) continue;
      const label = tier.label ?? tierLabel(tier.key);
      const order = tierOrder(tier.key);
      for (const reagentPath of tier.reagents) {
        const normalized = reagentPath?.trim();
        if (!normalized) continue;
        if (!map.has(normalized)) map.set(normalized, []);
        const entries = map.get(normalized);
        if (entries.some((e) => e.machinePath === machine.path && e.tier === tier.key)) continue;
        entries.push({ machineName, machinePath: machine.path, tier: tier.key, tierLabel: label, order });
      }
    }
  }
  for (const entries of map.values()) {
    entries.sort((a, b) => a.machineName.localeCompare(b.machineName) || (a.order ?? 0) - (b.order ?? 0));
    entries.forEach((e) => delete e.order);
  }
  return map;
}

function buildVendorSourceIndex(vendingMachines, containerIndex) {
  const map = new Map();
  for (const machine of vendingMachines) {
    const machineName = deriveMachineDisplayName(machine.path, machine.name);
    for (const itemPath of machine.items) {
      const container = containerIndex.get(itemPath);
      if (!container?.reagents?.length) continue;
      const itemName = deriveMachineDisplayName(itemPath, container.name);
      for (const reagent of container.reagents) {
        if (!reagent.path) continue;
        if (!map.has(reagent.path)) map.set(reagent.path, []);
        const entries = map.get(reagent.path);
        if (entries.some((e) => e.machinePath === machine.path && e.itemPath === itemPath)) continue;
        entries.push({ machineName, machinePath: machine.path, tier: "vendor", tierLabel: "Vendor", itemPath, itemName, quantity: reagent.quantity ?? null });
      }
    }
  }
  return map;
}

function buildSupplySourceIndex(supplyPacks, containerIndex) {
  const map = new Map();
  if (!Array.isArray(supplyPacks)) return map;

  for (const pack of supplyPacks) {
    const machineName = deriveMachineDisplayName(pack.path, pack.crateName ?? pack.name ?? null);
    for (const entry of pack.contents) {
      let itemPath = entry.path?.trim();
      if (!itemPath) continue;
      if (itemPath.startsWith("new ")) itemPath = itemPath.slice(4).trim();
      const typecacheMatch = itemPath.match(/^typecacheof\s*\((.+)\)$/i);
      if (typecacheMatch) itemPath = typecacheMatch[1].trim();
      if (itemPath.endsWith("()")) itemPath = itemPath.slice(0, -2).trim();

      const container = containerIndex.get(itemPath);
      if (!container?.reagents?.length) continue;

      const qty = typeof entry.quantity === "number" ? Math.max(1, entry.quantity) : 1;
      const baseName = deriveMachineDisplayName(itemPath, container.name);
      const itemName = qty > 1 ? `${baseName} (${qty}x)` : baseName;

      for (const reagent of container.reagents) {
        if (!reagent.path) continue;
        if (!map.has(reagent.path)) map.set(reagent.path, []);
        const sources = map.get(reagent.path);
        if (sources.some((s) => s.machinePath === pack.path && s.itemPath === itemPath)) continue;
        sources.push({
          machineName, machinePath: pack.path, tier: "supply", tierLabel: "Supply Pack",
          itemPath, itemName, itemQuantity: qty, quantity: reagent.quantity ?? null, packCost: pack.cost ?? null
        });
      }
    }
  }
  return map;
}

function combineSourceIndexes(...indexes) {
  const combined = new Map();
  for (const index of indexes) {
    if (!index) continue;
    for (const [path, sources] of index.entries()) {
      if (!combined.has(path)) combined.set(path, []);
      const entries = combined.get(path);
      for (const source of sources) {
        if (!entries.some((e) => e.machinePath === source.machinePath && e.tier === source.tier && e.itemPath === source.itemPath)) {
          entries.push({ ...source });
        }
      }
    }
  }
  for (const entries of combined.values()) {
    entries.sort((a, b) => (a.machineName ?? "").localeCompare(b.machineName ?? "") || (a.tierLabel ?? "").localeCompare(b.tierLabel ?? ""));
  }
  return combined;
}

function mergeContainerMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    if (!map) continue;
    for (const [path, details] of map.entries()) {
      if (!merged.has(path)) {
        merged.set(path, {
          path, name: details.name,
          reagents: details.reagents.map((e) => ({ ...e })),
          icon: details.icon ?? null, iconState: details.iconState ?? null,
          glassIcon: details.glassIcon ?? null, glassIconState: details.glassIconState ?? null
        });
      } else {
        const existing = merged.get(path);
        if (!existing.icon && details.icon) existing.icon = details.icon;
        if (!existing.iconState && details.iconState) existing.iconState = details.iconState;
        if (!existing.glassIcon && details.glassIcon) existing.glassIcon = details.glassIcon;
        if (!existing.glassIconState && details.glassIconState) existing.glassIconState = details.glassIconState;
      }
    }
  }
  return merged;
}

function attachRecipeIcons(recipes, containerIndex, iconManifest, reagentIndex) {
  if (!Array.isArray(recipes) || !iconManifest) return;

  const containersByReagent = new Map();
  if (containerIndex) {
    for (const container of containerIndex.values()) {
      if (!container?.reagents) continue;
      for (const reagent of container.reagents) {
        const key = reagent?.path?.trim();
        if (key && !containersByReagent.has(key)) containersByReagent.set(key, container);
      }
    }
  }

  for (const recipe of recipes) {
    const primaryResults = selectPrimaryResults(recipe);
    if (!primaryResults.length) continue;

    let assigned = false;
    if (reagentIndex instanceof Map) {
      for (const result of primaryResults) {
        const reagent = reagentIndex.get(result.path);
        if (!reagent) continue;
        const resolved = resolveIconAsset(reagent, iconManifest, { origin: "reagent" });
        if (resolved) {
          recipe.icon = { ...resolved, reagentPath: reagent.path ?? null };
          assigned = true;
          break;
        }
      }
    }

    if (!assigned) {
      for (const result of primaryResults) {
        const container = containerIndex?.get(result.path) ?? containersByReagent.get(result.path);
        if (!container) continue;
        const resolved = resolveIconAsset(container, iconManifest, { origin: "container" });
        if (resolved) {
          recipe.icon = { ...resolved, containerPath: container.path ?? null };
          break;
        }
      }
    }
  }
}

function linkRecipeDependencies(recipes) {
  if (!Array.isArray(recipes)) return;

  const byId = new Map();
  const byPath = new Map();
  const byResultKey = new Map();

  for (const recipe of recipes) {
    if (recipe.id) byId.set(recipe.id, recipe);
    if (recipe.path) byPath.set(recipe.path, recipe);
    for (const result of selectPrimaryResults(recipe)) {
      const key = identifierKey(result.path);
      if (key && !byResultKey.has(key)) byResultKey.set(key, recipe);
    }
    recipe.requiredRecipes = [];
    recipe.dependentRecipes = [];
  }

  for (const recipe of recipes) {
    const seen = new Set();
    for (const ingredient of recipe.requiredReagents) {
      const key = identifierKey(ingredient.path);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const dependency = byResultKey.get(key) ?? byPath.get(ingredient.path) ?? byId.get(ingredient.path);
      if (!dependency || dependency === recipe) continue;

      recipe.requiredRecipes.push({ id: dependency.id, path: dependency.path, name: dependency.name });
    }
  }

  for (const recipe of recipes) {
    for (const dep of recipe.requiredRecipes) {
      const target = byPath.get(dep.path) ?? byId.get(dep.id) ?? byResultKey.get(identifierKey(dep.path));
      if (!target || target === recipe) continue;
      if (!target.dependentRecipes.some((e) => e.path === recipe.path)) {
        target.dependentRecipes.push({ id: recipe.id, path: recipe.path, name: recipe.name });
      }
    }
    recipe.requiredRecipes.sort((a, b) => a.name.localeCompare(b.name));
    recipe.dependentRecipes.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function buildReagentList(reagentIndex, reagentSources, iconManifest) {
  if (!(reagentIndex instanceof Map)) return [];
  const reagents = [];
  for (const reagent of reagentIndex.values()) {
    const displayName = deriveDisplayName(reagent.path, reagentIndex);
    reagents.push({
      path: reagent.path,
      name: reagent.name ?? displayName,
      displayName,
      description: reagent.description ?? null,
      tasteDescription: reagent.tasteDescription ?? null,
      boozePower: reagent.boozePower ?? null,
      color: reagent.color ?? null,
      icon: resolveIconAsset(reagent, iconManifest, { origin: "reagent" }),
      sources: (reagentSources?.get(reagent.path) ?? []).map((s) => ({ ...s }))
    });
  }
  return reagents.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function fetchRecipeDataset() {
  const dataSource = await createDataSource();
  usingLocalData = dataSource.isLocal;
  const recipeMap = new Map();

  const [recipeFiles, synthFiles, reagentFiles, dispenserFiles, containerFiles, vendingFiles, supplyFiles] = await Promise.all([
    dataSource.fetchAllFiles(SOURCES.recipeFiles, SOURCES.recipeFolders),
    dataSource.fetchFiles(SOURCES.synthRecipeFiles),
    dataSource.fetchAllFiles(SOURCES.reagentFiles, SOURCES.reagentFolders),
    dataSource.fetchAllFiles(SOURCES.dispenserFiles, SOURCES.dispenserFolders),
    dataSource.fetchAllFiles(SOURCES.drinkContainerFiles, SOURCES.drinkContainerFolders),
    dataSource.fetchAllFiles(SOURCES.vendingFiles, SOURCES.vendingFolders),
    dataSource.fetchAllFiles(SOURCES.supplyPackFiles, SOURCES.supplyPackFolders)
  ]);

  for (const { path, text } of recipeFiles) {
    const sourceLabel = describeSource(path);
    for (const definition of parseChemicalReactions(text)) {
      if (!recipeMap.has(definition.path)) {
        recipeMap.set(definition.path, { ...definition, source: sourceLabel });
      }
    }
  }
  for (const { text } of synthFiles) {
    for (const definition of parseChemicalReactions(text)) {
      if (!recipeMap.has(definition.path)) {
        recipeMap.set(definition.path, { ...definition, source: "Synth Drinks" });
      }
    }
  }

  const reagentMaps = reagentFiles.map(({ text }) => parseReagents(text));
  const reagentIndex = mergeReagentMaps(...reagentMaps);

  const dispenserMachines = dispenserFiles.flatMap(({ text }) => [
    ...parseChemDispenserSources(text),
    ...parseStructureReagentDispensers(text)
  ]);

  const containerMaps = containerFiles.map(({ text }) => parseDrinkContainers(text));
  const containerIndex = mergeContainerMaps(...containerMaps);

  const vendingMachines = vendingFiles.flatMap(({ text }) => parseVendingMachines(text));
  const supplyPacks = supplyFiles.flatMap(({ text }) => parseSupplyPacks(text));

  const reagentSources = combineSourceIndexes(
    buildReagentSourceIndex(dispenserMachines),
    buildVendorSourceIndex(vendingMachines, containerIndex),
    buildSupplySourceIndex(supplyPacks, containerIndex)
  );

  const iconManifest = loadIconManifest();
  const normalizedRecipes = Array.from(recipeMap.values())
    .map((def) => normalizeRecipe(def, reagentIndex, reagentSources))
    .filter((recipe) => isDrinkRecipe(recipe, reagentIndex));

  attachRecipeIcons(normalizedRecipes, containerIndex, iconManifest, reagentIndex);
  linkRecipeDependencies(normalizedRecipes);
  attachSpecialPropertySimilarities(normalizedRecipes);

  const ingredients = buildIngredientIndex(normalizedRecipes, reagentIndex, reagentSources);
  const reagents = buildReagentList(reagentIndex, reagentSources, iconManifest);

  console.log(`Loaded ${normalizedRecipes.length} recipes from ${dataSource.isLocal ? "local folder" : "GitHub"}`);

  return {
    fetchedAt: new Date().toISOString(),
    version: dataSource.version,
    recipes: normalizedRecipes,
    ingredients,
    reagents
  };
}

export async function getRecipeDataset({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && datasetCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return datasetCache;
  }
  if (inflightRequest) return inflightRequest;

  inflightRequest = fetchRecipeDataset()
    .then((dataset) => {
      datasetCache = dataset;
      cacheTimestamp = Date.now();
      return datasetCache;
    })
    .finally(() => {
      inflightRequest = null;
    });
  return inflightRequest;
}

export function isUsingLocalData() {
  return usingLocalData;
}

export function clearRecipeDatasetCache() {
  datasetCache = null;
  cacheTimestamp = 0;
}

export function filterRecipes(recipes, { search, ingredient, alcoholic, source } = {}) {
  const list = Array.isArray(recipes) ? [...recipes] : [];
  const normalize = (v) => (v == null ? "" : v.toString().trim().toLowerCase());
  const searchTerm = normalize(search);
  const ingredientTerm = normalize(ingredient);
  const alcoholicFilter = normalize(alcoholic);

  let sourceFilters = null;
  if (source != null) {
    const values = Array.isArray(source) ? source : [source];
    const collected = values.flatMap((v) => (typeof v === "string" ? v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : []));
    if (collected.length) sourceFilters = new Set(collected);
  }

  let filtered = list;
  if (searchTerm) {
    filtered = filtered.filter((r) =>
      (r.name ?? "").toLowerCase().includes(searchTerm) ||
      r.requiredReagents.some((i) => (i.displayName ?? "").toLowerCase().includes(searchTerm))
    );
  }
  if (ingredientTerm) {
    filtered = filtered.filter((r) =>
      r.requiredReagents.some((i) =>
        (i.displayName ?? "").toLowerCase().includes(ingredientTerm) ||
        (i.path ?? "").toLowerCase().includes(ingredientTerm)
      )
    );
  }
  if (sourceFilters) {
    filtered = filtered.filter((r) => {
      if (!r.source) return sourceFilters.has("__none__");
      return sourceFilters.has((r.source ?? "").toLowerCase());
    });
  }
  if (alcoholicFilter === "true") {
    filtered = filtered.filter((r) => r.isAlcoholic);
  } else if (alcoholicFilter === "false") {
    filtered = filtered.filter((r) => !r.isAlcoholic);
  }
  return filtered;
}
