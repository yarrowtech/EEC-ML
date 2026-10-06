import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../config/api';
import { getStoredAdminScope } from '../../admin/utils/adminScope';

const initialFilters = { feature: '', status: '', from: '', to: '', needsReview: '', grounded: '' };
export default function AiOperations() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const params = new URLSearchParams({ limit: '100' });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, ['from', 'to'].includes(key) ? new Date(`${value}T${key === 'to' ? '23:59:59.999' : '00:00:00'}`).toISOString() : value);
    });
    const { schoolId, campusId } = getStoredAdminScope();
    fetch(`${API_BASE}/api/ai-tutor/admin/interaction-logs?${params}`, { signal: controller.signal, headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...(schoolId ? { 'x-school-id': schoolId } : {}), ...(campusId ? { 'x-campus-id': campusId } : {}),
    } }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load AI operations');
      if (!controller.signal.aborted) setData(result);
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, reload]);
  const summaries = data?.summary || [];
  return <main className="space-y-5 p-4 sm:p-6">
    <h1 className="text-2xl font-bold">AI operations</h1>
    <p>School-wide AI request outcomes. Grounding and review flags are recorded signals, not proof of answer quality.</p>
    <form onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft }); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      <label>Feature<input className="block rounded border p-2" placeholder="e.g. tutor_generate" value={draft.feature} onChange={(event) => setDraft({ ...draft, feature: event.target.value })} /></label>
      {[
        ['status', 'Outcome', [['success', 'Success'], ['error', 'Error']]],
        ['needsReview', 'Review needed', [['true', 'Yes'], ['false', 'No']]],
        ['grounded', 'Grounded', [['true', 'Yes'], ['false', 'No']]],
      ].map(([key, label, options]) => <label key={key}>{label}<select className="block rounded border p-2" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}><option value="">All</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}
      {['from', 'to'].map((key) => <label key={key}>{key === 'from' ? 'From date' : 'To date'}<input type="date" className="block rounded border p-2" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      <button className="rounded bg-indigo-700 px-4 py-2 text-white">Apply filters</button>
      <button type="button" onClick={() => setReload((value) => value + 1)}>Refresh</button>
    </form>
    {loading && <p role="status">Loading AI operations…</p>}
    {error && <div><p role="alert">{error}</p><button onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
    {data && <>
      <h2 className="text-lg font-semibold">Summary by feature</h2>
      <p className="text-sm">Aggregates cover all matching retained logs. Recent requests below show at most 100. Dates use your local timezone.</p>
      {!summaries.length ? <p>No interactions match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Feature', 'Requests', 'Errors', 'Grounded', 'Review needed', 'Average latency'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
        {summaries.map((row) => <tr key={row._id} className="border-t"><th className="p-3">{row._id}</th><td>{row.total}</td><td>{row.errors} ({row.total ? Math.round(row.errors / row.total * 100) : 0}%)</td><td>{row.grounded}</td><td>{row.needsReview}</td><td>{row.avgLatencyMs == null ? 'Not recorded' : `${Math.round(row.avgLatencyMs)} ms`}</td></tr>)}
      </tbody></table></div>}
      <h2 className="text-lg font-semibold">Recent requests</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time', 'Feature', 'Model', 'Outcome', 'Latency', 'Grounded', 'Review needed'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>
        {(data.data || []).map((row) => <tr key={row._id} className="border-t"><td className="p-3">{new Date(row.createdAt).toLocaleString()}</td><td>{row.feature}</td><td>{row.provider} / {row.model || 'Not recorded'}</td><td>{row.status}{row.errorType ? `: ${row.errorType}` : ''}</td><td>{row.latencyMs == null ? 'Not recorded' : `${row.latencyMs} ms`}</td><td>{row.grounded ? 'Yes' : 'No'}</td><td>{row.needsReview ? 'Yes' : 'No'}</td></tr>)}
      </tbody></table></div>
    </>}
  </main>;
}
