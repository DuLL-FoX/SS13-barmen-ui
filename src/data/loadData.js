import { RAW_SOURCES } from "./githubSources.js";
import {
  parseChemicalReactions,
  parseReagents,
  parseChemDispenserSources,
  parseStructureReagentDispensers,
  parseDrinkContainers,
  parseVendingMachines,
  parseSupplyPacks
} from "./parsers.js";
import { fetchText, safeCollectGithubDirectoryFiles } from "./githubClient.js";
import { loadIconManifest, resolveIconAsset } from "./iconManifest.js";
import {
  normalizeRecipe,
  buildIngredientIndex,
  selectPrimaryResults,
  deriveDisplayName,
  identifierKey
} from "./recipeNormalization.js";
import {
  buildReagentSourceIndex,
  buildVendorSourceIndex,
  buildSupplySourceIndex,
  combineSourceIndexes
} from "./sourceIndexes.js";
import { mergeContainerMaps, attachRecipeIcons } from "./containerUtils.js";

function mergeReagentMaps(...maps) {
  const combined = new Map();
  for (const map of maps) {
    for (const [key, value] of map.entries()) {
      if (!combined.has(key)) {
        combined.set(key, value);
      }
    }
  }
  return combined;
}

function describeSource(url) {
  if (url.includes("/modular_splurt/")) {
    return "Modular Splurt";
  }
  if (url.includes("/modular_sand/")) {
    return "Modular Sand";
  }
  return "Core Station";
}

function isDrinkRecipe(recipe, reagentIndex) {
  if (!recipe) {
    return false;
  }

  const primaryResults = selectPrimaryResults(recipe);
  if (!primaryResults.length) {
    return false;
  }

  const normalizedPaths = primaryResults
    .map((result) => (result.path ?? "").toLowerCase())
    .filter((path) => path.length);

  if (!normalizedPaths.length) {
    return false;
  }

  const isExplicitlyNonDrink = normalizedPaths.every((path) =>
    path.includes("/datum/reagent/drug/") ||
    path.includes("/datum/reagent/medicine/") ||
    path.includes("/datum/reagent/bio/")
  );
  if (isExplicitlyNonDrink) {
    return false;
  }

  const hasDrinkIndicator = normalizedPaths.some((path) =>
    path.includes("/datum/reagent/consumable/") ||
    path.includes("/datum/reagent/food/") ||
    path.includes("/datum/reagent/ethanol/") ||
    path.includes("/datum/reagent/drink/") ||
    path.includes("/obj/item/reagent_containers/food/drinks") ||
    path.includes("/obj/item/food/drinks")
  );
  if (hasDrinkIndicator) {
    return true;
  }

  if (reagentIndex instanceof Map) {
    for (const result of primaryResults) {
      const reagent = reagentIndex.get(result.path);
      if (!reagent) {
        continue;
      }
      const reagentPath = (reagent.path ?? "").toLowerCase();
      if (
        reagent.glassIcon ||
        reagent.glassIconState ||
        reagent.icon ||
        reagent.iconState ||
        reagent.boozePower != null ||
        reagentPath.includes("drink") ||
        reagentPath.includes("cocktail") ||
        reagentPath.includes("juice") ||
        reagentPath.includes("smoothie")
      ) {
        return true;
      }
    }
  }

  return false;
}

