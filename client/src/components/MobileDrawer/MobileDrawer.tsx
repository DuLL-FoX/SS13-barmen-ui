import { useEffect } from 'react';
import { useApp } from '@/context/useApp';
import { Filters } from '@/components/Filters';
import { trackEvent } from '@/utils';
import './MobileDrawer.css';

export function MobileDrawer() {
  const { mobileFilterOpen, setMobileFilterOpen } = useApp();

  useEffect(() => {
    if (mobileFilterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileFilterOpen]);

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
