import { useState, useEffect } from 'react';
import { trackEvent } from '@/utils';
import './BackToTop.css';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    trackEvent('back_to_top', {
      scroll_y: Math.round(window.scrollY),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button type="button" className="back-to-top" aria-label="Back to top" onClick={scrollToTop}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
