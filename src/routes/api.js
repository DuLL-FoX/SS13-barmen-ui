import { Router } from "express";
import { listIngredients, listRecipes, listReagents } from "../controllers/apiController.js";

const router = Router();

router.get("/recipes", listRecipes);
router.get("/ingredients", listIngredients);
router.get("/reagents", listReagents);

export default router;
