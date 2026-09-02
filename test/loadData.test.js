import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  buildRecipeDataset,
  describeSource,
  isDrinkRecipe,
  isDrinkRecipeFile,
  mergeDispenserMachines
} from "../src/data/loadData.js";
import { createLocalDataSource } from "../src/data/dataSource.js";

const DRINK_FILE = "code/modules/food_and_drinks/recipes/drinks_recipes.dm";
const CHEM_FILE = "code/modules/reagents/chemistry/recipes/others.dm";

test("drink recipe files are recognised across modular layers", () => {
  assert.ok(isDrinkRecipeFile(DRINK_FILE));
  assert.ok(isDrinkRecipeFile("modular_splurt/code/modules/food_and_drinks/recipes/drink_recipes.dm"));
  assert.ok(isDrinkRecipeFile("modular_bluemoon/code/modules/food_and_drinks/recipes/synth_drinks_recipes.dm"));
  assert.ok(!isDrinkRecipeFile(CHEM_FILE));
});

test("kitchen and lab chemistry from general recipe files is not a drink", () => {
  const reagents = new Map([
    ["/datum/reagent/consumable/sodiumchloride", { path: "/datum/reagent/consumable/sodiumchloride", name: "Table Salt", sourcePath: "code/modules/reagents/chemistry/reagents/food_reagents.dm" }],
    ["/datum/reagent/consumable/laughter", { path: "/datum/reagent/consumable/laughter", name: "Laughter", sourcePath: "code/modules/reagents/chemistry/reagents/drink_reagents.dm" }],
    ["/datum/reagent/consumable/hot_coco", { path: "/datum/reagent/consumable/hot_coco", name: "Hot Coco", glassIconState: "chocolateglass", sourcePath: "code/modules/reagents/chemistry/reagents/food_reagents.dm" }]
  ]);
  const recipe = (result) => ({ path: `/datum/chemical_reaction/${result.split("/").pop()}`, id: result, results: [{ path: result, quantity: 1 }], requiredReagents: [] });

  assert.equal(isDrinkRecipe(recipe("/datum/reagent/consumable/sodiumchloride"), reagents, { sourcePath: CHEM_FILE }), false);
  assert.equal(isDrinkRecipe(recipe("/datum/reagent/consumable/laughter"), reagents, { sourcePath: CHEM_FILE }), true, "defined in drink_reagents.dm");
  assert.equal(isDrinkRecipe(recipe("/datum/reagent/consumable/hot_coco"), reagents, { sourcePath: CHEM_FILE }), true, "served in a glass");
  assert.equal(isDrinkRecipe(recipe("/datum/reagent/consumable/sodiumchloride"), reagents, { sourcePath: DRINK_FILE }), true, "anything in the bar book counts");
  assert.equal(isDrinkRecipe(recipe("/datum/reagent/medicine/omnizine"), reagents, { sourcePath: DRINK_FILE }), false, "medicine never counts");
});

test("dispenser fragments from several files merge into one machine", () => {
  const merged = mergeDispenserMachines([
    { path: "/obj/machinery/chem_dispenser/drinks", name: "Soda Dispenser", tiers: [{ key: "base", label: "Base", reagents: ["/datum/reagent/water"] }] },
    { path: "/obj/machinery/chem_dispenser/drinks", name: null, tiers: [{ key: "upgrade4", label: "Upgrade Tier 4", reagents: ["/datum/reagent/consumable/caramel"] }] },
    { path: "/obj/machinery/chem_dispenser/drinks", name: null, tiers: [{ key: "base", label: "Base", reagents: ["/datum/reagent/consumable/ice", "/datum/reagent/water"] }] }
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "Soda Dispenser");
  assert.deepEqual(merged[0].tiers.map((t) => t.key), ["base", "upgrade4"]);
  assert.deepEqual(merged[0].tiers[0].reagents, ["/datum/reagent/consumable/ice", "/datum/reagent/water"]);
});

test("source labels cover every modular layer", () => {
  assert.equal(describeSource("modular_sand/code/x.dm"), "Modular Sand");
  assert.equal(describeSource("modular_citadel/code/x.dm"), "Modular Citadel");
  assert.equal(describeSource("modular_bluemoon/code/x.dm"), "Modular BlueMoon");
  assert.equal(describeSource("code/modules/x.dm"), "Core Station");
});

test("a dataset still builds when whole categories are missing upstream", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "barmen-dataset-"));
  const write = async (rel, content) => {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  };
  await write(DRINK_FILE, `
/datum/chemical_reaction/screwdrivercocktail
	name = "Screwdriver"
	id = /datum/reagent/consumable/ethanol/screwdrivercocktail
	results = list(/datum/reagent/consumable/ethanol/screwdrivercocktail = 3)
	required_reagents = list(/datum/reagent/consumable/ethanol/vodka = 2, /datum/reagent/consumable/orangejuice = 1)
`);
  await write("code/modules/reagents/chemistry/reagents/alcohol_reagents.dm", `
/datum/reagent/consumable/ethanol/vodka
	name = "Vodka"
	boozepwr = 65
/datum/reagent/consumable/ethanol/screwdrivercocktail
	name = "Screwdriver"
	boozepwr = 55
`);
  await write("code/modules/reagents/chemistry/machinery/chem_dispenser.dm", `
/obj/machinery/chem_dispenser/drinks/beer
	name = "Booze Dispenser"
	dispensable_reagents = list(/datum/reagent/consumable/ethanol/vodka)
	upgrade_reagents2 = list(/datum/reagent/consumable/orangejuice)
`);

  const dataset = await buildRecipeDataset(await createLocalDataSource(root));
  assert.equal(dataset.recipes.length, 1);
  const [recipe] = dataset.recipes;
  assert.equal(recipe.name, "Screwdriver");
  assert.equal(recipe.isAlcoholic, true);
  const vodka = recipe.requiredReagents.find((r) => r.path.endsWith("/vodka"));
  assert.deepEqual(vodka.sources.map((s) => `${s.machineName}:${s.tier}`), ["Booze Dispenser:base"]);
  const oj = recipe.requiredReagents.find((r) => r.path.endsWith("/orangejuice"));
  assert.deepEqual(oj.sources.map((s) => s.tierLabel), ["Upgrade Tier 2"]);
  assert.equal(dataset.stats.vendors, 0);
  assert.equal(dataset.stats.supplyPacks, 0);
});
