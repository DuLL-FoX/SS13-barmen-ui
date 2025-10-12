import { fetchDataset, filterRecipes } from "../services/datasetService.js";

export async function listRecipes(req, res, next) {
  try {
    const dataset = await fetchDataset();
    const filtered = filterRecipes(dataset.recipes, {
      search: req.query.search,
      ingredient: req.query.ingredient,
      alcoholic: req.query.alcoholic,
      source: req.query.source
    });

    res.json({
      fetchedAt: dataset.fetchedAt,
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
    const dataset = await fetchDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      count: dataset.ingredients.length,
      ingredients: dataset.ingredients
    });
  } catch (error) {
    next(error);
  }
}

export async function listReagents(_req, res, next) {
  try {
    const dataset = await fetchDataset();
    res.json({
      fetchedAt: dataset.fetchedAt,
      count: dataset.reagents.length,
      reagents: dataset.reagents
    });
  } catch (error) {
    next(error);
  }
}
