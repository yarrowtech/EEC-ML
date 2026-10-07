import React, { useLayoutEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { getPoints } from '../utils/points';

const pointSubscribers = new Set();
if (typeof window !== 'undefined' && !window.__eecPointsBadgeListener) {
  window.__eecPointsBadgeListener = true;
  window.addEventListener('points:update', (event) => {
    const value = event?.detail?.total;
    pointSubscribers.forEach((subscriber) => subscriber(value ?? getPoints()));
  });
}

const PointsBadge = ({ className = '' }) => {
  const [points, setPoints] = useState(0);

  // Register during render as well as layout effect. This keeps the badge
  // responsive to synchronous points:update events emitted immediately after
  // mount by portal navigation and by the test/runtime event bridge.
  pointSubscribers.add(setPoints);

  useLayoutEffect(() => {
    setPoints(getPoints());
    pointSubscribers.add(setPoints);
    return () => pointSubscribers.delete(setPoints);
  }, []);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-sm font-semibold shadow-sm ${className}`}>
      <Coins className="w-4 h-4 text-amber-600" />
      <span>{points}</span>
      <span className="hidden sm:inline">Points</span>
    </div>
  );
};

export default PointsBadge;
