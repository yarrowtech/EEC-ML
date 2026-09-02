import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FileText, Loader2, Plus, Send } from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiJson } from './parentApi';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const CATEGORY_OPTIONS = ['Technical', 'Academic', 'Transport', 'Fees', 'Wellbeing', 'General', 'Other'];
const resolveAssignee = (complaint) => {
  if (!complaint) return 'School Admin';
  return (
    complaint.assignedTo ||
    complaint.owner ||
    (complaint.targetRole === 'teacher' ? 'Class Teacher' : 'School Admin')
  );
};

const ComplaintManagementSystem = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: CATEGORY_OPTIONS[0],
    priority: 'medium',
    studentId: '',
  });

  const isTechnicalCategory = (form.category || '').toLowerCase().includes('technical');
  const isAcademicCategory = (form.category || '').toLowerCase().includes('academic');

  const fetchComplaints = async () => {
    if (!localStorage.getItem('token')) {
      setError('Please login to view complaints.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await parentApiJson('/api/parent/auth/complaints', {}, navigate);
      setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
      setChildren(Array.isArray(data.children) ? data.children : []);
      setForm((prev) => {
        if (prev.studentId || !Array.isArray(data.children) || data.children.length === 0) return prev;
        return { ...prev, studentId: data.children[0].studentId || '' };
      });
    } catch (err) {
      setError(err.message || 'Unable to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    if (!children.length) return;
    setForm((prev) => {
      if (prev.studentId) return prev;
      return { ...prev, studentId: children[0].studentId || '' };
    });
  }, [children]);

  useEffect(() => {
    if (!isAcademicCategory || !children.length) return;
    setForm((prev) => ({
      ...prev,
      studentId: prev.studentId || children[0].studentId || '',
    }));
  }, [isAcademicCategory, children]);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!localStorage.getItem('token')) {
      setSubmissionError('Please login to file a complaint.');
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      setSubmissionError('Title and description are required.');
      return;
    }
    if (isAcademicCategory && children.length > 0 && !form.studentId) {
      setSubmissionError('Select a child so the complaint can reach the class teacher.');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');
    try {
      const payload = { ...form };
      if (!payload.studentId) {
        delete payload.studentId;
      }
      const data = await parentApiJson('/api/parent/auth/complaints', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, navigate);
      setComplaints((prev) => [data, ...prev]);
      setForm({
        title: '',
        description: '',
        category: CATEGORY_OPTIONS[0],
        priority: 'medium',
        studentId: children[0]?.studentId || '',
      });
    } catch (err) {
      setSubmissionError(err.message || 'Unable to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter;
      const matchesSearch =
        !searchTerm ||
        complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (complaint.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (complaint.ticketNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [complaints, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return complaints.reduce(
      (acc, complaint) => {
        acc.total += 1;
        if (complaint.status === 'open') acc.open += 1;
        if (complaint.status === 'in_progress') acc.inProgress += 1;
        if (complaint.status === 'resolved') acc.resolved += 1;
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, resolved: 0 }
    );
  }, [complaints]);

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 text-red-700';
      case 'high':
        return 'bg-orange-50 text-orange-700';
      case 'medium':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-50 text-red-700';
      case 'in_progress':
        return 'bg-amber-50 text-amber-700';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Parent Services</p>
            <h1 className="text-2xl font-semibold text-gray-900 mt-1">Complaints & Support</h1>
            <p className="text-sm text-gray-600 mt-2">
              Submit issues directly to the school support desk and track the status in real time.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-800">{stats.total} tickets</p>
            <p>Last updated {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, accent: 'text-gray-900' },
          { label: 'Open', value: stats.open, accent: 'text-red-600' },
          { label: 'In Progress', value: stats.inProgress, accent: 'text-amber-600' },
          { label: 'Resolved', value: stats.resolved, accent: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500 tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={handleFormSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-800">
            <Plus className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-semibold">Submit new complaint</h2>
          </div>
          <div className="space-y-1">
            <label htmlFor="complaint-title" className="text-sm font-medium text-gray-600">Title</label>
            <input
              id="complaint-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm"
              placeholder="Brief summary of the issue"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="complaint-details" className="text-sm font-medium text-gray-600">Details</label>
            <textarea
              id="complaint-details"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm"
              placeholder="Explain what happened, when it occurred, and how it affects your child."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="complaint-category" className="text-sm font-medium text-gray-600">Category</label>
              <select
                id="complaint-category"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {isAcademicCategory
                  ? 'Academic complaints are routed directly to your child’s class teacher.'
                  : 'Other categories are sent to the school administration team.'}
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="complaint-priority" className="text-sm font-medium text-gray-600">Priority</label>
              <select
                id="complaint-priority"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm capitalize"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {children.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="complaint-child" className="text-sm font-medium text-gray-600">
                Related child {isAcademicCategory ? '(required for academic issues)' : '(optional)'}
              </label>
              <select
                id="complaint-child"
                value={form.studentId}
                onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
                disabled={!isAcademicCategory}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              >
                {children.map((child) => (
                  <option key={child.studentId} value={child.studentId}>
                    {formatStudentDisplay({
                      name: child.name,
                      studentId: child.studentId,
                      roll: child.roll || child.rollNo || child.rollNumber,
                      section: child.section,
                    })}
                  </option>
                ))}
              </select>
              {isAcademicCategory && (
                <p className="text-xs text-gray-500">We use this to route the complaint to the correct class teacher.</p>
              )}
            </div>
          )}
          {isAcademicCategory && !children.length && (
            <p className="text-xs text-violet-600">
              No linked children were found, so this complaint will be forwarded to the school admin.
            </p>
          )}
          {submissionError && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {submissionError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit complaint
          </button>
        </form>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-gray-800">
                <FileText className="w-5 h-5 text-violet-600" />
                <h2 className="text-lg font-semibold">Complaint log</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tickets you have submitted to the support desk
              </p>
            </div>
            <input
              type="search"
              aria-label="Search complaints by ticket or title"
              placeholder="Search by ticket or title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 w-full sm:w-64"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Filter complaints by status">
            {['all', 'open', 'in_progress', 'resolved'].map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full border ${
                  statusFilter === status
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {status === 'all' ? 'All' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading complaints…</div>
          ) : error ? (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-sm text-gray-500">No complaints found.</div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredComplaints.map((complaint) => {
                const assigneeLabel = resolveAssignee(complaint);
                return (
                  <article key={complaint.id} className="border border-gray-200 rounded-lg p-4 hover:border-violet-200 transition-colors">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs text-gray-500">Ticket #{complaint.ticketNumber}</p>
                        <h3 className="text-base font-semibold text-gray-900">{complaint.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusBadgeClass(complaint.status)}`}>
                          {STATUS_LABELS[complaint.status] || complaint.status}
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getPriorityBadgeClass(complaint.priority)}`}>
                          {complaint.priority?.charAt(0).toUpperCase() + complaint.priority?.slice(1)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{complaint.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-3">
                      <span className="px-2 py-1 bg-gray-100 rounded-md">{complaint.category}</span>
                      <span>Updated {complaint.updatedAt ? new Date(complaint.updatedAt).toLocaleDateString() : '-'}</span>
                      {assigneeLabel && (
                        <span className="px-2 py-1 bg-amber-50 rounded-md text-amber-700">
                          Assigned to {assigneeLabel}
                        </span>
                      )}
                      {complaint.studentName && (
                        <span className="px-2 py-1 bg-blue-50 rounded-md text-blue-700">
                          {formatStudentDisplay({
                            studentName: complaint.studentName,
                            studentId: complaint.studentId,
                            roll: complaint.studentRoll || complaint.roll,
                            section: complaint.studentSection,
                          })}
                        </span>
                      )}
                      {complaint.resolutionNotes && (
                        <span className="text-emerald-600">Note: {complaint.resolutionNotes}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ComplaintManagementSystem;
