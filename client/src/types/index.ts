
export interface RecipeIcon {
  src?: string;
  width?: number;
  height?: number;
  label?: string;
  sourceIcon?: string;
  state?: string;
  sourcePath?: string;
  origin?: string;
  attribution?: string;
  license?: string;
}

export interface IngredientSource {
  tier?: string;
  tierLabel?: string;
  machineName?: string;
  machinePath?: string;
  itemName?: string;
  quantity?: number;
  packCost?: number;
}

export interface RecipeItem {
  path: string;
  name?: string;
  displayName: string;
  quantity?: number | string;
  sources?: IngredientSource[];
}

export interface RecipeRelation {
  id: string;
  name: string;
  path: string;
}

export interface SpecialProperty {
  type: 'addiction' | 'overdose' | 'quality' | 'healing' | 'effect';
  value: string | number | object;
  label: string;
  condition?: string;
}

export interface Recipe {
  id: string;
  path: string;
  name: string;
  mixMessage?: string;
  source?: string;
  isAlcoholic: boolean;
  strength?: number;
  tags: string[];
  icon?: RecipeIcon;
  requiredReagents: RecipeItem[];
  results: RecipeItem[];
  requiredCatalysts: RecipeItem[];
  requiredRecipes: RecipeRelation[];
  dependentRecipes: RecipeRelation[];
  requiredTemp?: number;
  requiredTempHigh?: number;
  isColdRecipe?: boolean;
  requiredPressure?: number;
  requiredPhMin?: number;
  requiredPhMax?: number;
  specialProperties?: SpecialProperty[];
}

export interface Ingredient {
  path: string;
  name?: string;
  displayName?: string;
  uses?: number;
  count?: number;
  boozePower?: number;
  sources?: IngredientSource[];
}

export interface GameVersion {
  branch?: string;
  commit?: string;
  commitUrl?: string;
  commitMessage?: string;
  commitDate?: string;
}

export interface RecipeApiResponse {
  recipes: Recipe[];
  fetchedAt?: string;
  version?: GameVersion;
}

export interface IngredientApiResponse {
  ingredients: Ingredient[];
}


export interface SourceFilterOption {
  key: string;
  count: number;
  label: string;
}

export interface SourceCategoryFilterOption {
  key: string;
  count: number;
  label: string;
}

export type SortMode = 'name-asc' | 'strength-desc' | 'strength-asc';

export type BadgeVariant = 'accent' | 'neutral' | 'outline' | 'soft' | 'bold';

export type SourceCategoryKey = 'dispenser' | 'supply' | 'vendor' | 'other';

export interface SourceCategoryDefinition {
  key: SourceCategoryKey;
  label: string;
}
