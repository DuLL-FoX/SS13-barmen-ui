import { useApp } from '@/context/useApp';
import { SOURCE_CATEGORY_VISIBLE_LIMIT } from '@/constants';
import { trackEvent } from '@/utils';
import './Filters.css';

export function Filters() {
  const {
    alcoholicOnly,
    setAlcoholicOnly,
    nonAlcoholicOnly,
    setNonAlcoholicOnly,
    selectedIngredient,
    setSelectedIngredient,
    sortMode,
    setSortMode,
    ingredients,
    recipes,
    fetchedAt,
    version,
    sourceFilters,
    toggleSourceFilter,
    resetSourceFilters,
    sourceCategoryFilters,
    toggleSourceCategoryFilter,
    resetSourceCategoryFilters,
    toggleSourceCategoryShowAll,
  } = useApp();

  const ingredientOptions = ingredients.map((ing) => {
    const label = ing.displayName ?? ing.name ?? ing.path;
    const details = [];
    details.push(`uses ${ing.uses ?? ing.count ?? 0}`);
    if (ing.boozePower != null) {
      details.push(`power ${ing.boozePower}`);
    }
    if (Array.isArray(ing.sources) && ing.sources.length) {
      const sourceCount = ing.sources.length;
      details.push(`${sourceCount} source${sourceCount === 1 ? '' : 's'}`);
    }
    return {
      value: ing.path,
      label: `${label} — ${details.join(' · ')}`,
    };
  });

  const normalizedCategorySearch = sourceCategoryFilters.searchTerm.trim().toLowerCase();
  let categoryEntries = sourceCategoryFilters.options;
  if (normalizedCategorySearch.length) {
    categoryEntries = categoryEntries.filter((e) =>
      e.label.toLowerCase().includes(normalizedCategorySearch)
    );
  }
  const shouldLimitCategories =
    !sourceCategoryFilters.showAll &&
    !normalizedCategorySearch.length &&
    categoryEntries.length > SOURCE_CATEGORY_VISIBLE_LIMIT;
  const visibleCategoryEntries = shouldLimitCategories
    ? categoryEntries.slice(0, SOURCE_CATEGORY_VISIBLE_LIMIT)
    : categoryEntries;

  const versionParts = [];
  if (version?.commitMessage) {
    versionParts.push(
      version.commitMessage.length > 50
        ? version.commitMessage.substring(0, 50) + '...'
        : version.commitMessage
    );
  }
  if (version?.commitDate) {
    const date = new Date(version.commitDate);
    versionParts.push(`Updated ${date.toLocaleDateString()}`);
  }

  return (
    <aside className="filters">
      <section className="filters__group">
        <div className="filters__header">
          <h2>Quick Filters</h2>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={alcoholicOnly}
            onChange={(e) => {
              const checked = e.target.checked;
              trackEvent('filter_toggle', {
                filter: 'alcoholic_only',
                checked,
                clears_other: checked,
              });
              setAlcoholicOnly(checked);
              if (checked) setNonAlcoholicOnly(false);
            }}
          />
          <span>Alcoholic only</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={nonAlcoholicOnly}
            onChange={(e) => {
              const checked = e.target.checked;
              trackEvent('filter_toggle', {
                filter: 'non_alcoholic_only',
                checked,
                clears_other: checked,
              });
              setNonAlcoholicOnly(checked);
              if (checked) setAlcoholicOnly(false);
            }}
          />
          <span>Non-alcoholic only</span>
        </label>
        <label className="select-label" htmlFor="ingredient">
          Key ingredient
        </label>
        <select
          id="ingredient"
          value={selectedIngredient}
          onChange={(e) => {
            const value = e.target.value;
            trackEvent('filter_change', {
              filter: 'ingredient',
              has_value: value.length > 0,
              value,
            });
            setSelectedIngredient(value);
          }}
        >
          <option value="">All ingredients</option>
          {ingredientOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="select-label" htmlFor="sort">
          Sort by
        </label>
        <select
          id="sort"
          value={sortMode}
          onChange={(e) => {
            const value = e.target.value as typeof sortMode;
            trackEvent('sort_change', { sort_mode: value });
            setSortMode(value);
          }}
        >
          <option value="name-asc">Name (A→Z)</option>
          <option value="strength-desc">Strength (High→Low)</option>
          <option value="strength-asc">Strength (Low→High)</option>
        </select>
      </section>

      <section className="filters__group">
        <div className="filters__header">
          <h2>Sources</h2>
          <div className="filters__actions">
            <button
              type="button"
              className="filters__action"
              disabled={sourceFilters.disabled.size === 0}
              onClick={() => {
                trackEvent('sources_reset', {
                  disabled_count: sourceFilters.disabled.size,
                  total_sources: sourceFilters.options.length,
                });
                resetSourceFilters();
              }}
            >
              Reset sources
            </button>
          </div>
        </div>
        <p className="filters__hint">Toggle content packs to control which recipes appear.</p>
        <div className="filters__chips filters__chips--scroll" role="group" aria-label="Recipe sources">
          {sourceFilters.options.length === 0 ? (
            <p className="filters__hint">Sources will appear once recipes are loaded.</p>
          ) : (
            sourceFilters.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className="chip-toggle"
                data-source-key={opt.key}
                aria-pressed={!sourceFilters.disabled.has(opt.key)}
                onClick={() => {
                  const currentlyEnabled = !sourceFilters.disabled.has(opt.key);
                  trackEvent('source_toggle', {
                    source_key: opt.key,
                    source_label: opt.label,
                    enabled: !currentlyEnabled,
                    recipe_count: opt.count,
                  });
                  toggleSourceFilter(opt.key);
                }}
              >
                <span>{opt.label}</span>
                <span className="chip-toggle__count">{opt.count}</span>
              </button>
            ))
          )}
        </div>

        <div className="filters__subheader">
          <h3>Ingredient availability</h3>
          <div className="filters__actions">
            <button
              type="button"
              className="filters__action"
              disabled={sourceCategoryFilters.disabled.size === 0}
              onClick={() => {
                trackEvent('source_categories_reset', {
                  disabled_count: sourceCategoryFilters.disabled.size,
                  total_categories: sourceCategoryFilters.options.length,
                });
                resetSourceCategoryFilters();
              }}
            >
              Reset categories
            </button>
          </div>
        </div>
        <p className="filters__hint">
          Hide dispenser, crate, or vendor options from ingredient details.
        </p>
        <div
          className="filters__chips filters__chips--scroll"
          role="group"
          aria-label="Ingredient source categories"
        >
          {visibleCategoryEntries.length === 0 ? (
            <p className="filters__hint">
              {sourceCategoryFilters.options.length
                ? 'No categories match your search.'
                : 'Source categories will appear once recipe data is loaded.'}
            </p>
          ) : (
            visibleCategoryEntries.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className="chip-toggle"
                data-source-category-key={opt.key}
                aria-pressed={!sourceCategoryFilters.disabled.has(opt.key)}
                title={opt.label}
                onClick={() => {
                  const currentlyEnabled = !sourceCategoryFilters.disabled.has(opt.key);
                  trackEvent('source_category_toggle', {
                    category_key: opt.key,
                    category_label: opt.label,
                    enabled: !currentlyEnabled,
                    occurrence_count: opt.count,
                  });
                  toggleSourceCategoryFilter(opt.key);
                }}
              >
                <span>{opt.label}</span>
                <span className="chip-toggle__count">{opt.count}</span>
              </button>
            ))
          )}
        </div>
        {categoryEntries.length > SOURCE_CATEGORY_VISIBLE_LIMIT && !normalizedCategorySearch.length && (
          <button
            type="button"
            className="filters__action"
            aria-expanded={sourceCategoryFilters.showAll}
            onClick={() => {
              const next = !sourceCategoryFilters.showAll;
              trackEvent('source_categories_show_all', {
                show_all: next,
                total_categories: categoryEntries.length,
              });
              toggleSourceCategoryShowAll();
            }}
          >
            {sourceCategoryFilters.showAll ? 'Show less' : `Show all (${categoryEntries.length})`}
          </button>
        )}
      </section>

      <section className="filters__group">
        <div className="filters__header">
          <h2>Dataset</h2>
        </div>
        <dl className="stats">
          <div>
            <dt>Recipes</dt>
            <dd>{recipes.length}</dd>
          </div>
          <div>
            <dt>Fetched</dt>
            <dd>{fetchedAt ? new Date(fetchedAt).toLocaleString() : '-'}</dd>
          </div>
          <div>
            <dt>Game Version</dt>
            <dd>
              {version?.commit ? (
                version.commitUrl ? (
                  <a href={version.commitUrl} target="_blank" rel="noopener noreferrer">
                    {version.branch}@{version.commit}
                  </a>
                ) : (
                  `${version.branch}@${version.commit}`
                )
              ) : (
                version?.branch ?? '-'
              )}
            </dd>
          </div>
        </dl>
        {versionParts.length > 0 && (
          <p className="filters__hint version-hint">{versionParts.join(' · ')}</p>
        )}
      </section>
    </aside>
  );
}
