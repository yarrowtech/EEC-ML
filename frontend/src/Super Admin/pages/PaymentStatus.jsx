import { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, CreditCard, RefreshCw, XCircle } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function PaymentStatus() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/organizations/payment-status`, {
        headers: { authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load payment status');
      setOrganizations(data.organizations || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase text-gray-500">Organizations</p><h2 className="text-2xl font-bold text-gray-900">Payment Status</h2><p className="mt-1 text-sm text-gray-500">Read-only gateway health and transaction totals. Secrets are never available here.</p></div>
        <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <p className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Gateway</th><th className="px-4 py-3">Last verified</th><th className="px-4 py-3">Transactions</th><th className="px-4 py-3">Subscription</th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {organizations.map((organization) => <tr key={organization.organizationId}>
              <td className="px-4 py-4"><div className="flex items-center gap-3"><Building2 size={18} className="text-amber-600" /><div><p className="font-semibold text-gray-900">{organization.name}</p><p className="text-xs text-gray-500">{organization.domain}</p></div></div></td>
              <td className="px-4 py-4"><div className="flex items-center gap-2">{organization.paymentEnabled ? <CheckCircle2 size={17} className="text-emerald-600" /> : <XCircle size={17} className="text-gray-400" />}<div><p className={organization.paymentEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-gray-500'}>{organization.paymentEnabled ? 'Enabled' : 'Disabled'}</p><p className="text-xs capitalize text-gray-500">{organization.provider} · {organization.mode}</p></div></div></td>
              <td className="px-4 py-4 text-gray-700">{organization.lastVerifiedAt ? new Date(organization.lastVerifiedAt).toLocaleString('en-IN') : 'Never'}</td>
              <td className="px-4 py-4"><div className="flex items-center gap-2"><CreditCard size={16} className="text-gray-400" /><span className="font-semibold">{organization.totalTransactions}</span><span className="text-xs text-gray-500">({organization.capturedTransactions} captured)</span></div></td>
              <td className="px-4 py-4"><p className="font-semibold capitalize text-gray-800">{organization.subscriptionStatus}</p><p className="text-xs capitalize text-gray-500">{organization.subscriptionPlan}</p></td>
            </tr>)}
            {loading && <tr><td colSpan="5" className="px-4 py-12 text-center text-gray-500">Loading payment status...</td></tr>}
            {!loading && !organizations.length && <tr><td colSpan="5" className="px-4 py-12 text-center text-gray-500">No organizations found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
