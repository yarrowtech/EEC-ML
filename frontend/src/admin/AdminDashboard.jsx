import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/authSession';
import AdminAvatar from './Avatar';
import AdminProgressBar from './ProgressBar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart2,
  DollarSign,
  Award,
  Users,
  GraduationCap,
  BookOpen,
  FileText
} from 'lucide-react';
import CredentialGeneratorButton from './components/CredentialGeneratorButton';
import { MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';

const computeOutstanding = (invoice = {}) => {
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const hasBalance = invoice.balanceAmount === 0 || invoice.balanceAmount;
  const balance = hasBalance ? Number(invoice.balanceAmount) : total - paid;
  if (!Number.isFinite(balance)) return 0;
  return Math.max(0, balance);
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const buildMonthlyTrend = (invoices = [], payments = [], months = 6) => {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: getMonthKey(monthDate),
      month: monthDate.toLocaleString('default', { month: 'short' }),
      collected: 0,
      due: 0,
    });
  }
  const bucketMap = buckets.reduce((map, bucket) => map.set(bucket.key, bucket), new Map());

  payments.forEach((payment) => {
    const ts = payment.paidOn || payment.createdAt;
    if (!ts) return;
    const key = getMonthKey(new Date(ts));
    if (bucketMap.has(key)) bucketMap.get(key).collected += Number(payment.amount || 0);
  });

  invoices.forEach((invoice) => {
    const ts = invoice.dueDate || invoice.createdAt;
    if (!ts) return;
    const key = getMonthKey(new Date(ts));
    if (bucketMap.has(key)) bucketMap.get(key).due += computeOutstanding(invoice);
  });

  return buckets;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [financials, setFinancials] = useState({ trend: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsRes, feesRes, paymentsRes] = await Promise.all([
          apiFetch(
            `${import.meta.env.VITE_API_URL}/api/admin/users/dashboard-stats`,
            { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } },
            navigate
          ),
          apiFetch(
            `${import.meta.env.VITE_API_URL}/api/fees/invoices`,
            { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } },
            navigate
          ),
          apiFetch(
            `${import.meta.env.VITE_API_URL}/api/fees/payments`,
            { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } },
            navigate
          ),
        ]);

        const statsData = await statsRes.json();
        if (!statsRes.ok) throw new Error(statsData?.error || 'Failed to fetch dashboard data');
        setStats(statsData.stats || {});
        setTeachers(Array.isArray(statsData.teachers) ? statsData.teachers : []);

        const invoices = await feesRes.json().catch(() => []);
        const payments = await paymentsRes.json().catch(() => []);
        setFinancials(buildFinancialState(invoices, payments));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const statsCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents ?? 0,
      icon: GraduationCap,
      color: 'bg-yellow-400',
      change: `+${stats?.recentStudents ?? 0} this month`,
    },
    {
      title: 'Total Teachers',
      value: stats?.totalTeachers ?? 0,
      icon: Users,
      color: 'bg-yellow-400',
      change: `+${stats?.recentTeachers ?? 0} this month`,
    },
    {
      title: 'Active Courses',
      value: stats?.totalCourses ?? 0,
      icon: BookOpen,
      color: 'bg-yellow-400',
      change: 'School-wide',
    },
  ];

  return (
    <div className="w-full h-full space-y-6">
      {/* Header Section */}
      <h2 className="text-2xl font-semibold text-gray-800">School Dashboard</h2>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-gradient-to-r from-yellow-200 to-yellow-300 rounded-2xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Welcome Back, Admin! 📚</h3>
            <p className="text-gray-700 mb-4">
              Let's make learning better! Check the latest updates and manage your school efficiently.
            </p>
            <button className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              View School Reports
            </button>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl p-6 shadow-md h-full flex flex-col justify-center items-center">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Achievement Unlocked! 🏆</h3>
            <p className="text-gray-600 mb-4 text-center">Your school has achieved a {stats?.attendanceRate ?? '...'}% attendance rate this month!</p>
            <div className="flex justify-center mt-2">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center">
                <Award size={40} className="text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-md border border-yellow-100 h-32 animate-pulse" />
        ))}
        {error && !loading && (
          <div className="md:col-span-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            Could not load dashboard stats: {error}
          </div>
        )}
        {!loading && !error && statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-yellow-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-green-600 text-sm">{stat.change} from last month</p>
                </div>
                <div className={`p-3 ${stat.color} rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teacher Performance Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-yellow-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Teacher Performance</h3>
            <button className="p-2 hover:bg-yellow-100 rounded-lg transition-colors">
              <MoreHorizontal size={20} className="text-gray-600" />
            </button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading teachers...
            </div>
          ) : (
            <div className="space-y-6">
              {teachers.map((teacher) => (
                <div key={teacher._id} className="flex items-center space-x-4">
                  <AdminAvatar emoji={teacher.avatar || '👩‍🏫'} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-800">{teacher.name}</h4>
                      <span className="text-sm text-gray-500">{teacher.lastActivity || 'Online'}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{teacher.role || 'Teacher'}</p>
                    <AdminProgressBar
                      progress={teacher.performance || 0}
                      color={teacher.performance > 80 ? 'bg-green-500' : 'bg-yellow-500'}
                      animated={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fees Chart + Upcoming Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-500" />
                  Fees Collection
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Revenue trend — last 6 months</p>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading financial data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={financials.trend} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)'
                    }}
                    formatter={(value) => [`₹${value.toLocaleString()}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  <Bar dataKey="collected" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Collected" maxBarSize={40} />
                  <Bar dataKey="due" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Due" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Upcoming Deadlines
            </h2>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl p-6 text-white">
          <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <CredentialGeneratorButton
              buttonText="Generate IDs & Passwords"
              buttonClassName="w-full justify-start bg-white bg-opacity-20 hover:bg-opacity-30 text-white"
              allowRoleSelection
            />
            <button className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 text-left transition-colors flex items-center gap-2">
              <FileText size={20} /> Generate Attendance Report
            </button>
            <button className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 text-left transition-colors flex items-center gap-2">
              <Users size={20} /> Manage Students & Teachers
            </button>
            <button className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-3 text-left transition-colors flex items-center gap-2">
              <BookOpen size={20} /> Update Course Materials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
