import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const LOCAL_REPO_PATH = process.env.LOCAL_BLUEMOON_PATH || path.resolve(process.cwd(), "BlueMoon-Station");

export async function hasLocalRepository() {
  try {
    const stats = await fs.stat(LOCAL_REPO_PATH);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function getLocalRepositoryPath() {
  return LOCAL_REPO_PATH;
}

export async function getLocalVersionInfo() {
  try {
    const hasRepo = await hasLocalRepository();
    if (!hasRepo) {
      return null;
    }

    const gitDir = path.join(LOCAL_REPO_PATH, ".git");
    const gitStats = await fs.stat(gitDir).catch(() => null);
    if (!gitStats) {
      return { branch: "local", commit: null, commitFull: null, repository: "local" };
    }

    try {
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
        commitUrl: null,
        repository: "local",
        isLocal: true
      };
    } catch (gitError) {
      console.warn("Failed to get git info:", gitError.message);
      return { branch: "local", commit: null, commitFull: null, repository: "local", isLocal: true };
    }
  } catch (error) {
    console.warn("Error checking local repository:", error.message);
    return null;
  }
}

export async function readLocalFile(relativePath) {
  const fullPath = path.join(LOCAL_REPO_PATH, relativePath);
  try {
    return await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    console.warn(`Failed to read local file ${relativePath}:`, error.message);
    return null;
  }
}

export async function listLocalFiles(relativePath, extensions = [".dm"]) {
  const fullPath = path.join(LOCAL_REPO_PATH, relativePath);
  const results = [];

  async function scanDir(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(entryPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            results.push(path.relative(LOCAL_REPO_PATH, entryPath).replace(/\\/g, "/"));
          }
        }
      }
    } catch (error) {
    }
  }

  await scanDir(fullPath);
  return results;
}

export function getLocalSourcePaths() {
  return {
    recipeFiles: [
      "code/modules/food_and_drinks/recipes/drinks_recipes.dm",
      "modular_splurt/code/modules/food_and_drinks/recipes/drink_recipes.dm",
      "modular_bluemoon/code/modules/food_and_drinks/recipes/drinks_recipes.dm",
      "code/modules/reagents/chemistry/recipes/drugs.dm",
      "modular_bluemoon/code/modules/reagents/chemistry/recipes/recipes.dm",
      "code/modules/reagents/chemistry/recipes/others.dm"
    ],
    recipeFolders: [
      "modular_splurt/code/modules/food_and_drinks/recipes"
    ],
    synthRecipeFiles: [
      "modular_bluemoon/code/modules/food_and_drinks/recipes/synth_drinks_recipes.dm"
    ],
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
    dispenserFolders: [
      "modular_splurt/code/modules/reagents/chemistry/machinery"
    ],
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
    vendingFolders: [
      "modular_splurt/code/modules/vending"
    ],
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
}
