import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, PieChart, BarChart3, Users, CreditCard, AlertCircle, ArrowUpRight, Loader } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL;

const FinancialDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [financialData, setFinancialData] = useState(null);

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/financial`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch financial data');
        }

        const data = await res.json();
        setFinancialData(data);
      } catch (err) {
        console.error('Error fetching financial data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-slate-700" />
        <span className="ml-3 text-gray-600">Loading financial data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700">Error loading financial data: {error}</p>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <p className="text-slate-700">No financial data available</p>
      </div>
    );
  }

  const { totals, revenueData, expenseData, expenseDataNote, recentPayments } = financialData;

  // Format revenue data for charts
  const formattedRevenueData = revenueData || [];

  // Department budget data (placeholder - can be enhanced with real data later)
  const departmentBudget = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-950 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Financial Dashboard</h1>
        <p className="text-slate-300">Fee revenue, approved teacher expenses, and collection performance</p>
      </div>
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ₹{(totals.totalRevenue / 10000000).toFixed(1)} Cr
              </div>
              <div className="text-sm text-gray-500">Total Revenue</div>
              <div className="flex items-center mt-2 text-green-600">
                <span className="text-xs font-medium">Collected</span>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ₹{(totals.totalExpenses / 10000000).toFixed(1)} Cr
              </div>
              <div className="text-sm text-gray-500">Total Expenses</div>
              <div className="flex items-center mt-2 text-blue-600">
                <span className="text-xs font-medium">Approved claims</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{totals.budgetUtilization}%</div>
              <div className="text-sm text-gray-500">Collection Rate</div>
              <div className="flex items-center mt-2 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {totals.overdueInvoices} overdue
                </span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <PieChart className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ₹{(totals.netProfit / 10000000).toFixed(1)} Cr
              </div>
              <div className="text-sm text-gray-500">Net (Revenue − Expenses)</div>
              <div className="flex items-center mt-2 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Live</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses Trend</h3>
          {formattedRevenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formattedRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₹${(value/10000000).toFixed(1)}Cr`} />
                <Tooltip formatter={(value) => [`₹${(value/10000000).toFixed(2)}Cr`, '']} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={3}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#EF4444"
                  strokeWidth={3}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm">No revenue data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Expense Breakdown Pie Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          {expenseData && expenseData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Tooltip formatter={(value, name, entry) => [`₹${(entry.payload.amount || 0).toLocaleString('en-IN')}`, name]} />
                  <Pie data={expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={120}>
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {expenseData.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600">{item.name}: ₹{(item.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <PieChart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm">No approved teacher expense claims yet</p>
              </div>
            </div>
          )}
          {expenseDataNote && (
            <p className="mt-4 text-xs text-slate-400">{expenseDataNote}</p>
          )}
        </div>
      </div>

      {/* Outstanding Amount Summary */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total Invoiced</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              ₹{(totals.totalInvoiced / 10000000).toFixed(2)} Cr
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Total Collected</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              ₹{(totals.totalRevenue / 10000000).toFixed(2)} Cr
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600 font-medium">Outstanding</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">
              ₹{(totals.totalOutstanding / 10000000).toFixed(2)} Cr
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
        {recentPayments && recentPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Class</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Method</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900">{payment.studentName}</td>
                    <td className="py-3 px-4 text-gray-900">
                      {payment.className} {payment.section && `- ${payment.section}`}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      ₹{(payment.amount / 100000).toFixed(2)}L
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {payment.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(payment.paidOn).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No recent payments</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;