#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { PNG } from "pngjs";
import { GifCodec, GifFrame, BitmapImage } from "gifwrap";
import { inflateSync } from "zlib";

const SOURCES = [
  {
    key: "icons/obj/drinks.dmi",
    url: "https://raw.githubusercontent.com/BlueMoon-Labs/BlueMoon-Station/master/icons/obj/drinks.dmi"
  },
  {
    key: "modular_bluemoon/icons/obj/drinks.dmi",
    url: "https://raw.githubusercontent.com/BlueMoon-Labs/BlueMoon-Station/master/modular_bluemoon/icons/obj/drinks.dmi"
  },
  {
    key: "modular_splurt/icons/obj/drinks.dmi",
    url: "https://raw.githubusercontent.com/BlueMoon-Labs/BlueMoon-Station/master/modular_splurt/icons/obj/drinks.dmi"
  },
  {
    key: "modular_sand/icons/obj/drinks.dmi",
    url: "https://raw.githubusercontent.com/BlueMoon-Labs/BlueMoon-Station/master/modular_sand/icons/obj/drinks.dmi"
  }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_ROOT = path.resolve(__dirname, "../public");
const OUTPUT_ROOT = path.resolve(PUBLIC_ROOT, "assets/drinks");
const MANIFEST_PATH = path.resolve(OUTPUT_ROOT, "manifest.json");
const LICENSE_INFO = {
  sourceRepository: "BlueMoon-Labs/BlueMoon-Station",
  license: "CC-BY-SA-3.0",
  attribution: "Drink sprites © BlueMoon-Labs/BlueMoon-Station (CC BY-SA 3.0)."
};

const gifCodec = new GifCodec();

async function ensureCleanOutput() {
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
}

async function downloadDmi(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractDescriptionChunk(buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, pngSignature.length).equals(pngSignature)) {
    throw new Error("File is not a valid PNG/DMI asset");
  }
  let offset = pngSignature.length;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.slice(offset, offset + 4).toString("latin1");
    offset += 4;
    const data = buffer.slice(offset, offset + length);
    offset += length;
    offset += 4; // skip CRC
    if (type === "tEXt") {
      const separator = data.indexOf(0);
      if (separator === -1) {
        continue;
      }
      const keyword = data.slice(0, separator).toString("latin1");
      if (keyword !== "Description") {
        continue;
      }
      const description = data.slice(separator + 1).toString("utf8");
      if (description.includes("# BEGIN DMI")) {
        return description;
      }
    }
    if (type === "zTXt") {
      const separator = data.indexOf(0);
      if (separator === -1) {
        continue;
      }
      const keyword = data.slice(0, separator).toString("latin1");
      if (keyword !== "Description") {
        continue;
      }
      const method = data.readUInt8(separator + 1);
      if (method !== 0) {
        continue;
      }
      const compressed = data.slice(separator + 2);
      try {
        const description = inflateSync(compressed).toString("utf8");
        if (description.includes("# BEGIN DMI")) {
          return description;
        }
      } catch {
        // ignore invalid compressed payloads
      }
    }
    if (type === "iTXt") {
      let cursor = 0;
      const keywordEnd = data.indexOf(0, cursor);
      if (keywordEnd === -1) {
        continue;
      }
      const keyword = data.slice(cursor, keywordEnd).toString("latin1");
      cursor = keywordEnd + 1;
      const compressionFlag = data.readUInt8(cursor);
      cursor += 1;
      const compressionMethod = data.readUInt8(cursor);
      cursor += 1;
      const languageEnd = data.indexOf(0, cursor);
      cursor = languageEnd === -1 ? data.length : languageEnd + 1;
      const translatedEnd = data.indexOf(0, cursor);
      cursor = translatedEnd === -1 ? data.length : translatedEnd + 1;
      const textBuffer = data.slice(cursor);
      if (keyword !== "Description") {
        continue;
      }
      try {
        const description = compressionFlag
          ? inflateSync(textBuffer).toString("utf8")
          : textBuffer.toString("utf8");
        if (description.includes("# BEGIN DMI")) {
          return description;
        }
      } catch {
        // ignore failures and continue scanning
      }
    }
    if (type === "IEND") {
      break;
    }
  }
  throw new Error("Description chunk not found in DMI");
}

