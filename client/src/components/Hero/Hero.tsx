import { useApp } from '@/context/useApp';
import { trackEvent } from '@/utils';
import './Hero.css';

export function Hero() {
  const {
    searchTerm,
    setSearchTerm,
    alcoholicOnly,
    nonAlcoholicOnly,
    selectedIngredient,
    sortMode,
    sourceFilters,
    sourceCategoryFilters,
    recipes,
    filteredRecipes,
    showDeveloperDetails,
    setShowDeveloperDetails,
    setMobileFilterOpen,
  } = useApp();

  const toLimitedList = (items: string[], limit: number) => {
    const sliced = items.slice(0, limit);
    return {
      text: sliced.join('; '),
      truncated: items.length > limit,
      total: items.length,
    };
  };

  const submitSearch = () => {
    const normalized = searchTerm.trim();
    const query = normalized.slice(0, 120);

    const enabledSourceLabels = sourceFilters.options
      .filter((opt) => !sourceFilters.disabled.has(opt.key))
      .map((opt) => opt.label);
    const enabledCategoryLabels = sourceCategoryFilters.options
      .filter((opt) => !sourceCategoryFilters.disabled.has(opt.key))
      .map((opt) => opt.label);

    const sources = toLimitedList(enabledSourceLabels, 25);
    const categories = toLimitedList(enabledCategoryLabels, 25);

    trackEvent('search_submit', {
      query,
      query_length: normalized.length,
      has_query: normalized.length > 0,
      alcoholic_only: alcoholicOnly,
      non_alcoholic_only: nonAlcoholicOnly,
      selected_ingredient: selectedIngredient || null,
      sort_mode: sortMode,
      view_mode: showDeveloperDetails ? 'developer' : 'standard',
      recipes_total: recipes.length,
      recipes_visible: filteredRecipes.length,
      sources_enabled: sources.text,
      sources_enabled_total: sources.total,
      sources_enabled_truncated: sources.truncated,
      categories_enabled: categories.text,
      categories_enabled_total: categories.total,
      categories_enabled_truncated: categories.truncated,
    });
  };

  return (
    <header className="hero">
      <div className="hero__content">
        <h1>SS13 Bartender Companion</h1>
        <div className="hero__actions">
          <input
            type="search"
            placeholder="Search recipes or ingredients"
            aria-label="Search recipes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitSearch();
              }
            }}
            onBlur={() => {
              submitSearch();
            }}
          />
          <button
            type="button"
            className="hero__toggle mobile-only"
            aria-label="Open filters"
            onClick={() => {
              trackEvent('mobile_filters_open', { method: 'button' });
              setMobileFilterOpen(true);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            Filters
          </button>
          <button
            type="button"
            className="hero__toggle"
            aria-pressed={showDeveloperDetails}
            onClick={() => {
              const next = !showDeveloperDetails;
              trackEvent('view_mode_change', { mode: next ? 'developer' : 'standard' });
              setShowDeveloperDetails(next);
            }}
          >
            {showDeveloperDetails ? 'Hide developer details' : 'Show developer details'}
          </button>
          <div className="hero__quality-info">
            <span className="quality-label">Quality</span>
            <div className="quality-levels">
              <span className="quality-badge quality-badge--good">
                <span className="quality-badge__dot"></span>
                <span className="quality-badge__name">Good</span>
                <span className="quality-badge__boost">minor</span>
              </span>
              <span className="quality-badge quality-badge--great">
                <span className="quality-badge__dot"></span>
                <span className="quality-badge__name">Great</span>
                <span className="quality-badge__boost">moderate</span>
              </span>
              <span className="quality-badge quality-badge--excellent">
                <span className="quality-badge__dot"></span>
                <span className="quality-badge__name">Excellent</span>
                <span className="quality-badge__boost">strong</span>
              </span>
              <span className="quality-badge quality-badge--fantastic">
                <span className="quality-badge__dot"></span>
                <span className="quality-badge__name">Fantastic</span>
                <span className="quality-badge__boost">best</span>
              </span>
            </div>
            <span className="quality-suffix">mood boost</span>
          </div>
        </div>
      </div>
    </header>
  );
}
