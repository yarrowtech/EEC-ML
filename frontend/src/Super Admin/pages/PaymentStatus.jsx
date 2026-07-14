import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, CreditCard, RefreshCw, XCircle, Users, IndianRupee, Settings2, Loader2 } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TIER_ORDER = ['under500', 'midTier', 'over1000'];

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { authorization: `Bearer ${token}` } : {};
};

const formatMoney = (value, currency = 'INR') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
};

const TIER_BADGE = {
  under500: 'bg-sky-100 text-sky-700',
  midTier: 'bg-amber-100 text-amber-700',
  over1000: 'bg-violet-100 text-violet-700',
};

export default function PaymentStatus() {
  const toast = useToast();
  const [organizations, setOrganizations] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [totals, setTotals] = useState({ students: 0, monthlyRevenue: 0, currency: 'INR' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTiers, setDraftTiers] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/organizations/payment-status`, {
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load payment status');
      setOrganizations(data.organizations || []);
      setPricing(data.pricing || null);
      setTotals(data.totals || { students: 0, monthlyRevenue: 0, currency: 'INR' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currency = pricing?.currency || totals.currency || 'INR';

  const openEditor = () => {
    setDraftTiers(
      TIER_ORDER.reduce((acc, key) => {
        acc[key] = {
          label: pricing?.tiers?.[key]?.label || key,
          pricePerStudent: String(pricing?.tiers?.[key]?.pricePerStudent ?? 0),
        };
        return acc;
      }, {})
    );
    setEditorOpen(true);
  };

  const savePricing = async () => {
    const invalid = TIER_ORDER.some((key) => {
      const value = Number(draftTiers[key]?.pricePerStudent);
      return !Number.isFinite(value) || value < 0;
    });
    if (invalid) {
      toast.error('Enter a valid non-negative price for every tier.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tiers: TIER_ORDER.reduce((acc, key) => {
          acc[key] = { pricePerStudent: Number(draftTiers[key].pricePerStudent) };
          return acc;
        }, {}),
      };
      const response = await fetch(`${API_BASE}/api/super-admin/billing/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save pricing');
      setPricing(data.pricing);
      toast.success('Per-student pricing updated');
      setEditorOpen(false);
      await load();
    } catch (saveError) {
      toast.error(saveError.message || 'Unable to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const pricingSummary = useMemo(() => {
    if (!pricing?.tiers) return [];
    return TIER_ORDER.map((key) => ({
      key,
      label: pricing.tiers[key]?.label || key,
      price: pricing.tiers[key]?.pricePerStudent ?? 0,
    }));
  }, [pricing]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Organizations</p>
          <h2 className="text-2xl font-bold text-gray-900">Payment &amp; Billing</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monthly bills are calculated per active student, using the tier that matches each school&apos;s size.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openEditor} className="inline-flex h-10 items-center gap-2 rounded-md bg-violet-600 px-3 text-sm font-semibold text-white hover:bg-violet-700">
            <Settings2 size={16} /> Set per-student pricing
          </button>
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500"><Users size={16} /><span className="text-xs font-semibold uppercase">Total students</span></div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : totals.students.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500"><IndianRupee size={16} /><span className="text-xs font-semibold uppercase">Est. monthly revenue</span></div>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{loading ? '—' : formatMoney(totals.monthlyRevenue, currency)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500"><CreditCard size={16} /><span className="text-xs font-semibold uppercase">Pricing tiers</span></div>
          <div className="mt-1 space-y-0.5 text-sm text-gray-700">
            {pricingSummary.map((tier) => (
              <div key={tier.key} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{tier.label}</span>
                <span className="font-semibold">{formatMoney(tier.price, currency)}<span className="text-xs font-normal text-gray-400">/student</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto border border-gray-200 bg-white rounded-xl">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Tier / rate</th>
              <th className="px-4 py-3">Monthly bill</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Transactions</th>
              <th className="px-4 py-3">Subscription</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {organizations.map((organization) => (
              <tr key={organization.organizationId}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Building2 size={18} className="text-amber-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{organization.name}</p>
                      <p className="text-xs text-gray-500">{organization.domain}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-gray-400" />
                    <span className="font-semibold text-gray-900">{organization.studentCount.toLocaleString('en-IN')}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_BADGE[organization.tierKey] || 'bg-gray-100 text-gray-600'}`}>
                    {organization.tierLabel}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">{formatMoney(organization.pricePerStudent, currency)}/student</p>
                </td>
                <td className="px-4 py-4">
                  <span className="font-bold text-emerald-700">{formatMoney(organization.monthlyBill, currency)}</span>
                  <span className="text-xs text-gray-400"> /mo</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {organization.paymentEnabled ? <CheckCircle2 size={17} className="text-emerald-600" /> : <XCircle size={17} className="text-gray-400" />}
                    <div>
                      <p className={organization.paymentEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-gray-500'}>{organization.paymentEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p className="text-xs capitalize text-gray-500">{organization.provider} · {organization.mode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" />
                    <span className="font-semibold">{organization.totalTransactions}</span>
                    <span className="text-xs text-gray-500">({organization.capturedTransactions} captured)</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold capitalize text-gray-800">{organization.subscriptionStatus}</p>
                  <p className="text-xs capitalize text-gray-500">{organization.subscriptionPlan}</p>
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-500">Loading payment status...</td></tr>}
            {!loading && !organizations.length && <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-500">No organizations found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pricing editor */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Per-student monthly pricing</h3>
              <p className="text-sm text-slate-500 mt-1">Set the price charged per active student, per month, for each school-size tier.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {TIER_ORDER.map((key) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{draftTiers[key]?.label || key}</p>
                    <p className="text-xs text-slate-400">
                      {key === 'under500' ? '0 – 499 students' : key === 'midTier' ? '500 – 1,000 students' : '1,000+ students'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draftTiers[key]?.pricePerStudent ?? ''}
                      onChange={(e) => setDraftTiers((prev) => ({ ...prev, [key]: { ...prev[key], pricePerStudent: e.target.value } }))}
                      className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                    <span className="text-xs text-slate-400">/student</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditorOpen(false)} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={savePricing} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                Save pricing
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
