import { createContext, useContext } from 'react';
import type {
  Recipe,
  Ingredient,
  GameVersion,
  SourceFilterOption,
  SourceCategoryFilterOption,
  SortMode,
} from '@/types';

export interface AppState {
  recipes: Recipe[];
  ingredients: Ingredient[];
  fetchedAt: string | null;
  version: GameVersion | null;
  isLoading: boolean;
  error: string | null;
  showDeveloperDetails: boolean;
  searchTerm: string;
  selectedIngredient: string;
  alcoholicOnly: boolean;
  nonAlcoholicOnly: boolean;
  sortMode: SortMode;
  sourceFilters: {
    disabled: Set<string>;
    options: SourceFilterOption[];
  };
  sourceCategoryFilters: {
    disabled: Set<string>;
    options: SourceCategoryFilterOption[];
    searchTerm: string;
    showAll: boolean;
  };
  mobileFilterOpen: boolean;
}

export interface AppContextType extends AppState {
  setShowDeveloperDetails: (value: boolean) => void;
  setSearchTerm: (value: string) => void;
  setSelectedIngredient: (value: string) => void;
  setAlcoholicOnly: (value: boolean) => void;
  setNonAlcoholicOnly: (value: boolean) => void;
  setSortMode: (value: SortMode) => void;
  toggleSourceFilter: (key: string) => void;
  resetSourceFilters: () => void;
  toggleSourceCategoryFilter: (key: string) => void;
  resetSourceCategoryFilters: () => void;
  setSourceCategorySearchTerm: (value: string) => void;
  toggleSourceCategoryShowAll: () => void;
  setMobileFilterOpen: (value: boolean) => void;
  clearAllFilters: () => void;
  filteredRecipes: Recipe[];
  recipeLookup: Map<string, Recipe>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
