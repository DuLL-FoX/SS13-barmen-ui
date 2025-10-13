import { readFileSync } from "fs";

const ESCAPE_CHAR = "\\";

function stripLineComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (char === "'" && !inDouble && prev !== ESCAPE_CHAR) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== ESCAPE_CHAR) {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && char === "/" && line[i + 1] === "/") {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

function stripStrings(text) {
  return text.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, "");
}

function updateDepth(state, text) {
  const clean = stripStrings(text);
  for (const char of clean) {
    if (char === "(") {
      state.depth += 1;
    } else if (char === ")") {
      state.depth -= 1;
    }
  }
}

function collectListBlock(lines, startIndex) {
  const remaining = lines.slice(startIndex).map(stripLineComment);
  const combined = remaining.join("\n");
  const listMatch = combined.match(/\blist\s*\(/);
  if (!listMatch) {
    return {
      inner: "",
      nextIndex: Math.min(startIndex + 1, lines.length)
    };
  }

  const startPos = listMatch.index + listMatch[0].length;
  let depth = 1;
  let index = startPos;
  let inSingle = false;
  let inDouble = false;
  while (index < combined.length && depth > 0) {
    const char = combined[index];
    const prev = index > 0 ? combined[index - 1] : "";
    if (char === "'" && !inDouble && prev !== ESCAPE_CHAR) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && prev !== ESCAPE_CHAR) {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble) {
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
    }
    index += 1;
  }

  const inner = combined.slice(startPos, Math.max(startPos, index - 1)).trim();
  const consumed = combined.slice(0, index);
  const newlineCount = consumed.split("\n").length - 1;
  const nextIndex = Math.min(startIndex + newlineCount + 1, lines.length);

  return {
    inner,
    nextIndex
  };
}

function splitTopLevel(text, delimiter = ",") {
  const parts = [];
  let chunk = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const prev = i > 0 ? text[i - 1] : "";
    if (char === "'" && !inDouble && prev !== ESCAPE_CHAR) {
      inSingle = !inSingle;
      chunk += char;
      continue;
    }
    if (char === '"' && !inSingle && prev !== ESCAPE_CHAR) {
      inDouble = !inDouble;
      chunk += char;
      continue;
    }
    if (inSingle || inDouble) {
      chunk += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      chunk += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      chunk += char;
      continue;
    }
    if (char === delimiter && depth === 0) {
      const trimmed = chunk.trim();
      if (trimmed.length > 0) {
        parts.push(trimmed);
      }
      chunk = "";
      continue;
    }
    chunk += char;
  }
  const finalChunk = chunk.trim();
  if (finalChunk.length > 0) {
    parts.push(finalChunk);
  }
  return parts;
}

function parseListEntries(text) {
  const lines = text
    .split("\n")
    .map(stripLineComment)
    .join(" ");
  const items = splitTopLevel(lines);
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const eqIndex = item.indexOf("=");
      if (eqIndex === -1) {
        return {
          path: item.trim(),
          quantity: 1
        };
      }
      const path = item.slice(0, eqIndex).trim();
      const rawValue = item.slice(eqIndex + 1).trim();
      const quantity = Number.parseFloat(rawValue);
      return {
        path,
        quantity: Number.isFinite(quantity) ? quantity : rawValue
      };
    });
}

function extractStringValue(line) {
  const double = line.match(/=\s*"([^"\\]|\\.)*"/);
  if (double) {
    const value = double[0].slice(double[0].indexOf('"') + 1, -1);
    return value.replace(/\\"/g, '"');
  }
  const single = line.match(/=\s*'([^'\\]|\\.)*'/);
  if (single) {
    const value = single[0].slice(single[0].indexOf("'") + 1, -1);
    return value.replace(/\\'/g, "'");
  }
  return null;
}

function extractPathValue(line) {
  const stripped = stripLineComment(line);
  const eqIndex = stripped.indexOf("=");
  if (eqIndex === -1) {
    return stripped.trim();
  }
  return stripped
    .slice(eqIndex + 1)
    .trim()
    .replace(/,$/, "");
}

