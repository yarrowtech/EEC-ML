import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/authSession';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  User,
  Users,
  Trash2,
  PencilLine,
  PlusCircle,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const toTitleCase = (value = '') =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const formatRole = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Unknown';
  if (normalized.toLowerCase() === 'admin') return 'School Admin';
  if (normalized.toLowerCase() === 'super_admin') return 'Super Admin';
  return toTitleCase(normalized);
};

const formatName = (log = {}) => {
  const name = log.actorName || log.meta?.actorName || log.meta?.name || log.meta?.userName || '';
  return String(name || '').trim() || 'System';
};

const formatEntity = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  const map = {
    studentuser: 'Student',
    teacheruser: 'Teacher',
    parentuser: 'Parent',
    admin: 'Admin',
    notice: 'Notice',
    feeinvoice: 'Fee Invoice',
    promotionhistory: 'Promotion',
    attendance: 'Attendance',
    academicyear: 'Academic Year',
  };
  return map[normalized] || toTitleCase(value);
};

const classifyAction = (action = '') => {
  const normalized = String(action || '').toLowerCase();
  if (normalized.includes('delete') || normalized.includes('remove') || normalized.includes('archive') || normalized.includes('leave')) return 'danger';
  if (normalized.includes('create') || normalized.includes('add') || normalized.includes('restore') || normalized.includes('approve') || normalized.includes('publish')) return 'success';
  if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('change') || normalized.includes('set') || normalized.includes('assign')) return 'info';
  return 'neutral';
};

