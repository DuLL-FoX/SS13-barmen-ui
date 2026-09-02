import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const DEFAULT_USER_AGENT = "ss13-barmen-ui";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() || "";
const USE_LOCAL_DATA = process.env.USE_LOCAL_DATA === "true" || process.env.USE_LOCAL_DATA === "1";
const LOCAL_REPO_PATH = process.env.LOCAL_BLUEMOON_PATH || path.resolve(process.cwd(), "BlueMoon-Station");

export const SOURCE_BRANCH = "master";
export const REPO_OWNER = "BlueMoon-Labs";
export const REPO_NAME = "BlueMoon-Station";

const BASE_RAW = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${SOURCE_BRANCH}`;
const BASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

/**
 * Upstream file/folder map. Every entry is optional at runtime: a missing file or
 * folder is skipped with a warning and never takes a whole category down.
 *
 * Folders are preferred over hand-picked files wherever the upstream keeps moving
 * things between `code/`, `modular_bluemoon/`, `modular_splurt/`, `modular_sand/`
 * and `modular_citadel/`. Everything listed here mirrors what `tgstation.dme`
 * actually compiles, so overrides from every modular layer are picked up.
 */
export const SOURCES = {
  recipeFiles: [
    "code/modules/food_and_drinks/recipes/drinks_recipes.dm",
    "modular_splurt/code/modules/food_and_drinks/recipes/drink_recipes.dm",
    "modular_bluemoon/code/modules/food_and_drinks/recipes/drinks_recipes.dm",
    "code/modules/reagents/chemistry/recipes/drugs.dm",
    "modular_bluemoon/code/modules/reagents/chemistry/recipes/recipes.dm",
    "code/modules/reagents/chemistry/recipes/others.dm",
    "modular_splurt/code/modules/reagents/chemistry/recipes/others.dm",
    "modular_sand/code/modules/reagents/chemistry/recipes/others.dm"
  ],
  recipeFolders: ["modular_splurt/code/modules/food_and_drinks/recipes"],
  synthRecipeFiles: ["modular_bluemoon/code/modules/food_and_drinks/recipes/synth_drinks_recipes.dm"],
  reagentFiles: [
    "code/modules/reagents/chemistry/reagents/alcohol_reagents.dm",
    "code/modules/reagents/chemistry/reagents/drink_reagents.dm",
    "code/modules/reagents/chemistry/reagents/drug_reagents.dm",
    "code/modules/reagents/chemistry/reagents/food_reagents.dm",
    "code/modules/reagents/chemistry/reagents/other_reagents.dm",
    "code/modules/reagents/chemistry/reagents/medicine_reagents.dm",
    "code/modules/reagents/chemistry/reagents/toxin_reagents.dm"
  ],
  reagentFolders: [
    "modular_bluemoon/code/modules/reagents/chemistry/reagents",
    "modular_splurt/code/modules/reagents/chemistry/reagents",
    "modular_sand/code/modules/reagents/chemistry/reagents",
    "modular_citadel/code/modules/reagents/chemistry/reagents"
  ],
  dispenserFiles: [
    "code/modules/reagents/chemistry/machinery/chem_dispenser.dm",
    "code/modules/reagents/reagent_dispenser.dm",
    "modular_bluemoon/code/modules/reagents/reagent_dispenser.dm",
    "modular_splurt/code/modules/reagents/reagent_dispenser.dm",
    "modular_sand/code/modules/reagents/reagent_dispenser.dm"
  ],
  dispenserFolders: [
    "modular_splurt/code/modules/reagents/chemistry/machinery",
    "modular_sand/code/modules/reagents/chemistry/machinery"
  ],
  drinkContainerFiles: [
    "code/modules/food_and_drinks/drinks/drinks.dm",
    "code/modules/food_and_drinks/drinks/drinks/bottle.dm",
    "code/modules/food_and_drinks/drinks/drinks/drinkingglass.dm",
    "modular_bluemoon/code/modules/food_and_drinks/drinks/drinks.dm",
    "modular_bluemoon/code/modules/food_and_drinks/drinks/drinks/bottle.dm",
    "code/modules/reagents/reagent_containers/bottle.dm"
  ],
  drinkContainerFolders: [
    "modular_splurt/code/modules/food_and_drinks/drinks",
    "code/modules/reagents/reagent_containers",
    "modular_bluemoon/code/modules/reagents/reagent_containers"
  ],
  vendingFiles: [],
  vendingFolders: [
    "code/modules/vending",
    "modular_bluemoon/code/modules/vending",
    "modular_splurt/code/modules/vending",
    "modular_sand/code/modules/vending"
  ],
  supplyPackFiles: [],
  supplyPackFolders: [
    "code/modules/cargo/packs",
    "modular_bluemoon/code/modules/cargo/packs",
    "modular_splurt/code/modules/cargo/packs",
    "modular_sand/code/modules/cargo/packs"
  ]
};

function buildGithubHeaders(additional = {}) {
  const headers = { "User-Agent": DEFAULT_USER_AGENT, ...additional };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

function formatRateLimitMessage(response) {
  if (response?.status !== 403) return null;
  if (response.headers?.get("x-ratelimit-remaining") !== "0") return null;
  const reset = response.headers?.get("x-ratelimit-reset");
  const resetDate = reset ? new Date(Number.parseInt(reset, 10) * 1000) : null;
  const resetInfo = resetDate ? ` Rate limit resets around ${resetDate.toLocaleTimeString()}.` : "";
  const authHint = GITHUB_TOKEN
    ? " GitHub token is configured but the limit has still been reached."
    : " Provide a personal access token via the GITHUB_TOKEN environment variable.";
  return `GitHub rate limit exceeded.${authHint}${resetInfo}`;
}

async function hasLocalRepository(repoPath = LOCAL_REPO_PATH) {
  try {
    const stats = await fs.stat(repoPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Resolve the actual git directory for a checkout. `.git` can be a directory or a
 * file containing `gitdir: <path>` (worktrees / submodules).
 */
async function resolveGitDir(repoPath) {
  const dotGit = path.join(repoPath, ".git");
  let stats;
  try {
    stats = await fs.stat(dotGit);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return dotGit;
  if (stats.isFile()) {
    const content = await readTextIfExists(dotGit);
    const match = content?.match(/^gitdir:\s*(.+)$/m);
    if (match) return path.resolve(repoPath, match[1].trim());
  }
  return null;
}

async function resolveRef(gitDir, refName) {
  const direct = await readTextIfExists(path.join(gitDir, refName));
  if (direct?.trim()) return direct.trim();
  const packed = await readTextIfExists(path.join(gitDir, "packed-refs"));
  if (packed) {
    for (const line of packed.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const [sha, name] = line.trim().split(/\s+/);
      if (name === refName && sha) return sha;
    }
  }
  return null;
}

/**
 * Read HEAD information straight from the `.git` folder. This works inside minimal
 * containers where no `git` binary exists and on read-only mounts owned by another
 * user (where git refuses to run because of "dubious ownership").
 */
export async function readGitHeadInfo(repoPath) {
  const gitDir = await resolveGitDir(repoPath);
  if (!gitDir) return null;

  const head = (await readTextIfExists(path.join(gitDir, "HEAD")))?.trim();
  if (!head) return null;

  let branch = "detached";
  let sha = null;
  const refMatch = head.match(/^ref:\s*(.+)$/);
  if (refMatch) {
    const refName = refMatch[1].trim();
    branch = refName.replace(/^refs\/heads\//, "");
    sha = await resolveRef(gitDir, refName);
  } else if (/^[0-9a-f]{40}$/i.test(head)) {
    sha = head;
  }

  let commitDate = null;
  const reflog = await readTextIfExists(path.join(gitDir, "logs", "HEAD"));
  if (reflog) {
    const lines = reflog.trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const match = lines[i].match(/^([0-9a-f]{40}) ([0-9a-f]{40}) .*? (\d{9,11}) ([+-]\d{4})\t/);
      if (!match) continue;
      if (sha && match[2] !== sha) continue;
      commitDate = new Date(Number.parseInt(match[3], 10) * 1000).toISOString();
      break;
    }
  }

  return { branch, sha, commitDate };
}

function tryGitCommand(args, cwd) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export async function getLocalVersionInfo(repoPath = LOCAL_REPO_PATH) {
  const fallback = { branch: "local", commit: null, repository: "local", isLocal: true };
  try {
    if (!(await hasLocalRepository(repoPath))) return null;
    const headInfo = await readGitHeadInfo(repoPath);
    if (!headInfo?.sha) return fallback;

    // Commit message/date are only available if a git binary can read the objects.
    const message = tryGitCommand("log -1 --format=%s", repoPath);
    const date = tryGitCommand("log -1 --format=%aI", repoPath);

    return {
      branch: headInfo.branch,
      commit: headInfo.sha.substring(0, 7),
      commitFull: headInfo.sha,
      commitMessage: message || null,
      commitDate: date || headInfo.commitDate || null,
      commitUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${headInfo.sha}`,
      repository: `${REPO_OWNER}/${REPO_NAME}`,
      isLocal: true
    };
  } catch (error) {
    console.warn("Failed to read local git info:", error.message);
    return fallback;
  }
}

