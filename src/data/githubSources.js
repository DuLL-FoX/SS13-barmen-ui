export const SOURCE_BRANCH = "master";
export const REPO_OWNER = "BlueMoon-Labs";
export const REPO_NAME = "BlueMoon-Station";

const BASE_RAW = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${SOURCE_BRANCH}`;
const BASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

export const RAW_SOURCES = {
  recipeFiles: [
    `${BASE_RAW}/code/modules/food_and_drinks/recipes/drinks_recipes.dm`,
    `${BASE_RAW}/modular_splurt/code/modules/food_and_drinks/recipes/drink_recipes.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/food_and_drinks/recipes/drinks_recipes.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/recipes/drugs.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/reagents/chemistry/recipes/recipes.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/recipes/others.dm`
  ],
  recipeFolders: [
    `${BASE_API}/modular_splurt/code/modules/food_and_drinks/recipes?ref=${SOURCE_BRANCH}`
  ],
  synthRecipeFiles: [
    `${BASE_RAW}/modular_bluemoon/code/modules/food_and_drinks/recipes/synth_drinks_recipes.dm`
  ],
  reagentFiles: [
    `${BASE_RAW}/code/modules/reagents/chemistry/reagents/alcohol_reagents.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/reagents/drink_reagents.dm`,
    `${BASE_RAW}/modular_sand/code/modules/reagents/chemistry/reagents/drink_reagents.dm`,
    `${BASE_RAW}/modular_splurt/code/modules/reagents/chemistry/reagents/drink_reagents.dm`,
    `${BASE_RAW}/modular_splurt/code/modules/reagents/chemistry/reagents/alcohol_reagents.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/reagents/drug_reagents.dm`,
    `${BASE_RAW}/modular_splurt/code/modules/reagents/chemistry/reagents/cit_reagents.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/reagents/food_reagents.dm`,
    `${BASE_RAW}/code/modules/reagents/chemistry/reagents/other_reagents.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/reagents/chemistry/reagents/drink_synth.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/reagents/chemistry/reagents/drink_reagents.dm`
  ],
  reagentFolders: [
    `${BASE_API}/modular_bluemoon/code/modules/reagents/chemistry/reagents?ref=${SOURCE_BRANCH}`,
    `${BASE_API}/modular_splurt/code/modules/reagents/chemistry/reagents?ref=${SOURCE_BRANCH}`
  ],
  dispenserFiles: [
    `${BASE_RAW}/code/modules/reagents/chemistry/machinery/chem_dispenser.dm`,
    `${BASE_RAW}/modular_splurt/code/modules/reagents/chemistry/machinery/chem_dispenser.dm`,
    `${BASE_RAW}/modular_sand/code/modules/reagents/reagent_dispenser.dm`,
    `${BASE_RAW}/code/modules/reagents/reagent_dispenser.dm`
  ],
  dispenserFolders: [
    `${BASE_API}/modular_splurt/code/modules/reagents/chemistry/machinery?ref=${SOURCE_BRANCH}`
  ],
  drinkContainerFiles: [
    `${BASE_RAW}/code/modules/food_and_drinks/drinks/drinks.dm`,
    `${BASE_RAW}/code/modules/food_and_drinks/drinks/drinks/bottle.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/food_and_drinks/drinks/drinks.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/food_and_drinks/drinks/drinks/bottle.dm`,
    `${BASE_RAW}/code/modules/reagents/reagent_containers/bottle.dm`
  ],
  drinkContainerFolders: [
    `${BASE_API}/modular_splurt/code/modules/food_and_drinks/drinks?ref=${SOURCE_BRANCH}`,
    `${BASE_API}/modular_splurt/code/modules/food_and_drinks/drinks/drinks?ref=${SOURCE_BRANCH}`,
    `${BASE_API}/code/modules/reagents/reagent_containers?ref=${SOURCE_BRANCH}`
  ],
  vendingFiles: [
    `${BASE_RAW}/modular_bluemoon/code/modules/vending/boozeomat.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/vending/coffee.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/vending/cola.dm`,
    `${BASE_RAW}/modular_bluemoon/code/modules/vending/kinkmate.dm`
  ],
  vendingFolders: [
    `${BASE_API}/modular_splurt/code/modules/vending?ref=${SOURCE_BRANCH}`
  ],
  supplyPackFiles: [
    `${BASE_RAW}/code/modules/cargo/packs/organic.dm`,
    `${BASE_RAW}/code/modules/cargo/packs/armory.dm`,
    `${BASE_RAW}/code/modules/cargo/packs/medical.dm`,
    `${BASE_RAW}/code/modules/cargo/packs/misc.dm`,
    `${BASE_RAW}/code/modules/cargo/packs/security.dm`
  ],
  supplyPackFolders: [
    `${BASE_API}/modular_bluemoon/code/modules/cargo/packs?ref=${SOURCE_BRANCH}`,
    `${BASE_API}/modular_splurt/code/modules/cargo/packs?ref=${SOURCE_BRANCH}`
  ]
};
