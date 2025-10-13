import fetch from "node-fetch";
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

const DEFAULT_USER_AGENT = "ss13-barmen-ui";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : "";

function buildGithubHeaders(additional = {}) {
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    ...additional
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

function formatRateLimitMessage(response) {
  if (!response || response.status !== 403) {
    return null;
  }
  const remaining = response.headers?.get("x-ratelimit-remaining");
  if (remaining !== "0") {
    return null;
  }
  const reset = response.headers?.get("x-ratelimit-reset");
  const resetEpoch = reset ? Number.parseInt(reset, 10) : Number.NaN;
  const resetDate = Number.isFinite(resetEpoch) ? new Date(resetEpoch * 1000) : null;
  const resetInfo = resetDate ? ` Rate limit resets around ${resetDate.toLocaleTimeString()}.` : "";
  const authHint = GITHUB_TOKEN
    ? " GitHub token is configured but the limit has still been reached."
    : " Provide a personal access token via the GITHUB_TOKEN environment variable to raise the hourly quota.";
  return `GitHub rate limit exceeded.${authHint}${resetInfo}`;
}

function createGithubError(url, response) {
  const rateLimitMessage = formatRateLimitMessage(response);
  if (rateLimitMessage) {
    return new Error(`${rateLimitMessage} (while requesting ${url}).`);
  }
  return new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
}

function stripByondFormatting(value) {
  if (typeof value !== "string" || !value.length) {
    return value;
  }
  return value
    .replace(/\\(?:improper|proper|the|an|a)\b\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function deriveDisplayName(path, reagentIndex) {
  const entry = reagentIndex.get(path);
  if (entry && entry.name) {
    return stripByondFormatting(entry.name);
  }
  const segments = path.split("/").filter(Boolean);
  const fallback = segments.length ? segments[segments.length - 1] : path;
  return toTitleCase(fallback.replace(/-/g, " "));
}

function enrichComponent(component, reagentIndex, reagentSources) {
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

const SOURCE_TIERS = [
  { key: "base", label: "Base", order: 0 },
  { key: "upgrade1", label: "Upgrade Tier 1", order: 1 },
  { key: "upgrade2", label: "Upgrade Tier 2", order: 2 },
  { key: "upgrade3", label: "Upgrade Tier 3", order: 3 },
  { key: "upgrade4", label: "Upgrade Tier 4", order: 4 },
  { key: "emag", label: "Emag", order: 5 }
];

function deriveMachineDisplayName(path, explicitName) {
  if (explicitName) {
    return stripByondFormatting(explicitName);
  }
  const segments = path.split("/").filter(Boolean);
  const fallback = segments.length ? segments[segments.length - 1] : path;
  return toTitleCase(fallback.replace(/[-_]+/g, " "));
}

function tierOrder(key) {
  const entry = SOURCE_TIERS.find((tier) => tier.key === key);
  return entry ? entry.order : SOURCE_TIERS.length + 1;
}

function tierLabel(key) {
  const entry = SOURCE_TIERS.find((tier) => tier.key === key);
  return entry ? entry.label : toTitleCase(key.replace(/\d+/g, (match) => ` ${match}`));
}

function buildReagentSourceIndex(machines) {
  const map = new Map();
  for (const machine of machines) {
    if (!machine.tiers || !machine.tiers.length) {
      continue;
    }
    const machineName = deriveMachineDisplayName(machine.path, machine.name);
    for (const tier of machine.tiers) {
      if (!tier.reagents || !tier.reagents.length) {
        continue;
      }
      const label = tier.label ?? tierLabel(tier.key);
      const order = tierOrder(tier.key);
      for (const reagentPath of tier.reagents) {
        const normalized = reagentPath?.trim();
        if (!normalized) {
          continue;
        }
        if (!map.has(normalized)) {
          map.set(normalized, []);
        }
        const entries = map.get(normalized);
        if (entries.some((entry) => entry.machinePath === machine.path && entry.tier === tier.key)) {
          continue;
        }
        entries.push({
          machineName,
          machinePath: machine.path,
          tier: tier.key,
          tierLabel: label,
          order
        });
      }
    }
  }

  for (const entries of map.values()) {
    entries.sort((a, b) => {
      const nameComparison = a.machineName.localeCompare(b.machineName);
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return (a.order ?? 0) - (b.order ?? 0);
    });
    entries.forEach((entry) => {
      delete entry.order;
    });
  }

  return map;
}

function classifyRecipe(recipe) {
  const isAlcoholic = recipe.results.some((result) => result.path.includes("/ethanol"));
  const tags = new Set();
  if (isAlcoholic) {
    tags.add("Alcoholic");
  } else {
    tags.add("Non Alcoholic");
  }
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

function computeStrength(recipe, reagentIndex) {
  const resultStrength = averageBoozePower(recipe.results, reagentIndex);
  if (resultStrength != null) {
    return resultStrength;
  }
  return averageBoozePower(recipe.requiredReagents, reagentIndex);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: buildGithubHeaders()
  });
  if (!response.ok) {
    throw createGithubError(url, response);
  }
  return response.text();
}

function normalizeExtensions(extensions) {
  if (!extensions) {
    return [".dm"];
  }
  if (!Array.isArray(extensions)) {
    return [String(extensions)];
  }
  return extensions.map((value) => String(value));
}

function matchesExtension(name, extensions) {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension.toLowerCase()));
}

async function fetchGithubDirectoryFiles(directoryUrl, extensions = [".dm"]) {
  const normalizedExtensions = normalizeExtensions(extensions);
  const pending = [directoryUrl];
  const visited = new Set();
  const results = new Set();
  let ref = null;

  try {
    const parsed = new URL(directoryUrl);
    ref = parsed.searchParams.get("ref");
  } catch (
    _error
  ) {
    // Ignore malformed URLs and proceed without an explicit ref.
  }

  while (pending.length) {
    const current = pending.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const response = await fetch(current, {
      headers: buildGithubHeaders({ Accept: "application/vnd.github.v3+json" })
    });

    if (!response.ok) {
      throw createGithubError(current, response);
    }

    const entries = await response.json();
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      if (entry.type === "file" && entry.download_url && matchesExtension(entry.name, normalizedExtensions)) {
        results.add(entry.download_url);
        continue;
      }
      if (entry.type === "dir" && entry.url) {
        let nextUrl = entry.url;
        if (ref && !nextUrl.includes("?")) {
          nextUrl = `${nextUrl}?ref=${ref}`;
        }
        pending.push(nextUrl);
      }
    }
  }

  return Array.from(results);
}

