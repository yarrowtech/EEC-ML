import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Save } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const authHeaders = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0 });
  const [drafts, setDrafts] = useState({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/super-admin/organizations`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/super-admin/organizations/stats`, { headers: authHeaders() }),
      ]);
      if (!listResponse.ok || !statsResponse.ok) throw new Error('Unable to load organizations');
      const listPayload = await listResponse.json();
      const statsPayload = await statsResponse.json();
      const items = listPayload.organizations || [];
      setOrganizations(items);
      setStats(statsPayload);
      setDrafts(Object.fromEntries(items.map((item) => [item._id, {
        plan: item.subscription?.plan || '',
        customDomains: (item.customDomains || []).join(', '),
      }])));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createOrganization = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving('create');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/organizations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to create organization');
      setName('');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving('');
    }
  };

  const updateOrganization = async (organization, changes) => {
    setSaving(organization._id);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/organizations/${organization._id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(changes),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to update organization');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving('');
    }
  };

  const saveCommercialSettings = (organization) => {
    const draft = drafts[organization._id] || {};
    updateOrganization(organization, {
      subscription: { ...(organization.subscription || {}), plan: draft.plan || '' },
      customDomains: String(draft.customDomains || '').split(',').map((value) => value.trim()).filter(Boolean),
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Tenant Control</p>
          <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
        </div>
        <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 border-y border-gray-200 bg-white">
        {Object.entries(stats).map(([label, value]) => (
          <div key={label} className="border-r border-gray-200 px-5 py-4 last:border-r-0">
            <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={createOrganization} className="flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold text-gray-700">
          School name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 font-normal outline-none focus:border-amber-500" placeholder="St. Xavier's School" />
        </label>
        <button disabled={saving === 'create'} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          <Plus size={16} /> Create organization
        </button>
      </form>

      {error && <p className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto border border-gray-200 bg-white">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Custom domains</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!loading && organizations.map((organization) => (
              <tr key={organization._id}>
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Building2 size={18} className="text-amber-600" /><div><p className="font-semibold text-gray-900">{organization.name}</p><p className="text-xs text-gray-500">{organization.domain}</p></div></div></td>
                <td className="px-4 py-3"><span className={`font-semibold ${organization.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>{organization.status}</span></td>
                <td className="px-4 py-3"><select value={drafts[organization._id]?.plan || ''} onChange={(event) => setDrafts((current) => ({ ...current, [organization._id]: { ...current[organization._id], plan: event.target.value } }))} className="h-9 w-full rounded-md border border-gray-300 px-2"><option value="">Unassigned</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></td>
                <td className="px-4 py-3"><input value={drafts[organization._id]?.customDomains || ''} onChange={(event) => setDrafts((current) => ({ ...current, [organization._id]: { ...current[organization._id], customDomains: event.target.value } }))} className="h-9 w-full rounded-md border border-gray-300 px-2" placeholder="school.example.org" /></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" title="Save subscription and domains" onClick={() => saveCommercialSettings(organization)} disabled={saving === organization._id} className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 font-semibold text-gray-700 hover:bg-gray-50"><Save size={15} /> Save</button><button type="button" onClick={() => updateOrganization(organization, { status: organization.status === 'active' ? 'suspended' : 'active' })} disabled={saving === organization._id} className={`h-9 rounded-md px-3 font-semibold text-white ${organization.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{organization.status === 'active' ? 'Suspend' : 'Activate'}</button></div></td>
              </tr>
            ))}
            {loading && <tr><td colSpan="5" className="px-4 py-10 text-center text-gray-500">Loading organizations...</td></tr>}
            {!loading && organizations.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-gray-500">No organizations found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