async function fetchRecipeDataset() {
  const recipeMap = new Map();

  const ingestRecipeSources = async (urls, labelResolver) => {
    if (!Array.isArray(urls) || !urls.length) {
      return;
    }
    const recipeTexts = await Promise.all(urls.map((url) => fetchText(url)));
    recipeTexts.forEach((text, index) => {
      const sourceLabel = typeof labelResolver === "function" ? labelResolver(urls[index]) : labelResolver;
      const definitions = parseChemicalReactions(text);
      for (const definition of definitions) {
        if (!recipeMap.has(definition.path)) {
          recipeMap.set(definition.path, {
            ...definition,
            source: sourceLabel
          });
        }
      }
    });
  };

  const recipeFileUrls = new Set(Array.isArray(RAW_SOURCES.recipeFiles) ? RAW_SOURCES.recipeFiles : []);
  const recipeFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.recipeFolders,
    [".dm"],
    "recipe folders"
  );
  recipeFolderFiles.forEach((url) => recipeFileUrls.add(url));
  await ingestRecipeSources(Array.from(recipeFileUrls).sort(), describeSource);
  await ingestRecipeSources(RAW_SOURCES.synthRecipeFiles, () => "Synth Drinks");
  const recipeDefinitions = Array.from(recipeMap.values());

  const reagentFileUrls = new Set(Array.isArray(RAW_SOURCES.reagentFiles) ? RAW_SOURCES.reagentFiles : []);
  const reagentFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.reagentFolders,
    [".dm"],
    "reagent folders"
  );
  reagentFolderFiles.forEach((url) => reagentFileUrls.add(url));
  const sortedReagentFiles = Array.from(reagentFileUrls).sort();
  const reagentTexts = await Promise.all(sortedReagentFiles.map((url) => fetchText(url)));
  const reagentMaps = reagentTexts.map((text) => parseReagents(text));
  const reagentIndex = mergeReagentMaps(...reagentMaps);

  const dispenserFileUrls = new Set(Array.isArray(RAW_SOURCES.dispenserFiles) ? RAW_SOURCES.dispenserFiles : []);
  const dispenserFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.dispenserFolders,
    [".dm"],
    "reagent dispenser folders"
  );
  dispenserFolderFiles.forEach((url) => dispenserFileUrls.add(url));
  const dispenserTexts = await Promise.all(Array.from(dispenserFileUrls).sort().map((url) => fetchText(url)));
  const dispenserMachines = dispenserTexts.flatMap((text) => {
    const chemDispensers = parseChemDispenserSources(text);
    const structureDispensers = parseStructureReagentDispensers(text);
    return chemDispensers.concat(structureDispensers);
  });

  const containerFileUrls = new Set(
    Array.isArray(RAW_SOURCES.drinkContainerFiles) ? RAW_SOURCES.drinkContainerFiles : []
  );
  const containerFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.drinkContainerFolders,
    [".dm"],
    "drink container folders"
  );
  containerFolderFiles.forEach((url) => containerFileUrls.add(url));
  const containerTexts = await Promise.all(Array.from(containerFileUrls).sort().map((url) => fetchText(url)));
  const containerMaps = containerTexts.map((text) => parseDrinkContainers(text));
  const containerIndex = mergeContainerMaps(...containerMaps);
  const iconManifest = loadIconManifest();

  const vendingFileUrls = new Set(Array.isArray(RAW_SOURCES.vendingFiles) ? RAW_SOURCES.vendingFiles : []);
  const vendingFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.vendingFolders,
    [".dm"],
    "vending folders"
  );
  vendingFolderFiles.forEach((url) => vendingFileUrls.add(url));
  const vendingTexts = await Promise.all(Array.from(vendingFileUrls).sort().map((url) => fetchText(url)));
  const vendingMachines = vendingTexts.flatMap((text) => parseVendingMachines(text));

  const supplyFileUrls = new Set(Array.isArray(RAW_SOURCES.supplyPackFiles) ? RAW_SOURCES.supplyPackFiles : []);
  const supplyFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.supplyPackFolders,
    [".dm"],
    "supply pack folders"
  );
  supplyFolderFiles.forEach((url) => supplyFileUrls.add(url));
  const supplyTexts = await Promise.all(Array.from(supplyFileUrls).sort().map((url) => fetchText(url)));
  const supplyPacks = supplyTexts.flatMap((text) => parseSupplyPacks(text));

  const dispenserSourceIndex = buildReagentSourceIndex(dispenserMachines);
  const vendorSourceIndex = buildVendorSourceIndex(vendingMachines, containerIndex);
  const supplySourceIndex = buildSupplySourceIndex(supplyPacks, containerIndex);
  const reagentSources = combineSourceIndexes(dispenserSourceIndex, vendorSourceIndex, supplySourceIndex);

  const normalizedRecipes = recipeDefinitions
    .map((definition) => normalizeRecipe(definition, reagentIndex, reagentSources))
    .filter((recipe) => isDrinkRecipe(recipe, reagentIndex));

  attachRecipeIcons(normalizedRecipes, containerIndex, iconManifest, reagentIndex);
  linkRecipeDependencies(normalizedRecipes);

  const ingredients = buildIngredientIndex(normalizedRecipes, reagentIndex, reagentSources);
  const reagents = buildReagentList(reagentIndex, reagentSources, iconManifest);

  return {
    fetchedAt: new Date().toISOString(),
    recipes: normalizedRecipes,
    ingredients,
    reagents
  };
}


