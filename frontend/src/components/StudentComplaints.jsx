import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const CATEGORIES = ['Academic', 'Technical', 'Fees', 'Transport', 'Wellbeing', 'General'];

const StudentComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'Academic', priority: 'medium' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }), []);

  const loadComplaints = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/student/auth/complaints`, { headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Unable to load complaints');
      setComplaints(Array.isArray(payload?.complaints) ? payload.complaints : []);
    } catch (err) {
      setError(err.message || 'Unable to load complaints');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/student/auth/complaints`, {
        method: 'POST', headers, body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Unable to submit complaint');
      setComplaints((current) => [payload, ...current]);
      setForm({ title: '', description: '', category: 'Academic', priority: 'medium' });
    } catch (err) {
      setError(err.message || 'Unable to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
      <header className="rounded-2xl border border-indigo-100 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Student services</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Complaints & Support</h1><p className="mt-2 text-sm text-slate-600">Raise an issue and follow its resolution.</p></header>
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-900">Submit a complaint</h2>
          <label className="block text-sm font-semibold text-slate-700">Title<input aria-label="Complaint title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="block text-sm font-semibold text-slate-700">Description<textarea aria-label="Complaint description" required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-slate-700">Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal">{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          </div>
          <button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit</button>
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-900">My tickets</h2>
          {loading ? <p className="mt-5 text-sm text-slate-500">Loading tickets...</p> : complaints.length === 0 ? <p className="mt-5 text-sm text-slate-500">No complaints submitted.</p> : <div className="mt-4 space-y-3">{complaints.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.ticketNumber} · Assigned to {item.owner}</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold capitalize text-indigo-700">{String(item.status).replace('_', ' ')}</span></div><p className="mt-3 text-sm text-slate-600">{item.description}</p>{item.resolutionNotes && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Resolution: {item.resolutionNotes}</p>}</article>)}</div>}
        </section>
      </div>
    </div>
  );
};

export default StudentComplaints;
