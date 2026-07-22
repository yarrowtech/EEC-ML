import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Mail,
  Phone,
  Search,
  Users,
  GraduationCap,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PrincipalChatPanel from './PrincipalChatPanel';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const roleConfig = [
  { key: 'Teacher', label: 'Teachers', icon: GraduationCap, accent: 'bg-blue-500' },
  { key: 'Staff', label: 'Staff', icon: Users, accent: 'bg-purple-500' },
  { key: 'Parent', label: 'Parents', icon: Users, accent: 'bg-emerald-500' },
];

const getInitials = (value = '') => {
  if (!value.trim()) return 'PR';
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'P';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function Communications() {
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelSms, setChannelSms] = useState(false);
  const [audience, setAudience] = useState('Teachers');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchDirectory = async () => {
      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Please sign in to load directory');
        }
        const res = await fetch(`${API_BASE}/api/principal/directory`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Unable to load directory');
        }
        const data = await res.json();
        setDirectory(Array.isArray(data) ? data : []);
        setSelectedIds(new Set());
      } catch (err) {
        setDirectory([]);
        setDirectoryError(err.message || 'Unable to load directory');
      } finally {
        setDirectoryLoading(false);
      }
    };
    fetchDirectory();
  }, []);

  const subjects = useMemo(() => {
    const options = new Set();
    directory.forEach((entry) => entry.subject && options.add(entry.subject));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [directory]);

  const departments = useMemo(() => {
    const options = new Set();
    directory.forEach((entry) => entry.department && options.add(entry.department));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [directory]);

  const filteredDirectory = useMemo(() => {
    let list = directory;

    if (audience !== 'All') {
      list = list.filter((c) => c.role.toLowerCase() === audience.toLowerCase());
    }

    if (selectedSubject) {
      list = list.filter((c) => (c.subject || '').toLowerCase() === selectedSubject.toLowerCase());
    }
    if (selectedDepartment) {
      list = list.filter((c) => (c.department || '').toLowerCase() === selectedDepartment.toLowerCase());
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.subject && c.subject.toLowerCase().includes(q)) ||
          (c.department && c.department.toLowerCase().includes(q))
      );
    }
    return list;
  }, [audience, selectedSubject, selectedDepartment, query, directory]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredDirectory.map((c) => c.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const smsCharCount = message.length;
  const smsSegments = Math.max(1, Math.ceil(smsCharCount / 160));

  const roleStats = useMemo(() => {
    const counts = roleConfig.reduce((acc, role) => ({ ...acc, [role.key]: 0 }), {});
    directory.forEach((entry) => {
      if (counts[entry.role] !== undefined) {
        counts[entry.role] += 1;
      }
    });
    return roleConfig.map((role) => ({
      ...role,
      count: counts[role.key] || 0,
    }));
  }, [directory]);

  const selectedPreview = useMemo(() => {
    if (!selectedIds.size) {
      return { total: 0, chips: [], summary: [] };
    }
    const chips = [];
    const counts = {};
    directory.forEach((entry) => {
      if (selectedIds.has(entry.id)) {
        const key = entry.role || 'Recipients';
        counts[key] = (counts[key] || 0) + 1;
        if (chips.length < 3) {
          chips.push(entry.name);
        }
      }
    });
    const summary = Object.entries(counts).map(([role, count]) => `${count} ${role.toLowerCase()}`);
    return { total: selectedIds.size, chips, summary };
  }, [selectedIds, directory]);

  const canSend = (channelEmail || channelSms) && selectedIds.size > 0 && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/principal/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: subject || 'Announcement from Principal',
          message,
          recipients: Array.from(selectedIds),
          audience,
          channelEmail,
          channelSms
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send message');
      }
      toast.success('Message sent successfully!');
      setSubject('');
      setMessage('');
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const channelOptions = [
    {
      key: 'email',
      label: 'Email Channel',
      description: 'Deliver to inboxes',
      enabled: channelEmail,
      toggle: () => setChannelEmail((prev) => !prev),
      icon: Mail,
      accent: 'text-blue-700 bg-blue-50 border-blue-200'
    },
    {
      key: 'sms',
      label: 'SMS Channel',
      description: 'Quick mobile alerts',
      enabled: channelSms,
      toggle: () => setChannelSms((prev) => !prev),
      icon: Phone,
      accent: 'text-amber-700 bg-amber-50 border-amber-200'
    },
  ];

  const renderRoleBadge = (role) => {
    if (role === 'Teacher') return 'bg-blue-100 text-blue-700';
    if (role === 'Staff') return 'bg-purple-100 text-purple-700';
    if (role === 'Parent') return 'bg-emerald-100 text-emerald-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Principal Broadcast Hub</p>
            <h1 className="text-3xl font-bold mt-2">Communications</h1>
            <p className="text-white/80 mt-2 max-w-2xl">
              Filter your school directory and send targeted announcements via email or SMS without leaving the dashboard.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[240px]">
            {roleStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.key} className="bg-white/15 rounded-2xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-white/80">
                    <Icon className="w-4 h-4" />
                    {stat.label}
                  </div>
                  <p className="text-2xl font-bold mt-1">{stat.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {directoryError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {directoryError}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {channelOptions.map((channel) => {
            const Icon = channel.icon;
            const enabledClasses = channel.enabled
              ? channel.accent
              : 'text-gray-500 bg-white border border-gray-200';
            return (
              <button
                key={channel.key}
                type="button"
                onClick={channel.toggle}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${enabledClasses}`}
              >
                <span className="p-2 rounded-xl bg-white/60">
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{channel.label}</p>
                  <p className="text-xs opacity-80">{channel.description}</p>
                </div>
              </button>
            );
          })}
          <div className="space-y-1">
            <label className="text-xs text-slate-700 font-semibold">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
            >
              <option>Teachers</option>
              <option>Parents</option>
              <option>Staff</option>
              <option>All</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-700 font-semibold">Subject (teachers)</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
            >
              <option value="">All Subjects</option>
              {subjects.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-700 font-semibold">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-700 font-semibold">Search directory</label>
            <div className="mt-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, phone"
                className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="text-sm text-slate-900">
            {filteredDirectory.length} match{filteredDirectory.length !== 1 ? 'es' : ''} •{' '}
            {selectedIds.size} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllFiltered}
              disabled={filteredDirectory.length === 0 || directoryLoading}
              className="px-4 py-2 rounded-2xl border border-slate-200 text-sm text-slate-800 bg-slate-50 hover:bg-slate-100 disabled:opacity-60"
            >
              Select all results
            </button>
            <button
              onClick={clearSelection}
              disabled={!selectedIds.size}
              className="px-4 py-2 rounded-2xl border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              Clear selection
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Directory</h3>
              <p className="text-xs text-slate-700">Tap to add or remove recipients</p>
            </div>
            {directoryLoading && (
              <div className="flex items-center gap-2 text-slate-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-auto">
            {!directoryLoading && filteredDirectory.length === 0 && (
              <div className="p-8 text-center text-slate-800 text-sm">No matches found for the current filters.</div>
            )}
            {directoryLoading && (
              <div className="p-8 flex items-center justify-center text-slate-800 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading directory...
              </div>
            )}
            {!directoryLoading && filteredDirectory.map((contact) => {
              const selected = selectedIds.has(contact.id);
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => toggleSelect(contact.id)}
                  className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors ${
                    selected ? 'bg-slate-50' : 'hover:bg-slate-25'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 font-semibold flex items-center justify-center`}>
                    {getInitials(contact.name || contact.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{contact.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${renderRoleBadge(contact.role)}`}>
                        {contact.role}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">
                      {contact.email || 'No email'} {contact.email && contact.phone ? '• ' : ''}{contact.phone || 'No phone'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-700 w-32">
                    {contact.subject && <p>{contact.subject}</p>}
                    {contact.department && <p>{contact.department}</p>}
                  </div>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(contact.id)}
                    className="w-4 h-4 accent-slate-600"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Compose message</h3>
            <div className="text-xs text-slate-700">
              {selectedPreview.total ? `${selectedPreview.total} recipients selected` : 'Select recipients to enable send'}
            </div>
          </div>
          {channelEmail && (
            <div>
              <label className="text-xs text-slate-700 font-semibold">Email subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
                placeholder="Subject line"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-700 font-semibold">Message body</label>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
              placeholder="Type your announcement or message here..."
            />
            {channelSms && (
              <p className="text-xs text-slate-700 mt-1">
                {smsCharCount} characters • ~{smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm text-slate-900 space-y-1">
            <p className="font-semibold">Delivery summary</p>
            {!selectedPreview.total && <p>Select recipients to activate the send button.</p>}
            {!!selectedPreview.total && (
              <>
                <p>{selectedPreview.summary.join(', ')}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPreview.chips.map((name) => (
                    <span key={name} className="px-3 py-1 rounded-full bg-white text-xs border border-slate-200">
                      {name}
                    </span>
                  ))}
                  {selectedPreview.total > selectedPreview.chips.length && (
                    <span className="px-3 py-1 rounded-full bg-white text-xs border border-slate-200">
                      +{selectedPreview.total - selectedPreview.chips.length} more
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            disabled={!canSend}
            onClick={handleSend}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-semibold transition-colors ${
              canSend ? 'bg-slate-600 hover:bg-slate-700' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {sending ? 'Sending...' : (channelEmail && channelSms ? 'Send email & SMS' : channelEmail ? 'Send email' : 'Send SMS')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <PrincipalChatPanel />
      </div>
    </div>
  );
}
