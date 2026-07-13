import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CreditCard, FileText, Loader2, Wallet } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const loadRazorpayScript = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const StudentFees = () => {
  const [invoices, setInvoices] = useState([]);
  const [paymentsByInvoice, setPaymentsByInvoice] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingInvoiceId, setProcessingInvoiceId] = useState('');

  const fetchInvoices = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/student/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load invoices');
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setPaymentsByInvoice(data.paymentsByInvoice || {});
    } catch (err) {
      setError(err.message || 'Unable to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePayNow = async (invoice) => {
    const token = localStorage.getItem('token');
    setProcessingInvoiceId(invoice._id);
    setError('');
    setSuccess('');
    try {
      const orderResponse = await fetch(`${API_BASE}/api/fees/${invoice._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(invoice.balanceAmount) }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || 'Unable to create payment order');
      if (!await loadRazorpayScript()) throw new Error('Unable to load Razorpay checkout');
      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: 'School Fees',
        description: invoice.title || 'Fee Payment',
        theme: { color: '#f59e0b' },
        handler: async (response) => {
          try {
            const verifyResponse = await fetch(`${API_BASE}/api/fees/payments/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verifyData.error || 'Payment verification failed');
            setSuccess('Payment successful. Your invoice and receipt are updated.');
            await fetchInvoices();
          } catch (verifyError) {
            setError(verifyError.message);
          } finally { setProcessingInvoiceId(''); }
        },
        modal: { ondismiss: () => setProcessingInvoiceId('') },
      });
      razorpay.open();
    } catch (paymentError) {
      setError(paymentError.message || 'Payment failed');
      setProcessingInvoiceId('');
    }
  };

  const totals = useMemo(() => {
    return invoices.reduce(
      (acc, invoice) => {
        acc.total += Number(invoice.totalAmount || 0);
        acc.paid += Number(invoice.paidAmount || 0);
        acc.balance += Number(invoice.balanceAmount || 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );
  }, [invoices]);

  return (
    <div className="w-full p-2 sm:p-3 md:p-4 space-y-4">
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-4 sm:p-6 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Fees Overview</h1>
        <p className="text-yellow-100 text-sm sm:text-base">View invoices and pay securely online</p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      {loading ? (
        <div className="bg-white rounded-xl p-8 border border-gray-100 flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading fee information...
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <FileText className="w-4 h-4 text-blue-500" />
                Total Fees
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-2">
                {formatCurrency(totals.total)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <Wallet className="w-4 h-4 text-emerald-500" />
                Paid
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-2">
                {formatCurrency(totals.paid)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 text-gray-600 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Balance Due
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-2">
                {formatCurrency(totals.balance)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Invoices</h3>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No invoices found.
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const payments = paymentsByInvoice[invoice._id] || [];
                  return (
                    <div
                      key={invoice._id}
                      className="border border-gray-100 rounded-xl p-4 sm:p-5 bg-gray-50/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-gray-800">
                            {invoice.title || 'Fee Invoice'}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Status: <span className="capitalize">{invoice.status}</span>
                            {invoice.dueDate && (
                              <span className="ml-2">
                                Due {new Date(invoice.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Balance</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(invoice.balanceAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 mt-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500">Paid</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatCurrency(invoice.paidAmount)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500">Balance</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatCurrency(invoice.balanceAmount)}
                          </p>
                        </div>
                      </div>

                      {Number(invoice.balanceAmount || 0) > 0 && (
                        <div className="mt-4 flex justify-end">
                          <button type="button" onClick={() => handlePayNow(invoice)} disabled={processingInvoiceId === invoice._id} className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-600 disabled:opacity-60">
                            {processingInvoiceId === invoice._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                            {processingInvoiceId === invoice._id ? 'Processing' : `Pay ${formatCurrency(invoice.balanceAmount)}`}
                          </button>
                        </div>
                      )}

                      {payments.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-gray-600 mb-2">
                            Recent Payments
                          </p>
                          <div className="space-y-2">
                            {payments.slice(0, 3).map((payment) => (
                              <div
                                key={payment._id}
                                className="bg-white border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-gray-600"
                              >
                                <span>
                                  {new Date(payment.paidOn || payment.createdAt).toLocaleDateString()}
                                  {' · '}
                                  {payment.method || 'cash'}
                                </span>
                                <span className="font-semibold text-gray-800">
                                  {formatCurrency(payment.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentFees;
