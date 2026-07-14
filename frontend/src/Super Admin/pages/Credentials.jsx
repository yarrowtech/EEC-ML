import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeySquare, RefreshCw, Copy, ShieldCheck, Search, Loader2, AlertCircle, X } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 10;

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : null;
};

/* One-time display of a freshly reset password. Nothing is persisted client-side. */
const ResetResultModal = ({ result, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`Username: ${result.username}\nPassword: ${result.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Clipboard copy failed', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck size={18} /></div>
            <h3 className="text-base font-bold text-slate-800">Password reset</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            This password is shown <strong>only once</strong>. The admin must change it on first login.
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-sm">
            <span className="block text-[10px] font-sans font-semibold uppercase text-slate-400">Username</span>
            {result.username}
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-sm">
            <span className="block text-[10px] font-sans font-semibold uppercase text-slate-400">Temporary password</span>
            {result.password}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={copyAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const Credentials = () => {
  const toast = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [resettingId, setResettingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);

  const fetchAdmins = useCallback(async () => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/school-admins`, { headers });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load school admins');
      }
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load school admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);
  useEffect(() => { setPage(1); }, [searchTerm]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return admins;
    return admins.filter((admin) =>
      String(admin.username || '').toLowerCase().includes(q) ||
      String(admin.name || '').toLowerCase().includes(q) ||
      String(admin.email || '').toLowerCase().includes(q) ||
      String(admin.schoolId?.name || '').toLowerCase().includes(q) ||
      String(admin.schoolId?.code || '').toLowerCase().includes(q)
    );
  }, [admins, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleReset = async (admin) => {
    const headers = authHeaders();
    if (!headers || !API_BASE || !admin?._id) return;
    setResettingId(String(admin._id));
    setConfirmTarget(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/school-admins/${admin._id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to reset password');
      }
      setResetResult({ username: data.username || admin.username, password: data.password });
      toast.success(`Password reset for ${data.username || admin.username}`);
    } catch (err) {
      toast.error(err.message || 'Unable to reset password');
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Security controls</p>
            <h2 className="text-2xl font-semibold text-slate-800">School Admin Credentials</h2>
            <p className="text-sm text-slate-500 mt-1">
              Reset school admin passwords. New passwords are generated on the server, shown once, and must be changed on first login.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="border border-slate-200 rounded-xl p-3 text-center min-w-[90px]">
              <p className="text-xs uppercase text-slate-400">Admins</p>
              <p className="text-xl font-semibold text-slate-800">{loading ? '—' : admins.length}</p>
            </div>
            <button
              onClick={fetchAdmins}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-violet-300 transition-all">
            <Search size={16} className="text-slate-400" />
            <input
              className="bg-transparent flex-1 text-sm focus:outline-none"
              placeholder="Search by username, name, email or school"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500">
            Password policy: 12+ chars, mixed case, number & symbol — enforced server-side
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchAdmins} className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-medium">Retry</button>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={24} className="animate-spin text-violet-500" />
          <p className="text-sm">Loading school admins…</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {paged.map((admin) => (
            <div key={admin._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600">
                    <KeySquare size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {admin.schoolId?.name || admin.name || 'Unknown school'}
                      {admin.campusName && <span className="text-xs font-medium text-slate-400"> • {admin.campusName}</span>}
                    </p>
                    <p className="text-sm text-slate-500 font-mono">{admin.username}</p>
                    {admin.email && <p className="text-xs text-slate-400">{admin.email}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    admin.status === 'inactive' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {admin.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                  {confirmTarget === admin._id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Reset password?</span>
                      <button
                        onClick={() => handleReset(admin)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmTarget(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmTarget(admin._id)}
                      disabled={Boolean(resettingId)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {resettingId === String(admin._id)
                        ? <Loader2 size={15} className="animate-spin" />
                        : <RefreshCw size={15} />}
                      Reset password
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !error && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-500">
              {searchTerm ? `No school admins found for "${searchTerm}".` : 'No school admins yet — approve a school registration to create one.'}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold border transition-colors ${
                    p === page ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {resetResult && <ResetResultModal result={resetResult} onClose={() => setResetResult(null)} />}
    </div>
  );
};

export default Credentials;
