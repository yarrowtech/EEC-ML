import React, { useEffect, useMemo, useState } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Loader2, 
  Users, 
  ChevronRight, 
  Filter, 
  CheckCircle2, 
  User,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AttendanceReport = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [children, setChildren] = useState([]);

  useEffect(() => {
    const loadAttendance = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view attendance reports.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ month });

        const res = await fetch(`${API_BASE}/api/attendance/parent/children?${query.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load attendance report');
        }

        const list = Array.isArray(data.children) ? data.children : [];
        setChildren(list);
        if (!selectedStudentId && list.length > 0) {
          setSelectedStudentId(list[0]?.student?._id || '');
        }
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
    return children.find((child) => child?.student?._id === selectedStudentId) || children[0];
  }, [children, selectedStudentId]);

  const records = useMemo(() => Array.isArray(selectedChild?.attendance) ? selectedChild.attendance : [], [selectedChild]);
  
  const monthlySummary = useMemo(() => selectedChild?.monthlySummary || {
    totalClasses: 0,
    presentDays: 0,
    absentDays: 0,
    attendancePercentage: 0,
  }, [selectedChild]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <header className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm group transition-all hover:shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 size={14} />
              <span>Presence Tracker</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Report</h1>
            <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              Monitor your child's daily presence and punctuality. Data is refreshed in real-time as marked by the class teacher.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Control Panel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="att-student" className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <User size={14} />
              Select Student
            </label>
            <div className="relative group">
              <select
                id="att-student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer group-hover:bg-white"
              >
                {children.length === 0 && <option value="">No children found</option>}
                {children.map((child) => (
                  <option key={child?.student?._id} value={child?.student?._id}>
                    {formatStudentDisplay({
                      name: child?.student?.name,
                      username: child?.student?.username,
                      studentCode: child?.student?.studentCode,
                      roll: child?.student?.roll,
                      section: child?.student?.section,
                    })}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="att-month" className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <Calendar size={14} />
              Viewing Month
            </label>
            <input
              id="att-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
      </section>

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
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h2 className="text-2xl font-bold text-slate-900">{stat.value}</h2>
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
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-slate-500 tracking-widest">FETCHING REGISTERS...</p>
          </div>
        ) : !selectedChild ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="p-4 bg-slate-50 rounded-full">
              <User className="w-12 h-12 text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">No student selected</h3>
              <p className="text-sm text-slate-500">Please choose a child to view their presence history.</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="p-4 bg-slate-50 rounded-full text-slate-300">
              <Calendar size={48} />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="text-lg font-bold text-slate-900">No records found</h3>
              <p className="text-sm text-slate-500">
                Attendance hasn't been marked for the selected month or student yet.
              </p>
            </div>
          </div>
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
