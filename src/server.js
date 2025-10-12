import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getRecipeDataset } from "./data/loadData.js";

const app = express();
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "../public");

app.use(express.json());

app.get("/api/recipes", async (req, res, next) => {
  try {
    const dataset = await getRecipeDataset();
    const search = (req.query.search ?? "").toString().toLowerCase();
    const ingredient = (req.query.ingredient ?? "").toString().toLowerCase();
    const alcoholicFilter = (req.query.alcoholic ?? "").toString();
    const rawSource = req.query.source;

    let filtered = dataset.recipes;

    if (search) {
      filtered = filtered.filter((recipe) => {
        if (recipe.name.toLowerCase().includes(search)) {
          return true;
        }
        return recipe.requiredReagents.some((item) => item.displayName.toLowerCase().includes(search));
      });
    }

    if (ingredient) {
      filtered = filtered.filter((recipe) =>
        recipe.requiredReagents.some((item) =>
          item.displayName.toLowerCase().includes(ingredient) || item.path.toLowerCase().includes(ingredient)
        )
      );
    }

    let sourceFilters = null;
    if (rawSource != null) {
      const values = Array.isArray(rawSource) ? rawSource : [rawSource];
      const collected = [];
      for (const value of values) {
        if (typeof value !== "string") {
          continue;
        }
        const segments = value.split(",");
        for (const segment of segments) {
          const trimmed = segment.trim();
          if (trimmed) {
            collected.push(trimmed.toLowerCase());
          }
        }
      }
      if (collected.length) {
        sourceFilters = new Set(collected);
      }
    }

    if (sourceFilters && sourceFilters.size) {
      filtered = filtered.filter((recipe) => {
        if (!recipe.source) {
          return sourceFilters.has("__none__");
        }
        return sourceFilters.has(recipe.source.toLowerCase());
      });
    }

    if (alcoholicFilter === "true") {
      filtered = filtered.filter((recipe) => recipe.isAlcoholic);
    } else if (alcoholicFilter === "false") {
      filtered = filtered.filter((recipe) => !recipe.isAlcoholic);
    }

    res.json({
      fetchedAt: dataset.fetchedAt,
      total: dataset.recipes.length,
      count: filtered.length,
      recipes: filtered
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ingredients", async (req, res, next) => {
  try {
    const dataset = await getRecipeDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      count: dataset.ingredients.length,
      ingredients: dataset.ingredients
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reagents", async (req, res, next) => {
  try {
    const dataset = await getRecipeDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      count: dataset.reagents.length,
      reagents: dataset.reagents
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error("Unexpected error", err);
  res.status(500).json({
    error: "Unexpected server error",
    message: err.message ?? "Unknown error"
  });
});

async function startServer() {
  try {
    await getRecipeDataset();
  } catch (error) {
    console.error("Failed to preload recipe dataset", error);
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => {
    console.log(`Bartender recipe service running on http://localhost:${PORT}`);
  });
}

startServer();
