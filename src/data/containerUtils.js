import { resolveIconAsset } from "./iconManifest.js";
import { selectPrimaryResults } from "./recipeNormalization.js";

export function mergeContainerMaps(...maps) {
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
          reagents: details.reagents.map((entry) => ({ ...entry })),
          icon: details.icon ?? null,
          iconState: details.iconState ?? null,
          glassIcon: details.glassIcon ?? null,
          glassIconState: details.glassIconState ?? null
        });
        continue;
      }
      const existing = merged.get(path);
      if (!existing) {
        continue;
      }
      if (!existing.icon && details.icon) {
        existing.icon = details.icon;
      }
      if (!existing.iconState && details.iconState) {
        existing.iconState = details.iconState;
      }
      if (!existing.glassIcon && details.glassIcon) {
        existing.glassIcon = details.glassIcon;
      }
      if (!existing.glassIconState && details.glassIconState) {
        existing.glassIconState = details.glassIconState;
      }
    }
  }
  return merged;
}

function indexContainersByReagent(containerIndex) {
  const map = new Map();
  if (!containerIndex || typeof containerIndex.values !== "function") {
    return map;
  }
  for (const container of containerIndex.values()) {
    if (!container || !Array.isArray(container.reagents)) {
      continue;
    }
    for (const reagent of container.reagents) {
      const key = reagent?.path?.trim();
      if (!key || map.has(key)) {
        continue;
      }
      map.set(key, container);
    }
  }
  return map;
}

export function attachRecipeIcons(recipes, containerIndex, iconManifest, reagentIndex) {
  if (!Array.isArray(recipes) || !iconManifest) {
    return;
  }
  const containersByReagent = indexContainersByReagent(containerIndex);
  const lookupContainer = (resultPath) => {
    if (!resultPath) {
      return null;
    }
    if (containerIndex?.get && containerIndex.get(resultPath)) {
      return containerIndex.get(resultPath);
    }
    return containersByReagent.get(resultPath) ?? null;
  };
  for (const recipe of recipes) {
    const primaryResults = selectPrimaryResults(recipe);
    if (!primaryResults.length) {
      continue;
    }
    let assigned = false;
    if (reagentIndex instanceof Map) {
      for (const result of primaryResults) {
        const reagent = reagentIndex.get(result.path);
        if (!reagent) {
          continue;
        }
        const resolved = resolveIconAsset(reagent, iconManifest, { origin: "reagent" });
        if (!resolved) {
          continue;
        }
        recipe.icon = {
          ...resolved,
          reagentPath: reagent.path ?? null
        };
        assigned = true;
        break;
      }
    }
    if (assigned) {
      continue;
    }
    for (const result of primaryResults) {
      const container = lookupContainer(result.path);
      if (!container) {
        continue;
      }
      const resolved = resolveIconAsset(container, iconManifest, { origin: "container" });
      if (!resolved) {
        continue;
      }
      recipe.icon = {
        ...resolved,
        containerPath: container.path ?? null
      };
      assigned = true;
      break;
    }
  }
}