function parseQuotedValue(text) {
  const match = text.match(/=\s*"([^"\\]|\\.)*"/);
  if (match) {
    const raw = match[0];
    return raw.slice(raw.indexOf("\"") + 1, -1).replace(/\\\"/g, "\"");
  }
  const alt = text.match(/=\s*'([^'\\]|\\.)*'/);
  if (alt) {
    const raw = alt[0];
    return raw.slice(raw.indexOf("'") + 1, -1).replace(/\\'/g, "'");
  }
  const eq = text.indexOf("=");
  return eq === -1 ? null : text.slice(eq + 1).trim();
}

function parseNumericValue(text) {
  const eq = text.indexOf("=");
  if (eq === -1) {
    return null;
  }
  const raw = text.slice(eq + 1).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function parseDelayList(raw, frameCount) {
  if (!raw) {
    return Array.from({ length: frameCount }, () => 1);
  }
  const cleaned = raw.replace(/["'()]/g, "").trim();
  if (!cleaned) {
    return Array.from({ length: frameCount }, () => 1);
  }
  const parts = cleaned
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!parts.length) {
    return Array.from({ length: frameCount }, () => 1);
  }
  const result = [];
  for (let i = 0; i < frameCount; i += 1) {
    result.push(parts[i] ?? parts[parts.length - 1] ?? 1);
  }
  return result;
}

function parseDmiMetadata(description) {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const metadata = {
    width: 32,
    height: 32,
    states: []
  };

  let current = null;

  const finalizeState = () => {
    if (!current) {
      return;
    }
    current.frames = Math.max(1, current.frames ?? 1);
    current.dirs = Math.max(1, current.dirs ?? 1);
    current.delays = parseDelayList(current.delayRaw, current.frames);
    metadata.states.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith("width")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed) && parsed > 0) {
        metadata.width = parsed;
      }
      continue;
    }
    if (line.startsWith("height")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed) && parsed > 0) {
        metadata.height = parsed;
      }
      continue;
    }
    if (line.startsWith("state")) {
      finalizeState();
      current = {
        name: parseQuotedValue(line) ?? "",
        frames: 1,
        dirs: 1,
        delayRaw: null,
        delays: [],
        loop: null,
        rewind: null
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("dirs")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed) && parsed > 0) {
        current.dirs = parsed;
      }
      continue;
    }
    if (line.startsWith("frames")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed) && parsed > 0) {
        current.frames = parsed;
      }
      continue;
    }
    if (line.startsWith("delay")) {
      current.delayRaw = parseQuotedValue(line) ?? line;
      continue;
    }
    if (line.startsWith("loop")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed)) {
        current.loop = parsed;
      }
      continue;
    }
    if (line.startsWith("rewind")) {
      const parsed = parseNumericValue(line);
      if (Number.isFinite(parsed)) {
        current.rewind = parsed;
      }
    }
  }

  finalizeState();
  return metadata;
}

function sanitizeSegment(value, fallback) {
  if (!value) {
    return fallback;
  }
  const normalized = value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length ? normalized : fallback;
}

function deriveDirectoryName(iconPath) {
  const normalized = iconPath.replace(/\\/g, "/").replace(/^\.\//, "");
  const withoutExt = normalized.replace(/\.[^.]+$/, "");
  return sanitizeSegment(withoutExt, "drinks");
}

function deriveFileName(stateName, used) {
  const base = sanitizeSegment(stateName, "state");
  if (!used.has(base)) {
    used.add(base);
    return `${base}.gif`;
  }
  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  const unique = `${base}-${index}`;
  used.add(unique);
  return `${unique}.gif`;
}

function extractFrame(sheet, x, y, width, height) {
  const frame = new PNG({ width, height });
  const bytesPerPixel = 4;
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * sheet.width + x) * bytesPerPixel;
    const sourceEnd = sourceStart + width * bytesPerPixel;
    const targetStart = row * width * bytesPerPixel;
    sheet.data.copy(frame.data, targetStart, sourceStart, sourceEnd);
  }
  return frame;
}

