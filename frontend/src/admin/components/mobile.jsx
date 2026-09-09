import { Plus } from 'lucide-react';

/**
 * Shared mobile-responsive primitives for the admin portal.
 *   - PillRow  : horizontal-scroll strip for filter pills / tabs (no scrollbar)
 *   - Pill     : single filter pill button
 *   - Fab      : floating action button, parked above the mobile bottom nav
 *   - ResponsiveTableWrap : keeps a wide <table> scrollable instead of blowing
 *                           out the page width on small screens
 */

export const PillRow = ({ children, className = '', edgeToEdge = true }) => (
  <div
    className={`flex gap-2 overflow-x-auto no-scrollbar ${
      edgeToEdge ? '-mx-4 px-4 sm:mx-0 sm:px-0' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const Pill = ({ active = false, className = '', children, ...rest }) => (
  <button
    type="button"
    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
      active
        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/25'
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export const Fab = ({ icon: Icon = Plus, label, className = '', ...rest }) => (
  <button
    type="button"
    className={`fixed right-4 z-30 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-600 hover:shadow-xl active:scale-95 bottom-nav-offset lg:bottom-6 ${className}`}
    {...rest}
  >
    <Icon size={18} strokeWidth={2.5} />
    {label && <span>{label}</span>}
  </button>
);

export const ResponsiveTableWrap = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
    {children}
  </div>
);
