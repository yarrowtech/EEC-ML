import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Search, Star, MessageSquare, Calendar, Layers, Users,
  Award, TrendingUp, Send, User, Check, X, ChevronLeft, ChevronRight, Heart,
  Filter, RefreshCw, Sparkles, FileText, Eye, EyeOff, Loader2, AlertCircle,
  PenLine, ListChecks, CircleHelp, PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

/* ── helpers ─────────────────────────────────────────────────── */
const diffBadge = (d) => {
  if (d === 'easy')   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (d === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (d === 'hard')   return 'bg-red-50 text-red-600 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const Avatar = ({ name = '?', size = 'sm', gradient = 'from-amber-400 to-orange-500' }) => {
  const s = size === 'lg' ? 'h-12 w-12 text-base' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  return (
    <div className={`${s} rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center font-black text-white shrink-0 shadow-sm`}>
      {String(name)[0].toUpperCase()}
    </div>
  );
};

/* ── Main ────────────────────────────────────────────────────── */
export default function AcademicAlcove() {
  const [items, setItems]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [limit]                 = useState(12);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [subject, setSubject]       = useState('');
  const [chapter, setChapter]       = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [q, setQ]                   = useState('');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [showCreateProblem, setShowCreateProblem] = useState(false);
  const [creatingProblem, setCreatingProblem] = useState(false);
  const [newProblem, setNewProblem] = useState({
    title: '',
    subject: '',
    chapter: '',
    difficulty: 'medium',
    problemText: '',
  });
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [curriculumStatus, setCurriculumStatus]     = useState('idle'); // idle|loading|ready|empty|error
  const [subjectIsOther, setSubjectIsOther]         = useState(false);
  const [chapterIsOther, setChapterIsOther]         = useState(false);

  const [selected, setSelected]         = useState(null);
  const [comments, setComments]         = useState([]);
  const [commentText, setCommentText]   = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [viewMode, setViewMode]     = useState('problems');
  const [wallPosts, setWallPosts]   = useState([]);
  const [wallLoading, setWallLoading] = useState(false);
  const [wallError, setWallError]   = useState(null);

  const [submissions, setSubmissions]         = useState([]);
  const [mySubmission, setMySubmission]       = useState(null);
  const [answerText, setAnswerText]           = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [modalTab, setModalTab]               = useState('problem'); // 'problem'|'answer'|'discuss'

  const auth = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  /* ── fetch problems ─────────────────────────────────────────── */
  const fetchItems = async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (subject)    p.append('subject', subject);
      if (chapter)    p.append('chapter', chapter);
      if (difficulty) p.append('difficulty', difficulty);
      if (q)          p.append('q', q);
      p.append('page', page); p.append('limit', limit);
      const res = await fetch(`${API}/api/alcove/posts?${p}`, { headers: auth() });
      if (!res.ok) throw new Error('Failed to load posts');
      const data = await res.json();
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (e) { setError(e.message || 'Error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [subject, chapter, difficulty, q, page]);

  /* ── curriculum for the "Ask a Question" form (this student's class, current session) ── */
  useEffect(() => {
    if (!showCreateProblem || curriculumStatus !== 'idle') return;
    setCurriculumStatus('loading');
    (async () => {
      try {
        const res = await fetch(`${API}/api/lesson-plans/student/smart-learning-map`, { headers: auth() });
        if (!res.ok) throw new Error('Failed to load curriculum');
        const data = await res.json();
        const list = Array.isArray(data?.subjects) ? data.subjects : [];
        setCurriculumSubjects(list);
        setCurriculumStatus(list.length ? 'ready' : 'empty');
      } catch {
        setCurriculumStatus('error');
      }
    })();
  }, [showCreateProblem, curriculumStatus]);

  const selectedCurriculumSubject = useMemo(
    () => curriculumSubjects.find((s) => s.title === newProblem.subject) || null,
    [curriculumSubjects, newProblem.subject]
  );
  const curriculumChapterOptions = useMemo(() => {
    if (!selectedCurriculumSubject) return [];
    const options = [];
    (selectedCurriculumSubject.chapters || []).forEach((chapter) => {
      if (chapter?.title) options.push(chapter.title);
      (chapter?.topics || []).forEach((topic) => {
        if (topic?.title) options.push(topic.title);
      });
    });
    return [...new Set(options)];
  }, [selectedCurriculumSubject]);

  const uniqueSubjects = useMemo(() => [...new Set(items.map(i => i.subject))].filter(Boolean), [items]);
  const uniqueChapters = useMemo(() => [...new Set(items.map(i => i.chapter))].filter(Boolean), [items]);
  const totalPages     = Math.max(1, Math.ceil(total / limit));
  const unansweredCount = useMemo(() => items.filter((i) => i.hasAnswered === false).length, [items]);
  const visibleItems   = useMemo(
    () => (onlyUnanswered ? items.filter((i) => i.hasAnswered === false) : items),
    [items, onlyUnanswered]
  );

  /* ── open post modal ────────────────────────────────────────── */
  const openPost = async (post) => {
    let selectedPost = post;
    setSelected(post); setComments([]); setSubmissions([]);
    setMySubmission(null); setAnswerText('');
    setModalTab('problem');
    try {
      const viewRes = await fetch(`${API}/api/alcove/posts/${post._id}/view`, {
        method: 'POST',
        headers: auth(),
      });
      if (viewRes.ok) {
        const data = await viewRes.json();
        selectedPost = { ...post, viewCount: Number(data.viewCount) || 0 };
        setSelected(selectedPost);
        const updateView = (entry) => (
          entry._id === post._id
            ? { ...entry, viewCount: Number(data.viewCount) || 0 }
            : entry
        );
        setItems((prev) => prev.map(updateView));
        setWallPosts((prev) => prev.map(updateView));
      }

      const [cRes, sRes] = await Promise.all([
        fetch(`${API}/api/alcove/posts/${post._id}/comments`,    { headers: auth() }),
        fetch(`${API}/api/alcove/posts/${post._id}/submissions`, { headers: auth() }),
      ]);
      if (cRes.ok) setComments(await cRes.json());
      if (sRes.ok) {
        const subs = await sRes.json();
        setSubmissions(subs);
        const myId = (() => { try { return JSON.parse(localStorage.getItem('user'))?.id; } catch { return null; } })();
        const mine = subs.find(s => s.studentId === myId);
        if (mine) { setMySubmission(mine); setAnswerText(mine.answerText); }
      }
    } catch {
      setSelected(selectedPost);
    }
  };

  /* ── submit comment ─────────────────────────────────────────── */
  const submitComment = async () => {
    if (!selected || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`${API}/api/alcove/posts/${selected._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ text: commentText }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const newComment = await res.json();
      setComments(p => [...p, newComment]);
      setCommentText('');
    } catch (e) {
      toast.error(`Comment failed: ${e.message}`);
    } finally { setPostingComment(false); }
  };

  /* ── submit answer ──────────────────────────────────────────── */
  const submitAnswer = async () => {
    if (!selected || !answerText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/alcove/posts/${selected._id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ answerText }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setMySubmission(data.submission);
      const r = await fetch(`${API}/api/alcove/posts/${selected._id}/submissions`, { headers: auth() });
      if (r.ok) setSubmissions(await r.json());
      toast.success('Answer submitted — your answer has been saved.');
    } catch (e) {
      toast.error(`Submission failed: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  const submitStudentProblem = async () => {
    if (!newProblem.title.trim() || !newProblem.subject.trim() || !newProblem.chapter.trim() || !newProblem.problemText.trim()) {
      toast.error('Please fill in title, subject, chapter and problem.');
      return;
    }
    setCreatingProblem(true);
    try {
      const res = await fetch(`${API}/api/alcove/posts/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          title: newProblem.title.trim(),
          subject: newProblem.subject.trim(),
          chapter: newProblem.chapter.trim(),
          difficulty: newProblem.difficulty,
          problemText: newProblem.problemText.trim(),
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to post problem');
      }
      toast.success('Problem posted — now visible to teachers and students.');
      setNewProblem({ title: '', subject: '', chapter: '', difficulty: 'medium', problemText: '' });
      setSubjectIsOther(false);
      setChapterIsOther(false);
      setShowCreateProblem(false);
      setPage(1);
      fetchItems();
    } catch (e) {
      toast.error(`Post failed: ${e.message || 'Could not post your problem'}`);
    } finally {
      setCreatingProblem(false);
    }
  };

  /* ── wall ───────────────────────────────────────────────────── */
  const fetchWallPosts = async () => {
    setWallLoading(true); setWallError(null);
    try {
      const res = await fetch(`${API}/api/alcove/posts?page=1&limit=25`, { headers: auth() });
      if (!res.ok) throw new Error('Failed to load wall');
      const data = await res.json();
      setWallPosts(data.items || []);
    } catch (e) { setWallError(e.message); }
    finally { setWallLoading(false); }
  };

  useEffect(() => { if (viewMode === 'wall') fetchWallPosts(); }, [viewMode]);

  const handleLikePost = async (postId) => {
    try {
      const res = await fetch(`${API}/api/alcove/posts/${postId}/like`, {
        method: 'POST',
        headers: auth(),
      });
      if (!res.ok) throw new Error('Failed to update like');
      const data = await res.json();
      const applyLike = (entry) => (
        entry._id === postId
          ? { ...entry, likeCount: Number(data.likeCount) || 0, isLiked: Boolean(data.liked) }
          : entry
      );
      setItems((prev) => prev.map(applyLike));
      setWallPosts((prev) => prev.map(applyLike));
      setSelected((prev) => (prev && prev._id === postId
        ? { ...prev, likeCount: Number(data.likeCount) || 0, isLiked: Boolean(data.liked) }
        : prev));
    } catch (e) {
      toast.error(`Like failed: ${e.message || 'Could not update like'}`);
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero header ── */}
      <div className="bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 px-5 py-7 shadow-md shadow-amber-200/60 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-8 h-32 w-32 rounded-full bg-white/[0.07]" />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 border border-white/30">
                  <Sparkles size={18} className="text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">The Wall</h1>
              </div>
              <p className="text-sm text-white/75 max-w-md">
                {viewMode === 'problems'
                  ? 'Extra practice problems from your teachers and classmates — pick one, answer it, and see how others solved it.'
                  : "Everything your teachers have shared recently. Like, comment, or jump in and answer."}
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              {[
                { label: 'Problems', value: total || '—', icon: FileText },
                { label: 'This Page', value: items.length || '—', icon: Award },
                { label: 'Discussions', value: Math.floor(total * 0.3) || '—', icon: MessageSquare },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/15 border border-white/25 px-3 py-2 text-center backdrop-blur-sm min-w-17.5">
                  {React.createElement(stat.icon, { size: 13, className: 'text-white/70 mx-auto mb-0.5' })}
                  <p className="text-lg font-black text-white leading-none">{stat.value}</p>
                  <p className="text-[10px] text-white/65 font-medium mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="mt-5 inline-flex rounded-xl bg-white/15 border border-white/25 p-1 gap-1 backdrop-blur-sm">
            {[
              { id: 'problems', label: 'Problem Library', icon: BookOpen },
              { id: 'wall',     label: "Teacher's Wall",  icon: MessageSquare },
            ].map((entry) => (
              <button
                key={entry.id}
                onClick={() => setViewMode(entry.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200
                  ${viewMode === entry.id ? 'bg-white text-amber-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                {React.createElement(entry.icon, { size: 14 })}
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── How this works ── */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(viewMode === 'problems'
            ? [
                { icon: BookOpen,  text: 'Pick a problem below to open it' },
                { icon: PenLine,   text: 'Write and submit your own answer' },
                { icon: Users,     text: 'Compare with peers, ask questions' },
              ]
            : [
                { icon: MessageSquare, text: 'Browse what teachers have shared' },
                { icon: Heart,         text: 'Like or comment on a post' },
                { icon: PenLine,       text: "Open one to answer it yourself" },
              ]
          ).map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-black text-amber-700">{i + 1}</span>
              {React.createElement(step.icon, { size: 14, className: 'text-slate-400 shrink-0' })}
              <p className="text-xs font-semibold text-slate-600 leading-snug">{step.text}</p>
            </div>
          ))}
        </div>

        {/* ── Filter bar (problems) ── */}
        {viewMode === 'problems' && (
          <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={e => { setPage(1); setQ(e.target.value); }}
                  placeholder="Search problems, topics…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition"
                />
              </div>

              {/* Subject */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-35">
                <BookOpen size={13} className="text-amber-500 shrink-0" />
                <select value={subject} onChange={e => { setPage(1); setSubject(e.target.value); }}
                  className="flex-1 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Chapter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-35">
                <Layers size={13} className="text-orange-500 shrink-0" />
                <select value={chapter} onChange={e => { setPage(1); setChapter(e.target.value); }}
                  className="flex-1 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">
                  <option value="">All Chapters</option>
                  {uniqueChapters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Difficulty */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-32.5">
                <TrendingUp size={13} className="text-violet-500 shrink-0" />
                <select value={difficulty} onChange={e => { setPage(1); setDifficulty(e.target.value); }}
                  className="flex-1 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">
                  <option value="">All Levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Clear filters */}
              {(subject || chapter || difficulty || q) && (
                <button
                  onClick={() => { setSubject(''); setChapter(''); setDifficulty(''); setQ(''); setPage(1); }}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition shrink-0"
                >
                  <X size={12} /> Clear
                </button>
              )}

              <button
                onClick={() => setShowCreateProblem((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition shrink-0 shadow-sm ${
                  showCreateProblem
                    ? 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {showCreateProblem ? <><X size={13} /> Close</> : <><PlusCircle size={13} /> Ask a Question</>}
              </button>
            </div>

            {/* Unanswered-only toggle */}
            {items.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setOnlyUnanswered((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition ${
                    onlyUnanswered
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                  }`}
                >
                  <ListChecks size={12} />
                  {onlyUnanswered ? 'Showing: Not answered yet' : `Show only what I haven't answered (${unansweredCount})`}
                </button>
              </div>
            )}

            {showCreateProblem && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Ask a Question</p>
                  <p className="text-[11px] text-indigo-400 mt-0.5">Stuck on something? Post it here so teachers and classmates can help.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={newProblem.title}
                    onChange={(e) => setNewProblem((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Problem title"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  {/* Subject — populated from this student's own class curriculum */}
                  {curriculumStatus === 'ready' && !subjectIsOther ? (
                    <select
                      value={newProblem.subject}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '__other__') {
                          setSubjectIsOther(true);
                          setNewProblem((prev) => ({ ...prev, subject: '', chapter: '' }));
                          return;
                        }
                        setNewProblem((prev) => ({ ...prev, subject: value, chapter: '' }));
                        setChapterIsOther(false);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Select subject…</option>
                      {curriculumSubjects.map((s) => (
                        <option key={s.key || s.title} value={s.title}>{s.title}</option>
                      ))}
                      <option value="__other__">Other (type manually)</option>
                    </select>
                  ) : (
                    <input
                      value={newProblem.subject}
                      onChange={(e) => setNewProblem((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder={curriculumStatus === 'loading' ? 'Loading your subjects…' : 'Subject'}
                      disabled={curriculumStatus === 'loading'}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  )}

                  {/* Chapter / topic — filtered to the selected subject */}
                  {curriculumStatus === 'ready' && !subjectIsOther && !chapterIsOther ? (
                    <select
                      value={newProblem.chapter}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '__other__') {
                          setChapterIsOther(true);
                          setNewProblem((prev) => ({ ...prev, chapter: '' }));
                          return;
                        }
                        setNewProblem((prev) => ({ ...prev, chapter: value }));
                      }}
                      disabled={!newProblem.subject}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">{newProblem.subject ? 'Select chapter / topic…' : 'Pick a subject first'}</option>
                      {curriculumChapterOptions.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                      {newProblem.subject && <option value="__other__">Other (type manually)</option>}
                    </select>
                  ) : (
                    <input
                      value={newProblem.chapter}
                      onChange={(e) => setNewProblem((prev) => ({ ...prev, chapter: e.target.value }))}
                      placeholder="Chapter / topic"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  )}
                  <select
                    value={newProblem.difficulty}
                    onChange={(e) => setNewProblem((prev) => ({ ...prev, difficulty: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                {(curriculumStatus === 'empty' || curriculumStatus === 'error') && (
                  <p className="text-[11px] text-indigo-400">
                    We couldn&apos;t find published subjects for your class yet, so type them in manually.
                  </p>
                )}
                <textarea
                  value={newProblem.problemText}
                  onChange={(e) => setNewProblem((prev) => ({ ...prev, problemText: e.target.value }))}
                  placeholder="Describe your problem..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={submitStudentProblem}
                    disabled={creatingProblem}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${creatingProblem
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {creatingProblem ? 'Posting…' : 'Post Problem'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Wall toolbar ── */}
        {viewMode === 'wall' && (
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                <MessageSquare size={14} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Teacher&apos;s Discussion Wall</p>
                <p className="text-[11px] text-slate-400">{wallPosts.length} posts loaded</p>
              </div>
            </div>
            <button
              onClick={fetchWallPosts}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition"
            >
              <RefreshCw size={12} className={wallLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {(error || wallError) && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            {error || wallError}
          </div>
        )}

        {/* ══════════════════════════════
            PROBLEM CARDS
        ══════════════════════════════ */}
        {viewMode === 'problems' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-60 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}

              {!loading && visibleItems.map((p) => (
                <div
                  key={p._id}
                  className="group flex flex-col rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                >
                  {/* Card accent top */}
                  <div className={`h-1.5 w-full ${p.hasAnswered ? 'bg-linear-to-r from-emerald-400 to-teal-500' : 'bg-linear-to-r from-amber-400 to-orange-500'}`} />

                  <div className="flex flex-col flex-1 p-5">
                    {/* Status */}
                    {typeof p.hasAnswered === 'boolean' && (
                      <div className="mb-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          p.hasAnswered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {p.hasAnswered ? <><Check size={9} /> You answered this</> : <><CircleHelp size={9} /> Not answered yet</>}
                        </span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {p.subject && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">{p.subject}</span>
                      )}
                      {p.chapter && (
                        <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[10px] font-bold text-orange-700">{p.chapter}</span>
                      )}
                      {p.difficulty && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${diffBadge(p.difficulty)}`}>{p.difficulty}</span>
                      )}
                      {p.highlighted && (
                        <span className="ml-auto flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-300 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                          <Star size={9} className="fill-yellow-500 text-yellow-500" /> Featured
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-black text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-amber-700 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-2">
                      {p.authorName || 'Unknown'}
                      {String(p.authorType || '').toLowerCase() === 'student' && (p.authorGrade || p.authorSection) && (
                        <span className="ml-1 font-semibold text-indigo-700">
                          • Class {p.authorGrade || '-'} • Sec {p.authorSection || '-'}
                        </span>
                      )}
                    </p>

                    {/* Problem preview */}
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 flex-1">
                      {p.problemText}
                    </p>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar size={10} />
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => openPost(p)}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500"
                      >
                        {p.hasAnswered ? 'View my answer' : 'Answer now'} <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!loading && items.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <BookOpen size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No problems found</p>
                  <p className="text-xs text-slate-400">Try adjusting your filters</p>
                </div>
              )}

              {!loading && items.length > 0 && visibleItems.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                    <Check size={28} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">You&apos;re all caught up!</p>
                  <p className="text-xs text-slate-400">You&apos;ve answered every problem on this page.</p>
                  <button
                    onClick={() => setOnlyUnanswered(false)}
                    className="mt-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition"
                  >
                    Show all problems again
                  </button>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-sm shadow-amber-200">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════
            WALL POSTS
        ══════════════════════════════ */}
        {viewMode === 'wall' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {wallLoading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}

            {!wallLoading && wallPosts.map((post) => (
              <div key={post._id} className="rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Accent */}
                <div className="h-1 w-full bg-linear-to-r from-indigo-400 to-violet-500" />

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={post.authorName || 'T'} size="md" gradient="from-indigo-400 to-violet-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-800">{post.authorName || 'Teacher'}</span>
                        {String(post.authorType || '').toLowerCase() === 'student' && (post.authorGrade || post.authorSection) && (
                          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            Class {post.authorGrade || '-'} • Sec {post.authorSection || '-'}
                          </span>
                        )}
                        {post.subject && (
                          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{post.subject}</span>
                        )}
                        {post.difficulty && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${diffBadge(post.difficulty)}`}>{post.difficulty}</span>
                        )}
                        <span className="ml-auto text-[11px] text-slate-400">{timeAgo(post.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">{post.chapter || ''}</p>
                    </div>
                  </div>

                  {post.hasAnswered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 mb-2">
                      <Check size={9} /> You answered this
                    </span>
                  )}

                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-4 mb-4">{post.problemText}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLikePost(post._id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${post.isLiked
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Heart size={11} className={post.isLiked ? 'fill-current' : ''} /> {post.likeCount || 0} Likes
                      </button>
                      <button
                        onClick={() => openPost(post)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                      >
                        <MessageSquare size={11} /> {post.commentCount || 0} Comments
                      </button>
                      <button
                        onClick={() => openPost(post)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-100 transition"
                      >
                        <Users size={11} /> {post.submissionCount || 0} Answers
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Eye size={11} /> {post.viewCount || 0}
                      </span>
                      <button
                        onClick={() => openPost(post)}
                        className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800 transition"
                      >
                        {post.hasAnswered ? 'View my answer' : 'Answer'} <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!wallLoading && wallPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <MessageSquare size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-600">No posts yet</p>
                <p className="text-xs text-slate-400">Check back later for teacher posts</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL
      ══════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelected(null)}>
          <div
            className="relative bg-white w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-linear-to-br from-amber-400 to-orange-500 px-5 py-5 relative overflow-hidden shrink-0">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-white leading-snug line-clamp-2">{selected.title}</h3>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 hover:bg-white/35 transition border border-white/30">
                    <X size={14} className="text-white" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.authorName && (
                    <span className="rounded-full bg-white/25 border border-white/35 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {selected.authorName}
                      {String(selected.authorType || '').toLowerCase() === 'student' && (selected.authorGrade || selected.authorSection)
                        ? ` • Class ${selected.authorGrade || '-'} • Sec ${selected.authorSection || '-'}`
                        : ''}
                    </span>
                  )}
                  {selected.subject && (
                    <span className="rounded-full bg-white/25 border border-white/35 px-2.5 py-0.5 text-[10px] font-bold text-white">{selected.subject}</span>
                  )}
                  {selected.chapter && (
                    <span className="rounded-full bg-white/25 border border-white/35 px-2.5 py-0.5 text-[10px] font-bold text-white">{selected.chapter}</span>
                  )}
                  {selected.difficulty && (
                    <span className="rounded-full bg-white/25 border border-white/35 px-2.5 py-0.5 text-[10px] font-bold text-white capitalize">{selected.difficulty}</span>
                  )}
                  {selected.highlighted && (
                    <span className="rounded-full bg-yellow-300/80 border border-yellow-400/50 px-2.5 py-0.5 text-[10px] font-bold text-yellow-900 flex items-center gap-1">
                      <Star size={9} className="fill-yellow-700" /> Featured
                    </span>
                  )}
                </div>
              </div>

              {/* Tab bar */}
              <div className="mt-3 flex gap-1 bg-white/15 rounded-xl p-1">
                {[
                  { id: 'problem', label: 'Problem',    count: null, done: false },
                  { id: 'answer',  label: mySubmission ? 'My Answer' : 'Write Answer', count: null, done: Boolean(mySubmission) },
                  { id: 'discuss', label: 'Discussion', count: comments.length, done: false },
                  { id: 'peers',   label: 'Peers',      count: submissions.length, done: false },
                ].map(({ id, label, count, done }) => (
                  <button
                    key={id}
                    onClick={() => setModalTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-all
                      ${modalTab === id ? 'bg-white text-amber-700 shadow-sm' : 'text-white/75 hover:text-white hover:bg-white/10'}`}
                  >
                    {label}
                    {done && (
                      <Check size={10} className={modalTab === id ? 'text-emerald-600' : 'text-emerald-200'} />
                    )}
                    {count !== null && count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${modalTab === id ? 'bg-amber-100 text-amber-700' : 'bg-white/25 text-white'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Problem + Solution tab ── */}
              {modalTab === 'problem' && (
                <div className="p-5 space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-2">Problem Statement</p>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{selected.problemText}</p>
                  </div>
                  {selected.solutionText && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 mb-2">Expert Solution</p>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{selected.solutionText}</p>
                    </div>
                  )}
                  <button
                    onClick={() => setModalTab('answer')}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                      mySubmission
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200'
                    }`}
                  >
                    {mySubmission ? <><Check size={14} /> You&apos;ve answered — view or edit it</> : <><PenLine size={14} /> Ready? Write your answer</>}
                  </button>
                </div>
              )}

              {/* ── My Answer tab ── */}
              {modalTab === 'answer' && (
                <div className="p-5">
                  {mySubmission ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                          <Check size={13} className="text-emerald-600" />
                          Submitted {new Date(mySubmission.submittedAt).toLocaleString()}
                        </div>
                        <button
                          onClick={() => { setMySubmission(null); setAnswerText(''); }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{mySubmission.answerText}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Write your answer</p>
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Type your answer here…"
                        rows={8}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 resize-none transition"
                      />
                      <button
                        onClick={submitAnswer}
                        disabled={submitting || !answerText.trim()}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all
                          ${submitting || !answerText.trim()
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200'}`}
                      >
                        {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit Answer</>}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Discussion tab ── */}
              {modalTab === 'discuss' && (
                <div className="p-5 flex flex-col gap-4">
                  {/* Comment list */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <MessageSquare size={24} className="text-slate-300" />
                      <p className="text-xs text-slate-400">No comments yet — be the first!</p>
                    </div>
                  ) : comments.map(c => {
                    const byId = c?.authorId && selected?.authorUserId && String(c.authorId) === String(selected.authorUserId);
                    const byType = String(c?.authorType || '').toLowerCase() === String(selected?.authorType || '').toLowerCase();
                    const byName = String(c?.authorName || '').trim().toLowerCase() === String(selected?.authorName || '').trim().toLowerCase();
                    const isPostAuthor = (byId && byType) || byName;
                    return (
                      <div key={c._id} className="flex items-start gap-3">
                        <Avatar name={c.authorName || 'A'} size="sm" gradient="from-slate-400 to-slate-600" />
                        <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-slate-800">
                              {c.authorName || 'Anonymous'}
                              {isPostAuthor && <span className="ml-1 text-[10px] text-amber-600">(Author)</span>}
                            </span>
                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  {/* Comment input */}
                  <div className="flex gap-2 border-t border-slate-100 pt-3">
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                      placeholder="Share a thought or question…"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition"
                    />
                    <button
                      onClick={submitComment}
                      disabled={postingComment || !commentText.trim()}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all shrink-0
                        ${postingComment || !commentText.trim()
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'}`}
                    >
                      {postingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {postingComment ? '' : 'Post'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Peers tab ── */}
              {modalTab === 'peers' && (
                <div className="p-5">
                  {submissions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Users size={24} className="text-slate-300" />
                      <p className="text-xs text-slate-400">No submissions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map(sub => (
                        <div key={sub._id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                          <Avatar name={sub.studentName} size="sm" gradient="from-violet-400 to-purple-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-xs font-black text-slate-800">{sub.studentName}</span>
                              {sub.grade && sub.section && (
                                <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                  {sub.grade} – {sub.section}
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-slate-400">
                                {new Date(sub.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{sub.answerText}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
