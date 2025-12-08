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

export const SOURCES = {
  recipeFiles: [
    "code/modules/food_and_drinks/recipes/drinks_recipes.dm",
    "modular_splurt/code/modules/food_and_drinks/recipes/drink_recipes.dm",
    "modular_bluemoon/code/modules/food_and_drinks/recipes/drinks_recipes.dm",
    "code/modules/reagents/chemistry/recipes/drugs.dm",
    "modular_bluemoon/code/modules/reagents/chemistry/recipes/recipes.dm",
    "code/modules/reagents/chemistry/recipes/others.dm"
  ],
  recipeFolders: ["modular_splurt/code/modules/food_and_drinks/recipes"],
  synthRecipeFiles: ["modular_bluemoon/code/modules/food_and_drinks/recipes/synth_drinks_recipes.dm"],
  reagentFiles: [
    "code/modules/reagents/chemistry/reagents/alcohol_reagents.dm",
    "code/modules/reagents/chemistry/reagents/drink_reagents.dm",
    "modular_sand/code/modules/reagents/chemistry/reagents/drink_reagents.dm",
    "modular_splurt/code/modules/reagents/chemistry/reagents/drink_reagents.dm",
    "modular_splurt/code/modules/reagents/chemistry/reagents/alcohol_reagents.dm",
    "code/modules/reagents/chemistry/reagents/drug_reagents.dm",
    "modular_splurt/code/modules/reagents/chemistry/reagents/cit_reagents.dm",
    "code/modules/reagents/chemistry/reagents/food_reagents.dm",
    "code/modules/reagents/chemistry/reagents/other_reagents.dm",
    "modular_bluemoon/code/modules/reagents/chemistry/reagents/drink_synth.dm",
    "modular_bluemoon/code/modules/reagents/chemistry/reagents/drink_reagents.dm"
  ],
  reagentFolders: [
    "modular_bluemoon/code/modules/reagents/chemistry/reagents",
    "modular_splurt/code/modules/reagents/chemistry/reagents"
  ],
  dispenserFiles: [
    "code/modules/reagents/chemistry/machinery/chem_dispenser.dm",
    "modular_splurt/code/modules/reagents/chemistry/machinery/chem_dispenser.dm",
    "modular_sand/code/modules/reagents/reagent_dispenser.dm",
    "code/modules/reagents/reagent_dispenser.dm"
  ],
  dispenserFolders: ["modular_splurt/code/modules/reagents/chemistry/machinery"],
  drinkContainerFiles: [
    "code/modules/food_and_drinks/drinks/drinks.dm",
    "code/modules/food_and_drinks/drinks/drinks/bottle.dm",
    "modular_bluemoon/code/modules/food_and_drinks/drinks/drinks.dm",
    "modular_bluemoon/code/modules/food_and_drinks/drinks/drinks/bottle.dm",
    "code/modules/reagents/reagent_containers/bottle.dm"
  ],
  drinkContainerFolders: [
    "modular_splurt/code/modules/food_and_drinks/drinks",
    "modular_splurt/code/modules/food_and_drinks/drinks/drinks",
    "code/modules/reagents/reagent_containers"
  ],
  vendingFiles: [
    "modular_bluemoon/code/modules/vending/boozeomat.dm",
    "modular_bluemoon/code/modules/vending/coffee.dm",
    "modular_bluemoon/code/modules/vending/cola.dm",
    "modular_bluemoon/code/modules/vending/kinkmate.dm"
  ],
  vendingFolders: ["modular_splurt/code/modules/vending"],
  supplyPackFiles: [
    "code/modules/cargo/packs/organic.dm",
    "code/modules/cargo/packs/armory.dm",
    "code/modules/cargo/packs/medical.dm",
    "code/modules/cargo/packs/misc.dm",
    "code/modules/cargo/packs/security.dm"
  ],
  supplyPackFolders: [
    "modular_bluemoon/code/modules/cargo/packs",
    "modular_splurt/code/modules/cargo/packs"
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

async function hasLocalRepository() {
  try {
    const stats = await fs.stat(LOCAL_REPO_PATH);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function getLocalVersionInfo() {
  try {
    if (!(await hasLocalRepository())) return null;
    const gitDir = path.join(LOCAL_REPO_PATH, ".git");
    const gitStats = await fs.stat(gitDir).catch(() => null);
    if (!gitStats) return { branch: "local", commit: null, repository: "local", isLocal: true };

    const sha = execSync("git rev-parse HEAD", { cwd: LOCAL_REPO_PATH, encoding: "utf-8" }).trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: LOCAL_REPO_PATH, encoding: "utf-8" }).trim();
    const message = execSync("git log -1 --format=%s", { cwd: LOCAL_REPO_PATH, encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%aI", { cwd: LOCAL_REPO_PATH, encoding: "utf-8" }).trim();

    return {
      branch,
      commit: sha.substring(0, 7),
      commitFull: sha,
      commitMessage: message,
      commitDate: date,
      repository: "local",
      isLocal: true
    };
  } catch (error) {
    console.warn("Failed to get local git info:", error.message);
    return { branch: "local", commit: null, repository: "local", isLocal: true };
  }
}

async function readLocalFile(relativePath) {
  try {
    return await fs.readFile(path.join(LOCAL_REPO_PATH, relativePath), "utf-8");
  } catch {
    return null;
  }
}

async function listLocalFiles(relativePath, extensions = [".dm"]) {
  const fullPath = path.join(LOCAL_REPO_PATH, relativePath);
  const results = [];

  async function scanDir(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(entryPath);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
          results.push(path.relative(LOCAL_REPO_PATH, entryPath).replace(/\\/g, "/"));
        }
      }
    } catch {}
  }

  await scanDir(fullPath);
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

export async function createDataSource() {
  const useLocal = USE_LOCAL_DATA && (await hasLocalRepository());

  if (useLocal) {
    console.log("Using local BlueMoon-Station folder as data source");
    const version = (await getLocalVersionInfo()) || { branch: "local", repository: "local", isLocal: true };

    return {
      isLocal: true,
      version,

      async fetchFiles(filePaths) {
        const results = [];
        for (const filePath of filePaths) {
          const text = await readLocalFile(filePath);
          if (text) results.push({ path: filePath, text });
        }
        return results;
      },

      async fetchFilesFromFolders(folderPaths, extensions = [".dm"]) {
        const allPaths = new Set();
        for (const folder of folderPaths) {
          const files = await listLocalFiles(folder, extensions);
          files.forEach((f) => allPaths.add(f));
        }
        return this.fetchFiles(Array.from(allPaths));
      },

      async fetchAllFiles(filePaths, folderPaths, extensions = [".dm"]) {
        const fromFiles = await this.fetchFiles(filePaths);
        const fromFolders = await this.fetchFilesFromFolders(folderPaths, extensions);
        const seen = new Set(fromFiles.map((f) => f.path));
        return [...fromFiles, ...fromFolders.filter((f) => !seen.has(f.path))];
      }
    };
  }

  console.log("Using GitHub as data source");
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
            console.warn(`Failed to fetch ${url}: ${error.message}`);
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
          console.warn(`Failed to fetch folder ${folder}: ${error.message}`);
        }
      }

      const results = await Promise.all(
        Array.from(allUrls).map(async (url) => {
          try {
            const text = await fetchGithubText(url);
            const urlPath = new URL(url).pathname;
            const repoPath = urlPath.replace(`/${REPO_OWNER}/${REPO_NAME}/${SOURCE_BRANCH}/`, "");
            return { path: repoPath, text };
          } catch {
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
      const seen = new Set(fromFiles.map((f) => f.path));
      return [...fromFiles, ...fromFolders.filter((f) => !seen.has(f.path))];
    }
  };
}
