import { useApp } from '@/context/useApp';
import './Hero.css';

export function Hero() {
  const {
    searchTerm,
    setSearchTerm,
    showDeveloperDetails,
    setShowDeveloperDetails,
    setMobileFilterOpen,
  } = useApp();

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
          />
          <button
            type="button"
            className="hero__toggle mobile-only"
            aria-label="Open filters"
            onClick={() => setMobileFilterOpen(true)}
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
            onClick={() => setShowDeveloperDetails(!showDeveloperDetails)}
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