async function listLocalFiles(repoPath, relativePath, extensions = [".dm"]) {
  const fullPath = path.join(repoPath, relativePath);
  const results = [];

  async function scanDir(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await scanDir(entryPath);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
        results.push(path.relative(repoPath, entryPath).replace(/\\/g, "/"));
      }
    }
  }

  try {
    await scanDir(fullPath);
  } catch (error) {
    console.warn(`Skipping folder ${relativePath}: ${error.code === "ENOENT" ? "not found upstream" : error.message}`);
    return [];
  }
  return results;
}

async function fetchGithubText(url) {
  const response = await fetch(url, { headers: buildGithubHeaders() });
  if (!response.ok) {
    const rateLimitMsg = formatRateLimitMessage(response);
    throw new Error(rateLimitMsg || `Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchGithubDirectoryFiles(directoryUrl, extensions = [".dm"]) {
  const pending = [directoryUrl];
  const visited = new Set();
  const results = new Set();
  let ref = null;

  try {
    ref = new URL(directoryUrl).searchParams.get("ref");
  } catch {}

  while (pending.length) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const response = await fetch(current, {
      headers: buildGithubHeaders({ Accept: "application/vnd.github.v3+json" })
    });

    if (!response.ok) {
      const rateLimitMsg = formatRateLimitMessage(response);
      throw new Error(rateLimitMsg || `Failed to fetch ${current}: ${response.status}`);
    }

    const entries = await response.json();
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (!entry) continue;
      if (entry.type === "file" && entry.download_url) {
        const name = entry.name?.toLowerCase() || "";
        if (extensions.some((ext) => name.endsWith(ext.toLowerCase()))) {
          results.add(entry.download_url);
        }
      } else if (entry.type === "dir" && entry.url) {
        pending.push(ref && !entry.url.includes("?") ? `${entry.url}?ref=${ref}` : entry.url);
      }
    }
  }

  return Array.from(results);
}

async function fetchGithubLatestCommit() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${SOURCE_BRANCH}`;
  try {
    const response = await fetch(url, {
      headers: buildGithubHeaders({ Accept: "application/vnd.github.v3+json" })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      sha: data.sha ?? null,
      shortSha: data.sha?.substring(0, 7) ?? null,
      message: data.commit?.message?.split("\n")[0] ?? null,
      date: data.commit?.author?.date ?? null,
      url: data.html_url ?? null
    };
  } catch {
    return null;
  }
}

function mergeFileLists(fromFiles, fromFolders) {
  const seen = new Set(fromFiles.map((f) => f.path));
  return [...fromFiles, ...fromFolders.filter((f) => !seen.has(f.path))];
}

/**
 * Data source backed by a checkout on disk. Exported so tests can point it at a
 * fixture directory.
 */
export async function createLocalDataSource(repoPath = LOCAL_REPO_PATH) {
  const version = (await getLocalVersionInfo(repoPath)) || { branch: "local", repository: "local", isLocal: true };

  return {
    isLocal: true,
    repoPath,
    version,

    async fetchFiles(filePaths) {
      const results = [];
      for (const filePath of filePaths) {
        const text = await readTextIfExists(path.join(repoPath, filePath));
        if (text == null) {
          console.warn(`Skipping file ${filePath}: not found upstream`);
          continue;
        }
        results.push({ path: filePath, text });
      }
      return results;
    },

    async fetchFilesFromFolders(folderPaths, extensions = [".dm"]) {
      const allPaths = new Set();
      for (const folder of folderPaths) {
        const files = await listLocalFiles(repoPath, folder, extensions);
        files.forEach((f) => allPaths.add(f));
      }
      return this.fetchFiles(Array.from(allPaths));
    },

    async fetchAllFiles(filePaths, folderPaths, extensions = [".dm"]) {
      const fromFiles = await this.fetchFiles(filePaths);
      const fromFolders = await this.fetchFilesFromFolders(folderPaths, extensions);
      return mergeFileLists(fromFiles, fromFolders);
    }
  };
}

export async function createGithubDataSource() {
  const commitInfo = await fetchGithubLatestCommit();
  const version = {
    branch: SOURCE_BRANCH,
    commit: commitInfo?.shortSha ?? null,
    commitFull: commitInfo?.sha ?? null,
    commitMessage: commitInfo?.message ?? null,
    commitDate: commitInfo?.date ?? null,
    commitUrl: commitInfo?.url ?? null,
    repository: `${REPO_OWNER}/${REPO_NAME}`
  };

  return {
    isLocal: false,
    version,

    async fetchFiles(filePaths) {
      const urls = filePaths.map((p) => `${BASE_RAW}/${p}`);
      const results = await Promise.all(
        urls.map(async (url, i) => {
          try {
            const text = await fetchGithubText(url);
            return { path: filePaths[i], text };
          } catch (error) {
            console.warn(`Skipping file ${filePaths[i]}: ${error.message}`);
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },

    async fetchFilesFromFolders(folderPaths, extensions = [".dm"]) {
      const allUrls = new Set();
      for (const folder of folderPaths) {
        const apiUrl = `${BASE_API}/${folder}?ref=${SOURCE_BRANCH}`;
        try {
          const files = await fetchGithubDirectoryFiles(apiUrl, extensions);
          files.forEach((url) => allUrls.add(url));
        } catch (error) {
          console.warn(`Skipping folder ${folder}: ${error.message}`);
        }
      }

      const results = await Promise.all(
        Array.from(allUrls).map(async (url) => {
          try {
            const text = await fetchGithubText(url);
            const urlPath = new URL(url).pathname;
            const repoPath = urlPath.replace(`/${REPO_OWNER}/${REPO_NAME}/${SOURCE_BRANCH}/`, "");
            return { path: repoPath, text };
          } catch (error) {
            console.warn(`Skipping file ${url}: ${error.message}`);
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },

    async fetchAllFiles(filePaths, folderPaths, extensions = [".dm"]) {
      const [fromFiles, fromFolders] = await Promise.all([
        this.fetchFiles(filePaths),
        this.fetchFilesFromFolders(folderPaths, extensions)
      ]);
      return mergeFileLists(fromFiles, fromFolders);
    }
  };
}

export async function createDataSource() {
  const useLocal = USE_LOCAL_DATA && (await hasLocalRepository());

  if (useLocal) {
    console.log(`Using local BlueMoon-Station folder as data source (${LOCAL_REPO_PATH})`);
    return createLocalDataSource(LOCAL_REPO_PATH);
  }

  if (USE_LOCAL_DATA) {
    console.warn(`USE_LOCAL_DATA is set but ${LOCAL_REPO_PATH} is not a directory; falling back to GitHub`);
  }
  console.log("Using GitHub as data source");
  return createGithubDataSource();
}
