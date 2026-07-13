import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clipboard, CreditCard, Eye, EyeOff, Loader2, PlugZap, ShieldCheck,
  Unplug, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePaymentGateway from '../hooks/usePaymentGateway';

const EMPTY_FORM = { mode: 'test', keyId: '', keySecret: '', webhookSecret: '' };
const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

const SecretField = ({ id, label, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete="new-password" className="h-11 pr-11" />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700" aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
};

export default function PaymentGatewaySettings({ setShowAdminHeader }) {
  const gateway = usePaymentGateway();
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);
  useEffect(() => {
    if (!gateway.settings) return;
    setForm({ mode: gateway.settings.mode || 'test', keyId: gateway.settings.keyId || '', keySecret: '', webhookSecret: '' });
  }, [gateway.settings]);

  const formValid = useMemo(() => {
    const keyMatchesMode = new RegExp(`^rzp_${form.mode}_[A-Za-z0-9]+$`).test(form.keyId.trim());
    const secretsValid = gateway.settings?.connected
      ? (!form.keySecret || form.keySecret.length >= 8) && (!form.webhookSecret || form.webhookSecret.length >= 8)
      : form.keySecret.length >= 8 && form.webhookSecret.length >= 8;
    return keyMatchesMode && secretsValid;
  }, [form, gateway.settings?.connected]);

  const save = async () => {
    try {
      await gateway.save({ ...form, keyId: form.keyId.trim() });
      toast.success('Razorpay connected successfully');
      setForm((current) => ({ ...current, keySecret: '', webhookSecret: '' }));
    } catch (error) { toast.error(error.message); }
  };

  const test = async () => {
    try { await gateway.test(); toast.success('Razorpay connection verified'); }
    catch (error) { toast.error(error.message); }
  };

  const disconnect = async () => {
    try {
      await gateway.disconnect();
      setConfirmOpen(false);
      setForm(EMPTY_FORM);
      toast.success('Razorpay disconnected');
    } catch (error) { toast.error(error.message); }
  };

  if (gateway.loading) {
    return <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-8"><div className="h-32 animate-pulse rounded-2xl bg-slate-200" /><div className="h-[480px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" /></div>;
  }

  const connected = Boolean(gateway.settings?.connected);
  return (
    <div className="min-h-full bg-slate-50/70 p-4 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Payment Gateway</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Connect the school&apos;s own Razorpay account. Student payments settle directly into the bank account linked to that Razorpay account.</p>
        </div>

        {gateway.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gateway.error}</div>}

        <div className={`flex items-start gap-3 rounded-xl border p-4 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {connected ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={20} /> : <XCircle className="mt-0.5 text-amber-600" size={20} />}
          <div>
            <p className={`font-semibold ${connected ? 'text-emerald-900' : 'text-amber-900'}`}>{connected ? 'Razorpay Connected' : 'Payment gateway not configured'}</p>
            <p className={`mt-1 text-sm ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>{connected ? 'Online fee payments are available to students and parents.' : 'Students cannot pay fees online until credentials are saved.'}</p>
          </div>
        </div>

        {connected && (
          <Card className="bg-white">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-emerald-600" /> Connection details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <div><p className="text-slate-500">Account</p><p className="mt-1 font-semibold text-slate-900">{gateway.settings.accountName || 'School Razorpay account'}</p></div>
              <div><p className="text-slate-500">Email</p><p className="mt-1 font-semibold text-slate-900">{gateway.settings.accountEmail || 'Not available'}</p></div>
              <div><p className="text-slate-500">Last verified</p><p className="mt-1 font-semibold text-slate-900">{gateway.settings.lastVerifiedAt ? new Date(gateway.settings.lastVerifiedAt).toLocaleString('en-IN') : 'Not verified'}</p></div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2"><CreditCard className="text-amber-600" /> Razorpay configuration</CardTitle>
            <CardDescription>Secrets are encrypted before storage and are never returned to this page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                {['test', 'live'].map((mode) => <button key={mode} type="button" onClick={() => setForm((current) => ({ ...current, mode }))} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold capitalize transition ${form.mode === mode ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><span className={`mr-2 inline-block size-2 rounded-full ${mode === 'test' ? 'bg-blue-500' : 'bg-emerald-500'}`} />{mode}</button>)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyId">Key ID</Label>
              <div className="flex gap-2"><Input id="keyId" value={form.keyId} onChange={(event) => setForm((current) => ({ ...current, keyId: event.target.value }))} placeholder={`rzp_${form.mode}_...`} className="h-11 font-mono" /><Button variant="outline" size="icon-lg" onClick={async () => { await navigator.clipboard.writeText(form.keyId); toast.success('Key ID copied'); }} disabled={!form.keyId} aria-label="Copy Key ID"><Clipboard /></Button></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SecretField id="keySecret" label="Key Secret" value={form.keySecret} onChange={(event) => setForm((current) => ({ ...current, keySecret: event.target.value }))} placeholder={connected ? 'Leave blank to keep existing secret' : 'Enter Key Secret'} />
              <SecretField id="webhookSecret" label="Webhook Secret" value={form.webhookSecret} onChange={(event) => setForm((current) => ({ ...current, webhookSecret: event.target.value }))} placeholder={connected ? 'Leave blank to keep existing secret' : 'Enter Webhook Secret'} />
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><strong>Razorpay webhook URL:</strong> <span className="break-all font-mono">{`${API_BASE}/api/payments/webhook`}</span><br />Enable payment.captured, payment.failed, and order.paid in the Razorpay dashboard.</div>
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <Button onClick={test} variant="outline" size="lg" disabled={!connected || gateway.testing}>{gateway.testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Test Connection</Button>
              <Button onClick={save} size="lg" disabled={!formValid || gateway.saving} className="bg-amber-500 text-white hover:bg-amber-600">{gateway.saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Save Configuration</Button>
              {connected && <Button onClick={() => setConfirmOpen(true)} variant="destructive" size="lg" className="sm:ml-auto"><Unplug /> Disconnect</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-white"><DialogHeader><DialogTitle>Disconnect Razorpay?</DialogTitle><DialogDescription>Online fee payment will stop immediately. Stored credentials will be permanently removed, while transaction and audit history will be preserved.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="destructive" onClick={disconnect} disabled={gateway.disconnecting}>{gateway.disconnecting && <Loader2 className="animate-spin" />} Disconnect</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
