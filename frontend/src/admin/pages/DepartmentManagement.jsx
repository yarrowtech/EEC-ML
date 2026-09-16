import React, { useEffect, useState } from 'react';
import { Building2, Edit2, Loader2, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DepartmentManagement = ({ setShowAdminHeader }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });

  // Computed fresh per call (not memoized) so a token rotation mid-session
  // is picked up immediately rather than every request reusing whatever
  // token was in localStorage at mount.
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  });

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/departments`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Unable to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments().catch(() => {});
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm({ name: '', description: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = String(form.name || '').trim();
    const description = String(form.description || '').trim();
    if (!name) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(`${API_BASE}/api/departments${isEdit ? `/${editingId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (isEdit ? 'Failed to update department' : 'Failed to create department'));
      toast.success(isEdit ? 'Department updated' : 'Department created');
      resetForm();
      await loadDepartments();
    } catch (err) {
      toast.error(err.message || 'Unable to save department');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item?._id || '');
    setForm({
      name: item?.name || '',
      description: item?.description || '',
    });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/departments/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete department');
      toast.success('Department deleted');
      await loadDepartments();
    } catch (err) {
      toast.error(err.message || 'Unable to delete department');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-200">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 leading-tight">Departments</h1>
          <p className="text-xs text-gray-400 mt-0.5">Create school departments and use them for teacher assignment</p>
        </div>
      </div>

      <div className={`rounded-3xl border bg-white p-6 shadow-sm ${editingId ? 'border-indigo-300' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-800">{editingId ? 'Edit Department' : 'Add Department'}</h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Science"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 placeholder-gray-300 transition-all outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 placeholder-gray-300 transition-all outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#6366f1 60%,#818cf8 100%)' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Update' : 'Add'}
          </button>
        </form>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-800">Department List</h2>
          {!loading && (
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full">
              {departments.length} {departments.length === 1 ? 'department' : 'departments'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
            <p className="text-sm text-gray-400">Loading departments...</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No departments added yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {departments.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-800">{item.name || '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{item.description || '—'}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-all"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item._id)}
                          disabled={deletingId === item._id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                          {deletingId === item._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentManagement;
