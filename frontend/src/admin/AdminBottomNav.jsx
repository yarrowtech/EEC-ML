import { Link, useLocation } from 'react-router-dom';
import { Home, GraduationCap, Users, IndianRupee, Menu } from 'lucide-react';

/**
 * Mobile-only bottom tab bar for the admin portal.
 *
 * Active state:
 * - Icon gets a circular amber background
 * - Icon becomes white
 * - Text becomes amber
 * - No background behind the complete tab
 */

const TABS = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    Icon: Home,
    match: (p) => p.startsWith('/admin/dashboard'),
  },
  {
    to: '/admin/students',
    label: 'Students',
    Icon: GraduationCap,
    match: (p) => p.startsWith('/admin/students'),
  },
  {
    to: '/admin/teachers',
    label: 'Teachers',
    Icon: Users,
    match: (p) => p.startsWith('/admin/teachers'),
  },
  {
    to: '/admin/fees/dashboard',
    badgePath: '/admin/fees/collection',
    label: 'Fees',
    Icon: IndianRupee,
    match: (p) => p.startsWith('/admin/fees'),
  },
];

const AdminBottomNav = ({ onOpenMore, getNotificationCount = () => 0 }) => {
  const { pathname } = useLocation();

  return (
    <nav
      className="
        lg:hidden
        fixed
        inset-x-0
        bottom-0
        z-40
        border-t
        border-gray-200
        bg-white/95
        backdrop-blur-md
        safe-bottom
      "
      aria-label="Primary navigation"
    >
      <div className="grid h-14 grid-cols-5 px-1">

        {/* ==================================================
            PRIMARY TABS
        ================================================== */}

        {TABS.map(
          ({
            to,
            badgePath,
            label,
            Icon,
            match,
          }) => {
            const active = match(pathname);

            const count =
              getNotificationCount(
                badgePath || to
              );

            return (
              <Link
                key={to}
                to={to}
                aria-current={
                  active
                    ? 'page'
                    : undefined
                }
                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  gap-0.5
                  transition-all
                  active:scale-95
                "
              >

                {/* ==========================================
                    ICON CIRCLE
                ========================================== */}

                <span
                  className={`
                    relative
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    transition-all
                    duration-200
                    ${
                      active
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-transparent text-slate-400'
                    }
                  `}
                >
                  <Icon
                    size={19}
                    strokeWidth={
                      active
                        ? 2.5
                        : 2
                    }
                  />

                  {/* Notification badge */}
                  {count > 0 && (
                    <span
                      className="
                        absolute
                        -right-1
                        -top-1
                        flex
                        h-3.5
                        min-w-3.5
                        items-center
                        justify-center
                        rounded-full
                        bg-red-500
                        px-1
                        text-[8px]
                        font-bold
                        text-white
                      "
                    >
                      {count > 99
                        ? '99+'
                        : count}
                    </span>
                  )}
                </span>

                {/* ==========================================
                    TEXT
                ========================================== */}

                <span
                  className={`
                    text-[10px]
                    leading-none
                    tracking-tight
                    transition-colors
                    ${
                      active
                        ? 'font-bold text-amber-600'
                        : 'font-medium text-slate-400'
                    }
                  `}
                >
                  {label}
                </span>

              </Link>
            );
          }
        )}

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