async function collectGithubDirectoryFiles(directories, extensions = [".dm"]) {
  if (!Array.isArray(directories) || !directories.length) {
    return [];
  }
  const aggregate = new Set();
  for (const directory of directories) {
    const files = await fetchGithubDirectoryFiles(directory, extensions);
    files.forEach((fileUrl) => aggregate.add(fileUrl));
  }
  return Array.from(aggregate);
}

async function safeCollectGithubDirectoryFiles(directories, extensions, description) {
  if (!Array.isArray(directories) || !directories.length) {
    return [];
  }
  try {
    return await collectGithubDirectoryFiles(directories, extensions);
  } catch (error) {
    const label = description || "GitHub directory group";
    console.warn(`Skipping ${label}: ${error.message}`);
    return [];
  }
}

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

function sanitizeIdentifier(value) {
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

function identifierKey(value) {
  const sanitized = sanitizeIdentifier(value);
  if (!sanitized) {
    return null;
  }
  return sanitized.toLowerCase();
}

function lastPathSegment(value) {
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

function selectPrimaryResults(recipe) {
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

function normalizeRecipe(definition, reagentIndex, reagentSources) {
  const required = enrichComponent(definition.requiredReagents, reagentIndex, reagentSources);
  const catalysts = enrichComponent(definition.requiredCatalysts, reagentIndex, reagentSources);
  const results = enrichComponent(definition.results, reagentIndex, reagentSources);
  const strength = computeStrength({ results, requiredReagents: required }, reagentIndex);
  const { isAlcoholic, tags } = classifyRecipe(definition);
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
    name: definition.name ?? deriveDisplayName(definition.path, reagentIndex),
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

function buildIngredientIndex(recipes, reagentIndex, reagentSources) {
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

function mergeContainerMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const [path, details] of map.entries()) {
      if (!merged.has(path)) {
        merged.set(path, {
          path,
          name: details.name,
          reagents: details.reagents.map((entry) => ({ ...entry }))
        });
      }
    }
  }
  return merged;
}

function deriveItemDisplayName(path, explicitName) {
  return deriveMachineDisplayName(path, explicitName);
}

function buildVendorSourceIndex(vendingMachines, containerIndex) {
  const map = new Map();
  for (const machine of vendingMachines) {
    const machineName = deriveMachineDisplayName(machine.path, machine.name);
    for (const itemPath of machine.items) {
      const container = containerIndex.get(itemPath);
      if (!container || !container.reagents?.length) {
        continue;
      }
      const itemName = deriveItemDisplayName(itemPath, container.name);
      for (const reagent of container.reagents) {
        if (!reagent.path) {
          continue;
        }
        if (!map.has(reagent.path)) {
          map.set(reagent.path, []);
        }
        const entries = map.get(reagent.path);
        const exists = entries.some(
          (entry) =>
            entry.machinePath === machine.path && entry.tier === "vendor" && entry.itemPath === itemPath
        );
        if (!exists) {
          entries.push({
            machineName,
            machinePath: machine.path,
            tier: "vendor",
            tierLabel: "Vendor",
            itemPath,
            itemName,
            quantity: reagent.quantity ?? null
          });
        }
      }
    }
  }
  return map;
}

function normalizeSupplyItemPath(path) {
  if (!path) {
    return null;
  }
  let normalized = path.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("new ")) {
    normalized = normalized.slice(4).trim();
  }
  const typecacheMatch = normalized.match(/^typecacheof\s*\((.+)\)$/i);
  if (typecacheMatch) {
    normalized = typecacheMatch[1].trim();
  }
  if (normalized.endsWith("()")) {
    normalized = normalized.slice(0, -2).trim();
  }
  return normalized || null;
}

function deriveSupplyPackName(pack) {
  if (!pack) {
    return "Supply Pack";
  }
  const explicit = pack.crateName ?? pack.name ?? null;
  return deriveMachineDisplayName(pack.path, explicit);
}

function formatSupplyItemName(baseName, quantity) {
  if (!baseName) {
    return baseName;
  }
  const amount = typeof quantity === "number" && Number.isFinite(quantity) ? Math.max(1, quantity) : 1;
  if (amount <= 1) {
    return baseName;
  }
  return `${baseName} (${amount}x)`;
}

function buildSupplySourceIndex(supplyPacks, containerIndex) {
  const map = new Map();
  if (!Array.isArray(supplyPacks) || !supplyPacks.length) {
    return map;
  }
  for (const pack of supplyPacks) {
    const machineName = deriveSupplyPackName(pack);
    for (const entry of pack.contents) {
      const itemPath = normalizeSupplyItemPath(entry.path);
      if (!itemPath) {
        continue;
      }
      const container = containerIndex.get(itemPath);
      if (!container || !Array.isArray(container.reagents) || !container.reagents.length) {
        continue;
      }
      const itemName = formatSupplyItemName(deriveItemDisplayName(itemPath, container.name), entry.quantity);
      const itemQuantity = typeof entry.quantity === "number" && Number.isFinite(entry.quantity) ? entry.quantity : null;
      for (const reagent of container.reagents) {
        if (!reagent.path) {
          continue;
        }
        if (!map.has(reagent.path)) {
          map.set(reagent.path, []);
        }
        const sources = map.get(reagent.path);
        const exists = sources.some(
          (source) =>
            source.machinePath === pack.path &&
            source.itemPath === itemPath &&
            source.tier === "supply" &&
            source.tierLabel === "Supply Pack"
        );
        if (exists) {
          continue;
        }
        sources.push({
          machineName,
          machinePath: pack.path,
          tier: "supply",
          tierLabel: "Supply Pack",
          itemPath,
          itemName,
          itemQuantity,
          quantity: reagent.quantity ?? null,
          packCost: pack.cost ?? null
        });
      }
    }
  }
  return map;
}

function appendSourceEntry(index, path, source) {
  if (!index.has(path)) {
    index.set(path, []);
  }
  const entries = index.get(path);
  const exists = entries.some(
    (entry) =>
      entry.machinePath === source.machinePath &&
      entry.tier === source.tier &&
      entry.itemPath === source.itemPath &&
      entry.tierLabel === source.tierLabel
  );
  if (!exists) {
    entries.push({ ...source });
  }
}

function combineSourceIndexes(...indexes) {
  const combined = new Map();
  for (const index of indexes) {
    if (!index) {
      continue;
    }
    for (const [path, sources] of index.entries()) {
      for (const source of sources) {
        appendSourceEntry(combined, path, source);
      }
    }
  }
  for (const entries of combined.values()) {
    entries.sort((a, b) => {
      const nameComparison = (a.machineName ?? "").localeCompare(b.machineName ?? "");
      if (nameComparison !== 0) {
        return nameComparison;
      }
      const tierComparison = (a.tierLabel ?? "").localeCompare(b.tierLabel ?? "");
      if (tierComparison !== 0) {
        return tierComparison;
      }
      return (a.itemName ?? "").localeCompare(b.itemName ?? "");
    });
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
        const key = definition.path;
        if (!recipeMap.has(key)) {
          recipeMap.set(key, {
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

  let dispenserMachines = [];
  const dispenserFileUrls = new Set(Array.isArray(RAW_SOURCES.dispenserFiles) ? RAW_SOURCES.dispenserFiles : []);
  const dispenserFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.dispenserFolders,
    [".dm"],
    "reagent dispenser folders"
  );
  dispenserFolderFiles.forEach((url) => dispenserFileUrls.add(url));
  if (dispenserFileUrls.size) {
    const dispenserTexts = await Promise.all(Array.from(dispenserFileUrls).sort().map((url) => fetchText(url)));
    dispenserMachines = dispenserTexts.flatMap((text) => {
      const chemDispensers = parseChemDispenserSources(text);
      const structureDispensers = parseStructureReagentDispensers(text);
      return chemDispensers.concat(structureDispensers);
    });
  }
  let containerIndex = new Map();
  const containerFileUrls = new Set(
    Array.isArray(RAW_SOURCES.drinkContainerFiles) ? RAW_SOURCES.drinkContainerFiles : []
  );
  const containerFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.drinkContainerFolders,
    [".dm"],
    "drink container folders"
  );
  containerFolderFiles.forEach((url) => containerFileUrls.add(url));
  if (containerFileUrls.size) {
    const containerTexts = await Promise.all(Array.from(containerFileUrls).sort().map((url) => fetchText(url)));
    const containerMaps = containerTexts.map((text) => parseDrinkContainers(text));
    containerIndex = mergeContainerMaps(...containerMaps);
  }

  let supplyPacks = [];
  const supplyPackFileUrls = new Set(Array.isArray(RAW_SOURCES.supplyPackFiles) ? RAW_SOURCES.supplyPackFiles : []);
  const supplyPackFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.supplyPackFolders,
    [".dm"],
    "supply pack folders"
  );
  supplyPackFolderFiles.forEach((url) => supplyPackFileUrls.add(url));
  if (supplyPackFileUrls.size) {
    const supplyPackTexts = [];
    for (const url of Array.from(supplyPackFileUrls).sort()) {
      try {
        const text = await fetchText(url);
        supplyPackTexts.push(text);
      } catch (error) {
        console.warn(`Skipping supply pack source ${url}: ${error.message}`);
      }
    }
    supplyPacks = supplyPackTexts.flatMap((text) => parseSupplyPacks(text));
  }

  let vendingMachines = [];
  const vendingFileUrls = new Set(Array.isArray(RAW_SOURCES.vendingFiles) ? RAW_SOURCES.vendingFiles : []);
  const vendingFolderFiles = await safeCollectGithubDirectoryFiles(
    RAW_SOURCES.vendingFolders,
    [".dm"],
    "vending folders"
  );
  vendingFolderFiles.forEach((url) => vendingFileUrls.add(url));
  if (vendingFileUrls.size) {
    const vendingTexts = await Promise.all(Array.from(vendingFileUrls).sort().map((url) => fetchText(url)));
    vendingMachines = vendingTexts.flatMap((text) => parseVendingMachines(text));
  }

  const dispenserSources = buildReagentSourceIndex(dispenserMachines);
  const vendorSources = buildVendorSourceIndex(vendingMachines, containerIndex);
  const supplySources = buildSupplySourceIndex(supplyPacks, containerIndex);
  const reagentSourceIndex = combineSourceIndexes(dispenserSources, vendorSources, supplySources);

  const recipes = recipeDefinitions.map((definition) => normalizeRecipe(definition, reagentIndex, reagentSourceIndex));
  recipes.sort((a, b) => a.name.localeCompare(b.name));

  for (const recipe of recipes) {
    recipe.requiredRecipes = [];
    recipe.dependentRecipes = [];
  }

  const producedBy = new Map();
  for (const recipe of recipes) {
    const primaryResults = selectPrimaryResults(recipe);
    for (const result of primaryResults) {
      if (!producedBy.has(result.path)) {
        producedBy.set(result.path, []);
      }
      producedBy.get(result.path).push(recipe);
    }
  }

  for (const recipe of recipes) {
    const requiredMap = new Map();
    for (const item of recipe.requiredReagents) {
      const producers = producedBy.get(item.path);
      if (!producers) {
        continue;
      }
      for (const producer of producers) {
        if (producer.id === recipe.id) {
          continue;
        }
        if (!requiredMap.has(producer.id)) {
          requiredMap.set(producer.id, {
            id: producer.id,
            name: producer.name,
            path: producer.path
          });
        }
        if (!producer.dependentRecipes.some((entry) => entry.id === recipe.id)) {
          producer.dependentRecipes.push({
            id: recipe.id,
            name: recipe.name,
            path: recipe.path
          });
        }
      }
    }
    recipe.requiredRecipes = Array.from(requiredMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  for (const recipe of recipes) {
    recipe.dependentRecipes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    recipes,
    reagents: Array.from(reagentIndex.entries()).map(([path, details]) => ({
      path,
      name: details.name ?? deriveDisplayName(path, reagentIndex),
      description: details.description ?? details.tasteDescription ?? null,
      color: details.color ?? null,
      boozePower: details.boozePower ?? null,
      sources: (reagentSourceIndex.get(path) ?? []).map((source) => ({ ...source }))
    })),
    ingredients: buildIngredientIndex(recipes, reagentIndex, reagentSourceIndex)
  };
}

class RecipeDataCache {
  constructor() {
    this.cache = null;
    this.lastError = null;
    this.loading = null;
  }

  async load(force = false) {
    if (this.cache && !force) {
      return this.cache;
    }
    if (this.loading) {
      return this.loading;
    }
    this.loading = fetchRecipeDataset()
      .then((data) => {
        this.cache = {
          ...data,
          fetchedAt: new Date().toISOString()
        };
        this.lastError = null;
        return this.cache;
      })
      .catch((error) => {
        this.lastError = error;
        throw error;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  async refresh() {
    return this.load(true);
  }
}

export const recipeDataCache = new RecipeDataCache();
export async function getRecipeDataset() {
  return recipeDataCache.load();
}
