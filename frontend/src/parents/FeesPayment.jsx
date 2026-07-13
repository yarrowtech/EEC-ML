import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Wallet,
  Users,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window?.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const FeesPayment = () => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [paymentsByInvoice, setPaymentsByInvoice] = useState({});
  const [amounts, setAmounts] = useState({});
  const [processingInvoiceId, setProcessingInvoiceId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const buildChildKey = (child) => (child.id ? `id:${child.id}` : `name:${child.name || ''}`);

  const selectedChild = useMemo(
    () => children.find((child) => buildChildKey(child) === selectedChildId) || null,
    [children, selectedChildId]
  );

  const fetchChildren = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      setLoadingChildren(false);
      return;
    }

    setLoadingChildren(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/parent/children`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load children');
      }
      const list = Array.isArray(data.children) ? data.children : [];
      setChildren(list);
      if (list.length > 0) {
        setSelectedChildId(buildChildKey(list[0]));
      }
    } catch (err) {
      setError(err.message || 'Unable to load children');
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchInvoices = async (childId) => {
    if (!childId) {
      setInvoices([]);
      setPaymentsByInvoice({});
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      return;
    }
    setLoadingInvoices(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/parent/invoices?studentId=${childId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load invoices');
      }
      const list = Array.isArray(data.invoices) ? data.invoices : [];
      setInvoices(list);
      setPaymentsByInvoice(data.paymentsByInvoice || {});
      const nextAmounts = {};
      list.forEach((invoice) => {
        nextAmounts[invoice._id] = Number(invoice.balanceAmount || 0);
      });
      setAmounts(nextAmounts);
    } catch (err) {
      setError(err.message || 'Unable to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChild?.id) {
      fetchInvoices(selectedChild.id);
    } else {
      setInvoices([]);
      setPaymentsByInvoice({});
    }
  }, [selectedChild?.id]);

  const handlePayNow = async (invoice) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      return;
    }
    setProcessingInvoiceId(invoice._id);
    setError('');
    setSuccessMessage('');
    try {
      const paymentAmount = Number(amounts[invoice._id]);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Enter a valid amount');
      }

      const orderRes = await fetch(`${API_BASE}/api/fees/${invoice._id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: paymentAmount,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay');
      }

      const razorpayKey = orderData.keyId;
      if (!razorpayKey) {
        throw new Error('Razorpay key is missing');
      }

      const options = {
        key: razorpayKey,
        amount: orderData.order?.amount,
        currency: orderData.order?.currency || 'INR',
        name: 'School Fees',
        description: invoice.title || 'Fee Payment',
        order_id: orderData.order?.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/fees/payments/razorpay/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }
            setSuccessMessage('Payment successful. Invoice updated.');
            await fetchInvoices(selectedChild.id);
          } catch (verifyErr) {
            setError(verifyErr.message || 'Unable to verify payment');
          } finally {
            setProcessingInvoiceId('');
          }
        },
        modal: {
          ondismiss: () => setProcessingInvoiceId(''),
        },
        prefill: {
          name: selectedChild?.name || 'Parent',
        },
        theme: {
          color: '#f59e0b',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setError(err.message || 'Payment failed');
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Fees Payment</h1>
        <p className="text-yellow-100 text-sm sm:text-base">Manage invoices and pay online</p>
        <p className="text-yellow-50 text-xs sm:text-sm mt-1">Secure checkout powered by Razorpay</p>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <Users className="w-5 h-5 text-yellow-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Select Child</h3>
          <button
            onClick={fetchChildren}
            className="ml-auto flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800"
            type="button"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <select
          value={selectedChildId}
          onChange={(e) => setSelectedChildId(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm sm:text-base"
          disabled={loadingChildren}
        >
          <option value="">Select a child</option>
          {children.map((child) => (
            <option key={child.id || child.name} value={buildChildKey(child)}>
              {child.name || 'Child'} {child.grade ? `- ${child.grade}` : ''}
            </option>
          ))}
        </select>
        {loadingChildren && (
          <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading children...
          </p>
        )}
        {selectedChild && !selectedChild.id && (
          <p className="text-sm text-amber-600 mt-2">
            This child is not linked to a student record yet. Please contact the school office.
          </p>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {successMessage && <p className="text-sm text-emerald-700 mt-2">{successMessage}</p>}
      </div>

      {selectedChild?.id ? (
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
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Invoices</h3>
              {loadingInvoices && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </span>
              )}
            </div>

            {invoices.length === 0 && !loadingInvoices ? (
              <div className="text-center py-8 text-gray-500">
                No invoices found for this student.
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const payments = paymentsByInvoice[invoice._id] || [];
                  const balance = Number(invoice.balanceAmount || 0);
                  const canPay = balance > 0;
                  const isProcessing = processingInvoiceId === invoice._id;
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
                            {formatCurrency(balance)}
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
                            {formatCurrency(balance)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={amounts[invoice._id] ?? ''}
                            onChange={(e) =>
                              setAmounts((prev) => ({
                                ...prev,
                                [invoice._id]: e.target.value,
                              }))
                            }
                            className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={!canPay}
                          />
                          <span className="text-xs text-gray-500">Amount</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePayNow(invoice)}
                          disabled={!canPay || isProcessing}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            canPay
                              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Processing
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" /> Pay Now
                            </>
                          )}
                        </button>
                      </div>

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
                                  {' - '}
                                  {payment.method || 'cash'}
                                  {payment.transactionId ? ` - Ref ${payment.transactionId}` : ''}
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
      ) : (
        <div className="bg-white rounded-xl p-6 border border-gray-100 text-center text-gray-500">
          Please select a child to view fee details.
        </div>
      )}
    </div>
  );
};

export default FeesPayment;
