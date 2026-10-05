import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CalendarCheck, Check, CloudCheck, Info, Save, CalendarDays, ChevronDown, ChevronUp, ClipboardList, FileText, Heart, History,
  Home, Loader2, MessageCircle, MessageSquareText, Moon, Palette, Send, Star, Users, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parentApiJson } from './parentApi';
import { readSharedChild, writeSharedChild, isSameChild } from './ChildSwitcher';
import { useDialog } from './useDialog';

const POSITIVE_OPTIONS = ['Excellent', 'Good', 'Average', 'Needs Support'];
const SCORE_OPTIONS = ['High', 'Medium', 'Low'];
const CONCERN_OPTIONS = ['None', 'Mild', 'Moderate', 'High'];
const LIFE_OPTIONS = ['Healthy', 'Mostly Healthy', 'Inconsistent', 'Needs Attention'];
const field = (label, options) => ({ label, options });

// tone: card background/border, number badge, icon colour, rated pill.
const SECTIONS = [
  { title: 'Home Behavior', subtitle: 'Obedience, respect, listening and discipline at home', icon: Home,
    tone: { card: 'border-blue-100 bg-blue-50/40', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-600', pill: 'bg-blue-100/70 text-blue-700' },
    fields: [field('Obedience level', POSITIVE_OPTIONS), field('Respect towards elders', POSITIVE_OPTIONS), field('Listening habits', POSITIVE_OPTIONS), field('Following instructions', POSITIVE_OPTIONS), field('Discipline at home', POSITIVE_OPTIONS)] },
  { title: 'Communication', subtitle: 'Communication and interaction with parents', icon: MessageCircle,
    tone: { card: 'border-violet-100 bg-violet-50/40', badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-600', pill: 'bg-violet-100/70 text-violet-700' },
    fields: [field('Talks openly with parents', POSITIVE_OPTIONS), field('Expresses feelings clearly', POSITIVE_OPTIONS), field('Confidence in speaking', POSITIVE_OPTIONS), field('Shares daily experiences', POSITIVE_OPTIONS), field('Listening skills', POSITIVE_OPTIONS)] },
  { title: 'Emotional State', subtitle: 'Mood, anger control, stress and happiness', icon: Heart,
    tone: { card: 'border-emerald-100 bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-600', pill: 'bg-emerald-100/70 text-emerald-700' },
    fields: [field('Mood stability', POSITIVE_OPTIONS), field('Anger control', POSITIVE_OPTIONS), field('Sensitivity level', SCORE_OPTIONS), field('Stress or anxiety signs', CONCERN_OPTIONS), field('Happiness level', SCORE_OPTIONS)] },
  { title: 'Social Skills', subtitle: 'Interaction with family, friends and others', icon: Users,
    tone: { card: 'border-amber-100 bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-500', pill: 'bg-amber-100/70 text-amber-700' },
    fields: [field('Interaction with siblings', POSITIVE_OPTIONS), field('Behavior with relatives', POSITIVE_OPTIONS), field('Making friends outside school', POSITIVE_OPTIONS), field('Sharing and caring nature', POSITIVE_OPTIONS), field('Conflict handling', POSITIVE_OPTIONS)] },
  { title: 'Habits', subtitle: 'Daily tasks, routine and screen time', icon: CalendarCheck,
    tone: { card: 'border-violet-100 bg-violet-50/40', badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-600', pill: 'bg-violet-100/70 text-violet-700' },
    fields: [field('Completes daily tasks', POSITIVE_OPTIONS), field('Helps in household work', POSITIVE_OPTIONS), field('Time management', POSITIVE_OPTIONS), field('Follows routine', POSITIVE_OPTIONS), field('Screen time control', POSITIVE_OPTIONS)] },
  { title: 'Lifestyle', subtitle: 'Sleep, eating habits and physical activity', icon: Moon,
    tone: { card: 'border-blue-100 bg-blue-50/40', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-600', pill: 'bg-blue-100/70 text-blue-700' },
    fields: [field('Sleep pattern', LIFE_OPTIONS), field('Eating habits', LIFE_OPTIONS), field('Mobile/TV usage', LIFE_OPTIONS), field('Outdoor activity', LIFE_OPTIONS), field('Physical activity level', LIFE_OPTIONS)] },
  { title: 'Hobbies', subtitle: 'Interests, creativity and passion areas', icon: Palette,
    tone: { card: 'border-orange-100 bg-orange-50/40', badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-500', pill: 'bg-orange-100/70 text-orange-700' },
    fields: [field('Hobbies (sports, music, drawing, etc.)', POSITIVE_OPTIONS), field('Creativity at home', POSITIVE_OPTIONS), field('Learning new things', POSITIVE_OPTIONS), field('Passion areas', POSITIVE_OPTIONS)] },
  { title: 'Personality', subtitle: 'Confidence, independence and character', icon: Star,
    tone: { card: 'border-violet-100 bg-violet-50/40', badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-600', pill: 'bg-violet-100/70 text-violet-700' },
    fields: [field('Confidence', POSITIVE_OPTIONS), field('Independence', POSITIVE_OPTIONS), field('Honesty', POSITIVE_OPTIONS), field('Patience', POSITIVE_OPTIONS), field('Adaptability', POSITIVE_OPTIONS)] },
  { title: 'Key Concerns', subtitle: 'Behavioral issues, addiction and sudden changes', icon: AlertTriangle, wide: true,
    tone: { card: 'border-rose-100 bg-rose-50/50', badge: 'bg-rose-100 text-rose-700', icon: 'text-rose-600', pill: 'bg-rose-100/70 text-rose-700' },
    fields: [field('Behavioral issues', CONCERN_OPTIONS), field('Addiction (mobile, games, etc.)', CONCERN_OPTIONS), field('Fear or anxiety', CONCERN_OPTIONS), field('Sudden changes in behavior', CONCERN_OPTIONS)] },
];

// Option pills are coloured by position: best → worst (green, blue, amber, red).
const OPTION_TONES = [
  { idle: 'border-emerald-100 bg-emerald-50/70 text-emerald-700', active: 'border-emerald-500 bg-emerald-500 text-white' },
  { idle: 'border-blue-100 bg-blue-50/70 text-blue-700', active: 'border-blue-600 bg-blue-600 text-white' },
  { idle: 'border-amber-100 bg-amber-50/70 text-amber-700', active: 'border-amber-500 bg-amber-500 text-white' },
  { idle: 'border-rose-100 bg-rose-50/70 text-rose-600', active: 'border-rose-500 bg-rose-500 text-white' },
];

// Column header + radio colours by position: best → worst.
const OPTION_HEAD = ['bg-emerald-50 text-emerald-700', 'bg-blue-50 text-blue-700', 'bg-amber-50 text-amber-600', 'bg-rose-50 text-rose-600'];
const OPTION_RADIO = ['accent-emerald-600', 'accent-blue-600', 'accent-amber-500', 'accent-rose-600'];
const OVERALL_DOT = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500'];

// One-line hint under each area.
const HINTS = {
  'Obedience level': 'Follows rules and listens at home',
  'Respect towards elders': 'Shows respect to parents and family members',
  'Listening habits': 'Pays attention when spoken to',
  'Following instructions': 'Completes daily tasks and chores',
  'Discipline at home': 'Maintains routine and behaves well',
  'Talks openly with parents': 'Shares thoughts without hesitation',
  'Expresses feelings clearly': 'Can say how they feel',
  'Confidence in speaking': 'Speaks up comfortably',
  'Shares daily experiences': 'Talks about school and friends',
  'Listening skills': 'Listens without interrupting',
  'Mood stability': 'Mood stays steady through the day',
  'Anger control': 'Handles frustration calmly',
  'Sensitivity level': 'How strongly they react to things',
  'Stress or anxiety signs': 'Worry, restlessness or fear',
  'Happiness level': 'Generally cheerful and content',
  'Interaction with siblings': 'Plays and shares with siblings',
  'Behavior with relatives': 'Polite and friendly with family',
  'Making friends outside school': 'Builds friendships in the neighbourhood',
  'Sharing and caring nature': 'Helps and shares with others',
  'Conflict handling': 'Resolves disagreements peacefully',
  'Completes daily tasks': 'Finishes homework and chores',
  'Helps in household work': 'Lends a hand at home',
  'Time management': 'Uses time well',
  'Follows routine': 'Sticks to a daily schedule',
  'Screen time control': 'Limits phone, TV and games',
  'Sleep pattern': 'Regular and sufficient sleep',
  'Eating habits': 'Balanced meals on time',
  'Mobile/TV usage': 'Healthy amount of screen use',
  'Outdoor activity': 'Plays outside regularly',
  'Physical activity level': 'Stays active through the day',
  'Hobbies (sports, music, drawing, etc.)': 'Regularly enjoys a hobby',
  'Creativity at home': 'Makes and imagines new things',
  'Learning new things': 'Curious and eager to learn',
  'Passion areas': 'Shows a strong interest in something',
  Confidence: 'Believes in their own abilities',
  Independence: 'Does things on their own',
  Honesty: 'Tells the truth',
  Patience: 'Waits calmly for their turn',
  Adaptability: 'Copes well with change',
  'Behavioral issues': 'Tantrums, defiance or aggression',
  'Addiction (mobile, games, etc.)': 'Hard to stop using devices',
  'Fear or anxiety': 'Frequent fear or nervousness',
  'Sudden changes in behavior': 'Unusual or abrupt changes',
};
const REMARK_MAX = 500;
const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

const buildRatings = () => {
  const out = {};
  SECTIONS.forEach((section) => section.fields.forEach((f) => { out[f.label] = ''; }));
  return out;
};
const buildRemarks = () => Object.fromEntries(SECTIONS.map((sec) => [sec.title, '']));

// Drafts live on the server (one per child), like the admin enrolment drafts:
// edits auto-save after a short pause and come back on any device.
const DRAFTS_API = '/api/observations/parent/drafts';
const AUTOSAVE_DELAY_MS = 2000;
const hasDraftContent = ({ ratings = {}, remarks = {} }) =>
  Object.values(ratings).some(Boolean) || Object.values(remarks).some((v) => String(v || '').trim());
const draftSnapshot = (studentId, ratings, remarks, openSection) => JSON.stringify({ studentId, ratings, remarks, openSection });
const fmtTime = (v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const concernBadge = (level) =>
  level === 'high' ? 'bg-rose-50 text-rose-600' : level === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600';

const fmtDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

const ParentObservationNonAcademic = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [ratings, setRatings] = useState(buildRatings);
  const [remarks, setRemarks] = useState(buildRemarks);
  const [openSection, setOpenSection] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedPrev, setExpandedPrev] = useState('');
  const historyRef = useDialog(historyOpen, () => setHistoryOpen(false));

  // Draft state: idle | pending (typed, waiting) | saving | saved | error
  const [drafts, setDrafts] = useState({}); // studentId -> draft
  const [draftState, setDraftState] = useState('idle');
  const [autoSavedAt, setAutoSavedAt] = useState(null);
  const lastSnapshot = useRef('');
  const autoTimer = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Parent') throw new Error('Please login as a parent to manage observations.');

        const [childrenPayload, observationsPayload, draftsPayload] = await Promise.all([
          parentApiJson('/api/attendance/parent/children', {}, navigate),
          parentApiJson('/api/observations/parent', {}, navigate),
          parentApiJson(DRAFTS_API, {}, navigate).catch(() => ({ drafts: [] })),
        ]);
        setDrafts(Object.fromEntries((draftsPayload?.drafts || []).map((d) => [String(d.studentId), d])));

        const childOptions = (childrenPayload.children || []).map((entry) => ({
          id: entry.student?._id || entry.studentId,
          name: entry.student?.name || 'Student',
          roll: entry.student?.roll || entry.student?.rollNo || entry.student?.rollNumber,
          className: entry.student?.grade || '',
          section: entry.student?.section || entry.student?.sectionName || '',
          photo: entry.student?.profilePic || entry.student?.profileImage || '',
        }));
        setChildren(childOptions);
        setStudentId((prev) => {
          if (prev) return prev;
          const stored = readSharedChild();
          const match = stored && childOptions.find((c) => isSameChild({ id: String(c.id || ''), name: c.name }, stored));
          return String((match || childOptions[0])?.id || '');
        });
        setObservations(Array.isArray(observationsPayload.parentEntries) ? observationsPayload.parentEntries : []);
      } catch (err) {
        setError(err.message || 'Unable to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  const child = children.find((c) => String(c.id) === String(studentId)) || null;

  // Save the draft for a child to the server.
  const persistDraft = async ({ id, payload, silent }) => {
    if (!id) return;
    setDraftState('saving');
    try {
      const res = await parentApiJson(`${DRAFTS_API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, navigate);
      const saved = res?.draft || { ...payload, studentId: id, updatedAt: new Date().toISOString() };
      setDrafts((prev) => ({ ...prev, [String(id)]: saved }));
      setAutoSavedAt(saved.updatedAt || new Date().toISOString());
      setDraftState('saved');
      setTimeout(() => setDraftState((st) => (st === 'saved' ? 'idle' : st)), 2500);
    } catch {
      setDraftState('error');
      if (!silent) toast.error('Could not save draft');
      setTimeout(() => setDraftState((st) => (st === 'error' ? 'idle' : st)), 3000);
    }
  };

  // Switching child: share the selection portal-wide and restore that child's draft.
  useEffect(() => {
    if (!child) return;
    writeSharedChild({ id: String(child.id || ''), name: child.name || 'Student' });
    const draft = drafts[String(child.id)];
    const nextRatings = { ...buildRatings(), ...(draft?.ratings || {}) };
    const nextRemarks = { ...buildRemarks(), ...(draft?.remarks || {}) };
    const nextSection = draft?.openSection || 0;
    setRatings(nextRatings);
    setRemarks(nextRemarks);
    setOpenSection(nextSection);
    setAutoSavedAt(draft?.updatedAt || null);
    setDraftState('idle');
    lastSnapshot.current = draftSnapshot(String(child.id), nextRatings, nextRemarks, nextSection);
  }, [child?.id, loading]);

  // Always-current form, for the unmount flush below.
  const latest = useRef({});
  latest.current = { studentId, ratings, remarks, openSection };

  // Auto-save: debounce edits once there's something worth keeping.
  useEffect(() => {
    if (!studentId || loading) return undefined;
    const snapshot = draftSnapshot(studentId, ratings, remarks, openSection);
    if (snapshot === lastSnapshot.current || !hasDraftContent({ ratings, remarks })) return undefined;
    setDraftState((prev) => (prev === 'saving' ? prev : 'pending'));
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const id = studentId;
    const payload = { ratings, remarks, openSection };
    autoTimer.current = setTimeout(() => {
      lastSnapshot.current = snapshot;
      persistDraft({ id, payload, silent: true });
    }, AUTOSAVE_DELAY_MS);
    return () => autoTimer.current && clearTimeout(autoTimer.current);
  }, [studentId, ratings, remarks, openSection, loading]);

  // Flush a pending auto-save when the page unmounts (navigate away).
  useEffect(() => () => {
    const { studentId: id, ratings: r, remarks: m, openSection: o } = latest.current;
    if (!id || !hasDraftContent({ ratings: r, remarks: m })) return;
    if (draftSnapshot(id, r, m, o) === lastSnapshot.current) return;
    parentApiJson(`${DRAFTS_API}/${id}`, { method: 'PUT', body: JSON.stringify({ ratings: r, remarks: m, openSection: o }) }).catch(() => {});
  }, []);

  const selectedCount = useMemo(() => Object.values(ratings).filter(Boolean).length, [ratings]);

  const concernLevel = useMemo(() => {
    const values = SECTIONS[8].fields.map((f) => String(ratings[f.label] || '').toLowerCase());
    if (values.some((v) => v === 'high')) return 'high';
    if (values.some((v) => v === 'moderate')) return 'medium';
    return 'low';
  }, [ratings]);

  const moodRating = useMemo(() => {
    const h = String(ratings['Happiness level'] || '').toLowerCase();
    if (h === 'high') return 5;
    if (h === 'medium') return 3;
    if (h === 'low') return 2;
    return null;
  }, [ratings]);

  const isValid = useMemo(() => {
    const hasRatings = Object.values(ratings).some(Boolean);
    const hasRemarks = Object.values(remarks).some((v) => String(v || '').trim());
    return Boolean(studentId && (hasRatings || hasRemarks));
  }, [studentId, ratings, remarks]);

  // History for the selected child, grouped by session (newest first).
  const historyGroups = useMemo(() => {
    const mine = observations.filter((o) => !studentId || String(o.studentId?._id || o.studentId) === String(studentId));
    const map = new Map();
    mine.forEach((o) => {
      const key = o.sessionName || 'Earlier';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    });
    return [...map.entries()]
      .map(([session, items]) => ({ session, items: items.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)) }))
      .sort((a, b) => b.session.localeCompare(a.session, undefined, { numeric: true }));
  }, [observations, studentId]);
  const historyCount = historyGroups.reduce((n, g) => n + g.items.length, 0);

  const saveDraft = () => {
    if (!studentId || draftState === 'saving') return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    lastSnapshot.current = draftSnapshot(studentId, ratings, remarks, openSection);
    persistDraft({ id: studentId, payload: { ratings, remarks, openSection }, silent: false });
  };

  const discardDraft = async () => {
    if (!studentId) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    try {
      await parentApiJson(`${DRAFTS_API}/${studentId}`, { method: 'DELETE' }, navigate);
    } catch { /* nothing saved yet */ }
    setDrafts((prev) => { const next = { ...prev }; delete next[String(studentId)]; return next; });
    const empty = [buildRatings(), buildRemarks()];
    setRatings(empty[0]);
    setRemarks(empty[1]);
    setAutoSavedAt(null);
    setDraftState('idle');
    lastSnapshot.current = draftSnapshot(studentId, empty[0], empty[1], openSection);
    toast.success('Draft discarded');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      setSubmitting(true);
      setError('');
      const selectedLines = [];
      SECTIONS.forEach((section) => section.fields.forEach((f) => {
        if (ratings[f.label]) selectedLines.push(`${f.label}: ${ratings[f.label]}`);
      }));
      const remarkLines = SECTIONS
        .filter((sec) => String(remarks[sec.title] || '').trim())
        .map((sec) => `${sec.title}: ${String(remarks[sec.title]).trim()}`);

      const saved = await parentApiJson('/api/observations/parent', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          category: 'Parent Observation (Non-Academic)',
          observation: selectedLines.slice(0, 25).join(' | '),
          observationText: selectedLines.slice(0, 25).join(' | '),
          behaviorNotes: remarkLines.join('\n'),
          concernLevel,
          moodRating,
          date: new Date().toISOString().split('T')[0],
        }),
      }, navigate);

      setObservations((prev) => [saved, ...prev]);
      setRatings(buildRatings());
      setRemarks(buildRemarks());
      if (autoTimer.current) clearTimeout(autoTimer.current);
      parentApiJson(`${DRAFTS_API}/${studentId}`, { method: 'DELETE' }, navigate).catch(() => {});
      setDrafts((prev) => { const next = { ...prev }; delete next[String(studentId)]; return next; });
      setAutoSavedAt(null);
      setDraftState('idle');
      lastSnapshot.current = draftSnapshot(studentId, buildRatings(), buildRemarks(), openSection);
      toast.success('Observation recorded successfully');
    } catch (err) {
      setError(err.message || 'Unable to save observation');
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const ratedIn = (section) => section.fields.filter((f) => ratings[f.label]).length;

  const childObservations = useMemo(
    () => observations
      .filter((o) => String(o.studentId?._id || o.studentId) === String(studentId))
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)),
    [observations, studentId],
  );

  const previousFor = (section) => {
    const labels = new Set(section.fields.map((f) => f.label));
    const options = section.fields[0].options;
    return childObservations.map((o) => {
      const values = String(o.observationText || o.observation || '')
        .split('|')
        .map((part) => part.split(':').map((x) => x.trim()))
        .filter(([label, value]) => labels.has(label) && value);
      const remarkLine = String(o.behaviorNotes || '').split('\n').find((line) => line.startsWith(`${section.title}:`));
      const remark = remarkLine ? remarkLine.slice(section.title.length + 1).trim() : '';
      if (!values.length && !remark) return null;
      // Overall = the most frequently chosen option in this section.
      const counts = new Map();
      values.forEach(([, v]) => counts.set(v, (counts.get(v) || 0) + 1));
      const overall = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      const rank = Math.max(0, options.indexOf(overall));
      return {
        id: String(o.id || o._id),
        date: o.recordedAt || o.date,
        className: o.className,
        section: o.section,
        overall,
        overallTone: OVERALL_DOT[Math.min(rank, OVERALL_DOT.length - 1)],
        remark,
        values,
      };
    }).filter(Boolean);
  };

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      {/* Header + child selector + history */}
      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><FileText size={22} /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Parent Observation</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Record and track your child&apos;s behavior, communication, and emotional growth at home.</p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className={`${CARD} flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:min-w-[300px]`}>
            <span className="shrink-0 text-xs text-slate-500">Viewing</span>
            <div className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
              {child?.photo ? (
                <img src={child.photo} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-600">
                  {String(child?.name || 'C').trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#0b1446]">{child?.name || (loading ? 'Loading…' : 'No child linked')}</p>
                {child ? <p className="truncate text-[11px] text-slate-500">Class {child.className}{child.section ? ` · Section ${child.section}` : ''}{child.roll ? ` · Roll ${child.roll}` : ''}</p> : null}
              </div>
              {children.length > 1 ? (
                <>
                  <ChevronDown size={16} className="shrink-0 text-slate-500" />
                  <select aria-label="Select child" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    {children.map((c) => <option key={c.id} value={c.id}>{c.name}{drafts[String(c.id)] ? ' (draft)' : ''}</option>)}
                  </select>
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex h-[54px] shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 text-xs font-semibold text-blue-600 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:bg-blue-50"
          >
            <History size={16} />
            <span className="hidden sm:inline">History</span>
            {historyCount ? <span className="rounded-full bg-blue-50 px-1.5 text-[10px]">{historyCount}</span> : null}
          </button>
        </div>
      </motion.header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Status strip */}
      <motion.div variants={RISE} className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2`}>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">{selectedCount} Fields Rated</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${concernBadge(concernLevel)}`}>Concern: {concernLevel.toUpperCase()}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium">
          {draftState === 'pending' || draftState === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500"><Loader2 size={13} className="animate-spin text-amber-500" /> Saving…</span>
          ) : draftState === 'error' ? (
            <span className="inline-flex items-center gap-1.5 text-rose-600"><Info size={13} /> Auto-save failed</span>
          ) : autoSavedAt ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500"><CloudCheck size={14} className="text-emerald-500" /> Draft auto-saved {fmtTime(autoSavedAt)}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-blue-600"><ClipboardList size={14} /> Progress auto-saves as you go</span>
          )}
          {autoSavedAt ? (
            <button type="button" onClick={discardDraft} className="ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50">Discard</button>
          ) : null}
        </span>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Sections (accordion) */}
        <div className="space-y-2.5">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = openSection === idx;
            const previous = previousFor(section);
            // Sections whose questions use different scales get per-cell labels.
            const uniform = section.fields.every((f) => f.options.join('|') === section.fields[0].options.join('|'));
            const columnCount = Math.max(...section.fields.map((f) => f.options.length));
            return (
              <motion.section
                key={section.title}
                variants={RISE}
                layout
                className={`overflow-hidden rounded-xl border transition ${isOpen ? 'border-blue-300 bg-white shadow-[0_4px_16px_rgba(37,99,235,0.08)]' : section.tone.card}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenSection(isOpen ? -1 : idx)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${isOpen ? 'bg-blue-50/40' : ''}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${section.tone.badge}`}>{idx + 1}</span>
                  <Icon size={22} className={`shrink-0 ${section.tone.icon}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#0b1446]">{section.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{section.subtitle}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${section.tone.pill}`}>{ratedIn(section)}/{section.fields.length} rated</span>
                  {isOpen ? <ChevronUp size={16} className="shrink-0 text-blue-600" /> : <ChevronDown size={16} className="shrink-0 text-slate-500" />}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 px-3 pb-3 pt-1">
                        {/* Rating table */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-sm font-bold text-[#0b1446]">Rate the following areas</h2>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Info size={13} /> Select one option for each item</span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                          <table className="w-full min-w-[560px] text-xs">
                            <thead>
                              <tr>
                                <th scope="col" className="w-[38%] bg-slate-50 px-3 py-1.5 text-left font-semibold text-[#0b1446]">Area</th>
                                {Array.from({ length: columnCount }, (_, oi) => (
                                  <th key={oi} scope="col" className={`px-2 py-1.5 text-center font-semibold ${OPTION_HEAD[Math.min(oi, OPTION_HEAD.length - 1)]}`}>
                                    {uniform ? section.fields[0].options[oi] : ['Best', 'Good', 'Fair', 'Concern'][oi]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.fields.map((f) => (
                                <tr key={f.label} className="border-t border-slate-100">
                                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                                    <span className="block font-medium text-[#0b1446]">{f.label}</span>
                                    {HINTS[f.label] ? <span className="block text-[11px] text-slate-500">{HINTS[f.label]}</span> : null}
                                  </th>
                                  {f.options.map((opt, oi) => {
                                    const checked = ratings[f.label] === opt;
                                    const tone = OPTION_RADIO[Math.min(oi, OPTION_RADIO.length - 1)];
                                    return (
                                      <td key={opt} className="border-l border-slate-100 px-2 py-1.5 text-center">
                                        <label className="inline-flex cursor-pointer flex-col items-center justify-center gap-0.5 p-1">
                                          <input
                                            type="radio"
                                            name={`rate-${f.label}`}
                                            value={opt}
                                            checked={checked}
                                            onChange={() => setRatings((prev) => ({ ...prev, [f.label]: opt }))}
                                            onClick={() => checked && setRatings((prev) => ({ ...prev, [f.label]: '' }))}
                                            aria-label={`${f.label}: ${opt}`}
                                            className={`h-4 w-4 cursor-pointer ${tone}`}
                                          />
                                          {!uniform ? <span className="text-[10px] text-slate-500">{opt}</span> : null}
                                        </label>
                                      </td>
                                    );
                                  })}
                                  {Array.from({ length: columnCount - f.options.length }, (_, k) => (
                                    <td key={`pad-${k}`} className="border-l border-slate-100" />
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Remarks for this section */}
                        <div className="rounded-lg border border-slate-100 p-3">
                          <div className="mb-2 flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><MessageSquareText size={16} /></span>
                            <label htmlFor={`obs-remark-${idx}`} className="text-sm font-bold text-[#0b1446]">
                              Parent Remarks <span className="font-normal text-slate-500">(Optional)</span>
                            </label>
                          </div>
                          <div className="relative">
                            <textarea
                              id={`obs-remark-${idx}`}
                              rows={2}
                              maxLength={REMARK_MAX}
                              value={remarks[section.title] || ''}
                              onChange={(e) => setRemarks((prev) => ({ ...prev, [section.title]: e.target.value }))}
                              placeholder={`Share your observation about your child's ${section.title.toLowerCase()} at home...`}
                              className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 pb-5 text-xs outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            />
                            <span className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] text-slate-400">{(remarks[section.title] || '').length}/{REMARK_MAX}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={!studentId || draftState === 'saving'}
                              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                                draftState === 'saved'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : draftState === 'error'
                                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                                    : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              {draftState === 'saving' ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                                : draftState === 'saved' ? <><Check size={15} /> Draft saved</>
                                  : draftState === 'error' ? <><Info size={15} /> Save failed</>
                                    : <><Save size={15} /> Save as Draft</>}
                            </button>
                            <button type="submit" disabled={!isValid || submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                              {submitting ? 'Submitting…' : 'Submit Observation'}
                            </button>
                          </div>
                        </div>

                        {/* Previous observations for this section */}
                        <div className="overflow-hidden rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><History size={16} /></span>
                            <div>
                              <p className="text-xs font-bold text-[#0b1446]">Previous Observations</p>
                              <p className="text-[11px] text-slate-500">Your recent observations for {section.title}.</p>
                            </div>
                          </div>
                          {previous.length === 0 ? (
                            <p className="px-3 py-3 text-center text-[11px] text-slate-400">No previous observations for this section yet.</p>
                          ) : previous.slice(0, 3).map((p) => {
                            const expanded = expandedPrev === p.id;
                            return (
                              <div key={p.id} className="border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => setExpandedPrev(expanded ? '' : p.id)}
                                  aria-expanded={expanded}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50/60"
                                >
                                  <CalendarDays size={18} className="shrink-0 text-blue-600" />
                                  <span className="w-28 shrink-0 sm:w-36">
                                    <span className="block text-xs text-[#0b1446]">{fmtDate(p.date)}</span>
                                    {p.className ? <span className="block text-[11px] text-slate-500">Class {p.className}{p.section ? ` - Section ${p.section}` : ''}</span> : null}
                                  </span>
                                  <span className="hidden h-8 w-px bg-slate-100 sm:block" />
                                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.overallTone}`} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-[#0b1446]">Overall: {p.overall}</span>
                                    {p.remark ? <span className="block truncate text-[11px] text-slate-500">{p.remark}</span> : null}
                                  </span>
                                  {expanded ? <ChevronUp size={16} className="shrink-0 text-blue-600" /> : <ChevronDown size={16} className="shrink-0 text-blue-600" />}
                                </button>
                                <AnimatePresence initial={false}>
                                  {expanded && (
                                    <motion.ul
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="grid gap-x-4 gap-y-1 overflow-hidden px-3 pb-2 pl-10 text-[11px] sm:grid-cols-2"
                                    >
                                      {p.values.map(([label, value]) => (
                                        <li key={label} className="flex justify-between gap-2 border-b border-dashed border-slate-100 py-0.5">
                                          <span className="text-slate-500">{label}</span>
                                          <span className="font-medium text-[#0b1446]">{value}</span>
                                        </li>
                                      ))}
                                    </motion.ul>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            );
          })}
        </div>
      </form>

      {/* History modal (portal → full-screen backdrop) */}
      {createPortal(
        <AnimatePresence>
          {historyOpen && (
            <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} aria-hidden="true" />
              <motion.div
                ref={historyRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="obs-history-title"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border bg-white shadow-xl"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 id="obs-history-title" className="flex items-center gap-2 text-base font-bold text-[#0b1446]"><History size={18} className="text-blue-600" /> Observation History</h2>
                    <p className="text-xs text-slate-500">{child?.name || 'Your child'} · {historyCount} observation{historyCount === 1 ? '' : 's'}</p>
                  </div>
                  <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 overflow-y-auto p-4">
                  {historyGroups.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                      <ClipboardList size={30} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Your recorded observations will appear here.</p>
                    </div>
                  ) : historyGroups.map((group) => (
                    <div key={group.session}>
                      <div className="mb-2 flex items-center gap-2">
                        <CalendarDays size={14} className="text-blue-600" />
                        <p className="text-xs font-bold text-[#0b1446]">Session {group.session}</p>
                        <span className="rounded-full bg-blue-50 px-2 text-[10px] font-medium text-blue-600">{group.items.length}</span>
                        {group.items[0]?.className ? (
                          <span className="text-[11px] text-slate-500">· Class {group.items[0].className}{group.items[0].section ? ` ${group.items[0].section}` : ''}</span>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        {group.items.map((obs) => (
                          <div key={obs.id || obs._id} className="rounded-lg border border-slate-100 p-3">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-[#0b1446]">{fmtDate(obs.recordedAt || obs.date)}</span>
                              {obs.className ? <span className="text-[11px] text-slate-500">Class {obs.className}{obs.section ? ` ${obs.section}` : ''}</span> : null}
                              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${concernBadge(obs.concernLevel || 'low')}`}>Concern: {obs.concernLevel || 'low'}</span>
                            </div>
                            <p className="line-clamp-3 text-xs text-slate-600">{obs.observationText || obs.observation || 'No ratings recorded.'}</p>
                            {obs.behaviorNotes ? (
                              <p className="mt-2 whitespace-pre-line border-t border-slate-100 pt-2 text-[11px] text-slate-500">{obs.behaviorNotes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
};

export default ParentObservationNonAcademic;
