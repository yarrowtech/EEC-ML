import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, LogOut, X } from 'lucide-react';
import { ADMIN_MENU_ITEMS } from './adminConstants';
import { NavLink } from 'react-router-dom';

const AdminSidebar = ({
  onMenuItemClick,
  collapsed = false,
  onToggleSidebar,
  menuItems = ADMIN_MENU_ITEMS,
  adminUser,
  profileLoading = false,
  mobileOpen = false,
  onMobileClose,
  onLogoutRequest,
}) => {
  const [expandedMenus, setExpandedMenus] = useState({});
  const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onMobileClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onMobileClose]);
  useEffect(() => {
    if (!profileLoading) {
      setSkeletonTimedOut(false);
      return undefined;
    }
    const timeout = setTimeout(() => setSkeletonTimedOut(true), 7000);
    return () => clearTimeout(timeout);
  }, [profileLoading]);

  const brandLogoSrc = adminUser?.schoolLogo || adminUser?.avatar || '';
  const schoolName   = adminUser?.schoolName || adminUser?.name || 'School Admin';
  const campusLabel  = adminUser?.campusName
    ? `${adminUser.campusName}${adminUser.campusType ? ` · ${adminUser.campusType}` : ''}`
    : adminUser?.campusType || '';
  const footerInitial = (adminUser?.name || 'A').charAt(0).toUpperCase();
  const footerName    = adminUser?.name || 'Admin User';
  const footerRole    = adminUser?.role || 'Administrator';
  const showSkeleton = profileLoading && !skeletonTimedOut;

  const toggleSubmenu = (label) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          fixed lg:sticky inset-y-0 lg:inset-y-auto left-0 lg:top-0 z-50 lg:z-auto
          flex flex-col h-dvh bg-white border-r border-gray-100 shadow-lg
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* ── Brand header ── */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 relative">
          {/* Logo */}
          <div className={`
            shrink-0 rounded-xl overflow-hidden flex items-center justify-center
            bg-linear-to-br from-yellow-500 to-amber-700 shadow-md shadow-indigo-200
            transition-all duration-300
            ${collapsed ? 'w-9 h-9' : 'w-10 h-10'}
            ${showSkeleton ? 'animate-pulse bg-gray-200' : ''}
          `}>
            {!showSkeleton && (brandLogoSrc ? (
              <img src={brandLogoSrc} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-sm">
                {schoolName.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>

          {/* School name + campus — skeleton while loading */}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              {showSkeleton ? (
                <>
                  <div className="h-3 w-28 bg-gray-200 rounded-full animate-pulse mb-1.5" />
                  <div className="h-2.5 w-20 bg-gray-100 rounded-full animate-pulse" />
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-900 truncate leading-tight">{schoolName}</p>
                  {campusLabel && (
                    <p className="text-[11px] text-indigo-500 font-medium truncate mt-0.5">{campusLabel}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleSidebar}
            className={`
              hidden lg:flex shrink-0 items-center justify-center rounded-lg
              transition-all duration-200
              ${collapsed
                ? 'w-9 h-9 bg-yellow-500 hover:bg-yellow-600 text-white shadow-md hover:shadow-lg'
                : 'w-7 h-7 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}
            `}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={15} />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Close menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const isExpanded = expandedMenus[item.label];
            const itemKey = `${item.label}:${item.path || 'root'}`;

            return (
              <div key={itemKey || idx}>
                {item.hasSubmenu ? (
                  <>
                    <button
                      onClick={() => toggleSubmenu(item.label)}
                      title={collapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-gray-500 hover:text-gray-900 hover:bg-gray-50
                        transition-all duration-150 group
                        ${collapsed ? 'justify-center' : ''}
                        ${isExpanded && !collapsed ? 'text-gray-900 bg-gray-50' : ''}
                      `}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 transition-colors ${isExpanded && !collapsed ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'}`}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-sm font-semibold">{item.label}</span>
                          {isExpanded
                            ? <ChevronDown size={14} className="text-indigo-400 shrink-0" />
                            : <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />}
                        </>
                      )}
                    </button>

                    {isExpanded && !collapsed && (
                      <div className="mt-0.5 ml-4 pl-3 border-l-2 border-indigo-100 space-y-0.5">
                        {item.submenu.map((sub) => {
                          const SubIcon = sub.icon;
                          const subKey = `${sub.label}:${sub.path}`;
                          return (
                            <NavLink
                              key={subKey}
                              to={sub.path}
                              end
                              onClick={() => { onMenuItemClick(sub.label); onMobileClose?.(); }}
                            >
                              {({ isActive }) => (
                                <div className={`
                                  flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                                  ${isActive
                                    ? 'bg-yellow-50 text-yellow-700 font-semibold shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                                `}>
                                  <SubIcon size={14} className={`shrink-0 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} />
                                  <span>{sub.label}</span>
                                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0 animate-pulse" />}
                                </div>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    onClick={() => { onMenuItemClick(item.label); onMobileClose?.(); }}
                  >
                    {({ isActive }) => (
                      <div
                        title={collapsed ? item.label : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-xl
                          transition-all duration-150 group
                          ${collapsed ? 'justify-center' : ''}
                          ${isActive
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                        `}
                      >
                        <Icon
                          size={18}
                          className={`shrink-0 transition-colors ${isActive ? 'text-yellow-600' : 'text-gray-400 group-hover:text-yellow-500'}`}
                        />
                        {!collapsed && (
                          <span className={`text-sm flex-1 ${isActive ? 'font-bold' : 'font-semibold'}`}>
                            {item.label}
                          </span>
                        )}
                        {!collapsed && isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                        )}
                      </div>
                    )}
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          {/* User row — skeleton while loading */}
          <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
            <div className={`w-8 h-8 rounded-xl shrink-0 overflow-hidden flex items-center justify-center
              ${showSkeleton ? 'bg-gray-200 animate-pulse' : 'bg-indigo-100'}`}>
              {!showSkeleton && (brandLogoSrc ? (
                <img src={brandLogoSrc} alt={footerName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-indigo-600 font-bold text-sm">{footerInitial}</span>
              ))}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {showSkeleton ? (
                  <>
                    <div className="h-2.5 w-24 bg-gray-200 rounded-full animate-pulse mb-1.5" />
                    <div className="h-2 w-16 bg-gray-100 rounded-full animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-gray-900 truncate">{footerName}</p>
                    <p className="text-[11px] text-gray-400 truncate">{footerRole}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={onLogoutRequest}
            title={collapsed ? 'Logout' : undefined}
            aria-label="Logout"
            className={`
              w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
              text-gray-400 hover:text-red-600 hover:bg-red-50
              transition-all duration-150 text-sm font-semibold
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut size={15} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Smooth scrollbar for navigation */
        nav::-webkit-scrollbar {
          width: 4px;
        }

        nav::-webkit-scrollbar-track {
          background: transparent;
        }

        nav::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 4px;
        }

        nav::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </>
  );
};

export default AdminSidebar;