function extractNumericValue(line) {
  const stripped = stripLineComment(line);
  const eqIndex = stripped.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }
  const raw = stripped.slice(eqIndex + 1).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseChemicalReactions(dmText) {
  const lines = dmText.split(/\r?\n/);
  const recipes = [];
  let current = null;
  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("//")) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("/datum/chemical_reaction")) {
      if (current && current.name) {
        recipes.push(current);
      }
      const path = trimmed.split(/\s+/)[0];
      current = {
        path,
        name: null,
        id: null,
        results: [],
        requiredReagents: [],
        requiredCatalysts: [],
        mixMessage: null,
        mixSound: null,
        requiredTemp: null,
        requiredTempHigh: null,
        requiredPressure: null,
        requiredPhMin: null,
        requiredPhMax: null,
        notes: []
      };
      index += 1;
      continue;
    }
    if (!current) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      index += 1;
      continue;
    }
    if (trimmed.startsWith("id")) {
      current.id = extractPathValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("results")) {
      const { inner, nextIndex } = collectListBlock(lines, index);
      current.results = parseListEntries(inner);
      index = nextIndex;
      continue;
    }
    if (trimmed.startsWith("required_reagents")) {
      const { inner, nextIndex } = collectListBlock(lines, index);
      current.requiredReagents = parseListEntries(inner);
      index = nextIndex;
      continue;
    }
    if (trimmed.startsWith("required_catalysts")) {
      const { inner, nextIndex } = collectListBlock(lines, index);
      current.requiredCatalysts = parseListEntries(inner);
      index = nextIndex;
      continue;
    }
    if (trimmed.startsWith("mix_message")) {
      current.mixMessage = extractStringValue(trimmed) ?? stripLineComment(trimmed).split("=")[1]?.trim();
      index += 1;
      continue;
    }
    if (trimmed.startsWith("mix_sound")) {
      current.mixSound = extractStringValue(trimmed) ?? extractPathValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("required_temp_high")) {
      current.requiredTempHigh = extractNumericValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("required_temp")) {
      current.requiredTemp = extractNumericValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("required_pressure")) {
      current.requiredPressure = extractNumericValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("required_ph_min")) {
      current.requiredPhMin = extractNumericValue(trimmed);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("required_ph_max")) {
      current.requiredPhMax = extractNumericValue(trimmed);
      index += 1;
      continue;
    }
    const noteLine = stripLineComment(trimmed);
    if (noteLine) {
      current.notes.push(noteLine);
    }
    index += 1;
  }
  if (current && current.name) {
    recipes.push(current);
  }
  return recipes;
}

export function parseReagents(dmText) {
  const lines = dmText.split(/\r?\n/);
  const reagents = new Map();
  let current = null;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("//")) {
      continue;
    }
    if (trimmed.startsWith("/datum/reagent")) {
      if (current) {
        reagents.set(current.path, current);
      }
      const path = trimmed.split(/\s+/)[0];
      current = {
        path,
        name: null,
        description: null,
        tasteDescription: null,
        color: null,
        boozePower: null
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      continue;
    }
    if (trimmed.startsWith("description")) {
      current.description = extractStringValue(trimmed) ?? current.description;
      continue;
    }
    if (trimmed.startsWith("taste_description")) {
      current.tasteDescription = extractStringValue(trimmed) ?? current.tasteDescription;
      continue;
    }
    if (trimmed.startsWith("glass_desc")) {
      current.description = current.description ?? extractStringValue(trimmed);
      continue;
    }
    if (trimmed.startsWith("color")) {
      current.color = extractStringValue(trimmed) ?? extractPathValue(trimmed);
      continue;
    }
    if (trimmed.startsWith("boozepwr")) {
      current.boozePower = extractNumericValue(trimmed) ?? current.boozePower;
    }
  }
  if (current) {
    reagents.set(current.path, current);
  }
  return reagents;
}

const DISPENSER_TIER_PROPS = [
  { property: "dispensable_reagents", key: "base", label: "Base" },
  { property: "upgrade_reagents", key: "upgrade1", label: "Upgrade Tier 1" },
  { property: "upgrade_reagents2", key: "upgrade2", label: "Upgrade Tier 2" },
  { property: "upgrade_reagents3", key: "upgrade3", label: "Upgrade Tier 3" },
  { property: "upgrade_reagents4", key: "upgrade4", label: "Upgrade Tier 4" },
  { property: "emagged_reagents", key: "emag", label: "Emag" }
];