const formatAction = (action = '') => {
  const normalized = String(action || '').trim().toLowerCase();
  if (!normalized) return 'Activity updated';

  const map = {
    'student.create': 'Student added',
    'student.update': 'Student updated',
    'student.delete': 'Student deleted',
    'student.mark_leaving': 'Student marked as leaving',
    'student.mark_left': 'Student marked as left',
    'student.restore_active': 'Student restored to active',
    'teacher.create': 'Teacher added',
    'teacher.update': 'Teacher updated',
    'teacher.delete': 'Teacher deleted',
    'parent.create': 'Parent added',
    'parent.update': 'Parent updated',
    'parent.delete': 'Parent deleted',
    'promotion.execute': 'Promotion executed',
  };

  if (map[normalized]) return map[normalized];

  return toTitleCase(
    normalized
      .replace(/\./g, ' ')
      .replace(/\bcreate\b/g, 'created')
      .replace(/\badd\b/g, 'added')
      .replace(/\bupdate\b/g, 'updated')
      .replace(/\bedit\b/g, 'edited')
      .replace(/\bdelete\b/g, 'deleted')
      .replace(/\bremove\b/g, 'removed')
  );
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeFileSegment = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const getActionIcon = (category) => {
  if (category === 'success') return PlusCircle;
  if (category === 'danger') return Trash2;
  if (category === 'info') return PencilLine;
  return Activity;
};

const ActivityLog = ({ setShowAdminHeader, adminUser }) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedName, setSelectedName] = useState('All Names');
  const [selectedAction, setSelectedAction] = useState('All Actions');
  const [selectedEntity, setSelectedEntity] = useState('All Entities');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { authorization: `Bearer ${token}` } : {};
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(
        `${API_BASE}/api/audit-logs`,
        { headers: authHeaders() },
        navigate
      );
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load activity log');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load activity log');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadDirectory = useCallback(async () => {
    try {
      const roleRequests = [
        { role: 'student', endpoint: '/api/admin/users/get-students', label: 'Student' },
        { role: 'teacher', endpoint: '/api/admin/users/get-teachers', label: 'Teacher' },
        { role: 'parent', endpoint: '/api/admin/users/get-parents', label: 'Parent' },
        { role: 'principal', endpoint: '/api/admin/users/get-principals', label: 'Principal' },
        { role: 'staff', endpoint: '/api/admin/users/get-staff', label: 'Staff' },
      ];

      const responses = await Promise.allSettled(
        roleRequests.map(async ({ endpoint, label }) => {
          const res = await apiFetch(
            `${API_BASE}${endpoint}`,
            { headers: authHeaders() },
            navigate
          );
          const data = await res.json().catch(() => []);
          if (!res.ok) throw new Error(data?.error || `Unable to load ${label.toLowerCase()}s`);
          const items = Array.isArray(data) ? data : [];
          return items
            .map((item) => ({
              role: label,
              name: String(item?.name || '').trim(),
            }))
            .filter((item) => item.name);
        })
      );

      const entries = responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
      if (adminUser?.name) {
        entries.push({
          role: adminUser?.role ? formatRole(adminUser.role) : 'School Admin',
          name: String(adminUser.name).trim(),
        });
      }
      setDirectory(entries);
    } catch {
      setDirectory(adminUser?.name ? [{ role: adminUser?.role ? formatRole(adminUser.role) : 'School Admin', name: String(adminUser.name).trim() }] : []);
    }
  }, [adminUser?.name, adminUser?.role, navigate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const rows = useMemo(() => logs.map((log) => {
    const action = String(log.action || '').trim();
    const entity = String(log.entity || log.meta?.entity || '').trim();
    const category = classifyAction(action);
    return {
      id: String(log._id || log.id || `${action}-${log.createdAt}`),
      raw: log,
      role: formatRole(log.actorType || log.meta?.actorType),
      name: formatName(log),
      action: formatAction(action),
      actionKey: action || 'unknown',
      entity: formatEntity(entity),
      entityKey: entity || 'unknown',
      ip: String(log.ip || log.meta?.ip || '—'),
      createdAt: log.createdAt || log.timestamp || '',
      dateKey: toDateKey(log.createdAt || log.timestamp),
      category,
      detail:
        log.meta?.message ||
        log.meta?.reason ||
        log.meta?.details ||
        log.meta?.description ||
        '',
    };
  }), [logs]);

  const roleOptions = useMemo(() => {
    const options = directory.map((item) => item.role).filter(Boolean);
    return ['All Roles', ...new Set(options.length ? options : rows.map((row) => row.role).filter(Boolean))];
  }, [directory, rows]);
  const nameOptions = useMemo(() => {
    const options = directory.map((item) => item.name).filter(Boolean);
    return ['All Names', ...new Set(options.length ? options : rows.map((row) => row.name).filter(Boolean))];
  }, [directory, rows]);
  const actionOptions = useMemo(() => ['All Actions', ...new Set(rows.map((row) => row.action).filter(Boolean))], [rows]);
  const entityOptions = useMemo(() => ['All Entities', ...new Set(rows.map((row) => row.entity).filter(Boolean))], [rows]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedRole, selectedName, selectedAction, selectedEntity, fromDate, toDate, pageSize]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromKey = fromDate ? toDateKey(fromDate) : '';
    const toKey = toDate ? toDateKey(toDate) : '';

    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        [row.role, row.name, row.action, row.entity, row.ip, row.detail]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      const matchesRole = selectedRole === 'All Roles' || row.role === selectedRole;
      const matchesName = selectedName === 'All Names' || row.name === selectedName;
      const matchesAction = selectedAction === 'All Actions' || row.action === selectedAction;
      const matchesEntity = selectedEntity === 'All Entities' || row.entity === selectedEntity;
      const matchesFrom = !fromKey || (row.dateKey && row.dateKey >= fromKey);
      const matchesTo = !toKey || (row.dateKey && row.dateKey <= toKey);
      return matchesQuery && matchesRole && matchesName && matchesAction && matchesEntity && matchesFrom && matchesTo;
    });
  }, [rows, query, selectedRole, selectedName, selectedAction, selectedEntity, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const metrics = useMemo(() => {
    const total = filteredRows.length;
    const uniqueActors = new Set(filteredRows.map((row) => `${row.role}:${row.name}`)).size;
    const todayKey = toDateKey(new Date());
    const todayCount = filteredRows.filter((row) => row.dateKey === todayKey).length;
    const riskyCount = filteredRows.filter((row) => row.category === 'danger').length;
    return { total, uniqueActors, todayCount, riskyCount };
  }, [filteredRows]);

  const clearFilters = () => {
    setQuery('');
    setSelectedRole('All Roles');
    setSelectedName('All Names');
    setSelectedAction('All Actions');
    setSelectedEntity('All Entities');
    setFromDate('');
    setToDate('');
    setPageSize(25);
  };

  const exportCsv = () => {
    if (!filteredRows.length) return;
    const headers = ['timestamp', 'role', 'name', 'action', 'entity', 'ip', 'details'];
    const scopeParts = [
      selectedRole !== 'All Roles' ? selectedRole : '',
      selectedName !== 'All Names' ? selectedName : '',
      selectedAction !== 'All Actions' ? selectedAction : '',
      selectedEntity !== 'All Entities' ? selectedEntity : '',
    ].filter(Boolean);
    const scopeLabel = scopeParts.length ? scopeParts.join('_') : 'all-roles';
    const fileDate = new Date().toISOString().slice(0, 10);
    const lines = [
      `Report scope,${scopeParts.length ? scopeParts.join(' | ') : 'All Roles'}`,
      `Total rows,${filteredRows.length}`,
      `Generated at,${new Date().toLocaleString('en-IN')}`,
      '',
      headers.join(','),
      ...filteredRows.map((row) =>
        headers.map((header) => {
          const value = header === 'timestamp'
            ? formatTimestamp(row.createdAt)
            : header === 'details'
              ? row.detail
              : row[header];
          return `"${String(value ?? '').replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${sanitizeFileSegment(scopeLabel)}-${fileDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const badgeStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/25">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />
          <div className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500">School Activity</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Track what happened across the school with role, name, action, entity, and date filters.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadLogs}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Events', value: metrics.total, icon: Activity, tone: 'indigo' },
            { label: 'Actors', value: metrics.uniqueActors, icon: Users, tone: 'emerald' },
            { label: 'Today', value: metrics.todayCount, icon: CalendarDays, tone: 'blue' },
            { label: 'Critical', value: metrics.riskyCount, icon: Shield, tone: 'rose' },
          ].map((card) => {
            const Icon = card.icon;
            const toneMap = {
              indigo: 'from-indigo-600 to-blue-600',
              emerald: 'from-emerald-600 to-teal-500',
              blue: 'from-sky-600 to-cyan-500',
              rose: 'from-rose-600 to-pink-500',
            };
            return (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${toneMap[card.tone] || toneMap.indigo} shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gray-400">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-indigo-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="xl:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search role, name, action, entity, details..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {nameOptions.map((name) => <option key={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Action</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {actionOptions.map((action) => <option key={action}>{action}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Entity</label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {entityOptions.map((entity) => <option key={entity}>{entity}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Rows</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Activity Feed</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Showing {filteredRows.length.toLocaleString()} records from {logs.length.toLocaleString()} total
              </p>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              {currentPage} / {pageCount}
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No activity matches the current filters.</p>
              <p className="text-xs text-gray-400 mt-1">Try widening the date range or clearing the name filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50/80">
                  <tr className="border-b border-gray-100">
                    {['Time', 'Role', 'Name', 'Action', 'Entity', 'IP', 'Details'].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.18em] font-semibold text-gray-400">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => {
                    const ActionIcon = getActionIcon(row.category);
                    return (
                      <tr key={row.id} className={`border-b border-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-indigo-50/30 transition-colors`}>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <CalendarDays className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{formatTimestamp(row.createdAt)}</p>
                              <p className="text-[11px] text-gray-400">{row.dateKey || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
                            {row.role}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                              <p className="text-[11px] text-gray-400">{row.ip}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl ${badgeStyles[row.category] || badgeStyles.neutral}`}>
                              <ActionIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-sm font-semibold text-gray-900">{row.action}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-100">
                            {row.entity}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="text-sm text-gray-600">{row.ip}</span>
                        </td>
                        <td className="px-4 py-4 align-top max-w-[320px]">
                          <div className="space-y-1">
                            <p className="text-sm text-gray-700 line-clamp-2">{row.detail || 'No extra details recorded.'}</p>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[row.category] || badgeStyles.neutral}`}>
                              {row.category}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length.toLocaleString()} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700">
                {currentPage} / {pageCount}
              </span>
              <button
                disabled={currentPage >= pageCount}
                onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
