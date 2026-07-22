import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  School, Users, GraduationCap, BookOpen, TrendingUp,
  AlertTriangle, Calendar, DollarSign, UserCheck, FileText,
  Bell, Settings, BarChart3, PieChart, Activity, Clock,
  Award, Target, Zap, Eye, ChevronRight, ArrowUp,
  ArrowDown, Filter, Download, RefreshCw, MessageSquare,
  Phone, Maximize2, ChevronDown, Search, MoreHorizontal
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import PrincipalSidebar from './PrincipalSidebar';
import PrincipalHeader from './PrincipalHeader';
import AcademicAnalytics from './AcademicAnalytics';
import StudentAnalytics from './StudentAnalytics';
import StaffManagement from './StaffManagement';
import FinancialDashboard from './FinancialDashboard';
import NotificationCenter from './NotificationCenter';
import Communications from './Communications';
import OverviewPage from './OverviewPage';
import FacilitiesPage from './FacilitiesPage';
import ReportsPage from './ReportsPage';
import CalendarPage from './CalendarPage';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';

const API_BASE = import.meta.env.VITE_API_URL;

const formatRelativeLabel = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const normalizeNotifications = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const createdAt = item.createdAt || item.updatedAt || item.timestamp || new Date().toISOString();
    return {
      id: item._id || item.id || createdAt,
      title: item.title || 'Notification',
      message: item.message || '',
      priority: typeof item.priority === 'string' ? item.priority.toLowerCase() : 'medium',
      department: item.department || item.category || item.typeLabel || item.type || 'General',
      category: item.category || 'general',
      type: item.type || 'general',
      createdAt,
      timestamp: formatRelativeLabel(createdAt),
      audience: item.audience || 'All',
      read: Boolean(item.isRead),
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      createdByName: item.createdByName || '',
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const PrincipalDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overview, setOverview] = useState(null);
  const [principalProfile, setPrincipalProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const fetchOverview = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/api/principal/overview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to load principal overview');
      }
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      console.error('Principal overview error:', err);
      setLoadError('Unable to load live dashboard data.');
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchOverview(true);
  }, [fetchOverview]);

  useEffect(() => {
    const fetchPrincipalProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/principal/auth/profile`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          throw new Error('Failed to load principal profile');
        }
        const data = await res.json();
        setPrincipalProfile(data);
      } catch (err) {
        console.error('Principal profile error:', err);
      }
    };

    fetchPrincipalProfile();
  }, []);
  
  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const res = await fetch(`${API_BASE}/api/notifications/user`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load notifications');
      }
      setNotifications(normalizeNotifications(data));
    } catch (err) {
      console.error('Principal notifications error:', err);
      setNotificationsError(err.message || 'Unable to load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOverview(false);
      fetchNotifications();
    }, 60_000);
    return () => clearInterval(intervalId);
  }, [fetchNotifications, fetchOverview]);

  const handleMarkNotificationRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/user/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to mark notification as read');
      }
      setNotifications((prev) =>
        prev.map((item) =>
          String(item.id) === String(notificationId) ? { ...item, read: true } : item
        )
      );
    } catch (err) {
      console.error('Mark read error:', err);
      setNotificationsError(err.message || 'Unable to update notification.');
    }
  }, []);

  const handleDismissNotification = useCallback(async (notificationId) => {
    if (!notificationId) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/user/${notificationId}/dismiss`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to dismiss notification');
      }
      setNotifications((prev) => prev.filter((item) => String(item.id) !== String(notificationId)));
    } catch (err) {
      console.error('Dismiss notification error:', err);
      setNotificationsError(err.message || 'Unable to dismiss notification.');
    }
  }, []);

  // School data - using only real API data
  const schoolStats = {
    totalStudents: overview?.stats?.totalStudents || 0,
    totalTeachers: overview?.stats?.totalTeachers || 0,
    totalStaff: overview?.stats?.totalStaff || 0,
    totalClasses: overview?.stats?.totalClasses || 0,
    activeParents: overview?.stats?.totalParents || 0,
    attendanceRate: overview?.attendance?.rate || 0,
    currentRevenue: overview?.fees?.paidAmount
      ? Number((overview.fees.paidAmount / 1_000_000).toFixed(2))
      : 0,
    totalRevenue: overview?.fees?.totalAmount
      ? Number((overview.fees.totalAmount / 1_000_000).toFixed(2))
      : 0,
    balanceRevenue: overview?.fees?.balanceAmount
      ? Number((overview.fees.balanceAmount / 1_000_000).toFixed(2))
      : 0,
  };

  // Calculate growth percentage from API data
  const monthlyGrowth = schoolStats.totalRevenue > 0
    ? Number(((schoolStats.currentRevenue / schoolStats.totalRevenue) * 100).toFixed(1))
    : 0;

  const criticalNotifications = notifications;
  const resolvedSchoolName = principalProfile?.schoolName || principalProfile?.campusName || 'Electronic Educare Center';
  const resolvePrincipalNotificationPath = useCallback((notification) => {
    const title = String(notification?.title || '').toLowerCase();
    const type = String(notification?.type || '').toLowerCase();
    const department = String(notification?.department || '').toLowerCase();
    const blob = `${title} ${type} ${department}`;
    if (blob.includes('finance') || blob.includes('fee') || blob.includes('payment')) return '/principal/finance';
    if (blob.includes('staff') || blob.includes('teacher') || blob.includes('hr')) return '/principal/staff';
    if (blob.includes('academic') || blob.includes('exam') || blob.includes('result')) return '/principal/academics';
    if (blob.includes('student') || blob.includes('attendance')) return '/principal/students';
    return '/principal/notifications';
  }, []);
  const {
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  } = useDesktopNotificationBridge({
    scopeKey: 'principal',
    resolvePath: resolvePrincipalNotificationPath,
    appName: 'Principal Portal',
  });

  useEffect(() => {
    syncNotifications(notifications);
  }, [notifications, syncNotifications]);

  const recentActivities = useMemo(
    () => (Array.isArray(overview?.recentActivities) ? overview.recentActivities : []).map((item) => ({
      ...item,
      time: formatRelativeLabel(item.createdAt),
    })),
    [overview]
  );

  // Performance metrics - using real API data
  const performanceMetrics = [];

  // Quick stats cards data - using only real API data
  const quickStats = [
    {
      title: 'Total Students',
      value: schoolStats.totalStudents.toLocaleString(),
      change: '',
      changeType: 'neutral',
      icon: GraduationCap,
      color: 'bg-blue-600',
      drillDown: 'students'
    },
    {
      title: 'Faculty & Staff',
      value: (schoolStats.totalTeachers + schoolStats.totalStaff).toLocaleString(),
      change: '',
      changeType: 'neutral',
      icon: Users,
      color: 'bg-green-600',
      drillDown: 'staff'
    },
    {
      title: 'Active Classes',
      value: schoolStats.totalClasses.toString(),
      change: '',
      changeType: 'neutral',
      icon: BookOpen,
      color: 'bg-purple-600',
      drillDown: 'academics'
    },
    {
      title: 'Attendance Rate',
      value: `${schoolStats.attendanceRate.toFixed(1)}%`,
      change: '',
      changeType: 'neutral',
      icon: UserCheck,
      color: 'bg-orange-600',
      drillDown: 'attendance'
    },
    {
      title: 'Paid Revenue (M)',
      value: `$${schoolStats.currentRevenue}M`,
      change: `${monthlyGrowth.toFixed(1)}%`,
      changeType: monthlyGrowth > 0 ? 'increase' : 'neutral',
      icon: DollarSign,
      color: 'bg-indigo-600',
      drillDown: 'finance'
    },
    {
      title: 'Total Parents',
      value: schoolStats.activeParents.toLocaleString(),
      change: '',
      changeType: 'neutral',
      icon: Award,
      color: 'bg-yellow-500',
      drillDown: 'students'
    }
  ];

  // Chart data - using only real API data
  const attendanceTrend = overview?.attendance?.trend?.length
    ? overview.attendance.trend.map((item) => ({
        month: item.month,
        value: item.rate
      }))
    : [];

  // ChartJS data for Attendance Trend
  const attendanceChartData = {
    labels: attendanceTrend.map((d) => d.month),
    datasets: [
      {
        label: 'Attendance Rate (%)',
        data: attendanceTrend.map((d) => d.value),
        backgroundColor: 'rgba(59, 130, 246, 0.7)', // blue-500
        borderRadius: 8,
      },
      {
        label: 'Target (%)',
        data: Array(attendanceTrend.length).fill(95),
        backgroundColor: 'rgba(34, 197, 94, 0.5)', // green-500
        borderRadius: 8,
      }
    ]
  };

  const attendanceChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Attendance Trend (Last 6 Months)',
      },
    },
    scales: {
      y: {
        min: 85,
        max: 100,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Attendance (%)',
        },
      },
    },
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Student performance data - using only real API data
  const studentPerformance = overview?.performance?.gradeDistribution?.length
    ? overview.performance.gradeDistribution.map((item) => ({
        grade: item.grade,
        students: item.count
      }))
    : [];

  // ChartJS data for Student Performance Distribution
  const performanceChartData = {
    labels: studentPerformance.map((d) => d.grade),
    datasets: [
      {
        label: 'Students',
        data: studentPerformance.map((d) => d.students),
        backgroundColor: [
          'rgba(251, 191, 36, 0.7)', // yellow-400
          'rgba(59, 130, 246, 0.7)', // blue-500
          'rgba(34, 197, 94, 0.7)', // green-500
          'rgba(239, 68, 68, 0.7)', // red-500
          'rgba(107, 114, 128, 0.7)' // gray-500
        ],
        borderColor: [
          'rgba(251, 191, 36, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(107, 114, 128, 1)'
        ],
        borderWidth: 2,
      }
    ]
  };

  const performanceChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Student Performance Distribution',
      },
    },
  };

  // Overview page component with all props
  const overviewElement = (
    <OverviewPage
      overview={overview}
      isLoading={isLoading}
      loadError={loadError}
      schoolStats={schoolStats}
      quickStats={quickStats}
      attendanceTrend={attendanceTrend}
      studentPerformance={studentPerformance}
      criticalNotifications={criticalNotifications}
      recentActivities={recentActivities}
      monthlyGrowth={monthlyGrowth}
      schoolName={resolvedSchoolName}
      onRefreshOverview={() => fetchOverview(true)}
    />
  );

  return (
    <>
    <div className="min-h-screen bg-slate-50">
      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <PrincipalSidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        principalProfile={principalProfile}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'
      }`}>
        {/* Header */}
        <div className="sticky top-0 z-30">
          <PrincipalHeader
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            notifications={notifications}
            principalProfile={principalProfile}
          />
        </div>

        {/* Main Dashboard Content */}
        <main className="p-6 bg-slate-50 min-h-screen">
          {(isLoading || loadError) && (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              loadError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {isLoading ? 'Loading live dashboard data...' : loadError}
            </div>
          )}
          <Routes>
            <Route index element={overviewElement} />
            <Route path="overview" element={overviewElement} />
            <Route path="academics" element={<AcademicAnalytics />} />
            <Route path="students" element={<StudentAnalytics />} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="finance" element={<FinancialDashboard />} />
            <Route path="facilities" element={<FacilitiesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route
              path="notifications"
              element={(
                <NotificationCenter
                  notifications={notifications}
                  loading={notificationsLoading}
                  error={notificationsError}
                  onRefresh={fetchNotifications}
                  onMarkRead={handleMarkNotificationRead}
                  onDismiss={handleDismissNotification}
                />
              )}
            />
            <Route path="communications" element={<Communications />} />
            <Route path="*" element={overviewElement} />
          </Routes>
        </main>
      </div>
    </div>
    <DesktopNotificationPermissionModal
      open={showPermissionModal}
      onAllow={requestPermissionFromModal}
      onLater={dismissPermissionModal}
      pendingCount={pendingCount}
    />
    </>
  );
};

export default PrincipalDashboard;
