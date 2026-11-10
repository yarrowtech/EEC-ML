import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeftRight, Copy, GraduationCap, KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');
const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const CARD = 'rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never');

const EMPTY_ROLE = { name: '', description: '', permissions: {} };
const EMPTY_MEMBER = { source: 'teacher', teacherId: '', name: '', username: '', email: '', accessRoleId: '', password: '' };

const RolesAccess = ({ setShowAdminHeader }) => {
  const [tab, setTab] = useState('members');
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleDrawer, setRoleDrawer] = useState(null);
  const [memberDrawer, setMemberDrawer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState(null); // { name, username, password }
  const [confirm, setConfirm] = useState(null); // { title, message, action }
  const [teachers, setTeachers] = useState([]);

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}/api/admin/team${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return json;
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, r, t, tch] = await Promise.all([api('/modules'), api('/roles'), api('/members'), api('/teachers').catch(() => [])]);
      setTeachers(Array.isArray(tch) ? tch : []);
      setModules(Array.isArray(m) ? m : []);
      setRoles(Array.isArray(r) ? r : []);
      setMembers(Array.isArray(t) ? t : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => {
    const map = new Map();
    modules.forEach((m) => {
      if (!map.has(m.section)) map.set(m.section, []);
      map.get(m.section).push(m);
    });
    return [...map.entries()];
  }, [modules]);
  const moduleLabel = useMemo(() => new Map(modules.map((m) => [m.key, m.label])), [modules]);
  const roleById = useMemo(() => new Map(roles.map((r) => [String(r._id), r])), [roles]);

  // ── Role permission matrix ──
  const setLevel = (key, level, on) => setRoleDrawer((d) => {
    const permissions = { ...d.permissions };
    if (level === 'view') {
      if (on) permissions[key] = permissions[key] || 'view';
      else delete permissions[key];
    } else if (on) permissions[key] = 'edit';
    else if (permissions[key]) permissions[key] = 'view';
    return { ...d, permissions };
  });
  const setSection = (list, level, on) => setRoleDrawer((d) => {
    const permissions = { ...d.permissions };
    list.forEach((m) => {
      if (level === 'view') {
        if (on) permissions[m.key] = permissions[m.key] || 'view';
        else delete permissions[m.key];
      } else if (on) permissions[m.key] = 'edit';
      else if (permissions[m.key]) permissions[m.key] = 'view';
    });
    return { ...d, permissions };
  });

  const saveRole = async (e) => {
    e.preventDefault();
    if (!Object.keys(roleDrawer.permissions).length) { toast.error('Select at least one menu for this role'); return; }
    try {
      setSaving(true);
      const body = JSON.stringify({ name: roleDrawer.name, description: roleDrawer.description, permissions: roleDrawer.permissions });
      if (roleDrawer._id) await api(`/roles/${roleDrawer._id}`, { method: 'PUT', body });
      else await api('/roles', { method: 'POST', body });
      toast.success(roleDrawer._id ? 'Role updated' : 'Role created');
      setRoleDrawer(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveMember = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (memberDrawer._id) {
        await api(`/members/${memberDrawer._id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: memberDrawer.name, email: memberDrawer.email, accessRoleId: memberDrawer.accessRoleId }),
        });
        toast.success('Team member updated');
      } else {
        const body = memberDrawer.source === 'teacher'
          ? { teacherId: memberDrawer.teacherId, accessRoleId: memberDrawer.accessRoleId }
          : memberDrawer;
        const res = await api('/members', { method: 'POST', body: JSON.stringify(body) });
        if (res.linkedTeacher) toast.success(`${res.member.name} can now switch to the admin panel from the teacher portal`);
        else setCredentials({ name: res.member.name, username: res.member.username, password: res.password });
      }
      setMemberDrawer(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (member, patch, message) => {
    try {
      const updated = await api(`/members/${member._id}`, { method: 'PUT', body: JSON.stringify(patch) });
      setMembers((prev) => prev.map((m) => (m._id === member._id ? updated : m)));
      if (message) toast.success(message);
      if (patch.accessRoleId) load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetPassword = async (member) => {
    try {
      const res = await api(`/members/${member._id}/reset-password`, { method: 'POST' });
      setCredentials({ name: member.name, username: res.username, password: res.password });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runConfirm = async () => {
    const { action } = confirm;
    setConfirm(null);
    await action();
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {/* Header */}
      <div className={`${CARD} flex flex-wrap items-center gap-3 px-4 py-3`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><UserCog className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">Roles &amp; Access</h1>
          <p className="text-xs text-slate-500">Create team logins and choose which menus each role can view or edit.</p>
        </div>
        <button type="button"
          onClick={() => (tab === 'members'
            ? setMemberDrawer({ ...EMPTY_MEMBER, accessRoleId: roles[0]?._id || '' })
            : setRoleDrawer({ ...EMPTY_ROLE }))}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
          <Plus className="h-3.5 w-3.5" /> {tab === 'members' ? 'Add Team Member' : 'New Role'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'members', label: `Team Members (${members.length})`, icon: Users },
          { key: 'roles', label: `Roles (${roles.length})`, icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <section className={CARD}>
          {members.length === 0 ? (
            <div className="py-14 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No team members yet</p>
              <p className="text-xs text-slate-500">Give an existing teacher admin access, or create a login for admission, finance, HR or support staff.</p>
            </div>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Member</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Last Login</th>
                    <th className="px-3 py-2.5">Active</th><th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m._id}>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        {m.linkedTeacherId ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <GraduationCap className="h-3 w-3" /> Teacher · switches from teacher portal
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500">{m.username}{m.email ? ` · ${m.email}` : ''}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={m.accessRoleId || ''} onChange={(e) => updateMember(m, { accessRoleId: e.target.value }, 'Role changed')}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {!roleById.has(String(m.accessRoleId)) && <option value="">No role</option>}
                          {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{fmtDate(m.lastLoginAt)}</td>
                      <td className="px-3 py-2.5">
                        <button type="button" role="switch" aria-checked={m.status === 'active'} aria-label="Toggle active"
                          onClick={() => updateMember(m, { status: m.status === 'active' ? 'inactive' : 'active' }, m.status === 'active' ? 'Login disabled' : 'Login enabled')}
                          className={`relative h-5 w-9 rounded-full transition ${m.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${m.status === 'active' ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" title="Edit" onClick={() => setMemberDrawer({ ...m, source: m.linkedTeacherId ? 'teacher' : 'login', password: '' })}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"><Pencil className="h-3.5 w-3.5" /></button>
                          {!m.linkedTeacherId && <button type="button" title="Reset password"
                            onClick={() => setConfirm({ title: 'Reset password?', message: `A new password will be generated for ${m.name}. They must change it at next login.`, action: () => resetPassword(m) })}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600"><KeyRound className="h-3.5 w-3.5" /></button>}
                          <button type="button" title="Delete"
                            onClick={() => setConfirm({
                              title: 'Delete team member?',
                              message: `${m.name} will no longer be able to log in.`,
                              action: async () => {
                                try { await api(`/members/${m._id}`, { method: 'DELETE' }); toast.success('Team member deleted'); load(); } catch (err) { toast.error(err.message); }
                              },
                            })}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => {
            const keys = Object.keys(r.permissions || {});
            return (
              <article key={r._id} className={`${CARD} flex flex-col p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><ShieldCheck className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{r.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{r.description || `${keys.length} menus`}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{r.memberCount} member{r.memberCount === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-3 flex flex-1 flex-wrap content-start gap-1">
                  {keys.map((k) => (
                    <span key={k} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${r.permissions[k] === 'edit' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {moduleLabel.get(k) || k}{r.permissions[k] === 'view' ? ' (view)' : ''}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-1.5 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setRoleDrawer({ ...r, permissions: { ...r.permissions } })}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"><Pencil className="h-3 w-3" /> Edit</button>
                  <button type="button"
                    onClick={() => setConfirm({
                      title: 'Delete role?',
                      message: `"${r.name}" will be removed.`,
                      action: async () => {
                        try { await api(`/roles/${r._id}`, { method: 'DELETE' }); toast.success('Role deleted'); load(); } catch (err) { toast.error(err.message); }
                      },
                    })}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"><Trash2 className="h-3 w-3" /> Delete</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Role drawer: name + permission matrix */}
      {roleDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => { if (e.target === e.currentTarget && !saving) setRoleDrawer(null); }}>
          <form onSubmit={saveRole} className="excuse-drawer-in flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">{roleDrawer._id ? 'Edit Role' : 'New Role'}</h2>
              <button type="button" onClick={() => setRoleDrawer(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Role name *</span>
                  <input value={roleDrawer.name} onChange={(e) => setRoleDrawer({ ...roleDrawer, name: e.target.value })} required maxLength={60} placeholder="e.g. Finance" className={INPUT} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Description</span>
                  <input value={roleDrawer.description} onChange={(e) => setRoleDrawer({ ...roleDrawer, description: e.target.value })} maxLength={200} className={INPUT} /></label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Menu access</span>
                  <span className="text-[11px] text-slate-400">{Object.keys(roleDrawer.permissions).length} selected · Edit includes View</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1fr_64px_64px] bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Menu</span><span className="text-center">View</span><span className="text-center">Edit</span>
                  </div>
                  {sections.map(([section, list]) => {
                    const allView = list.every((m) => roleDrawer.permissions[m.key]);
                    const allEdit = list.every((m) => roleDrawer.permissions[m.key] === 'edit');
                    return (
                      <div key={section} className="border-t border-slate-100">
                        <div className="grid grid-cols-[1fr_64px_64px] items-center bg-indigo-50/50 px-3 py-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">{section}</span>
                          <span className="flex justify-center"><input type="checkbox" checked={allView} onChange={(e) => setSection(list, 'view', e.target.checked)} aria-label={`View all ${section}`} className="h-4 w-4 accent-indigo-600" /></span>
                          <span className="flex justify-center"><input type="checkbox" checked={allEdit} onChange={(e) => setSection(list, 'edit', e.target.checked)} aria-label={`Edit all ${section}`} className="h-4 w-4 accent-emerald-600" /></span>
                        </div>
                        {list.map((m) => (
                          <div key={m.key} className="grid grid-cols-[1fr_64px_64px] items-center px-3 py-1.5 hover:bg-slate-50">
                            <span className="text-xs text-slate-700">{m.label}</span>
                            <span className="flex justify-center"><input type="checkbox" checked={Boolean(roleDrawer.permissions[m.key])} onChange={(e) => setLevel(m.key, 'view', e.target.checked)} aria-label={`View ${m.label}`} className="h-4 w-4 accent-indigo-600" /></span>
                            <span className="flex justify-center"><input type="checkbox" checked={roleDrawer.permissions[m.key] === 'edit'} onChange={(e) => setLevel(m.key, 'edit', e.target.checked)} aria-label={`Edit ${m.label}`} className="h-4 w-4 accent-emerald-600" /></span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setRoleDrawer(null)} className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{roleDrawer._id ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Member drawer */}
      {memberDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => { if (e.target === e.currentTarget && !saving) setMemberDrawer(null); }}>
          <form onSubmit={saveMember} className="excuse-drawer-in flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">{memberDrawer._id ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button type="button" onClick={() => setMemberDrawer(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {!memberDrawer._id && (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  {[['teacher', 'Existing teacher', GraduationCap], ['login', 'New login', KeyRound]].map(([key, label, Icon]) => (
                    <button key={key} type="button" onClick={() => setMemberDrawer({ ...memberDrawer, source: key })}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${memberDrawer.source === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
              )}
              {memberDrawer.source === 'teacher' && !memberDrawer._id ? (
                <>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Teacher *</span>
                    <select value={memberDrawer.teacherId} onChange={(e) => setMemberDrawer({ ...memberDrawer, teacherId: e.target.value })} required className={INPUT}>
                      <option value="">Select teacher</option>
                      {teachers.map((tch) => (
                        <option key={tch._id} value={tch._id}>{tch.name}{tch.department ? ` · ${tch.department}` : ''} ({tch.username})</option>
                      ))}
                    </select>
                    {teachers.length === 0 && <span className="mt-1 block text-[11px] text-slate-400">Every teacher already has admin access, or no teachers are added yet.</span>}
                  </label>
                  <p className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                    <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    No new password needed. The teacher signs in as usual and uses <b>Switch to Admin Panel</b> in their profile menu.
                  </p>
                </>
              ) : (
              <>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Full name *</span>
                <input value={memberDrawer.name} onChange={(e) => setMemberDrawer({ ...memberDrawer, name: e.target.value })} required maxLength={120} className={INPUT} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Username *</span>
                <input value={memberDrawer.username} disabled={Boolean(memberDrawer._id)} required minLength={3} maxLength={60}
                  onChange={(e) => setMemberDrawer({ ...memberDrawer, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                  placeholder="e.g. finance.rahul" className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-500`} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
                <input type="email" value={memberDrawer.email} onChange={(e) => setMemberDrawer({ ...memberDrawer, email: e.target.value })} maxLength={160} className={INPUT} /></label>
              </>
              )}
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Role *</span>
                <select value={memberDrawer.accessRoleId || ''} onChange={(e) => setMemberDrawer({ ...memberDrawer, accessRoleId: e.target.value })} required className={INPUT}>
                  <option value="">Select role</option>
                  {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select></label>
              {memberDrawer.accessRoleId && roleById.get(String(memberDrawer.accessRoleId)) && (
                <div className="flex flex-wrap gap-1 rounded-lg bg-slate-50 p-2.5">
                  {Object.entries(roleById.get(String(memberDrawer.accessRoleId)).permissions).map(([k, level]) => (
                    <span key={k} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${level === 'edit' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-600'}`}>
                      {moduleLabel.get(k) || k}{level === 'view' ? ' (view)' : ''}
                    </span>
                  ))}
                </div>
              )}
              {!memberDrawer._id && memberDrawer.source === 'login' && (
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Password</span>
                  <input type="text" value={memberDrawer.password} onChange={(e) => setMemberDrawer({ ...memberDrawer, password: e.target.value })} placeholder="Leave blank to auto-generate" className={INPUT} />
                  <span className="mt-1 block text-[11px] text-slate-400">They will be asked to set a new password at first login.</span>
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setMemberDrawer(null)} className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{memberDrawer._id ? 'Update' : memberDrawer.source === 'teacher' ? 'Give Access' : 'Create Login'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Login details shown once */}
      {credentials && (
        <div className="excuse-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="excuse-pop-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><KeyRound className="h-5 w-5" /></span>
              <h3 className="mt-2 text-base font-bold text-slate-900">Login details for {credentials.name}</h3>
              <p className="text-xs text-slate-500">Shown only once. Share them securely.</p>
            </div>
            <div className="mt-4 space-y-2">
              {[['Username', credentials.username], ['Password', credentials.password]].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <span className="w-20 text-xs text-slate-500">{k}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-slate-900">{v}</span>
                  <button type="button" onClick={() => copy(v)} aria-label={`Copy ${k}`} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">They log in on the admin login page and must set a new password the first time.</p>
            <button type="button" onClick={() => setCredentials(null)} className="mt-4 w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirm && (
        <div className="excuse-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirm(null)}>
          <div className="excuse-pop-in w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
            <h3 className="mt-2 text-base font-bold text-slate-900">{confirm.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{confirm.message}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={runConfirm} className="rounded-full bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesAccess;