const CACHE_TTL_MS = 15 * 60 * 1000;
let datasetCache = null;
let cacheTimestamp = 0;
let inflightRequest = null;

export async function getRecipeDataset({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && datasetCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return datasetCache;
  }
  if (inflightRequest) {
    return inflightRequest;
  }
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

export function clearRecipeDatasetCache() {
  datasetCache = null;
  cacheTimestamp = 0;
}

function linkRecipeDependencies(recipes) {
  if (!Array.isArray(recipes)) {
    return;
  }

  const byId = new Map();
  const byPath = new Map();
  const byResultKey = new Map();

  for (const recipe of recipes) {
    if (recipe.id) {
      byId.set(recipe.id, recipe);
    }
    if (recipe.path) {
      byPath.set(recipe.path, recipe);
    }

    const primaryResults = selectPrimaryResults(recipe);
    for (const result of primaryResults) {
      const key = identifierKey(result.path);
      if (key && !byResultKey.has(key)) {
        byResultKey.set(key, recipe);
      }
    }

    recipe.requiredRecipes = [];
    recipe.dependentRecipes = [];
  }

  for (const recipe of recipes) {
    const seen = new Set();
    for (const ingredient of recipe.requiredReagents) {
      const key = identifierKey(ingredient.path);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);

      let dependency = byResultKey.get(key);
      if (!dependency) {
        dependency = byPath.get(ingredient.path) ?? (ingredient.path ? byId.get(ingredient.path) : null);
      }
      if (!dependency || dependency === recipe) {
        continue;
      }

      recipe.requiredRecipes.push({
        id: dependency.id,
        path: dependency.path,
        name: dependency.name
      });
    }
  }

  for (const recipe of recipes) {
    for (const dependency of recipe.requiredRecipes) {
      const dependencyKey = identifierKey(dependency.path);
      const target =
        byPath.get(dependency.path) ??
        (dependency.id ? byId.get(dependency.id) : null) ??
        (dependencyKey ? byResultKey.get(dependencyKey) : null);
      if (!target || target === recipe) {
        continue;
      }
      if (!target.dependentRecipes.some((entry) => entry.path === recipe.path)) {
        target.dependentRecipes.push({
          id: recipe.id,
          path: recipe.path,
          name: recipe.name
        });
      }
    }
    recipe.requiredRecipes.sort((a, b) => a.name.localeCompare(b.name));
    recipe.dependentRecipes.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function buildReagentList(reagentIndex, reagentSources, iconManifest) {
  if (!(reagentIndex instanceof Map)) {
    return [];
  }
  const reagents = [];
  for (const reagent of reagentIndex.values()) {
    const displayName = deriveDisplayName(reagent.path, reagentIndex);
    const icon = resolveIconAsset(reagent, iconManifest, { origin: "reagent" });
    reagents.push({
      path: reagent.path,
      name: reagent.name ?? displayName,
      displayName,
      description: reagent.description ?? null,
      tasteDescription: reagent.tasteDescription ?? null,
      boozePower: reagent.boozePower ?? null,
      color: reagent.color ?? null,
      icon,
      sources: (reagentSources?.get(reagent.path) ?? []).map((source) => ({ ...source }))
    });
  }
  reagents.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return reagents;
}

