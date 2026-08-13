import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Clipboard, CreditCard, Eye, EyeOff, Loader2, Lock, PlugZap, Radio,
  ShieldCheck, Sparkles, Unplug, XCircle, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePaymentGateway from '../hooks/usePaymentGateway';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

const MODE_META = {
  test: { label: 'Test', dot: 'bg-blue-500', ring: 'ring-blue-200', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  live: { label: 'Live', dot: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

const copyToClipboard = async (value, label) => {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
};

/* ─── secret field: password input with eye toggle while typing a NEW value ─── */
const SecretField = ({ id, label, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete="new-password" className="h-11 pr-11" />
      <button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700" aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
};

/* ─── already-saved secret: masked preview chip, never re-decrypted ─── */
const SavedSecretChip = ({ preview, onChange }) => (
  <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5">
    <span className="inline-flex items-center gap-2 font-mono text-sm text-slate-600">
      <Lock size={13} className="text-slate-400" />
      {preview || '••••••••'}
    </span>
    <button type="button" onClick={onChange} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Change</button>
  </div>
);

/* ─── secret field with saved-chip / edit-mode toggle ─── */
const ManagedSecretField = ({ id, label, hasSaved, preview, editing, onStartEdit, onCancelEdit, value, onChange, placeholder }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label htmlFor={id}>{label}</Label>
      {hasSaved && editing && (
        <button type="button" onClick={onCancelEdit} className="text-xs font-medium text-slate-400 hover:text-slate-600">Keep existing</button>
      )}
    </div>
    {hasSaved && !editing ? (
      <SavedSecretChip preview={preview} onChange={onStartEdit} />
    ) : (
      <SecretField id={id} label={label} value={value} onChange={onChange} placeholder={placeholder} />
    )}
  </div>
);

export default function PaymentGatewaySettings({ setShowAdminHeader }) {
  const gateway = usePaymentGateway();
  const [viewMode, setViewMode] = useState(null);
  const [form, setForm] = useState({ keyId: '', keySecret: '', webhookSecret: '' });
  const [editingKeySecret, setEditingKeySecret] = useState(false);
  const [editingWebhookSecret, setEditingWebhookSecret] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  // Default the viewed tab to whichever mode is currently active, once —
  // after that the admin drives tab switching themselves. Falls back to
  // 'test' if the initial fetch failed, so the page can still render the
  // error banner instead of being stuck on the loading skeleton forever.
  useEffect(() => {
    if (viewMode !== null) return;
    if (gateway.settings) setViewMode(gateway.settings.mode || 'test');
    else if (!gateway.loading && gateway.error) setViewMode('test');
  }, [gateway.settings, gateway.loading, gateway.error, viewMode]);

  const slot = (gateway.settings && viewMode) ? (gateway.settings[viewMode] || {}) : {};

  useEffect(() => {
    if (!gateway.settings || !viewMode) return;
    const currentSlot = gateway.settings[viewMode] || {};
    setForm({ keyId: currentSlot.keyId || '', keySecret: '', webhookSecret: '' });
    setEditingKeySecret(!currentSlot.hasKeySecret);
    setEditingWebhookSecret(!currentSlot.hasWebhookSecret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway.settings, viewMode]);

  const formValid = useMemo(() => {
    if (!viewMode) return false;
    const keyMatchesMode = new RegExp(`^rzp_${viewMode}_[A-Za-z0-9]+$`).test(form.keyId.trim());
    const keySecretOk = editingKeySecret ? form.keySecret.length >= 8 : true;
    const webhookSecretOk = editingWebhookSecret ? form.webhookSecret.length >= 8 : true;
    return keyMatchesMode && keySecretOk && webhookSecretOk;
  }, [form, viewMode, editingKeySecret, editingWebhookSecret]);

  const modeLabel = MODE_META[viewMode || 'test'].label;

  const save = async () => {
    try {
      await gateway.save({
        mode: viewMode,
        keyId: form.keyId.trim(),
        keySecret: editingKeySecret ? form.keySecret : '',
        webhookSecret: editingWebhookSecret ? form.webhookSecret : '',
      });
      toast.success(`${modeLabel} credentials saved`);
      setForm((current) => ({ ...current, keySecret: '', webhookSecret: '' }));
    } catch (error) { toast.error(error.message); }
  };

  const test = async () => {
    try { await gateway.test(viewMode); toast.success(`${modeLabel} connection verified`); }
    catch (error) { toast.error(error.message); }
  };

  const activateThisMode = async () => {
    try {
      await gateway.activate(viewMode);
      toast.success(`${modeLabel} mode is now active for payments`);
    } catch (error) { toast.error(error.message); }
  };

  const disconnect = async () => {
    try {
      await gateway.disconnect(viewMode);
      setConfirmOpen(false);
      toast.success(`${modeLabel} credentials disconnected`);
    } catch (error) { toast.error(error.message); }
  };

  if (gateway.loading || !viewMode) {
    return <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-8"><div className="h-32 animate-pulse rounded-2xl bg-slate-200" /><div className="h-120 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" /></div>;
  }

  const connected = Boolean(gateway.settings?.connected);
  const isActiveMode = gateway.settings?.mode === viewMode;
  const meta = MODE_META[viewMode];

  return (
    <div className="min-h-full bg-linear-to-b from-slate-50 to-slate-50/60 p-4 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
            <CreditCard className="text-amber-600" size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Settings</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-950 flex items-center gap-2">Payment Gateway <Sparkles size={16} className="text-amber-400" /></h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Connect the school&apos;s own Razorpay account. Student payments settle directly into the bank account linked to that Razorpay account.</p>
          </div>
        </div>

        {gateway.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gateway.error}</div>}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xs ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {connected ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={20} /> : <XCircle className="mt-0.5 text-amber-600" size={20} />}
          <div>
            <p className={`font-semibold ${connected ? 'text-emerald-900' : 'text-amber-900'}`}>
              {connected ? `Razorpay Connected (${MODE_META[gateway.settings.mode].label} mode active)` : 'Payment gateway not configured'}
            </p>
            <p className={`mt-1 text-sm ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>{connected ? 'Online fee payments are available to students and parents.' : 'Students cannot pay fees online until credentials are saved and a mode is activated.'}</p>
          </div>
        </motion.div>

        {/* ─── test / live segmented control ─── */}
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-xs">
          {['test', 'live'].map((tabMode) => {
            const tabSlot = gateway.settings?.[tabMode] || {};
            const isTabActive = gateway.settings?.mode === tabMode;
            return (
              <button
                key={tabMode}
                type="button"
                onClick={() => setViewMode(tabMode)}
                className={`relative flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${viewMode === tabMode ? 'text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                {viewMode === tabMode && (
                  <motion.span layoutId="gateway-mode-pill" className={`absolute inset-0 rounded-lg shadow-sm ${tabMode === 'live' ? 'bg-emerald-500' : 'bg-blue-500'}`} transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={`size-2 rounded-full ${MODE_META[tabMode].dot} ${viewMode === tabMode ? 'ring-2 ring-white/60' : ''}`} />
                  {MODE_META[tabMode].label}
                  {isTabActive && <Badge variant={viewMode === tabMode ? 'secondary' : 'default'} className={viewMode === tabMode ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'}>Active</Badge>}
                  {!isTabActive && tabSlot.connected && <Badge variant="outline" className={viewMode === tabMode ? 'border-white/40 text-white' : ''}>Configured</Badge>}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={viewMode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">

            {/* ─── active-mode status row ─── */}
            <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isActiveMode ? `${meta.border} ${meta.bg}` : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2.5">
                <Radio size={16} className={isActiveMode ? meta.text : 'text-slate-400'} />
                <p className={`text-sm font-semibold ${isActiveMode ? meta.text : 'text-slate-600'}`}>
                  {isActiveMode ? `${meta.label} mode is active — this is what students pay through right now.` : `${meta.label} mode is not active. Students are paying through ${MODE_META[gateway.settings?.mode || 'test'].label} mode.`}
                </p>
              </div>
              {!isActiveMode && (
                <Button size="sm" variant="outline" onClick={activateThisMode} disabled={!slot.connected || gateway.activating} className={`${meta.border} ${meta.text} hover:${meta.bg}`}>
                  {gateway.activating ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} Activate {meta.label} mode
                </Button>
              )}
            </div>

            {isActiveMode && connected && (
              <Card className="bg-white">
                <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-emerald-600" /> Connection details</CardTitle></CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
                  <div><p className="text-slate-500">Account</p><p className="mt-1 font-semibold text-slate-900">{gateway.settings.accountName || 'School Razorpay account'}</p></div>
                  <div><p className="text-slate-500">Email</p><p className="mt-1 font-semibold text-slate-900">{gateway.settings.accountEmail || 'Not available'}</p></div>
                  <div><p className="text-slate-500">Last verified</p><p className="mt-1 font-semibold text-slate-900">{slot.lastVerifiedAt ? new Date(slot.lastVerifiedAt).toLocaleString('en-IN') : 'Not verified'}</p></div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2"><CreditCard className="text-amber-600" /> {meta.label} configuration</CardTitle>
                <CardDescription>Key Secret and Webhook Secret are encrypted at rest. Once saved, only a masked preview is ever shown again — never the full value.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="keyId">Key ID</Label>
                  <div className="flex gap-2">
                    <Input id="keyId" value={form.keyId} onChange={(event) => setForm((current) => ({ ...current, keyId: event.target.value }))} placeholder={`rzp_${viewMode}_...`} className="h-11 font-mono" />
                    <Button variant="outline" size="icon-lg" onClick={() => copyToClipboard(form.keyId, 'Key ID')} disabled={!form.keyId} aria-label="Copy Key ID"><Clipboard /></Button>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <ManagedSecretField
                    id="keySecret" label="Key Secret"
                    hasSaved={slot.hasKeySecret} preview={slot.keySecretPreview}
                    editing={editingKeySecret}
                    onStartEdit={() => setEditingKeySecret(true)}
                    onCancelEdit={() => { setEditingKeySecret(false); setForm((c) => ({ ...c, keySecret: '' })); }}
                    value={form.keySecret} onChange={(event) => setForm((current) => ({ ...current, keySecret: event.target.value }))}
                    placeholder="Enter Key Secret"
                  />
                  <ManagedSecretField
                    id="webhookSecret" label="Webhook Secret"
                    hasSaved={slot.hasWebhookSecret} preview={slot.webhookSecretPreview}
                    editing={editingWebhookSecret}
                    onStartEdit={() => setEditingWebhookSecret(true)}
                    onCancelEdit={() => { setEditingWebhookSecret(false); setForm((c) => ({ ...c, webhookSecret: '' })); }}
                    value={form.webhookSecret} onChange={(event) => setForm((current) => ({ ...current, webhookSecret: event.target.value }))}
                    placeholder="Enter Webhook Secret"
                  />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  <div>
                    <strong>Razorpay webhook URL:</strong> <span className="break-all font-mono">{`${API_BASE}/api/payments/webhook`}</span>
                    <br />Enable payment.captured, payment.failed, and order.paid in the Razorpay dashboard.
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(`${API_BASE}/api/payments/webhook`, 'Webhook URL')} aria-label="Copy webhook URL"><Clipboard size={14} /></Button>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                  <Button onClick={test} variant="outline" size="lg" disabled={!slot.connected || gateway.testing}>{gateway.testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Test {meta.label} Connection</Button>
                  <Button onClick={save} size="lg" disabled={!formValid || gateway.saving} className="bg-amber-500 text-white hover:bg-amber-600">{gateway.saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Save {meta.label} Configuration</Button>
                  {slot.connected && <Button onClick={() => setConfirmOpen(true)} variant="destructive" size="lg" className="sm:ml-auto"><Unplug /> Disconnect {meta.label}</Button>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Disconnect {meta.label} credentials?</DialogTitle>
            <DialogDescription>
              {isActiveMode
                ? 'This mode is currently active — online fee payment will stop immediately. '
                : `${meta.label} mode isn't currently active, so payments won't be affected. `}
              Stored credentials for {meta.label.toLowerCase()} mode will be permanently removed, while transaction and audit history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={disconnect} disabled={gateway.disconnecting}>{gateway.disconnecting && <Loader2 className="animate-spin" />} Disconnect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
