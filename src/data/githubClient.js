import fetch from "node-fetch";

const DEFAULT_USER_AGENT = "ss13-barmen-ui";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : "";

export function buildGithubHeaders(additional = {}) {
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

export async function fetchText(url) {
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

export async function collectGithubDirectoryFiles(directories, extensions = [".dm"]) {
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

export async function safeCollectGithubDirectoryFiles(directories, extensions, description) {
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
