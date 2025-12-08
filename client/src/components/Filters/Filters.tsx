import { useApp } from '@/context/useApp';
import { SOURCE_CATEGORY_VISIBLE_LIMIT } from '@/constants';
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
              setAlcoholicOnly(e.target.checked);
              if (e.target.checked) setNonAlcoholicOnly(false);
            }}
          />
          <span>Alcoholic only</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={nonAlcoholicOnly}
            onChange={(e) => {
              setNonAlcoholicOnly(e.target.checked);
              if (e.target.checked) setAlcoholicOnly(false);
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
          onChange={(e) => setSelectedIngredient(e.target.value)}
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
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
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
              onClick={resetSourceFilters}
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
                onClick={() => toggleSourceFilter(opt.key)}
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
              onClick={resetSourceCategoryFilters}
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
                onClick={() => toggleSourceCategoryFilter(opt.key)}
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
            onClick={toggleSourceCategoryShowAll}
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
