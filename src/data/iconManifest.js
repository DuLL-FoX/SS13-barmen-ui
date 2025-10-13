import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICON_MANIFEST_PATH = path.resolve(__dirname, "../../public/assets/drinks/manifest.json");
const ICON_SOURCE_PRIORITY = [
  "icons/obj/drinks.dmi",
  "modular_bluemoon/icons/obj/drinks.dmi",
  "modular_splurt/icons/obj/drinks.dmi",
  "modular_sand/icons/obj/drinks.dmi"
];

let iconManifestLoaded = false;
let iconManifestCache = null;

export function loadIconManifest() {
  if (iconManifestLoaded) {
    return iconManifestCache;
  }
  iconManifestLoaded = true;
  if (!existsSync(ICON_MANIFEST_PATH)) {
    return null;
  }
  try {
    const raw = readFileSync(ICON_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      iconManifestCache = parsed;
      return iconManifestCache;
    }
  } catch (error) {
    console.warn(`Failed to read drink icon manifest: ${error.message}`);
  }
  iconManifestCache = null;
  return iconManifestCache;
}

function iconSourcePriority(iconPath) {
  if (!iconPath) {
    return ICON_SOURCE_PRIORITY.length + 1;
  }
  const normalized = iconPath.replace(/\\/g, "/");
  const directIndex = ICON_SOURCE_PRIORITY.findIndex((candidate) => normalized === candidate);
  if (directIndex !== -1) {
    return directIndex;
  }
  const suffixIndex = ICON_SOURCE_PRIORITY.findIndex((candidate) => normalized.endsWith(candidate));
  if (suffixIndex !== -1) {
    return suffixIndex;
  }
  return ICON_SOURCE_PRIORITY.length + 1;
}

function findManifestStates(manifestIcons, iconPath) {
  if (!manifestIcons || typeof manifestIcons !== "object" || !iconPath) {
    return null;
  }
  const normalized = iconPath.replace(/\\/g, "/");
  const candidates = new Set([iconPath, normalized]);
  if (normalized.startsWith("./")) {
    candidates.add(normalized.slice(2));
  } else {
    candidates.add(`./${normalized}`);
  }
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(manifestIcons, candidate)) {
      return {
        icon: candidate,
        states: manifestIcons[candidate]
      };
    }
  }
  return null;
}

function selectManifestStateEntry(states, desiredState, { allowAny = false } = {}) {
  if (!states || typeof states !== "object") {
    return null;
  }
  const entries = Object.entries(states).filter(
    ([key, value]) => key !== "_meta" && value && typeof value === "object"
  );
  if (!entries.length) {
    return null;
  }
  if (desiredState) {
    if (states[desiredState] && typeof states[desiredState] === "object") {
      return { stateName: desiredState, entry: states[desiredState] };
    }
    const lowered = desiredState.toLowerCase();
    const match = entries.find(([key]) => key.toLowerCase() === lowered);
    if (match) {
      return { stateName: match[0], entry: match[1] };
    }
  }
  if (!allowAny) {
    return null;
  }
  const fallback = entries[0];
  return { stateName: fallback[0], entry: fallback[1] };
}

function findManifestEntryByState(manifestIcons, stateName) {
  if (!manifestIcons || typeof manifestIcons !== "object" || !stateName) {
    return null;
  }
  const trimmed = stateName.trim();
  if (!trimmed.length) {
    return null;
  }
  const iconEntries = Object.entries(manifestIcons)
    .filter(([iconKey, states]) => iconKey && states && typeof states === "object")
    .sort((a, b) => iconSourcePriority(a[0]) - iconSourcePriority(b[0]));
  for (const [iconKey, states] of iconEntries) {
    const selection = selectManifestStateEntry(states, trimmed, { allowAny: false });
    if (selection) {
      return {
        icon: iconKey,
        stateName: selection.stateName,
        entry: selection.entry,
        states
      };
    }
  }
  return null;
}

export function resolveIconAsset(entity, manifest, { origin = "container" } = {}) {
  if (!entity || !manifest) {
    return null;
  }
  const manifestIcons = manifest.icons ?? manifest;
  const meta = manifest.meta ?? {};
  const candidates = [];
  const label = entity.name ?? entity.displayName ?? null;
  const sourcePath = entity.path ?? null;
  if (entity.glassIcon || entity.glassIconState) {
    candidates.push({ icon: entity.glassIcon ?? null, state: entity.glassIconState ?? null, kind: "glass" });
  }
  if (entity.icon || entity.iconState) {
    candidates.push({ icon: entity.icon ?? null, state: entity.iconState ?? null, kind: "default" });
  }
  for (const candidate of candidates) {
    let selection = null;
    if (candidate.icon) {
      const located = findManifestStates(manifestIcons, candidate.icon);
      if (located && located.states) {
        const chosen = selectManifestStateEntry(located.states, candidate.state, { allowAny: true });
        if (chosen) {
          selection = {
            icon: located.icon,
            stateName: chosen.stateName,
            entry: chosen.entry,
            states: located.states
          };
        }
      }
    }
    if (!selection && candidate.state) {
      selection = findManifestEntryByState(manifestIcons, candidate.state);
    }
    if (!selection || !selection.entry || !selection.entry.file) {
      continue;
    }
    const relativePath = selection.entry.file.startsWith("/")
      ? selection.entry.file.slice(1)
      : selection.entry.file;
    const src = `/${relativePath}`.replace(/\/+/g, "/");
    const iconMeta = selection.states?._meta ?? {};
    return {
      src,
      width: selection.entry.width ?? null,
      height: selection.entry.height ?? null,
      frameCount: selection.entry.frameCount ?? null,
      delayCentisecs: Array.isArray(selection.entry.delayCentisecs)
        ? selection.entry.delayCentisecs
        : null,
      loop: selection.entry.loop ?? null,
      directions: selection.entry.directions ?? null,
      framesPerDirection: selection.entry.framesPerDirection ?? null,
      sourceIcon: selection.icon ?? candidate.icon ?? null,
      state: selection.stateName ?? candidate.state ?? null,
      label,
      kind: candidate.kind,
      origin,
      sourcePath,
      attribution: selection.entry.attribution ?? iconMeta.attribution ?? meta.attribution ?? null,
      license: selection.entry.license ?? iconMeta.license ?? meta.license ?? null,
      sourceRepository:
        selection.entry.sourceRepository ?? iconMeta.sourceRepository ?? meta.sourceRepository ?? null,
      sourceUrl: selection.entry.sourceUrl ?? iconMeta.url ?? meta.sourceUrl ?? null
    };
  }
  return null;
}
