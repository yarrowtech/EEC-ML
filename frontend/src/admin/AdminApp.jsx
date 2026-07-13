import { Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
import AdminLayout from './AdminLayout';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import Teachers from './Teachers';
import Students from './Students';
import Wellbeing from './pages/Wellbeing';
import SchoolsManagement from './pages/SchoolsManagement';
import SchoolAdminsManagement from './pages/SchoolAdminsManagement';
import Routines from './Routines';
import FloorRoomManagement from './pages/FloorRoomManagement';
import LessonPlanPage from './pages/LessonPlan';
import TeacherTimetable from './pages/TeacherTimetable';
import ExaminationManagement from './pages/ExaminationManagement';
import ParentsManagement from './pages/ParentsManagement';
import SubjectManagement from './pages/SubjectManagement';
import AcademicSetup from './pages/AcademicSetup';
import AttendanceManagement from './pages/AttendanceManagement';
import Result from './pages/Result';
import FeesCollection from './pages/FeesCollection';
import FeesDashboard from './pages/FeesDashboard';
import StudentFeeDetails from './pages/StudentFeeDetails';
import FeesManagement from './pages/FeesManagement';
import HR from './pages/HR';
import SchoolRegistrations from './pages/SchoolRegistrations';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Support from './pages/Support';
import NoticeManagement from './pages/NoticeManagement';
import AdminSettings from './pages/AdminSettings';
import PaymentGatewaySettings from './pages/PaymentGatewaySettings';
import StudentPromotion from './pages/StudentPromotion';
import ReportCardManagement from './pages/ReportCardManagement';
import HolidayList from './pages/HolidayList';
import TeacherFeedbackOverview from './pages/TeacherFeedbackOverview';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_MENU_ITEMS } from './adminConstants';
import { syncScopeFromProfile } from './utils/adminScope';
import { apiFetch, AUTH_NOTICE } from '../utils/authSession';
import toast from 'react-hot-toast';

// ── Error Boundary ────────────────────────────────────────────────────────────
class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[AdminErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred in this section. Your data is safe.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const resolveLogoUrl = (logo) => {
  if (!logo) return '';
  if (typeof logo === 'string') return logo;
  if (typeof logo === 'object') {
    return logo.secure_url || logo.url || logo.path || '';
  }
  return '';
};

const ADMIN_PROFILE_CACHE_KEY = 'admin_profile_cache_v1';

const getAdminProfileCacheKey = () => {
  const token = localStorage.getItem('token');
  if (!token) return `${ADMIN_PROFILE_CACHE_KEY}:anonymous`;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return `${ADMIN_PROFILE_CACHE_KEY}:fallback`;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const adminId = payload?.id || 'unknown';
    const schoolId = payload?.schoolId || 'school';
    const campusId = payload?.campusId || 'campus';
    return `${ADMIN_PROFILE_CACHE_KEY}:${adminId}_${schoolId}_${campusId}`;
  } catch {
    return `${ADMIN_PROFILE_CACHE_KEY}:fallback`;
  }
};

