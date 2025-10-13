import { stripByondFormatting, toTitleCase } from "./recipeNormalization.js";

export const SOURCE_TIERS = [
  { key: "base", label: "Base", order: 0 },
  { key: "upgrade1", label: "Upgrade Tier 1", order: 1 },
  { key: "upgrade2", label: "Upgrade Tier 2", order: 2 },
  { key: "upgrade3", label: "Upgrade Tier 3", order: 3 },
  { key: "upgrade4", label: "Upgrade Tier 4", order: 4 },
  { key: "emag", label: "Emag", order: 5 }
];

export function deriveMachineDisplayName(path, explicitName) {
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

export function buildReagentSourceIndex(machines) {
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

export function deriveItemDisplayName(path, explicitName) {
  return deriveMachineDisplayName(path, explicitName);
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

export function buildVendorSourceIndex(vendingMachines, containerIndex) {
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
        if (exists) {
          continue;
        }
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
  return map;
}

export function buildSupplySourceIndex(supplyPacks, containerIndex) {
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

export function combineSourceIndexes(...indexes) {
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
