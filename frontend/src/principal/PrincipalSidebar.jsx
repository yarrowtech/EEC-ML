import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, GraduationCap, ChevronDown, HelpCircle, ArrowRight, Info } from 'lucide-react';
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
        <div className={`relative shrink-0 border-b border-slate-100 ${isOpen ? 'p-4' : 'py-4 px-0'}`}>
          {isOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm">
                  {schoolLogo ? (
                    <img
                      src={schoolLogo}
                      alt={schoolName}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight text-slate-900">{schoolName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100"
                title="Collapse sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt={schoolName}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <GraduationCap className="h-5 w-5 text-white" />
                )}
              </div>
              <button
                onClick={() => setIsOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100"
                title="Expand sidebar"
              >
                <ChevronRight size={12} />
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
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div
                      className={`flex shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        collapsed ? 'h-8 w-8' : 'h-7 w-7'
                      } ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      <Icon size={collapsed ? 16 : 15} />
                    </div>
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{item.label}</span>
                    )}
                    {collapsed && isActive && (
                      <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-white bg-indigo-500" />
                    )}
                  </button>
                  {collapsed && <Tooltip label={item.label} sub={item.description} visible={hoverId === item.id} />}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className={`shrink-0 space-y-2.5 border-t border-slate-100 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          {!collapsed && (
            <button
              type="button"
              onClick={() => handleNavigate('/principal/profile')}
              className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm">
                <span className="text-xs font-black text-white">{initials.toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{principalName}</p>
                <p className="truncate text-[10px] text-slate-400">Principal</p>
              </div>
              <Info size={14} className="shrink-0 text-slate-400" />
            </button>
          )}

          <div
            className="relative"
            onMouseEnter={() => collapsed && setHoverId('__logout')}
            onMouseLeave={() => collapsed && setHoverId(null)}
          >
            <button
              onClick={handleLogout}
              className={`group flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 ${
                collapsed ? 'h-10 w-10 mx-auto' : 'px-4 py-2.5'
              }`}
            >
              <LogOut size={collapsed ? 15 : 14} />
              {!collapsed && <span className="text-sm font-semibold">Logout</span>}
            </button>
            {collapsed && <Tooltip label="Logout" sub="Sign out" visible={hoverId === '__logout'} />}
          </div>

          {/* {!collapsed && (
            <div className="rounded-2xl bg-indigo-50 p-3.5 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                <HelpCircle size={16} className="text-indigo-600" />
              </div>
              <p className="text-xs font-bold text-slate-800">Need Help?</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Check our help center</p>
              <button
                onClick={() => handleNavigate('/principal/communications')}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
              >
                Visit Help Center
                <ArrowRight size={12} />
              </button>
            </div>
          )} */}
        </div>
      </div>
    </>
  );
};

export default PrincipalSidebar;