async function writeGif(frames, delays, width, height, loop) {
  const gifFrames = frames.map((frame, index) => {
    const delay = delays[index] ?? delays[delays.length - 1] ?? 1;
    const delayCentisecs = Math.max(1, Math.round(delay * 10));
    const bitmap = new BitmapImage({ width, height, data: Buffer.from(frame.data) });
    return new GifFrame(bitmap, { delayCentisecs });
  });
  const gif = await gifCodec.encodeGif(gifFrames, {
    loops: loop == null || loop < 0 ? 0 : Math.max(0, Math.floor(loop))
  });
  return gif.buffer;
}

async function processSource(source, manifest) {
  console.log(`Extracting ${source.key}...`);
  const buffer = await downloadDmi(source.url);
  const description = extractDescriptionChunk(buffer);
  const metadata = parseDmiMetadata(description);
  const sheet = PNG.sync.read(buffer);
  const framesPerRow = Math.floor(sheet.width / metadata.width);
  if (!framesPerRow) {
    throw new Error(`Unable to determine frame layout for ${source.key}`);
  }
  const directoryName = deriveDirectoryName(source.key);
  const outputDir = path.resolve(OUTPUT_ROOT, directoryName);
  await fs.mkdir(outputDir, { recursive: true });
  const stateManifest = {};
  const usedNames = new Set();
  let tileIndex = 0;

  for (const state of metadata.states) {
    const totalTiles = state.frames * state.dirs;
    const visibleFrames = Math.max(1, state.frames);
    const delays = state.delays.slice(0, visibleFrames);
    const frames = [];
    for (let frameIndex = 0; frameIndex < visibleFrames; frameIndex += 1) {
      const tile = tileIndex + frameIndex;
      const column = tile % framesPerRow;
      const row = Math.floor(tile / framesPerRow);
      const x = column * metadata.width;
      const y = row * metadata.height;
      frames.push(extractFrame(sheet, x, y, metadata.width, metadata.height));
    }
    tileIndex += totalTiles;

    if (!frames.length) {
      continue;
    }

    const fileName = deriveFileName(state.name, usedNames);
    const gifBuffer = await writeGif(frames, delays, metadata.width, metadata.height, state.loop);
    const outputPath = path.resolve(outputDir, fileName);
    await fs.writeFile(outputPath, gifBuffer);
    const relativeFile = path.relative(PUBLIC_ROOT, outputPath).replace(/\\/g, "/");

    stateManifest[state.name] = {
      file: relativeFile,
      width: metadata.width,
      height: metadata.height,
      frameCount: frames.length,
      delayCentisecs: delays.map((value) => Math.max(1, Math.round(value * 10))),
      loop: state.loop ?? null,
      directions: state.dirs,
      framesPerDirection: state.frames
    };
  }

  manifest.icons[source.key] = {
    _meta: {
      url: source.url
    },
    ...stateManifest
  };
  console.log(`  → ${Object.keys(stateManifest).length} states written to ${path.relative(PUBLIC_ROOT, outputDir)}`);
}

async function main() {
  await ensureCleanOutput();
  const manifest = {
    meta: {
      ...LICENSE_INFO,
      generatedAt: new Date().toISOString(),
      sourceFiles: SOURCES.map((source) => source.url)
    },
    icons: {}
  };

  for (const source of SOURCES) {
    await processSource(source, manifest);
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Manifest written to ${path.relative(PUBLIC_ROOT, MANIFEST_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