export function parseChemDispenserSources(dmText) {
  const lines = dmText.split(/\r?\n/);
  const machines = [];
  let current = null;
  let index = 0;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    const tiers = DISPENSER_TIER_PROPS.map((tier) => {
      const entries = current.tiers.get(tier.key) ?? [];
      const unique = Array.from(new Set(entries.filter(Boolean)));
      if (!unique.length) {
        return null;
      }
      unique.sort();
      return {
        key: tier.key,
        label: tier.label,
        reagents: unique
      };
    }).filter(Boolean);
    if (tiers.length) {
      machines.push({
        path: current.path,
        name: current.name,
        tiers
      });
    }
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("/obj/machinery/chem_dispenser")) {
      if (current) {
        finalizeCurrent();
      }
      const path = trimmed.split(/\s+/)[0];
      if (path.includes("/proc/") || path.includes("/verb/") || path.includes("(") || path.includes(")")) {
        current = null;
        index += 1;
        continue;
      }
      current = {
        path,
        name: null,
        tiers: new Map()
      };
      index += 1;
      continue;
    }
    if (!current) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      index += 1;
      continue;
    }
    const tier = DISPENSER_TIER_PROPS.find((entry) => trimmed.startsWith(entry.property));
    if (tier) {
      if (trimmed.includes("= null")) {
        current.tiers.set(tier.key, current.tiers.get(tier.key) ?? []);
        index += 1;
        continue;
      }
      const { inner, nextIndex } = collectListBlock(lines, index);
      const entries = parseListEntries(inner)
        .map((item) => item.path?.trim())
        .filter(Boolean);
      const existing = current.tiers.get(tier.key) ?? [];
      current.tiers.set(tier.key, existing.concat(entries));
      index = nextIndex;
      continue;
    }
    index += 1;
  }

  if (current) {
    finalizeCurrent();
  }

  return machines;
}

export function parseStructureReagentDispensers(dmText) {
  const lines = dmText.split(/\r?\n/);
  const machines = [];
  let current = null;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    const reagents = Array.from(new Set(current.reagents)).filter(Boolean);
    if (!reagents.length) {
      current = null;
      return;
    }
    machines.push({
      path: current.path,
      name: current.name,
      tiers: [
        {
          key: "base",
          label: "Base",
          reagents
        }
      ]
    });
    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    if (trimmed.startsWith("/obj/structure/reagent_dispensers")) {
      const path = trimmed.split(/\s+/)[0];
      if (path.includes("/proc/") || path.includes("/verb/") || path.includes("(") || path.includes(")")) {
        continue;
      }
      if (current) {
        finalizeCurrent();
      }
      current = {
        path,
        name: null,
        reagents: []
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (trimmed.startsWith("/obj/") && !trimmed.startsWith("/obj/structure/reagent_dispensers")) {
      finalizeCurrent();
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      continue;
    }
    if (trimmed.startsWith("reagent_id")) {
      if (trimmed.includes("= null")) {
        current.reagents = [];
        continue;
      }
      const reagent = extractPathValue(trimmed);
      if (reagent) {
        current.reagents.push(reagent);
      }
      continue;
    }
  }

  if (current) {
    finalizeCurrent();
  }

  return machines;
}

export function parseDrinkContainers(dmText) {
  const lines = dmText.split(/\r?\n/);
  const containers = new Map();
  let current = null;
  let index = 0;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    if (current.reagents.length) {
      containers.set(current.path, {
        path: current.path,
        name: current.name,
        reagents: current.reagents
      });
    }
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("/obj/item/reagent_containers/")) {
      const path = trimmed.split(/\s+/)[0];
      if (!path.includes("/proc/") && !path.includes("/verb/") && !path.includes("(") && !path.includes(")")) {
        if (current) {
          finalizeCurrent();
        }
        current = {
          path,
          name: null,
          reagents: []
        };
        index += 1;
        continue;
      }
    }

    if (!current) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("/obj/item") && !trimmed.startsWith("/obj/item/reagent_containers/")) {
      finalizeCurrent();
      current = null;
      index += 1;
      continue;
    }

    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      index += 1;
      continue;
    }
    if (trimmed.startsWith("list_reagents")) {
      if (trimmed.includes("= null")) {
        current.reagents = [];
        index += 1;
        continue;
      }
      const { inner, nextIndex } = collectListBlock(lines, index);
      const entries = parseListEntries(inner).map((entry) => ({
        path: entry.path,
        quantity: entry.quantity
      }));
      current.reagents = entries.filter((entry) => entry.path);
      index = nextIndex;
      continue;
    }
    index += 1;
  }

  if (current) {
    finalizeCurrent();
  }

  return containers;
}

