import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import { PRINCIPAL_MENU_ITEMS } from './principalConstants';

const getDisplayValue = (value, fallback) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
};

const Tooltip = ({ label, sub, visible }) => (
  <div
    className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[999] transition-all duration-150 ${
      visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
    }`}
  >
    <div className="whitespace-nowrap min-w-max rounded-xl bg-slate-900 px-3 py-2 text-white shadow-2xl">
      <p className="text-xs font-bold">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
    </div>
  </div>
);

const PrincipalSidebar = ({ isOpen, setIsOpen, principalProfile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoverId, setHoverId] = useState(null);
  const collapsed = !isOpen;

  const handleLogout = () => {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  const principalName = getDisplayValue(principalProfile?.name, 'Principal');
  const schoolName = getDisplayValue(
    principalProfile?.schoolName || principalProfile?.campusName,
    'Electronic Educare Center'
  );
  const schoolLogo = getDisplayValue(principalProfile?.schoolLogo, '');
  const nameParts = principalName.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'P');

  const handleNavigate = (path) => {
    navigate(path);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsOpen(false);
  };

  return (
    <>
      <style>{`
        .principal-scrollbar::-webkit-scrollbar { width: 6px; }
        .principal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .principal-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 10px; }
        .principal-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.6); }
        .principal-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.4) transparent; }
      `}</style>
      <div
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-all duration-300 ${
          isOpen ? 'w-72' : 'w-16'
        }`}
      >
        {/* Header */}
        <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 ${isOpen ? 'p-4' : 'py-4 px-0'}`}>
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />

          {isOpen ? (
            <div className="relative z-10">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/25 shadow-sm">
                      {schoolLogo ? (
                        <img
                          src={schoolLogo}
                          alt={schoolName}
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="max-w-[150px] truncate text-sm font-black leading-tight text-white">{principalName}</p>
                    <p className="mt-0.5 truncate text-[10px] leading-none text-white/75">{schoolName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/30 bg-white/20 transition-colors hover:bg-white/35"
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={14} className="text-white" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/25 shadow-sm">
                  {schoolLogo ? (
                    <img
                      src={schoolLogo}
                      alt={schoolName}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-white" />
                  )}
                </div>
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <button
                onClick={() => setIsOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/30 bg-white/20 transition-colors hover:bg-white/35"
                title="Expand sidebar"
              >
                <ChevronRight size={12} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`principal-scrollbar flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
          <div className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
            {PRINCIPAL_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === 'overview'
                ? (location.pathname === '/principal' || location.pathname === '/principal/' || location.pathname === '/principal/overview')
                : location.pathname.startsWith(item.path);

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => collapsed && setHoverId(item.id)}
                  onMouseLeave={() => collapsed && setHoverId(null)}
                >
                  <button
                    onClick={() => handleNavigate(item.path)}
                    className={`group relative flex w-full items-center rounded-xl transition-all duration-200 ${
                      collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5'
                    } ${
                      isActive
                        ? 'border border-amber-200 bg-amber-50 text-amber-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div
                      className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                        collapsed ? 'h-8 w-8' : 'h-7 w-7'
                      } ${isActive ? `${item.iconBg} ${item.iconColor}` : 'bg-slate-100 text-slate-500'}`}
                    >
                      <Icon size={collapsed ? 16 : 15} />
                    </div>
                    {!collapsed && (
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block truncate text-xs text-slate-400">{item.description}</span>
                      </div>
                    )}
                    {collapsed && isActive && (
                      <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-white bg-amber-400" />
                    )}
                  </button>
                  {collapsed && <Tooltip label={item.label} sub={item.description} visible={hoverId === item.id} />}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className={`shrink-0 border-t border-slate-100 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          {!collapsed && (
            <div className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-sm">
                <span className="text-xs font-black text-white">{initials.toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{principalName}</p>
                <p className="truncate text-[10px] text-slate-400">{schoolName}</p>
              </div>
            </div>
          )}

          <div
            className="relative"
            onMouseEnter={() => collapsed && setHoverId('__logout')}
            onMouseLeave={() => collapsed && setHoverId(null)}
          >
            <button
              onClick={handleLogout}
              className={`group flex w-full items-center rounded-xl text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 ${
                collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5'
              }`}
            >
              <div className={`flex shrink-0 items-center justify-center rounded-full bg-red-50 transition-colors group-hover:bg-red-100 ${collapsed ? 'h-8 w-8' : 'h-7 w-7'}`}>
                <LogOut size={collapsed ? 15 : 14} className="text-red-500" />
              </div>
              {!collapsed && (
                <div className="text-left">
                  <p className="text-sm font-semibold">Logout</p>
                  <p className="text-[10px] text-red-400">Sign out securely</p>
                </div>
              )}
            </button>
            {collapsed && <Tooltip label="Logout" sub="Sign out securely" visible={hoverId === '__logout'} />}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrincipalSidebar;
