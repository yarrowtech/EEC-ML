import { Link, useLocation } from 'react-router-dom';
import { Home, GraduationCap, Users, IndianRupee, Menu } from 'lucide-react';

/**
 * Mobile-only bottom tab bar for the admin portal (hidden at `lg` and up,
 * where the sidebar takes over). Five slots: four primary destinations plus
 * "More", which opens the full slide-in menu.
 */
const TABS = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: Home, match: (p) => p.startsWith('/admin/dashboard') },
  { to: '/admin/students', label: 'Students', Icon: GraduationCap, match: (p) => p.startsWith('/admin/students') },
  { to: '/admin/teachers', label: 'Teachers', Icon: Users, match: (p) => p.startsWith('/admin/teachers') },
  { to: '/admin/fees/dashboard', label: 'Fees', Icon: IndianRupee, match: (p) => p.startsWith('/admin/fees') },
];

const AdminBottomNav = ({ onOpenMore }) => {
  const { pathname } = useLocation();

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md safe-bottom"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5 h-14">
        {TABS.map(({ to, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 pt-1 transition-colors active:scale-95 ${
                active ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] leading-none tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 pt-1 text-slate-400 transition-transform active:scale-95"
          aria-label="Open full menu"
        >
          <Menu size={20} strokeWidth={2} />
          <span className="text-[10px] leading-none font-medium tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminBottomNav;
