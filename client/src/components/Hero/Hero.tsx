import { useEffect, useRef } from 'react';
import { useApp } from '@/context/useApp';
import { trackEvent } from '@/utils';
import './Hero.css';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

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

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const input = searchRef.current;
      if (!input) return;
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      const isShortcut =
        (modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') ||
        (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target));
      if (!isShortcut) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
        <div className="neon-sign">
          <div className="neon-sign__eyebrow">Deck 7 · Promenade · Est. 2441</div>
          <h1 className="neon-sign__title">
            THE&nbsp;ORBITAL<span className="neon-sign__amp">&amp;</span>BAR
          </h1>
          <div className="neon-sign__sub">Bartender Companion Terminal</div>
        </div>

        <div className="command-bar">
          <div className="command-bar__search-wrap">
            <span className="command-bar__search-icon" aria-hidden="true">›</span>
            <input
              ref={searchRef}
              type="search"
              className="command-bar__search"
              placeholder="Search recipes, reagents, ingredients…"
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
            <div className="command-bar__kbd" aria-hidden="true">
              <span className="kbd">{isMac ? '⌘' : 'Ctrl'}</span><span className="kbd">K</span>
            </div>
          </div>
          <button
            type="button"
            className="btn command-bar__pill command-bar__pill--mobile"
            aria-label="Open filters"
            onClick={() => {
              trackEvent('mobile_filters_open', { method: 'button' });
              setMobileFilterOpen(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            Menu
          </button>
          <button
            type="button"
            className="btn command-bar__pill"
            aria-pressed={showDeveloperDetails}
            onClick={() => {
              const next = !showDeveloperDetails;
              trackEvent('view_mode_change', { mode: next ? 'developer' : 'standard' });
              setShowDeveloperDetails(next);
            }}
          >
            <span aria-hidden="true">✎</span>
            {showDeveloperDetails ? 'Dev on' : 'Dev'}
          </button>
        </div>

        <div className="hero__quality-info" aria-label="Quality tiers">
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
    </header>
  );
}
