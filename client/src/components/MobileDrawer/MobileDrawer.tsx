import { useEffect } from 'react';
import { useApp } from '@/context/useApp';
import { Filters } from '@/components/Filters';
import { trackEvent } from '@/utils';
import './MobileDrawer.css';

export function MobileDrawer() {
  const { mobileFilterOpen, setMobileFilterOpen } = useApp();

  useEffect(() => {
    if (!mobileFilterOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        trackEvent('mobile_filters_close', { method: 'escape' });
        setMobileFilterOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileFilterOpen, setMobileFilterOpen]);

  return (
    <div className="mobile-drawer" aria-hidden={!mobileFilterOpen}>
      <div
        className="mobile-drawer__overlay"
        onClick={() => {
          trackEvent('mobile_filters_close', { method: 'overlay' });
          setMobileFilterOpen(false);
        }}
      />
      <div className="mobile-drawer__content">
        <header className="mobile-drawer__header">
          <h2>Filters</h2>
          <button
            type="button"
            className="mobile-drawer__close"
            aria-label="Close filters"
            onClick={() => {
              trackEvent('mobile_filters_close', { method: 'button' });
              setMobileFilterOpen(false);
            }}
          >
            &times;
          </button>
        </header>
        <Filters />
      </div>
    </div>
  );
}
