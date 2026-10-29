import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Plus, Search, Calendar, Target, Package, FileText, X, AlertTriangle } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const emptyForm = {
  classId: '',
  sectionId: '',
  teacherId: '',
  subjectId: '',
  title: '',
  subject: '',
  date: '',
  learningObjectives: [''],
  materialsNeeded: [''],
  additionalNotes: '',
};

const LessonPlanPage = ({ setShowAdminHeader }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [deletingPlan, setDeletingPlan] = useState(null);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    setShowAdminHeader?.(false);
  }, [setShowAdminHeader]);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    };
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/lesson-plans/admin`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load lesson plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  };

  // Picking a class then quickly picking a different one can leave two
  // requests in flight; without this guard, class A's response resolving
  // after class B's would overwrite the sections/allocations shown (and
  // selectable in the form) with class A's data under class B's selection.
  const loadOptionsRequestIdRef = useRef(0);

  const loadOptions = async ({ classId = '', sectionId = '' } = {}) => {
    const requestId = ++loadOptionsRequestIdRef.current;
    const isStale = () => loadOptionsRequestIdRef.current !== requestId;
    try {
      setLoadingOptions(true);
      const query = new URLSearchParams();
      if (classId) query.set('classId', classId);
      if (sectionId) query.set('sectionId', sectionId);
      const res = await fetch(`${API_BASE}/api/lesson-plans/admin/options?${query.toString()}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load options');
      if (isStale()) return;
      setClasses(Array.isArray(data?.classes) ? data.classes : []);
      setSections(Array.isArray(data?.sections) ? data.sections : []);
      setAllocations(Array.isArray(data?.allocations) ? data.allocations : []);
    } catch (err) {
      if (isStale()) return;
      setError(err.message || 'Failed to load form options');
    } finally {
      if (!isStale()) setLoadingOptions(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const filteredPlans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((plan) => {
      return [plan.title, plan.subject, plan.className, plan.sectionName, plan.teacherName]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q));
    });
  }, [plans, searchTerm]);

  const openCreateModal = () => {
    setEditingPlanId('');
    setForm(emptyForm);
    setSections([]);
    setAllocations([]);
    setShowModal(true);
    loadOptions();
  };

  const openEditModal = async (plan) => {
    const classId = String(plan?.classId || '');
    const sectionId = String(plan?.sectionId || '');
    const teacherId = String(plan?.teacherId || '');
    const subjectId = String(plan?.subjectId || '');

    setEditingPlanId(String(plan?._id || ''));
    setForm({
      classId,
      sectionId,
      teacherId,
      subjectId,
      title: plan?.title || '',
      subject: plan?.subject || '',
      date: plan?.date ? new Date(plan.date).toISOString().slice(0, 10) : '',
      learningObjectives: Array.isArray(plan?.learningObjectives) && plan.learningObjectives.length ? plan.learningObjectives : [''],
      materialsNeeded: Array.isArray(plan?.materialsNeeded) && plan.materialsNeeded.length ? plan.materialsNeeded : [''],
      additionalNotes: plan?.additionalNotes || '',
    });
    setShowModal(true);
    await loadOptions({ classId, sectionId });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlanId('');
    setForm(emptyForm);
  };

  const updateArrayField = (field, index, value) => {
    setForm((prev) => {
      const next = [...prev[field]];
      next[index] = value;
      return { ...prev, [field]: next };
    });
  };

  const addArrayField = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayField = (field, index) => {
    setForm((prev) => {
      const next = prev[field].filter((_, idx) => idx !== index);
      return { ...prev, [field]: next.length ? next : [''] };
    });
  };

  const onClassChange = async (classId) => {
    setForm((prev) => ({
      ...prev,
      classId,
      sectionId: '',
      teacherId: '',
      subjectId: '',
      subject: '',
    }));
    setAllocations([]);
    if (classId) {
      await loadOptions({ classId });
    } else {
      setSections([]);
    }
  };

  const onSectionChange = async (sectionId) => {
    const classId = form.classId;
    setForm((prev) => ({
      ...prev,
      sectionId,
      teacherId: '',
      subjectId: '',
      subject: '',
    }));
    if (classId && sectionId) {
      await loadOptions({ classId, sectionId });
    } else {
      setAllocations([]);
    }
  };

  const onAllocationChange = (combo) => {
    if (!combo) {
      setForm((prev) => ({ ...prev, teacherId: '', subjectId: '', subject: '' }));
      return;
    }
    const [teacherId, subjectId] = combo.split('::');
    const selected = allocations.find((item) => item.teacherId === teacherId && item.subjectId === subjectId);
    setForm((prev) => ({
      ...prev,
      teacherId,
      subjectId,
      subject: selected?.subjectName || '',
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const payload = {
        ...form,
        learningObjectives: form.learningObjectives.map((v) => String(v || '').trim()).filter(Boolean),
        materialsNeeded: form.materialsNeeded.map((v) => String(v || '').trim()).filter(Boolean),
      };
      const isEdit = Boolean(editingPlanId);
      const endpoint = isEdit
        ? `${API_BASE}/api/lesson-plans/admin/${editingPlanId}`
        : `${API_BASE}/api/lesson-plans/admin`;
      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (isEdit ? 'Failed to update lesson plan' : 'Failed to create lesson plan'));
      closeModal();
      await loadPlans();
    } catch (err) {
      setError(err.message || (editingPlanId ? 'Failed to update lesson plan' : 'Failed to create lesson plan'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPlan) return;
    try {
      setError('');
      const res = await fetch(`${API_BASE}/api/lesson-plans/admin/${deletingPlan._id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete lesson plan');
      setDeletingPlan(null);
      await loadPlans();
    } catch (err) {
      setError(err.message || 'Failed to delete lesson plan');
      setDeletingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Lesson Plans</h1>
            <p className="text-amber-50 text-sm">Create class-section-teacher specific lesson plans</p>
          </div>
          <div className="p-3 bg-white/20 rounded-xl">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, subject, class, teacher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none transition-all"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-yellow-500 text-white px-5 py-2.5 rounded-xl hover:bg-yellow-600 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Lesson Plan
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}
      </div>

      {/* Plans List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <div className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading lesson plans...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <BookOpen className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No lesson plans found</p>
            <p className="text-xs text-gray-400 mt-1">Create your first lesson plan to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredPlans.map((plan) => (
              <div key={plan._id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{plan.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                        {plan.subject}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                        Class {plan.className} - {plan.sectionName}
                      </span>
                      <span className="text-xs text-gray-500">Teacher: {plan.teacherName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(plan.date).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => openEditModal(plan)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingPlan(plan)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 text-blue-700 font-medium text-xs uppercase tracking-wide mb-2">
                      <Target className="w-3.5 h-3.5" />Objectives
                    </div>
                    <ul className="list-disc ml-5 text-gray-700 space-y-1 text-xs">
                      {(plan.learningObjectives || []).map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs uppercase tracking-wide mb-2">
                      <Package className="w-3.5 h-3.5" />Materials
                    </div>
                    <ul className="list-disc ml-5 text-gray-700 space-y-1 text-xs">
                      {(plan.materialsNeeded || []).map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 text-amber-700 font-medium text-xs uppercase tracking-wide mb-2">
                      <FileText className="w-3.5 h-3.5" />Notes
                    </div>
                    <p className="text-gray-700 text-xs">{plan.additionalNotes || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold">{editingPlanId ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class *</label>
                  <select
                    value={form.classId}
                    onChange={(e) => onClassChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Section *</label>
                  <select
                    value={form.sectionId}
                    onChange={(e) => onSectionChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    required
                    disabled={!form.classId}
                  >
                    <option value="">Select Section</option>
                    {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Teacher (Subject) *</label>
                  <select
                    value={form.teacherId && form.subjectId ? `${form.teacherId}::${form.subjectId}` : ''}
                    onChange={(e) => onAllocationChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    required
                    disabled={!form.sectionId || loadingOptions}
                  >
                    <option value="">Select Allocation</option>
                    {allocations.map((item) => (
                      <option key={`${item.teacherId}::${item.subjectId}`} value={`${item.teacherId}::${item.subjectId}`}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject *</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Learning Objectives *</label>
                <div className="space-y-2">
                  {form.learningObjectives.map((item, idx) => (
                    <div key={`obj-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateArrayField('learningObjectives', idx, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                        placeholder={`Objective ${idx + 1}`}
                        required
                      />
                      <button type="button" onClick={() => removeArrayField('learningObjectives', idx)} className="px-3 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors text-sm">-</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addArrayField('learningObjectives')} className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-700">+ Add Objective</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Materials Needed *</label>
                <div className="space-y-2">
                  {form.materialsNeeded.map((item, idx) => (
                    <div key={`mat-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateArrayField('materialsNeeded', idx, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none"
                        placeholder={`Material ${idx + 1}`}
                        required
                      />
                      <button type="button" onClick={() => removeArrayField('materialsNeeded', idx)} className="px-3 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors text-sm">-</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addArrayField('materialsNeeded')} className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-700">+ Add Material</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Additional Notes</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => setForm((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                  rows={4}
                  placeholder="Any additional notes for this lesson plan..."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button
                  type="submit"
                  disabled={saving || loadingOptions}
                  className="px-6 py-2.5 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 disabled:opacity-60 transition-colors text-sm font-medium shadow-sm"
                >
                  {saving ? 'Saving...' : editingPlanId ? 'Update Lesson Plan' : 'Create Lesson Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Lesson Plan</h3>
              <p className="text-sm text-gray-500 mb-1">Are you sure you want to delete</p>
              <p className="text-sm font-semibold text-gray-800 mb-4">"{deletingPlan.title}"?</p>
              <p className="text-xs text-gray-400">This action cannot be undone.</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setDeletingPlan(null)}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 border-l border-gray-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanPage;
