import { useEffect, useRef, useState } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  Home,
  GraduationCap,
  Users,
  IndianRupee,
  Settings,
  LogOut,
  LayoutGrid,
} from 'lucide-react';

/**
 * Mobile-only bottom tab bar for the admin portal (hidden at `lg` and up,
 * where the sidebar takes over).
 *
 * Five slots:
 * - Dashboard
 * - Students
 * - Teachers
 * - Fees
 * - Profile
 *
 * Active tab:
 * - Amber pill/capsule background
 * - White icon
 * - White text
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

const AdminBottomNav = ({
  onOpenMore,
  getNotificationCount = () => 0,
  adminUser,
  onLogoutRequest,
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const menuRef = useRef(null);

  /* -------------------------------------------------------
     Profile information
  ------------------------------------------------------- */

  const schoolLogoSrc =
    adminUser?.schoolLogo ||
    adminUser?.avatar ||
    '';

  const schoolName =
    adminUser?.schoolName ||
    '';

  const profileName =
    adminUser?.name ||
    'Admin';

  const profileRole =
    adminUser?.role ||
    'Administrator';

  const primaryName =
    schoolName ||
    profileName;

  const avatarInitials = (
    schoolName
      ? schoolName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
      : profileName.charAt(0)
  ).toUpperCase();

  /* -------------------------------------------------------
     Close profile menu when clicking outside
  ------------------------------------------------------- */

  useEffect(() => {
    if (!showProfileMenu) return undefined;

    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [showProfileMenu]);

  /* -------------------------------------------------------
     Close profile menu when route changes
  ------------------------------------------------------- */

  useEffect(() => {
    setShowProfileMenu(false);
  }, [pathname]);

  /* -------------------------------------------------------
     Active state
  ------------------------------------------------------- */

  const onPrimaryTab = TABS.some(({ match }) =>
    match(pathname)
  );

  const profileActive =
    showProfileMenu ||
    !onPrimaryTab;

  /* -------------------------------------------------------
     Render
  ------------------------------------------------------- */

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
      <div className="grid h-14 grid-cols-5 px-1.5">

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
                  items-center
                  justify-center
                  px-2
                  py-1.5
                  transition-all
                  active:scale-95
                "
              >
                {/* Active pill */}
                <span
                  className={`
                    flex
                    h-full
                    w-full
                    flex-col
                    items-center
                    justify-center
                    gap-0.5
                    rounded-full
                    transition-all
                    duration-200
                    ${
                      active
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-400'
                    }
                  `}
                >

                  {/* Icon + notification badge */}
                  <span className="relative">

                    <Icon
                      size={20}
                      strokeWidth={
                        active
                          ? 2.5
                          : 2
                      }
                    />

                    {count > 0 && (
                      <span
                        className="
                          absolute
                          -right-1.5
                          -top-1.5
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

                  {/* Label */}
                  <span
                    className={`
                      text-[10px]
                      leading-none
                      tracking-tight
                      ${
                        active
                          ? 'font-bold text-white'
                          : 'font-medium'
                      }
                    `}
                  >
                    {label}
                  </span>

                </span>
              </Link>
            );
          }
        )}

        {/* ==================================================
            PROFILE TAB
        ================================================== */}

        <div
          ref={menuRef}
          className="
            relative
            flex
            h-full
            px-2
            py-1.5
          "
        >
          <button
            type="button"
            onClick={() =>
              setShowProfileMenu(
                (p) => !p
              )
            }
            aria-current={
              onPrimaryTab
                ? undefined
                : 'page'
            }
            className={`
              flex
              w-full
              flex-col
              items-center
              justify-center
              gap-0.5
              rounded-full
              transition-all
              duration-200
              active:scale-95
              ${
                profileActive
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-400'
              }
            `}
            aria-label="Open profile menu"
            aria-expanded={
              showProfileMenu
            }
          >

            {/* Profile image */}
            <span
              className={`
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                overflow-hidden
                rounded-full
                ring-1
                ${
                  profileActive
                    ? 'ring-white/70'
                    : 'ring-slate-300'
                }
              `}
            >
              {schoolLogoSrc ? (
                <img
                  src={schoolLogoSrc}
                  alt={primaryName}
                  className="
                    h-full
                    w-full
                    object-cover
                  "
                />
              ) : (
                <span
                  className="
                    flex
                    h-full
                    w-full
                    items-center
                    justify-center
                    bg-gradient-to-br
                    from-blue-400
                    to-purple-500
                    text-[8px]
                    font-bold
                    text-white
                  "
                >
                  {avatarInitials}
                </span>
              )}
            </span>

            {/* Profile label */}
            <span
              className={`
                text-[10px]
                leading-none
                tracking-tight
                ${
                  profileActive
                    ? 'font-bold text-white'
                    : 'font-medium'
                }
              `}
            >
              Profile
            </span>

          </button>

          {/* ==================================================
              PROFILE POPUP
          ================================================== */}

          {showProfileMenu && (
            <div
              className="
                absolute
                bottom-full
                right-0
                mb-2
                w-60
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-xl
                animate-in
                fade-in
                slide-in-from-bottom-1
                duration-150
              "
            >

              {/* Profile header */}
              <div
                className="
                  flex
                  items-center
                  gap-2.5
                  border-b
                  border-gray-100
                  px-4
                  py-3
                "
              >

                {/* Avatar */}
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-full
                    bg-gradient-to-br
                    from-blue-400
                    to-purple-500
                    ring-2
                    ring-white
                    shadow-sm
                  "
                >
                  {schoolLogoSrc ? (
                    <img
                      src={schoolLogoSrc}
                      alt={primaryName}
                      className="
                        h-full
                        w-full
                        object-cover
                      "
                    />
                  ) : (
                    <span
                      className="
                        text-xs
                        font-semibold
                        text-white
                      "
                    >
                      {avatarInitials}
                    </span>
                  )}
                </div>

                {/* Name / Role */}
                <div
                  className="
                    min-w-0
                    flex-1
                    text-left
                  "
                >
                  <p
                    className="
                      truncate
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    {primaryName}
                  </p>

                  <p
                    className="
                      truncate
                      text-[11px]
                      text-slate-400
                    "
                  >
                    {profileRole}
                  </p>
                </div>

              </div>

              {/* Menu items */}
              <div className="py-1.5">

                {/* Full Menu */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(
                      false
                    );

                    onOpenMore?.();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2.5
                    px-4
                    py-2.5
                    text-left
                    text-sm
                    text-slate-700
                    transition-colors
                    hover:bg-gray-50
                  "
                >
                  <LayoutGrid
                    size={15}
                    className="text-slate-400"
                  />

                  Full Menu
                </button>

                {/* Settings */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(
                      false
                    );

                    navigate(
                      '/admin/settings'
                    );
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2.5
                    px-4
                    py-2.5
                    text-left
                    text-sm
                    text-slate-700
                    transition-colors
                    hover:bg-gray-50
                  "
                >
                  <Settings
                    size={15}
                    className="text-slate-400"
                  />

                  Settings
                </button>

                {/* Divider */}
                <div
                  className="
                    my-1
                    border-t
                    border-gray-100
                  "
                />

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(
                      false
                    );

                    onLogoutRequest?.();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-2.5
                    px-4
                    py-2.5
                    text-left
                    text-sm
                    text-rose-600
                    transition-colors
                    hover:bg-rose-50
                  "
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