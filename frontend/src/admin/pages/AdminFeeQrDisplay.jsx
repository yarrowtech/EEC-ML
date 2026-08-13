import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
const POLL_INTERVAL_MS = 3000;
const AUTO_CLOSE_MS = 4000;

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

// Full-screen, chrome-free "second screen" QR display meant to face the
// payer — mirrors the pattern used by handheld railway TTE UPI machines:
// show only the QR and a live status, then close itself once paid.
export default function AdminFeeQrDisplay() {
  const [searchParams] = useSearchParams();
  const qrId = searchParams.get('qrId') || '';
  const imageUrl = searchParams.get('imageUrl') || '';
  const amount = searchParams.get('amount') || '0';
  const studentName = searchParams.get('studentName') || '';

  const [status, setStatus] = useState('pending'); // pending | captured | expired | error
  const [message, setMessage] = useState('');
  const pollTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    document.title = 'Scan to Pay';
  }, []);

  useEffect(() => {
    if (!qrId) {
      setStatus('error');
      setMessage('No QR session found. Close this window and try again.');
      return undefined;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fees/admin/razorpay/qr/${qrId}/status`, {
          headers: { authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(data?.error || 'Unable to check payment status');
          return;
        }
        if (data.status === 'captured') {
          setStatus('captured');
          closeTimerRef.current = setTimeout(() => window.close(), AUTO_CLOSE_MS);
          return;
        }
        if (data.status === 'expired') {
          setStatus('expired');
          return;
        }
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollTimerRef.current);
      clearTimeout(closeTimerRef.current);
    };
  }, [qrId]);

  const cancelQr = async () => {
    if (qrId) {
      try {
        await fetch(`${API_BASE}/api/fees/admin/razorpay/qr/${qrId}/cancel`, {
          method: 'POST',
          headers: { authorization: `Bearer ${localStorage.getItem('token')}` },
        });
      } catch {
        // best-effort — closing the window regardless
      }
    }
    window.close();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-5 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Scan to Pay</p>
          <p className="mt-1 text-3xl font-black">{formatCurrency(amount)}</p>
          {studentName ? <p className="mt-1 text-sm text-white/80">{studentName}</p> : null}
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          {status === 'pending' && (
            <>
              <div className="rounded-2xl border-4 border-slate-100 p-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="Scan to pay via UPI" className="w-64 h-64 object-contain" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-slate-300">
                    <QrCode size={64} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
                Waiting for payment…
              </div>
              <p className="text-xs text-slate-400 text-center">
                Scan with any UPI app — Google Pay, PhonePe, Paytm, or your bank app. This screen updates automatically the moment payment is received.
              </p>
              <button
                onClick={cancelQr}
                className="mt-1 text-xs font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                Cancel and close
              </button>
            </>
          )}

          {status === 'captured' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={44} className="text-emerald-500" />
              </div>
              <p className="text-lg font-bold text-emerald-700">Payment Received!</p>
              <p className="text-sm text-slate-400">This window will close automatically…</p>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
                <XCircle size={44} className="text-amber-500" />
              </div>
              <p className="text-lg font-bold text-amber-700">QR Code Expired</p>
              <p className="text-sm text-slate-400 text-center">Close this window and generate a new QR code to try again.</p>
              <button
                onClick={() => window.close()}
                className="mt-2 rounded-xl bg-slate-900 text-white px-5 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
                <XCircle size={44} className="text-red-500" />
              </div>
              <p className="text-lg font-bold text-red-700">Something went wrong</p>
              <p className="text-sm text-slate-400 text-center">{message}</p>
              <button
                onClick={() => window.close()}
                className="mt-2 rounded-xl bg-slate-900 text-white px-5 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
