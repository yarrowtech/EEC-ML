import { useLayoutEffect, useRef, useState } from 'react';

// Sizes an element to exactly fill the viewport below where it starts, so the
// page itself never scrolls (only inner panes do). Measured rather than a
// hard-coded calc(100dvh - Npx): the admin header height varies by breakpoint
// and the mobile bottom-nav adds padding to <main> — both are accounted for.
const useFitViewportHeight = () => {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const main = el.closest('main');
      const bottomPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const viewportH = window.visualViewport?.height || window.innerHeight;
      setHeight(Math.max(320, Math.floor(viewportH - top - bottomPad)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    // Header height can change after fonts/images load.
    const t = setTimeout(measure, 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return { ref, style: height ? { height } : undefined };
};

export default useFitViewportHeight;
