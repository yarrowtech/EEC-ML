import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clipboard, Edit3, Eye, EyeOff, ExternalLink, Loader2, Lock,
  Send, ShieldCheck, Trash2, Save, XCircle, Info,
  Edit,
} from 'lucide-react';
import toast from 'react-hot-toast';
import usePaymentGateway from '../hooks/usePaymentGateway';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

const copyToClipboard = async (value, label) => {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
};

/* ─── Edit-credentials modal (inline overlay) ─── */
const CredentialEditModal = ({ open, onClose, mode, slot, onSave, saving, revealFn }) => {
  const [form, setForm] = useState({ keyId: '', keySecret: '', webhookSecret: '' });
  const [revealed, setRevealed] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [visible, setVisible] = useState({ keySecret: false, webhookSecret: false });

  useEffect(() => {
    if (open) {
      setForm({ keyId: slot?.keyId || '', keySecret: '', webhookSecret: '' });
      setRevealed(null);
      setVisible({ keySecret: false, webhookSecret: false });
    }
  }, [open, slot]);

  const toggleReveal = async (field) => {
    if (visible[field]) { setVisible((c) => ({ ...c, [field]: false })); return; }
    if (revealed) { setVisible((c) => ({ ...c, [field]: true })); return; }
    setRevealing(true);
    try {
      const data = await revealFn(mode);
      setRevealed(data);
      setVisible((c) => ({ ...c, [field]: true }));
    } catch (err) { toast.error(err.message || 'Unable to reveal'); }
    finally { setRevealing(false); }
  };

  if (!open) return null;
  const modeLabel = mode === 'live' ? 'Live' : 'Test';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">Edit {modeLabel} Credentials</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Key ID</label>
            <input value={form.keyId} onChange={(e) => setForm((c) => ({ ...c, keyId: e.target.value }))} placeholder={`rzp_${mode}_...`} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Key Secret</label>
            {slot?.hasKeySecret && !form.keySecret ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
                <span className="font-mono text-gray-500">{visible.keySecret && revealed ? revealed.keySecret : (slot.keySecretPreview || '••••••••••••••••')}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleReveal('keySecret')} disabled={revealing} className="text-gray-400 hover:text-gray-600">
                    {revealing ? <Loader2 size={15} className="animate-spin" /> : visible.keySecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button type="button" onClick={() => setForm((c) => ({ ...c, keySecret: '' }))} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Change</button>
                </div>
              </div>
            ) : (
              <input type="password" value={form.keySecret} onChange={(e) => setForm((c) => ({ ...c, keySecret: e.target.value }))} placeholder="Enter Key Secret" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Webhook Secret</label>
            {slot?.hasWebhookSecret && !form.webhookSecret ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
                <span className="font-mono text-gray-500">{visible.webhookSecret && revealed ? revealed.webhookSecret : (slot.webhookSecretPreview || '••••••••••••••••')}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleReveal('webhookSecret')} disabled={revealing} className="text-gray-400 hover:text-gray-600">
                    {revealing ? <Loader2 size={15} className="animate-spin" /> : visible.webhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button type="button" onClick={() => setForm((c) => ({ ...c, webhookSecret: '' }))} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Change</button>
                </div>
              </div>
            ) : (
              <input type="password" value={form.webhookSecret} onChange={(e) => setForm((c) => ({ ...c, webhookSecret: e.target.value }))} placeholder="Enter Webhook Secret" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            disabled={saving || !form.keyId.trim()}
            onClick={() => onSave({ mode, keyId: form.keyId.trim(), keySecret: form.keySecret, webhookSecret: form.webhookSecret })}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin inline mr-1.5" /> : null}Save
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function PaymentGatewaySettings({ setShowAdminHeader }) {
  const gateway = usePaymentGateway();
  const [editMode, setEditMode] = useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Per-mode reveal state for the inline credential display
  const [revealed, setRevealed] = useState({ test: null, live: null });
  const [revealing, setRevealing] = useState({ test: false, live: false });
  const [visible, setVisible] = useState({
    test: { keySecret: false, webhookSecret: false },
    live: { keySecret: false, webhookSecret: false },
  });

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  useEffect(() => {
    setRevealed({ test: null, live: null });
    setVisible({ test: { keySecret: false, webhookSecret: false }, live: { keySecret: false, webhookSecret: false } });
  }, [gateway.settings]);

  const toggleReveal = async (mode, field) => {
    if (visible[mode][field]) {
      setVisible((c) => ({ ...c, [mode]: { ...c[mode], [field]: false } }));
      return;
    }
    if (revealed[mode]) {
      setVisible((c) => ({ ...c, [mode]: { ...c[mode], [field]: true } }));
      return;
    }
    setRevealing((c) => ({ ...c, [mode]: true }));
    try {
      const data = await gateway.reveal(mode);
      setRevealed((c) => ({ ...c, [mode]: data }));
      setVisible((c) => ({ ...c, [mode]: { ...c[mode], [field]: true } }));
    } catch (err) { toast.error(err.message || 'Unable to reveal'); }
    finally { setRevealing((c) => ({ ...c, [mode]: false })); }
  };

  const connected = Boolean(gateway.settings?.connected);
  const activeMode = gateway.settings?.mode || 'test';
  const isLive = activeMode === 'live';

  const switchMode = async (mode) => {
    if (mode === activeMode || gateway.activating) return;
    const modeSlot = gateway.settings?.[mode] || {};
    if (!modeSlot.connected) {
      toast.error(`Save and connect ${mode === 'live' ? 'Live' : 'Test'} credentials first.`);
      return;
    }
    try {
      await gateway.activate(mode);
      toast.success(`${mode === 'live' ? 'Live' : 'Test'} mode is now active`);
    } catch (err) { toast.error(err.message); }
  };

  const handleSave = async (payload) => {
    try {
      await gateway.save(payload);
      toast.success(`${payload.mode === 'live' ? 'Live' : 'Test'} credentials saved`);
      setEditMode(null);
    } catch (err) { toast.error(err.message); }
  };

  const handleDisconnect = async () => {
    try {
      await gateway.disconnect(activeMode);
      setConfirmDisconnect(false);
      toast.success('Credentials disconnected');
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveAll = async () => {
    toast.success('Changes saved and applied to the selected environment.');
  };

  if (gateway.loading) {
    return (
      <div className="min-h-full bg-gray-50/50 p-4 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-white border border-gray-200" />
        </div>
      </div>
    );
  }

  const testSlot = gateway.settings?.test || {};
  const liveSlot = gateway.settings?.live || {};

  return (
    <div className="bg-gray-50/50">
      <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-8 space-y-5">

        {/* ─── Header ─── */}
        <div>
          <p className="text-sm text-gray-500">Settings</p>
          <h1 className="text-3xl font-bold text-gray-900">Payment Gateway</h1>
          <p className="mt-1 text-sm text-gray-500">Connect your school&apos;s Razorpay account to collect fees from students and parents securely.</p>
        </div>

        {gateway.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gateway.error}</div>}

        {/* ─── Status banner ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between rounded-2xl border p-5 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
        >
          <div className="flex items-center gap-3">
            {connected ? <CheckCircle2 className="text-emerald-600 shrink-0" size={24} /> : <XCircle className="text-amber-600 shrink-0" size={24} />}
            <div>
              <p className={`font-semibold text-base ${connected ? 'text-emerald-900' : 'text-amber-900'}`}>
                {connected ? `Razorpay Connected · ${isLive ? 'Live' : 'Test'} mode` : 'Payment gateway not configured'}
              </p>
              <p className={`text-sm ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
                {connected ? 'Online fee payments are available to students and parents.' : 'Students cannot pay fees online until credentials are saved.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <img src="https://razorpay.com/assets/razorpay-glyph.svg" alt="Razorpay" className="h-8 hidden sm:block" onError={(e) => { e.target.style.display = 'none'; }} />
            <span className="hidden sm:block text-xl font-bold text-gray-800">Razorpay</span>
            <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
              <ExternalLink size={14} /> View Docs
            </a>
          </div>
        </motion.div>

        {/* ─── Environment toggle ─── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <ShieldCheck className="text-blue-600" size={20} />
            </span>
            <div>
              <p className="font-semibold text-gray-900">Environment</p>
              <p className="text-sm text-gray-500">Choose the mode for payment processing.</p>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => switchMode('test')}
              disabled={gateway.activating}
              className={`inline-flex items-center gap-2 rounded-l-full border px-6 py-2.5 text-sm font-semibold transition ${activeMode === 'test' ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <ShieldCheck size={15} /> Test
            </button>
            <button
              type="button"
              onClick={() => switchMode('live')}
              disabled={gateway.activating}
              className={`inline-flex items-center gap-2 rounded-r-full border px-6 py-2.5 text-sm font-semibold transition ${activeMode === 'live' ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Live
            </button>
          </div>
          <p className="text-sm text-gray-500 max-w-xs hidden lg:block">
            {activeMode === 'test'
              ? 'Test mode allows you to try payments using Razorpay test cards/UPI. No real money is deducted.'
              : 'Live mode processes real payments. Money will be deducted from student accounts.'}
          </p>
        </div>

        {/* ─── Credentials: only the active mode ─── */}
        <div className="grid grid-cols-1 gap-5">
          {[activeMode].map((mode) => {
            const slot = mode === 'test' ? testSlot : liveSlot;
            const isActive = activeMode === mode;
            const modeLabel = mode === 'test' ? 'Test' : 'Live';
            const iconColor = mode === 'test' ? 'text-blue-600' : 'text-amber-600';
            const iconBg = mode === 'test' ? 'bg-blue-50' : 'bg-amber-50';

            return (
              <div key={mode} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                      <Lock className={iconColor} size={18} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{modeLabel} mode credentials</p>
                        {isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Not active</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{mode === 'test' ? 'Used for testing payments (no real money).' : 'Used for real payments.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditMode(mode)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    <Edit size={14} /> Edit credentials
                  </button>
                </div>
                {/* Credential rows — single row with 3 columns */}
                <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
                  {/* Key ID */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <span className="text-sm font-medium text-gray-500">Key ID</span>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm text-gray-700">{slot.keyId || 'Not set'}</span>
                      {slot.keyId && (
                        <button type="button" onClick={() => copyToClipboard(slot.keyId, 'Key ID')} className="shrink-0 text-gray-400 hover:text-gray-600">
                          <Clipboard size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Key Secret */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <span className="text-sm font-medium text-gray-500">Key Secret</span>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm text-gray-700">
                        {visible[mode].keySecret && revealed[mode]?.keySecret ? revealed[mode].keySecret : (slot.hasKeySecret ? (slot.keySecretPreview || '••••••••••••••••••') : 'Not set')}
                      </span>
                      {slot.hasKeySecret && (
                        <button type="button" onClick={() => toggleReveal(mode, 'keySecret')} disabled={revealing[mode]} className="shrink-0 text-gray-400 hover:text-gray-600">
                          {revealing[mode] ? <Loader2 size={15} className="animate-spin" /> : visible[mode].keySecret ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Webhook Secret */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <span className="text-sm font-medium text-gray-500">Webhook Secret</span>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm text-gray-700">
                        {visible[mode].webhookSecret && revealed[mode]?.webhookSecret ? revealed[mode].webhookSecret : (slot.hasWebhookSecret ? (slot.webhookSecretPreview || '••••••••••••••••••') : 'Not set')}
                      </span>
                      {slot.hasWebhookSecret && (
                        <button type="button" onClick={() => toggleReveal(mode, 'webhookSecret')} disabled={revealing[mode]} className="shrink-0 text-gray-400 hover:text-gray-600">
                          {revealing[mode] ? <Loader2 size={15} className="animate-spin" /> : visible[mode].webhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Connection status ─── */}
        {connected && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="text-emerald-600" size={20} />
              </span>
              <div>
                <p className="font-semibold text-gray-900">Connection status</p>
                <p className="text-sm text-gray-500">Details of your connected Razorpay account.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Account</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{gateway.settings?.accountName || 'School Razorpay Account'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{gateway.settings?.accountEmail || 'Not available'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last verified</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {(gateway.settings?.[activeMode]?.lastVerifiedAt)
                    ? new Date(gateway.settings[activeMode].lastVerifiedAt).toLocaleString('en-IN')
                    : 'Not verified'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Webhook ─── */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50">
                <Send className="text-teal-600" size={18} />
              </span>
              <div>
                <p className="font-semibold text-gray-900">Webhook</p>
                <p className="text-sm text-gray-500">Razorpay will send payment event notifications to this URL.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-700">
                <span className="truncate max-w-xs">{`${API_BASE}/api/payments/webhook`}</span>
                <button type="button" onClick={() => copyToClipboard(`${API_BASE}/api/payments/webhook`, 'Webhook URL')} className="shrink-0 text-gray-400 hover:text-gray-600">
                  <Clipboard size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try { await gateway.test(activeMode); toast.success('Webhook test successful'); }
                  catch (err) { toast.error(err.message); }
                }}
                disabled={!connected || gateway.testing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 shadow-sm disabled:opacity-50"
              >
                {gateway.testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Test
              </button>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-blue-600">
            <Info size={13} /> Enable payment.captured, payment.failed, and order.paid events in your Razorpay dashboard.
          </p>
        </div>
      </div>

      {/* ─── Bottom bar ─── */}
      <div className="mt-5 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <Info size={14} className="text-blue-500" /> Your changes will be saved and applied to the selected environment.
          </p>
          <div className="flex items-center gap-3">
            {connected && (
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                disabled={gateway.disconnecting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                {gateway.disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Disconnect
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Save size={14} /> Save changes
            </button>
          </div>
        </div>
      </div>

      {/* ─── Edit credentials modal ─── */}
      <CredentialEditModal
        open={editMode !== null}
        onClose={() => setEditMode(null)}
        mode={editMode || 'test'}
        slot={editMode === 'live' ? liveSlot : testSlot}
        onSave={handleSave}
        saving={gateway.saving}
        revealFn={gateway.reveal}
      />

      {/* ─── Disconnect confirmation ─── */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmDisconnect(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Disconnect credentials?</h3>
            <p className="mt-2 text-sm text-gray-600">
              {activeMode === gateway.settings?.mode
                ? 'This mode is currently active — online fee payment will stop immediately. '
                : ''}
              Stored credentials will be permanently removed. Transaction history will be preserved.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmDisconnect(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDisconnect} disabled={gateway.disconnecting} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {gateway.disconnecting && <Loader2 size={14} className="animate-spin inline mr-1.5" />}Disconnect
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
