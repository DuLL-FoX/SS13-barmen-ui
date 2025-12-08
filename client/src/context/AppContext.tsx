import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type {
  Recipe,
  Ingredient,
  IngredientSource,
  GameVersion,
  SourceFilterOption,
  SourceCategoryFilterOption,
  SortMode,
} from '@/types';
import {
  VIEW_MODE_STORAGE_KEY,
  SOURCE_FILTER_STORAGE_KEY,
  SOURCE_CATEGORY_FILTER_STORAGE_KEY,
  SOURCE_CATEGORY_DEFINITIONS,
  SOURCE_CATEGORY_ORDER,
} from '@/constants';
import { normalizeSourceKey, sourceDisplayLabel, deriveSourceCategory } from '@/utils';
import { AppContext, type AppContextType } from './useApp';

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch {
    // Ignore storage errors
  }
  return defaultValue;
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [version, setVersion] = useState<GameVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeveloperDetails, setShowDeveloperDetailsState] = useState(() => {
    const stored = loadFromStorage<string>(VIEW_MODE_STORAGE_KEY, 'standard');
    return stored === 'developer';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [alcoholicOnly, setAlcoholicOnly] = useState(false);
  const [nonAlcoholicOnly, setNonAlcoholicOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [sourceFiltersDisabled, setSourceFiltersDisabled] = useState<Set<string>>(() => {
    const stored = loadFromStorage<string[]>(SOURCE_FILTER_STORAGE_KEY, []);
    return new Set(stored.map(normalizeSourceKey));
  });

  const [sourceFilterOptions, setSourceFilterOptions] = useState<SourceFilterOption[]>([]);

  const [sourceCategoryFiltersDisabled, setSourceCategoryFiltersDisabled] = useState<Set<string>>(() => {
    const stored = loadFromStorage<string[]>(SOURCE_CATEGORY_FILTER_STORAGE_KEY, []);
    return new Set(stored.map((e) => e?.toString().trim().toLowerCase()).filter(Boolean));
  });

  const [sourceCategoryFilterOptions, setSourceCategoryFilterOptions] = useState<SourceCategoryFilterOption[]>([]);
  const [sourceCategorySearchTerm, setSourceCategorySearchTerm] = useState('');
  const [sourceCategoryShowAll, setSourceCategoryShowAll] = useState(false);

  const dedupeRecipes = (list: Recipe[]): Recipe[] => {
    const seen = new Set<string>();
    return list.filter((r) => {
      const key = (r.id ?? r.path ?? r.name ?? '').toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Load data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [recipeRes, ingredientRes] = await Promise.all([
          fetch('/api/recipes'),
          fetch('/api/ingredients'),
        ]);

        if (!recipeRes.ok) {
          throw new Error(`Recipe request failed: ${recipeRes.status}`);
        }
        if (!ingredientRes.ok) {
          throw new Error(`Ingredient request failed: ${ingredientRes.status}`);
        }

        const recipeData = await recipeRes.json();
        const ingredientData = await ingredientRes.json();

        const uniqueRecipes = dedupeRecipes(recipeData.recipes ?? []);
        setRecipes(uniqueRecipes);
        setFetchedAt(recipeData.fetchedAt ?? null);
        setVersion(recipeData.version ?? null);
        setIngredients(ingredientData.ingredients ?? []);
      } catch (err) {
        console.error(err);
        setError('Failed to load recipes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Build source filter options when recipes change
  useEffect(() => {
    if (!recipes.length) return;

    const counts = new Map<string, number>();
    const labels = new Map<string, string>();

    recipes.forEach((recipe) => {
      const key = normalizeSourceKey(recipe.source);
      const label = sourceDisplayLabel(recipe.source);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!labels.has(key)) {
        labels.set(key, label);
      }
    });

    const entries = Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        count,
        label: labels.get(key) ?? 'Unspecified',
      }))
      .sort((a, b) => {
        if (a.key === '__none__' && b.key === '__none__') return 0;
        if (a.key === '__none__') return 1;
        if (b.key === '__none__') return -1;
        return a.label.localeCompare(b.label);
      });

    setSourceFilterOptions(entries);

    // Clean up invalid disabled keys
    const validKeys = new Set(entries.map((e) => e.key));
    setSourceFiltersDisabled((prev) => {
      const cleaned = new Set(Array.from(prev).filter((k) => validKeys.has(k)));
      return cleaned;
    });
  }, [recipes]);

  // Build source category filter options when recipes change
  useEffect(() => {
    if (!recipes.length) return;

    const counts = new Map<string, number>();
    const labels = new Map<string, string>();

    const registerSource = (source: IngredientSource | undefined) => {
      const category = deriveSourceCategory(source);
      if (!category?.key) return;
      counts.set(category.key, (counts.get(category.key) ?? 0) + 1);
      if (!labels.has(category.key)) {
        labels.set(category.key, category.label);
      }
    };

    const collectFromItems = (items: { sources?: IngredientSource[] }[] | undefined) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (!Array.isArray(item.sources)) return;
        item.sources.forEach(registerSource);
      });
    };

    recipes.forEach((recipe) => {
      collectFromItems(recipe.requiredReagents);
      collectFromItems(recipe.results);
      collectFromItems(recipe.requiredCatalysts);
    });

    const entries = Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        count,
        label: labels.get(key) ?? (SOURCE_CATEGORY_DEFINITIONS[key as keyof typeof SOURCE_CATEGORY_DEFINITIONS]?.label ?? 'Other Sources'),
      }))
      .sort((a, b) => {
        const orderA = SOURCE_CATEGORY_ORDER.indexOf(a.key as typeof SOURCE_CATEGORY_ORDER[number]);
        const orderB = SOURCE_CATEGORY_ORDER.indexOf(b.key as typeof SOURCE_CATEGORY_ORDER[number]);
        const safeA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
        const safeB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
        if (safeA !== safeB) return safeA - safeB;
        return a.label.localeCompare(b.label);
      });

    setSourceCategoryFilterOptions(entries);

    // Clean up invalid disabled keys
    const validKeys = new Set(entries.map((e) => e.key));
    setSourceCategoryFiltersDisabled((prev) => {
      const cleaned = new Set(Array.from(prev).filter((k) => validKeys.has(k)));
      return cleaned;
    });
  }, [recipes]);

  // Persist source filters
  useEffect(() => {
    saveToStorage(SOURCE_FILTER_STORAGE_KEY, Array.from(sourceFiltersDisabled));
  }, [sourceFiltersDisabled]);

  // Persist source category filters
  useEffect(() => {
    saveToStorage(SOURCE_CATEGORY_FILTER_STORAGE_KEY, Array.from(sourceCategoryFiltersDisabled));
  }, [sourceCategoryFiltersDisabled]);

  const setShowDeveloperDetails = useCallback((value: boolean) => {
    setShowDeveloperDetailsState(value);
    saveToStorage(VIEW_MODE_STORAGE_KEY, value ? 'developer' : 'standard');
  }, []);

  const toggleSourceFilter = useCallback((key: string) => {
    const normalized = normalizeSourceKey(key);
    setSourceFiltersDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  }, []);

  const resetSourceFilters = useCallback(() => {
    setSourceFiltersDisabled(new Set());
  }, []);

  const toggleSourceCategoryFilter = useCallback((key: string) => {
    const normalized = key?.toString().trim().toLowerCase();
    if (!normalized) return;
    setSourceCategoryFiltersDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  }, []);

  const resetSourceCategoryFilters = useCallback(() => {
    setSourceCategoryFiltersDisabled(new Set());
    setSourceCategorySearchTerm('');
    setSourceCategoryShowAll(false);
  }, []);

  const toggleSourceCategoryShowAll = useCallback(() => {
    setSourceCategoryShowAll((prev) => !prev);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedIngredient('');
    setAlcoholicOnly(false);
    setNonAlcoholicOnly(false);
    resetSourceFilters();
    resetSourceCategoryFilters();
  }, [resetSourceFilters, resetSourceCategoryFilters]);

  // Recipe lookup map
  const recipeLookup = useMemo(() => {
    return new Map(recipes.map((r) => [r.id, r]));
  }, [recipes]);

  // Filtered and sorted recipes
  const filteredRecipes = useMemo(() => {
    let filtered = [...recipes];

    // Search filter (match name, message, tags, props, ingredients, catalysts, results)
    const search = searchTerm.trim().toLowerCase();
    if (search) {
      const matchesSearch = (recipe: Recipe): boolean => {
        const fields: string[] = [];
        fields.push(recipe.name ?? '');
        fields.push(recipe.mixMessage ?? '');
        fields.push(recipe.source ?? '');
        if (Array.isArray(recipe.tags)) fields.push(recipe.tags.join(' '));
        if (Array.isArray(recipe.specialProperties)) {
          fields.push(recipe.specialProperties.map((p) => p.label ?? p.type ?? '').join(' '));
        }

        const collectItems = (items: { displayName?: string; name?: string; path?: string }[] = []) =>
          items.forEach((i) => {
            fields.push(i.displayName ?? '');
            fields.push(i.name ?? '');
            fields.push(i.path ?? '');
          });

        collectItems(recipe.requiredReagents);
        collectItems(recipe.requiredCatalysts);
        collectItems(recipe.results);

        return fields.some((f) => f.toLowerCase().includes(search));
      };

      filtered = filtered.filter((recipe) => matchesSearch(recipe));
    }

    // Ingredient filter
    if (selectedIngredient) {
      filtered = filtered.filter((recipe) =>
        recipe.requiredReagents.some((item) => item.path === selectedIngredient)
      );
    }

    // Source filter
    if (sourceFiltersDisabled.size) {
      filtered = filtered.filter((recipe) => {
        const key = normalizeSourceKey(recipe.source);
        return !sourceFiltersDisabled.has(key);
      });
    }

    // Alcoholic filter
    if (alcoholicOnly && !nonAlcoholicOnly) {
      filtered = filtered.filter((recipe) => recipe.isAlcoholic);
    } else if (nonAlcoholicOnly && !alcoholicOnly) {
      filtered = filtered.filter((recipe) => !recipe.isAlcoholic);
    }

    // Sort
    const sorted = [...filtered];
    if (sortMode === 'strength-desc') {
      sorted.sort((a, b) => {
        const bStrength = b.strength ?? -Infinity;
        const aStrength = a.strength ?? -Infinity;
        if (bStrength === aStrength) return a.name.localeCompare(b.name);
        return bStrength - aStrength;
      });
    } else if (sortMode === 'strength-asc') {
      sorted.sort((a, b) => {
        const aStrength = a.strength ?? Infinity;
        const bStrength = b.strength ?? Infinity;
        if (aStrength === bStrength) return a.name.localeCompare(b.name);
        return aStrength - bStrength;
      });
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [
    recipes,
    searchTerm,
    selectedIngredient,
    sourceFiltersDisabled,
    alcoholicOnly,
    nonAlcoholicOnly,
    sortMode,
  ]);

  const value: AppContextType = {
    recipes,
    ingredients,
    fetchedAt,
    version,
    isLoading,
    error,
    showDeveloperDetails,
    searchTerm,
    selectedIngredient,
    alcoholicOnly,
    nonAlcoholicOnly,
    sortMode,
    sourceFilters: {
      disabled: sourceFiltersDisabled,
      options: sourceFilterOptions,
    },
    sourceCategoryFilters: {
      disabled: sourceCategoryFiltersDisabled,
      options: sourceCategoryFilterOptions,
      searchTerm: sourceCategorySearchTerm,
      showAll: sourceCategoryShowAll,
    },
    mobileFilterOpen,
    setShowDeveloperDetails,
    setSearchTerm,
    setSelectedIngredient,
    setAlcoholicOnly,
    setNonAlcoholicOnly,
    setSortMode,
    toggleSourceFilter,
    resetSourceFilters,
    toggleSourceCategoryFilter,
    resetSourceCategoryFilters,
    setSourceCategorySearchTerm,
    toggleSourceCategoryShowAll,
    setMobileFilterOpen,
    clearAllFilters,
    filteredRecipes,
    recipeLookup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
