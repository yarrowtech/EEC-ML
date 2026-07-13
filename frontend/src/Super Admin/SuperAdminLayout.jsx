import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Building2,
  MessageSquare,
  AlertTriangle,
  Menu,
  Activity,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

const navLinks = [
  { to: '/super-admin/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/super-admin/requests', label: 'Requests', icon: Building2 },
  { to: '/super-admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/super-admin/issues', label: 'Issues', icon: AlertTriangle },
  { to: '/super-admin/operations', label: 'Operations', icon: Activity },
  { to: '/super-admin/active-schools', label: 'Active Schools', icon: Building2 },
  { to: '/super-admin/organizations', label: 'Organizations', icon: Building2 }
];

const SuperAdminLayout = ({ children, sidebarCollapsed, onToggleSidebar, insights, profile }) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  const initials = profile?.name ? profile.name.trim().charAt(0).toUpperCase() : 'S';

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const renderNavItems = (showLabel = true) =>
    navLinks.map(({ to, label, icon }) => {
      const IconComponent = icon;
      return (
      <NavLink
        key={to}
        to={to}
        onClick={closeMobileMenu}
        className="mb-1 block"
      >
        {({ isActive }) => (
          <div className={`
            flex items-center space-x-3 px-4 py-3 rounded-lg
            group transition-all duration-200 ease-out
            ${isActive
              ? 'bg-gradient-to-r from-amber-100 to-orange-50 text-amber-700 shadow-sm border-l-4 border-amber-500'
              : 'text-gray-600 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:text-gray-900 hover:shadow-sm hover:border-l-4 hover:border-amber-300'}
          `}>
            <IconComponent size={20} className={`flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-amber-600' : 'group-hover:text-amber-600'}`} />
            {showLabel && <span className="font-medium flex-1 opacity-100 transition-opacity duration-200">{label}</span>}
          </div>
        )}
      </NavLink>
    )});

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex-col transition-all duration-300 ease-in-out shadow-lg ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
        style={{ willChange: 'width' }}
      >
        {/* Logo Section */}
        <div className="px-4 py-4 border-b border-gray-200 relative">
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className={`${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md transition-all duration-300`}>
                <Shield size={sidebarCollapsed ? 20 : 24} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col opacity-100 transition-opacity duration-300">
                  <span className="text-xl font-bold text-gray-800">Electronic Educare</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Super Admin Portal</span>
                </div>
              )}
            </div>
            {/* Toggle Button */}
            <button
              onClick={onToggleSidebar}
              className={`absolute ${sidebarCollapsed ? 'top-2 right-[-7px]' : 'top-4 right-[-5px]'} p-4 bg-transparent rounded-lg text-gray-500 hover:text-amber-600 transition-colors duration-200`}
              aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed && <ChevronRight size={16} className="transition-transform duration-200" />}
              {!sidebarCollapsed && <ChevronLeft size={16} className="transition-transform duration-200" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto sidebar-scroll">{renderNavItems(!sidebarCollapsed)}</nav>

        {/* Profile Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 hover:bg-gradient-to-r hover:from-gray-50 hover:to-amber-50 transition-all duration-200 cursor-pointer group">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center space-x-0' : 'space-x-3'}`}>
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={profile?.name || 'Super admin'}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-200 group-hover:border-amber-300 transition-all duration-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-all duration-200 group-hover:shadow-sm">
                <span className="text-amber-600 group-hover:text-amber-700 font-semibold transition-colors duration-200">
                  {initials}
                </span>
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="opacity-100 transition-opacity duration-200 flex-1">
                <p className="text-sm font-medium text-gray-900 group-hover:text-amber-900 transition-colors duration-200">
                  {profile?.name || 'Super Admin'}
                </p>
                <p className="text-xs text-gray-500 group-hover:text-amber-600 transition-colors duration-200">
                  {profile?.role || 'Super Administrator'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 shadow-2xl flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">EEC Platform</p>
              <p className="text-base font-semibold text-gray-800">Super Admin</p>
            </div>
          </div>
          <button
            onClick={closeMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors duration-200"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto sidebar-scroll">{renderNavItems(true)}</nav>

        {/* Mobile Profile Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={profile?.name || 'Super admin'}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-amber-600 font-semibold">{initials}</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{profile?.name || 'Super Admin'}</p>
              <p className="text-xs text-gray-500">{profile?.role || 'Super Administrator'}</p>
            </div>
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={closeMobileMenu} role="presentation" />
      )}

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
        }`}
      >
        <header className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg border border-gray-200 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 text-gray-600 hover:text-amber-600 transition-all duration-200"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <div>
                <p className="text-xs uppercase text-gray-400 tracking-wide font-medium">Control Centre</p>
                <h1 className="text-2xl font-bold text-gray-800">Super Admin Portal</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleSidebar}
                className="hidden md:inline-flex p-2 rounded-lg border border-gray-200 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 text-gray-600 hover:text-amber-600 transition-all duration-200 hover:shadow-sm"
                aria-label="Toggle sidebar width"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-3 rounded-full bg-gray-50 px-3 py-1.5 border border-gray-200 hover:border-amber-300 transition-all duration-200">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile?.name || 'Super admin'}
                    className="h-9 w-9 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 font-semibold flex items-center justify-center border-2 border-amber-200 shadow-sm">
                    {initials}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-900">{profile?.name || 'Super Admin'}</p>
                  <p className="text-xs text-gray-500">{profile?.role || 'Super Administrator'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs font-semibold text-white hover:text-white px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {insights.map((insight, index) => {
              const gradients = [
                'from-blue-50 to-blue-100',
                'from-amber-50 to-orange-100',
                'from-green-50 to-emerald-100',
                'from-purple-50 to-pink-100'
              ];
              const textColors = [
                'text-blue-700',
                'text-amber-700',
                'text-emerald-700',
                'text-purple-700'
              ];
              const borderColors = [
                'border-blue-200',
                'border-amber-200',
                'border-emerald-200',
                'border-purple-200'
              ];

              return (
                <div
                  key={insight.label}
                  className={`bg-gradient-to-br ${gradients[index % 4]} rounded-xl p-4 border ${borderColors[index % 4]} shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105`}
                >
                  <p className="text-xs uppercase tracking-wide text-gray-600 font-medium mb-1">{insight.label}</p>
                  <p className={`text-2xl sm:text-3xl font-bold ${textColors[index % 4]} mb-1`}>{insight.value}</p>
                  {insight.change && (
                    <p
                      className={`text-xs font-semibold ${
                        insight.change.startsWith('+') ? 'text-emerald-600' : 'text-gray-600'
                      }`}
                    >
                      {insight.change}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </header>

        <main className="super-admin-scroll flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