export function parseVendingMachines(dmText) {
  const lines = dmText.split(/\r?\n/);
  const machines = [];
  let current = null;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    const items = Array.from(current.items).filter(Boolean).sort();
    if (items.length) {
      machines.push({
        path: current.path,
        name: current.name,
        items
      });
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    if (trimmed.startsWith("/obj/machinery/vending")) {
      const path = trimmed.split(/\s+/)[0];
      if (path.includes("/proc/") || path.includes("/verb/") || path.includes("(") || path.includes(")")) {
        continue;
      }
      if (current) {
        finalizeCurrent();
      }
      current = {
        path,
        name: null,
        items: new Set()
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (trimmed.startsWith("/obj/machinery") && !trimmed.startsWith("/obj/machinery/vending")) {
      finalizeCurrent();
      current = null;
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      continue;
    }

    const matches = trimmed.match(/\/(obj\/item\/reagent_containers[^\s,]*)/g);
    if (matches) {
      for (const match of matches) {
        const path = match.trim();
        if (path.startsWith("/obj/item/reagent_containers")) {
          current.items.add(path);
        }
      }
    }
  }

  if (current) {
    finalizeCurrent();
  }

  return machines;
}

export function parseSupplyPacks(dmText) {
  const lines = dmText.split(/\r?\n/);
  const packs = [];
  let current = null;
  let index = 0;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    const contents = current.contents.filter((entry) => entry.path);
    if (contents.length) {
      packs.push({
        path: current.path,
        name: current.name,
        crateName: current.crateName,
        cost: current.cost,
        contents
      });
    }
    current = null;
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("/datum/supply_pack")) {
      const path = trimmed.split(/\s+/)[0];
      if (path.includes("/proc/") || path.includes("/verb/") || path.includes("(") || path.includes(")")) {
        index += 1;
        continue;
      }
      if (current) {
        finalizeCurrent();
      }
      current = {
        path,
        name: null,
        crateName: null,
        cost: null,
        contents: []
      };
      index += 1;
      continue;
    }
    if (!current) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("/datum/") && !trimmed.startsWith("/datum/supply_pack")) {
      finalizeCurrent();
      index += 1;
      continue;
    }
    if (trimmed.startsWith("name")) {
      current.name = extractStringValue(trimmed) ?? current.name;
      index += 1;
      continue;
    }
    if (trimmed.startsWith("crate_name")) {
      current.crateName = extractStringValue(trimmed) ?? current.crateName;
      index += 1;
      continue;
    }
    if (trimmed.startsWith("cost")) {
      const cost = extractNumericValue(trimmed);
      if (cost != null) {
        current.cost = cost;
      }
      index += 1;
      continue;
    }
    if (trimmed.startsWith("contains")) {
      if (trimmed.includes("= null")) {
        current.contents = [];
        index += 1;
        continue;
      }
      const { inner, nextIndex } = collectListBlock(lines, index);
      const entries = parseListEntries(inner).map((entry) => ({
        path: entry.path,
        quantity: entry.quantity
      }));
      current.contents = entries;
      index = nextIndex;
      continue;
    }
    index += 1;
  }

  if (current) {
    finalizeCurrent();
  }

  return packs;
}

export function hydrateFromDisk(recipePath, alcoholPath, drinkPath) {
  const recipeText = readFileSync(recipePath, "utf8");
  const alcoholText = readFileSync(alcoholPath, "utf8");
  const drinkText = readFileSync(drinkPath, "utf8");
  return {
    recipes: parseChemicalReactions(recipeText),
    alcoholReagents: parseReagents(alcoholText),
    drinkReagents: parseReagents(drinkText)
  };
}
