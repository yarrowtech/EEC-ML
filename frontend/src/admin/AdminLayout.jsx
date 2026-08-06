import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

const AdminLayout = ({
  children,
  activeMenuItem,
  onMenuItemClick,
  sidebarCollapsed,
  onToggleSidebar,
  adminUser,
  profileLoading,
  menuItems,
  showAdminHeader = true,
}) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutRequest = () => setShowLogoutConfirm(true);
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  return (
    <div className="flex w-full min-h-dvh bg-gray-50">
      {/* ── Shared logout confirmation dialog ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1 bg-linear-to-r from-red-400 to-rose-400" />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center">Confirm Logout</h3>
              <p className="text-sm text-gray-500 text-center mt-1">
                Are you sure you want to log out? Any unsaved changes will be lost.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminSidebar
        activeMenuItem={activeMenuItem}
        onMenuItemClick={onMenuItemClick}
        collapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        menuItems={menuItems}
        adminUser={adminUser}
        profileLoading={profileLoading}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogoutRequest={handleLogoutRequest}
        showAdminHeader={showAdminHeader}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {showAdminHeader && (
          <AdminHeader
            adminUser={adminUser}
            onOpenMobileSidebar={() => setMobileOpen(true)}
            onLogoutRequest={handleLogoutRequest}
          />
        )}

        <main className="flex-1 overflow-x-hidden bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
