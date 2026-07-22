import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, XCircle, UserX, IndianRupee, Loader, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CardShell, SectionHeader, StatCard, MotionDiv, EmptyState, pageVariants, itemVariants } from './principalUi';

const API_BASE = import.meta.env.VITE_API_URL;

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/reports`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load reports');
        }
        setData(payload);
      } catch (err) {
        console.error('Reports error:', err);
        setError(err.message || 'Unable to load reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const academic = data?.academic || { totalResults: 0, passRate: 0, failRate: 0, absentRate: 0, gradeDistribution: [] };
  const attendanceTrend = data?.attendance?.trend || [];
  const financial = data?.financial || { totalRevenue: 0, totalExpenses: 0, netProfit: 0, totalOutstanding: 0 };

  return (
    <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="space-y-6">
      <MotionDiv variants={itemVariants} className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-7">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-300">Academic, attendance, and financial snapshot</p>
      </MotionDiv>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader className="h-5 w-5 animate-spin" /> Loading reports...
        </div>
      ) : (
        <>
          <MotionDiv variants={itemVariants} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={CheckCircle2} label="Exam Pass Rate" value={`${academic.passRate}%`} tone="emerald" />
            <StatCard icon={XCircle} label="Exam Fail Rate" value={`${academic.failRate}%`} tone="rose" />
            <StatCard icon={UserX} label="Absent Rate" value={`${academic.absentRate}%`} tone="amber" />
            <StatCard icon={IndianRupee} label="Net (Revenue - Expenses)" value={formatCurrency(financial.netProfit)} />
          </MotionDiv>

          <MotionDiv variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
            <CardShell>
              <SectionHeader icon={BarChart3} title="Exam Grade Distribution" subtitle={`${academic.totalResults} results recorded`} />
              <div className="p-5">
                {academic.gradeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={academic.gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="grade" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0f172a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={BarChart3} title="No exam results yet" description="Published exam results will populate this chart." />
                )}
              </div>
            </CardShell>

            <CardShell>
              <SectionHeader icon={BarChart3} title="Attendance Trend" subtitle="Last 6 months" />
              <div className="p-5">
                {attendanceTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Attendance']} />
                      <Line type="monotone" dataKey="rate" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={BarChart3} title="No attendance data yet" description="Attendance trend will appear once records are logged." />
                )}
              </div>
            </CardShell>
          </MotionDiv>

          <MotionDiv variants={itemVariants}>
            <CardShell>
              <SectionHeader icon={IndianRupee} title="Financial Snapshot" subtitle="Fee revenue vs. approved teacher expenses" />
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Revenue Collected</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(financial.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Approved Expenses</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(financial.totalExpenses)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Outstanding Fees</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(financial.totalOutstanding)}</p>
                </div>
              </div>
            </CardShell>
          </MotionDiv>
        </>
      )}
    </MotionDiv>
  );
};

export default ReportsPage;
