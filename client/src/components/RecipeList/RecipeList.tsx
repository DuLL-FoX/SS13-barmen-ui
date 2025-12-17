import { useApp } from '@/context/useApp';
import { RecipeCard } from '@/components/Recipe';
import { Icon } from '@/components/Icon';
import { trackEvent } from '@/utils';
import './RecipeList.css';

export function RecipeList() {
  const {
    filteredRecipes,
    isLoading,
    error,
    recipes,
    sourceFilters,
    sourceCategoryFilters,
    clearAllFilters,
  } = useApp();

  if (isLoading) {
    return (
      <div className="recipe-grid recipe-grid--loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="recipe-skeleton">
            <div className="recipe-skeleton__header">
              <div className="recipe-skeleton__icon" />
              <div className="recipe-skeleton__title-area">
                <div className="recipe-skeleton__title" />
                <div className="recipe-skeleton__badges" />
              </div>
            </div>
            <div className="recipe-skeleton__body">
              <div className="recipe-skeleton__line" />
              <div className="recipe-skeleton__line recipe-skeleton__line--short" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="recipe-error">
        <Icon name="alert" size={32} className="recipe-error__icon" />
        <p className="recipe-error__message">{error}</p>
      </div>
    );
  }

  if (filteredRecipes.length === 0) {
    return (
      <div className="recipe-empty">
        <div className="recipe-empty__visual">
          <Icon name="search" size={48} className="recipe-empty__icon" />
        </div>
        <h3 className="recipe-empty__title">No recipes found</h3>
        <p className="recipe-empty__text">
          Try adjusting your search or filters to find what you're looking for.
        </p>
        <button
          type="button"
          className="recipe-empty__btn"
          onClick={() => {
            trackEvent('filters_clear_all', {
              recipes_total: recipes.length,
              recipes_visible: filteredRecipes.length,
              sources_disabled: sourceFilters.disabled.size,
              categories_disabled: sourceCategoryFilters.disabled.size,
            });
            clearAllFilters();
          }}
        >
          Clear all filters
        </button>
      </div>
    );
  }

  const totalSources = sourceFilters.options.length;
  const enabledSources = totalSources - sourceFilters.disabled.size;
  const totalCategories = sourceCategoryFilters.options.length;
  const enabledCategories = totalCategories - sourceCategoryFilters.disabled.size;

  return (
    <div className="recipe-container">
      <div className="recipe-status">
        <span className="recipe-status__count">
          <strong>{filteredRecipes.length}</strong>
          <span> of {recipes.length} recipes</span>
        </span>
        {totalSources > 0 && (
          <span className="recipe-status__filter">
            {enabledSources}/{totalSources} sources
          </span>
        )}
        {totalCategories > 0 && (
          <span className="recipe-status__filter">
            {enabledCategories}/{totalCategories} categories
          </span>
        )}
      </div>

      <ul className="recipe-grid">
        {filteredRecipes.map((recipe) => (
          <RecipeCard key={recipe.id ?? recipe.path ?? recipe.name} recipe={recipe} />
        ))}
      </ul>
    </div>
  );
}
