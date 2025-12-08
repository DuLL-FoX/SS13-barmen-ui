import { getRecipeDataset, filterRecipes } from "../data/loadData.js";

export async function listRecipes(req, res, next) {
  try {
    const dataset = await getRecipeDataset();
    const filtered = filterRecipes(dataset.recipes, {
      search: req.query.search,
      ingredient: req.query.ingredient,
      alcoholic: req.query.alcoholic,
      source: req.query.source
    });

    res.json({
      fetchedAt: dataset.fetchedAt,
      version: dataset.version ?? null,
      total: dataset.recipes.length,
      count: filtered.length,
      recipes: filtered
    });
  } catch (error) {
    next(error);
  }
}

export async function listIngredients(_req, res, next) {
  try {
    const dataset = await getRecipeDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      version: dataset.version ?? null,
      count: dataset.ingredients.length,
      ingredients: dataset.ingredients
    });
  } catch (error) {
    next(error);
  }
}

export async function listReagents(_req, res, next) {
  try {
    const dataset = await getRecipeDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      version: dataset.version ?? null,
      count: dataset.reagents.length,
      reagents: dataset.reagents
    });
  } catch (error) {
    next(error);
  }
}
