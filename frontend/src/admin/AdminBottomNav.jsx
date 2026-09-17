import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, GraduationCap, Users, IndianRupee, Settings, LogOut, LayoutGrid } from 'lucide-react';

/**
 * Mobile-only bottom tab bar for the admin portal (hidden at `lg` and up,
 * where the sidebar takes over). Five slots: four primary destinations plus
 * "More", which opens the full slide-in menu.
 */
const TABS = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: Home, match: (p) => p.startsWith('/admin/dashboard') },
  { to: '/admin/students', label: 'Students', Icon: GraduationCap, match: (p) => p.startsWith('/admin/students') },
  { to: '/admin/teachers', label: 'Teachers', Icon: Users, match: (p) => p.startsWith('/admin/teachers') },
  // Badge count is keyed off /fees/collection (where fee notifications resolve to),
  // even though the tab itself links to the dashboard view.
  { to: '/admin/fees/dashboard', badgePath: '/admin/fees/collection', label: 'Fees', Icon: IndianRupee, match: (p) => p.startsWith('/admin/fees') },
];

const AdminBottomNav = ({ onOpenMore, getNotificationCount = () => 0, adminUser, onLogoutRequest }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  const schoolLogoSrc = adminUser?.schoolLogo || adminUser?.avatar || '';
  const schoolName    = adminUser?.schoolName || '';
  const profileName   = adminUser?.name || 'Admin';
  const profileRole   = adminUser?.role || 'Administrator';
  const primaryName   = schoolName || profileName;
  const avatarInitials = (schoolName
    ? schoolName.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : profileName.charAt(0)
  ).toUpperCase();

  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  useEffect(() => { setShowProfileMenu(false); }, [pathname]);

  const onPrimaryTab = TABS.some(({ match }) => match(pathname));
  const profileActive = showProfileMenu || !onPrimaryTab;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md safe-bottom"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5 h-14">
        {TABS.map(({ to, badgePath, label, Icon, match }) => {
          const active = match(pathname);
          const count = getNotificationCount(badgePath || to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 pt-1 transition-colors active:scale-95 ${
                active ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span className={`text-[10px] leading-none tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <div ref={menuRef} className="relative flex h-full">
          <button
            type="button"
            onClick={() => setShowProfileMenu((p) => !p)}
            aria-current={onPrimaryTab ? undefined : 'page'}
            className={`flex w-full flex-col items-center justify-center gap-0.5 pt-1 transition-colors active:scale-95 ${
              profileActive ? 'text-amber-600' : 'text-black'
            }`}
            aria-label="Open profile menu"
            aria-expanded={showProfileMenu}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${
                profileActive ? 'ring-amber-500' : 'ring-slate-300'
              }`}
            >
              {schoolLogoSrc ? (
                <img src={schoolLogoSrc} alt={primaryName} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-[8px] font-bold text-white">
                  {avatarInitials}
                </span>
              )}
            </span>
            <span className={`text-[10px] leading-none tracking-tight ${profileActive ? 'font-bold' : 'font-medium'}`}>
              Profile
            </span>
          </button>

          {showProfileMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-150">
              <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-purple-500 ring-2 ring-white shadow-sm">
                  {schoolLogoSrc ? (
                    <img src={schoolLogoSrc} alt={primaryName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-white">{avatarInitials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-bold text-slate-900">{primaryName}</p>
                  <p className="truncate text-[11px] text-slate-400">{profileRole}</p>
                </div>
              </div>
              <div className="py-1.5">
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); onOpenMore?.(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-gray-50"
                >
                  <LayoutGrid size={15} className="text-slate-400" />
                  Full Menu
                </button>
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); navigate('/admin/settings'); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-gray-50"
                >
                  <Settings size={15} className="text-slate-400" />
                  Settings
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); onLogoutRequest?.(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AdminBottomNav;