const readCachedAdminProfile = () => {
  try {
    const raw = sessionStorage.getItem(getAdminProfileCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedAdminProfile = (profile) => {
  try {
    if (!profile || typeof profile !== 'object') return;
    sessionStorage.setItem(getAdminProfileCacheKey(), JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
};

const AdminApp = () => {
  const navigate = useNavigate();
  const cachedAdminProfile = useMemo(() => readCachedAdminProfile(), []);
  const profileHydratedRef = useRef(Boolean(cachedAdminProfile));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('adminSidebarCollapsed') === 'true'
  );
  const [activeMenuItem, setActiveMenuItem] = useState('Dashboard');
  const [adminProfile, setAdminProfile] = useState(cachedAdminProfile);
  const [adminProfileLoading, setAdminProfileLoading] = useState(!cachedAdminProfile);

  const handleMenuItemClick = (item) => {
    setActiveMenuItem(item);
  };

  // state to manage admin header
  const [showAdminHeader, setShowAdminHeader] = useState(true);

  const handleSettingsUpdated = ({ admin, school } = {}) => {
    setAdminProfile((prev) => {
      const next = { ...(prev || {}) };
      if (admin && typeof admin === 'object') {
        next.name = admin.name ?? next.name;
        next.email = admin.email ?? next.email;
        next.avatar = admin.avatar ?? next.avatar;
        next.campusName = admin.campusName ?? next.campusName;
        next.campusType = admin.campusType ?? next.campusType;
      }
      if (school && typeof school === 'object') {
        next.schoolName = school.name ?? next.schoolName;
        const nextLogo = resolveLogoUrl(school.logo);
        if (nextLogo) next.schoolLogo = nextLogo;
        if (!nextLogo && Object.prototype.hasOwnProperty.call(school, 'logo')) {
          next.schoolLogo = '';
        }
      }
      writeCachedAdminProfile(next);
      return next;
    });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setAdminProfileLoading(false); return; }
      if (!profileHydratedRef.current) {
        setAdminProfileLoading(true);
      }
      try {
        const res = await apiFetch(
          `${import.meta.env.VITE_API_URL}/api/admin/auth/profile`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` } },
          navigate
        );
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load admin profile');
        }
        const data = await res.json();
        let schoolDetails = {};

        if (data?.role === 'admin') {
          try {
            const schoolRes = await apiFetch(
              `${import.meta.env.VITE_API_URL}/api/schools`,
              { method: 'GET', headers: { authorization: `Bearer ${token}` } },
              navigate
            );

            if (schoolRes.ok) {
              const schoolList = await schoolRes.json();
              const schools = Array.isArray(schoolList) ? schoolList : [];
              const matchedSchool =
                schools.find((school) => String(school?._id) === String(data?.schoolId)) || schools[0];

              if (matchedSchool) {
                schoolDetails = {
                  schoolName: matchedSchool.name || '',
                  schoolLogo: resolveLogoUrl(matchedSchool.logo),
                };
              }
            }
          } catch (schoolErr) {
            console.error('Failed to load school details', schoolErr);
            if (schoolErr?.code !== AUTH_NOTICE.EXPIRED) {
              toast.error('Unable to load school details. Some profile info may be incomplete.');
            }
          }
        }

        const profileWithSchool = { ...data, ...schoolDetails };
        setAdminProfile(profileWithSchool);
        writeCachedAdminProfile(profileWithSchool);
        profileHydratedRef.current = true;
        syncScopeFromProfile(profileWithSchool);
      } catch (err) {
        console.error('Failed to load admin profile', err);
        if (err?.code !== AUTH_NOTICE.EXPIRED) {
          toast.error('Unable to load admin profile. Refresh and try again.');
        }
      } finally {
        setAdminProfileLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    if (adminProfile) {
      syncScopeFromProfile(adminProfile);
    }
  }, [adminProfile]);

  const isSuperAdmin = adminProfile?.role === 'super_admin';
  const schoolAdminMenuOrder = useMemo(
    () => [
      'Dashboard',
      'Analytics',
      'Academic Setup',
      // 'Subjects',
      'Teachers',
      'Teacher Feedback',
      'Routine Management',
      'Students',
      'Promotion & Leave',
      'Parents',
      'Floor & Rooms',
      'Lesson Plan',
      'Exam Management',
      'Result Management',
      'Report Cards',
      'Fees Management',
      'Notices',
      'Holiday List',
      'HR',
      'Support',
      'Settings',
    ],
    []
  );

  const menuItems = useMemo(() => {
    if (isSuperAdmin) return ADMIN_MENU_ITEMS.filter((item) => item.scope !== 'school');
    const filteredMenuItems = ADMIN_MENU_ITEMS.filter(
      (item) =>
        item.scope !== 'super' &&
        item.label !== 'Student Attendance' &&
        item.path !== '/admin/attendance'
    );
    const orderIndexByLabel = new Map(
      schoolAdminMenuOrder.map((label, index) => [label, index])
    );

    return [...filteredMenuItems].sort((a, b) => {
      const indexA = orderIndexByLabel.has(a.label)
        ? orderIndexByLabel.get(a.label)
        : Number.MAX_SAFE_INTEGER;
      const indexB = orderIndexByLabel.has(b.label)
        ? orderIndexByLabel.get(b.label)
        : Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });
  }, [isSuperAdmin, schoolAdminMenuOrder]);

  const adminUser = {
    id: adminProfile?._id || adminProfile?.id || adminProfile?.adminId || '',
    email: adminProfile?.email || '',
    name: adminProfile?.name || 'Admin User',
    role: isSuperAdmin ? 'SUPER ADMIN' : 'School Admin',
    avatar: adminProfile?.avatar || '',
    schoolName: adminProfile?.schoolName || '',
    schoolLogo: adminProfile?.schoolLogo || '',
    campusName: adminProfile?.campusName || '',
    campusType: adminProfile?.campusType || ''
  };

  // Guard: redirect school admins away from super-admin-only routes
  const SuperAdminOnly = ({ children }) =>
    isSuperAdmin ? children : <Navigate to="/admin/dashboard" replace />;

  return (
    <AdminErrorBoundary>
      <AdminLayout
        activeMenuItem={activeMenuItem}
        onMenuItemClick={handleMenuItemClick}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          localStorage.setItem('adminSidebarCollapsed', next);
        }}
        adminUser={adminUser}
        profileLoading={adminProfileLoading}
        menuItems={menuItems}
        showAdminHeader={showAdminHeader}
      >
        <Routes>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="analytics" element={<Analytics setShowAdminHeader={setShowAdminHeader} />} />

          {/* Super-admin-only routes — redirect school admins to dashboard */}
          <Route path="schools" element={<SuperAdminOnly><SchoolsManagement setShowAdminHeader={setShowAdminHeader} isSuperAdmin={isSuperAdmin} /></SuperAdminOnly>} />
          <Route path="school-admins" element={<SuperAdminOnly><SchoolAdminsManagement setShowAdminHeader={setShowAdminHeader} isSuperAdmin={isSuperAdmin} /></SuperAdminOnly>} />
          <Route path="attendance" element={<SuperAdminOnly><AttendanceManagement setShowAdminHeader={setShowAdminHeader} /></SuperAdminOnly>} />
          <Route path="school-registrations" element={<SuperAdminOnly><SchoolRegistrations setShowAdminHeader={setShowAdminHeader} /></SuperAdminOnly>} />

          <Route path="teachers" element={<Teachers setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="teacher-feedback" element={<TeacherFeedbackOverview setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="students" element={<Students setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="wellbeing" element={<Wellbeing setShowAdminHeader={setShowAdminHeader} />} />
          {/* Canonical route is /routines; /routine redirects to it */}
          <Route path="routine" element={<Navigate to="/admin/routines" replace />} />
          <Route path="routines" element={<Routines setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="floor-rooms" element={<FloorRoomManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="parents" element={<ParentsManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="academics" element={<AcademicSetup setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="subjects" element={<SubjectManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="examination" element={<ExaminationManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="timetable" element={<TeacherTimetable setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="lesson-plans" element={<LessonPlanPage setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="result" element={<Result setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="report-cards" element={<ReportCardManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="fees" element={<FeesCollection setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="fees/collection" element={<FeesCollection setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="fees/manage" element={<FeesManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="fees/dashboard" element={<FeesDashboard setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="fees/student-details" element={<StudentFeeDetails setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="hr" element={<HR setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="support" element={<Support setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="notices" element={<NoticeManagement setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="holidays" element={<HolidayList setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="settings" element={<AdminSettings setShowAdminHeader={setShowAdminHeader} onSettingsUpdated={handleSettingsUpdated} />} />
          <Route path="settings/payment-gateway" element={<PaymentGatewaySettings setShowAdminHeader={setShowAdminHeader} />} />
          <Route path="promotion" element={<StudentPromotion setShowAdminHeader={setShowAdminHeader} />} />

          {/* 404 catch-all — redirect unknown /admin/* paths to dashboard */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AdminLayout>
    </AdminErrorBoundary>
  );
};

export default AdminApp;
