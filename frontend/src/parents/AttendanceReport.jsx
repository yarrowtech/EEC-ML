import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Loader2, 
  Users, 
  Filter, 
  CheckCircle2, 
  User,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import { getLocalMonthKey } from './attendanceViewModel';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const AttendanceReport = () => {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => getLocalMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [children, setChildren] = useState([]);

  const childOptions = useMemo(
    () => children.map((c) => ({ id: c?.student?._id || '', name: c?.student?.name || 'Student' })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedStudentId = selectedOption?.id || '';

  useEffect(() => {
    const loadAttendance = async () => {
      if (!localStorage.getItem('token')) {
        setError('Please login to view attendance reports.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ month });
        const data = await parentApiJson(`/api/attendance/parent/children?${query.toString()}`, {}, navigate);

        const list = Array.isArray(data.children) ? data.children : [];
        setChildren(list);
      } catch (err) {
        setError(err.message || 'Could not load attendance');
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [month]);

  const selectedChild = useMemo(() => {
    if (!children.length) return null;
    if (!selectedStudentId) return children[0];
    return children.find((child) => String(child?.student?._id) === String(selectedStudentId)) || children[0];
  }, [children, selectedStudentId]);

  const records = useMemo(() => Array.isArray(selectedChild?.attendance) ? selectedChild.attendance : [], [selectedChild]);
  
  const monthlySummary = useMemo(() => selectedChild?.monthlySummary || {
    totalClasses: 0,
    presentDays: 0,
    absentDays: 0,
    attendancePercentage: 0,
  }, [selectedChild]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Attendance"
        icon={CheckCircle2}
        subtitle="Your child's daily presence, as marked by the class teacher."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <User size={13} /> Student
            </p>
            {childOptions.length === 0
              ? <p className="text-sm text-slate-400">No children found</p>
              : <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} label="Student" />}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="att-month" className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Calendar size={13} /> Month
            </label>
            <input
              id="att-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all"
              data-flat
            />
          </div>
        </div>
      </PageHeader>

      {error && <ErrorState message={error} />}

      {/* Stats Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { 
            label: 'Attendance Rate', 
            value: `${monthlySummary.attendancePercentage}%`, 
            icon: TrendingUp, 
            color: 'bg-emerald-50 text-emerald-600',
            trend: 'Monthly average'
          },
          { 
            label: 'Total Sessions', 
            value: monthlySummary.totalClasses, 
            icon: Clock, 
            color: 'bg-blue-50 text-blue-600',
            trend: 'Current month'
          },
          { 
            label: 'Days Present', 
            value: monthlySummary.presentDays, 
            icon: CheckCircle, 
            color: 'bg-indigo-50 text-indigo-600',
            trend: 'Verified presence'
          },
          { 
            label: 'Days Absent', 
            value: monthlySummary.absentDays, 
            icon: XCircle, 
            color: monthlySummary.absentDays > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400',
            trend: 'Leave of absence'
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-2">{stat.trend}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Main Records Table */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <ShieldCheck size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Daily Attendance Logs</h2>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1.5 rounded-full">
            Filtered by: {new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        {loading ? (
          <div className="p-5"><Loading label="attendance" rows={4} /></div>
        ) : !selectedChild ? (
          <div className="p-5"><EmptyState icon={User} title="No student selected" hint="Choose a child above to view their presence history." /></div>
        ) : records.length === 0 ? (
          <div className="p-5"><EmptyState icon={Calendar} title="No records this month" hint="Attendance hasn't been marked for this month yet — check back later." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Attendance Date</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Subject Reference</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Presence Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((entry) => (
                  <tr key={entry._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900">
                        {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-slate-700">{entry.subject || 'Full Day Register'}</div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                        entry.status === 'present' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {entry.status === 'present' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="text-center pb-8 border-t border-slate-100 pt-8">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          Electronic Educare • Centralized Attendance Records
        </p>
      </footer>
    </div>
  );
};

export default AttendanceReport;
