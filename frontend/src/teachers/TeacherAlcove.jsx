import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Search as SearchIcon,
  MessageSquare,
  Edit3,
  Eye,
  Brain,
  CheckCircle2,
  Bookmark,
  X,
  Loader2,
  Sparkles,
  UserCheck,
  Home,
  Compass,
  Pencil,
  BookOpen,
  Folder,
  ChevronDown,
  Monitor,
  Calculator,
  FlaskConical,
  BookA,
  Landmark,
  LayoutGrid,
  Bell,
  Plus,
  Image as ImageIcon,
  Link2,
  FileText,
  BarChart3,
  ThumbsUp,
  Send,
  Star,
  Activity,
  Users,
  ShieldCheck,
  Check,
  ArrowRight,
  ArrowUpDown,
  GraduationCap,
  MessageSquareText
} from 'lucide-react';
import Swal from 'sweetalert2';

const SUBJECTS = [
  { name: 'Computer', icon: Monitor, tone: 'bg-blue-50 text-blue-600' },
  { name: 'Mathematics', icon: Calculator, tone: 'bg-rose-50 text-rose-500' },
  { name: 'Science', icon: FlaskConical, tone: 'bg-emerald-50 text-emerald-600' },
  { name: 'English', icon: BookA, tone: 'bg-violet-50 text-violet-600' },
  { name: 'Social Science', icon: Landmark, tone: 'bg-orange-50 text-orange-500' },
];

const GUIDELINES = ['Be respectful and helpful', 'Share accurate information', 'Use clear explanations', 'Give credit where applicable'];

const readUserName = () => {
  for (const key of ['teacherUser', 'user', 'userData']) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      const name = parsed?.name || parsed?.fullName || parsed?.username;
      if (name) return String(name);
    } catch {
      // ignore malformed storage
    }
  }
  return 'Teacher';
};

const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || 'T') + (parts[1]?.[0] || '')).toUpperCase();
};

const API = import.meta.env.VITE_API_URL;

const emptyProblem = {
  title: '',
  subject: '',
  chapter: '',
  difficulty: 'medium',
  problemText: '',
  solutionText: '',
  hints: [''],
  tags: [],
  estimatedTime: 30
};

const TeacherAlcove = () => {
  const [problems, setProblems] = useState([]);
  const [myProblems, setMyProblems] = useState([]);
  const [viewMode, setViewMode] = useState('wall'); // 'wall' | 'my-problems' | 'create'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newProblem, setNewProblem] = useState(emptyProblem);
  const [editingProblemId, setEditingProblemId] = useState(null);
  
  const [filters, setFilters] = useState({
    subject: '',
    difficulty: '',
    search: ''
  });
  const [detailProblem, setDetailProblem] = useState(null);
  const [detailComments, setDetailComments] = useState([]);
  const [detailViewers, setDetailViewers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCommentText, setDetailCommentText] = useState('');
  const [postingDetailComment, setPostingDetailComment] = useState(false);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const mapApiPostToUi = (post) => {
    const teacherName = post?.authorName || post?.author?.name || post?.author?.username || 'Teacher';
    const nameParts = teacherName.trim().split(/\s+/).filter(Boolean);
    const teacherAvatar = (nameParts[0]?.[0] || 'T') + (nameParts[1]?.[0] || '');

    return {
      id: post._id,
      title: post.title || '',
      teacherName,
      authorUserId: post?.authorUserId || '',
      authorName: post?.authorName || teacherName,
      authorType: post?.authorType || 'teacher',
      authorGrade: post?.authorGrade || '',
      authorSection: post?.authorSection || '',
      teacherAvatar: teacherAvatar.toUpperCase(),
      subject: post.subject || '',
      chapter: post.chapter || '',
      difficulty: post.difficulty || 'medium',
      problemText: post.problemText || '',
      solutionText: post.solutionText || '',
      hints: [],
      tags: Array.isArray(post.tags) ? post.tags : [],
      estimatedTime: Number(post.estimatedTime) || 30,
      timestamp: post.createdAt ? new Date(post.createdAt) : new Date(),
      likes: Number(post.likeCount) || 0,
      comments: Number(post.commentCount) || 0,
      saves: 0,
      isLiked: Boolean(post.isLiked),
      isSaved: false,
      views: Number(post.viewCount) || 0,
      authorPhoto: post?.authorPhoto || ''
    };
  };

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      if (filters.search) params.append('q', filters.search);
      params.append('page', '1');
      params.append('limit', '60');

      const res = await fetch(`${API}/api/alcove/posts?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load problems');
      const data = await res.json();
      setProblems((data.items || []).map(mapApiPostToUi));
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Load failed',
        text: err.message || 'Could not load problem wall',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMyProblems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('mine', 'true');
      params.append('page', '1');
      params.append('limit', '80');
      const res = await fetch(`${API}/api/alcove/posts?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load your problems');
      const data = await res.json();
      setMyProblems((data.items || []).map(mapApiPostToUi));
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Load failed',
        text: err.message || 'Could not load your problems',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'my-problems') {
      fetchMyProblems();
      return;
    }
    fetchProblems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filters.subject, filters.difficulty, filters.search]);

  const handleCreateProblem = async () => {
    if (!newProblem.title || !newProblem.subject || !newProblem.problemText) return;

    setSubmitting(true);
    try {
      const payload = {
        title: newProblem.title.trim(),
        subject: newProblem.subject.trim(),
        chapter: (newProblem.chapter || 'General').trim(),
        difficulty: newProblem.difficulty,
        problemText: newProblem.problemText.trim(),
        solutionText: (newProblem.solutionText || 'Solution will be updated soon.').trim(),
        tags: (newProblem.tags || []).filter(Boolean).map((tag) => String(tag).trim())
      };

      const url = editingProblemId
        ? `${API}/api/alcove/posts/${editingProblemId}`
        : `${API}/api/alcove/posts`;
      const method = editingProblemId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Save failed');
      }

      await Swal.fire({
        icon: 'success',
        title: editingProblemId ? 'Problem updated' : 'Problem created',
        timer: 1200,
        showConfirmButton: false,
      });
      setNewProblem(emptyProblem);
      setEditingProblemId(null);
      setViewMode('wall');
      fetchProblems();
      fetchMyProblems();
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Save failed',
        text: err.message || 'Could not save problem',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeProblem = async (problemId) => {
    try {
      const res = await fetch(`${API}/api/alcove/posts/${problemId}/like`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Like failed');
      }
      const data = await res.json();
      const applyLike = (problem) => (
        problem.id === problemId
          ? { ...problem, isLiked: Boolean(data.liked), likes: Number(data.likeCount) || 0 }
          : problem
      );
      setProblems((prev) => prev.map(applyLike));
      setMyProblems((prev) => prev.map(applyLike));
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Like failed',
        text: err.message || 'Could not update like',
      });
    }
  };

  const handleSaveProblem = (problemId) => {
    setProblems(prev => prev.map(problem => 
      problem.id === problemId 
        ? { ...problem, isSaved: !problem.isSaved, saves: problem.isSaved ? problem.saves - 1 : problem.saves + 1 }
        : problem
    ));
  };

  const openProblemDetails = async (problem) => {
    setDetailProblem(problem);
    setDetailComments([]);
    setDetailViewers([]);
    setDetailCommentText('');
    setDetailLoading(true);
    try {
      const [postRes, commentsRes, viewersRes] = await Promise.all([
        fetch(`${API}/api/alcove/posts/${problem.id}`, { headers: authHeaders() }),
        fetch(`${API}/api/alcove/posts/${problem.id}/comments`, { headers: authHeaders() }),
        fetch(`${API}/api/alcove/posts/${problem.id}/viewers`, { headers: authHeaders() }),
      ]);

      if (postRes.ok) {
        const post = await postRes.json();
        setDetailProblem((prev) => prev ? {
          ...prev,
          comments: Number(post.commentCount) || 0,
          views: Number(post.viewCount) || 0,
          likes: Number(post.likeCount) || 0,
        } : prev);
      }
      if (commentsRes.ok) {
        const comments = await commentsRes.json();
        setDetailComments(Array.isArray(comments) ? comments : []);
      }
      if (viewersRes.ok) {
        const data = await viewersRes.json();
        setDetailViewers(Array.isArray(data?.viewers) ? data.viewers : []);
      }
    } catch {
      setDetailComments([]);
      setDetailViewers([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitDetailComment = async () => {
    if (!detailProblem || !detailCommentText.trim()) return;
    setPostingDetailComment(true);
    try {
      const res = await fetch(`${API}/api/alcove/posts/${detailProblem.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ text: detailCommentText.trim() }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to post comment');
      }
      const newComment = await res.json();
      setDetailComments((prev) => [...prev, newComment]);
      setDetailCommentText('');
      setProblems((prev) => prev.map((p) => (
        p.id === detailProblem.id ? { ...p, comments: (Number(p.comments) || 0) + 1 } : p
      )));
      setMyProblems((prev) => prev.map((p) => (
        p.id === detailProblem.id ? { ...p, comments: (Number(p.comments) || 0) + 1 } : p
      )));
      setDetailProblem((prev) => (prev ? { ...prev, comments: (Number(prev.comments) || 0) + 1 } : prev));
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Comment failed',
        text: err.message || 'Could not post comment',
      });
    } finally {
      setPostingDetailComment(false);
    }
  };

  const startEditProblem = (problem) => {
    setEditingProblemId(problem.id);
    setNewProblem({
      title: problem.title || '',
      subject: problem.subject || '',
      chapter: problem.chapter || '',
      difficulty: problem.difficulty || 'medium',
      problemText: problem.problemText || '',
      solutionText: problem.solutionText || '',
      hints: Array.isArray(problem.hints) && problem.hints.length ? problem.hints : [''],
      tags: Array.isArray(problem.tags) ? problem.tags : [],
      estimatedTime: Number(problem.estimatedTime) || 30,
    });
    setViewMode('create');
  };

  const handleDeleteProblem = async (problemId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete problem?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API}/api/alcove/posts/${problemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Delete failed');
      }
      setProblems((prev) => prev.filter((problem) => problem.id !== problemId));
      setMyProblems((prev) => prev.filter((problem) => problem.id !== problemId));
      await Swal.fire({
        icon: 'success',
        title: 'Problem deleted',
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: err.message || 'Could not delete problem',
      });
    }
  };

  const addHint = () => {
    setNewProblem(prev => ({
      ...prev,
      hints: [...prev.hints, '']
    }));
  };

  const updateHint = (index, value) => {
    setNewProblem(prev => ({
      ...prev,
      hints: prev.hints.map((hint, i) => i === index ? value : hint)
    }));
  };

  const removeHint = (index) => {
    setNewProblem(prev => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index)
    }));
  };

  const addTag = (tag) => {
    if (tag && !newProblem.tags.includes(tag)) {
      setNewProblem(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setNewProblem(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const [navView] = useState('home'); // 'home' | 'discover' | 'mine' | 'saved' | 'library'
  const [feedTab, setFeedTab] = useState('all'); // 'all' | 'questions' | 'solutions' | 'following'
  const [sortBy, setSortBy] = useState('latest');
  const [composerText, setComposerText] = useState('');
  const userName = useMemo(readUserName, []);

  const hubStats = useMemo(() => {
    const source = viewMode === 'my-problems' ? myProblems : problems;
    return {
      discussions: source.length,
      answers: source.reduce((sum, item) => sum + Number(item.comments || 0), 0),
      active: source.filter((item) => Number(item.comments || 0) > 0).length,
      views: source.reduce((sum, item) => sum + Number(item.views || 0), 0),
    };
  }, [myProblems, problems, viewMode]);

  const subjectCounts = useMemo(() => {
    const counts = new Map();
    problems.forEach((problem) => {
      const key = String(problem.subject || '').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return SUBJECTS.map((subject) => ({ ...subject, count: counts.get(subject.name.toLowerCase()) || 0 }));
  }, [problems]);

  const popularTags = useMemo(() => {
    const counts = new Map();
    problems.forEach((problem) => {
      [problem.chapter, ...(problem.tags || [])].filter(Boolean).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  }, [problems]);

  const activeProblems = useMemo(() => {
    let list = viewMode === 'my-problems' ? myProblems : problems;
    if (navView === 'saved') list = list.filter((item) => item.isSaved);
    if (feedTab === 'questions') list = list.filter((item) => !item.solutionText);
    if (feedTab === 'solutions') list = list.filter((item) => item.solutionText);
    if (feedTab === 'following') list = list.filter((item) => item.isLiked || item.isSaved);
    const sorted = [...list];
    if (sortBy === 'popular' || navView === 'discover') {
      sorted.sort((a, b) => (b.likes + b.comments * 2 + b.views) - (a.likes + a.comments * 2 + a.views));
    } else {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    }
    return sorted;
  }, [viewMode, myProblems, problems, navView, feedTab, sortBy]);

  const openCreate = (title = '') => {
    setEditingProblemId(null);
    setNewProblem({ ...emptyProblem, title });
    setViewMode('create');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Feed */}
        <main className="min-w-0 space-y-3">
          <AnimatePresence mode="wait">
            {viewMode === 'create' ? (
              <Motion.div key="editor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <KnowledgeEditor
                  newProblem={newProblem}
                  setNewProblem={setNewProblem}
                  editingProblemId={editingProblemId}
                  submitting={submitting}
                  onCancel={() => { setEditingProblemId(null); setNewProblem(emptyProblem); setViewMode(navView === 'mine' || navView === 'library' ? 'my-problems' : 'wall'); }}
                  onSubmit={handleCreateProblem}
                  addHint={addHint}
                  updateHint={updateHint}
                  removeHint={removeHint}
                  addTag={addTag}
                  removeTag={removeTag}
                />
              </Motion.div>
            ) : (
              <Motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                {/* Composer */}
                <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex gap-3">
                    <Avatar initials={initialsOf(userName)} size="lg" />
                    <div className="min-w-0 flex-1">
                      <input
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter' && composerText.trim()) { openCreate(composerText.trim()); setComposerText(''); } }}
                        placeholder="Share a question, idea, or solution..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-300"
                      />
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {[{ label: 'Photo', icon: ImageIcon }, { label: 'Link', icon: Link2 }, { label: 'File', icon: FileText }, { label: 'Poll', icon: BarChart3 }].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button key={item.label} type="button" onClick={() => openCreate(composerText.trim())} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                              <Icon size={14} />{item.label}
                            </button>
                          );
                        })}
                        <button type="button" onClick={() => { openCreate(composerText.trim()); setComposerText(''); }} className="ml-auto rounded-lg bg-blue-600 px-5 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700">Post</button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Tabs */}
                <div className="flex items-center justify-between border-b border-slate-200 px-1">
                  <div className="flex gap-1 overflow-x-auto">
                    {[{ id: 'all', label: 'All Posts' }, { id: 'questions', label: 'Questions' }, { id: 'solutions', label: 'Solutions' }, { id: 'following', label: 'Following' }].map((tab) => (
                      <button key={tab.id} type="button" onClick={() => setFeedTab(tab.id)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition ${feedTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setSortBy((prev) => (prev === 'latest' ? 'popular' : 'latest'))} className="inline-flex items-center gap-1.5 px-2 py-2 text-[13px] text-slate-600 hover:text-slate-900">
                    {sortBy === 'latest' ? 'Latest' : 'Popular'} <ArrowUpDown size={13} />
                  </button>
                </div>

                {loading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
                {!loading && activeProblems.map((problem, index) => (
                  <DiscussionCard
                    key={problem.id}
                    problem={problem}
                    index={index}
                    onOpen={openProblemDetails}
                    onLike={handleLikeProblem}
                    onSave={handleSaveProblem}
                    onEdit={startEditProblem}
                    onDelete={handleDeleteProblem}
                    canManage={viewMode === 'my-problems'}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))}
                {!loading && activeProblems.length === 0 && <EmptyKnowledgeState onCreate={() => openCreate()} />}
              </Motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right rail */}
        <aside className="hidden space-y-3 self-start xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <h2 className="mb-3 text-[14px] font-semibold text-slate-900">Community Overview</h2>
            <div className="grid grid-cols-2 gap-2">
              <OverviewStat icon={MessageSquareText} tone="bg-blue-50 text-blue-600" value={hubStats.discussions} label="Discussions" />
              <OverviewStat icon={Users} tone="bg-indigo-50 text-indigo-600" value={hubStats.answers} label="Community answers" />
              <OverviewStat icon={Activity} tone="bg-emerald-50 text-emerald-600" value={hubStats.active} label="Active threads" />
              <OverviewStat icon={Eye} tone="bg-amber-50 text-amber-500" value={hubStats.views} label="Knowledge views" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Trending Subjects</h2>
              <button type="button" onClick={() => setFilters((prev) => ({ ...prev, subject: '' }))} className="text-[12px] font-medium text-blue-600 hover:underline">View all</button>
            </div>
            <div className="space-y-0.5">
              {subjectCounts.map((subject) => {
                const Icon = subject.icon;
                return (
                  <button key={subject.name} type="button" onClick={() => setFilters((prev) => ({ ...prev, subject: subject.name }))} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md ${subject.tone}`}><Icon size={14} /></span>
                    <span className="flex-1 text-[13px] text-slate-800">{subject.name}</span>
                    <span className="text-[11px] text-slate-500">{subject.count} posts</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Popular Tags</h2>
              <button type="button" className="text-[12px] font-medium text-blue-600 hover:underline">View all</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {popularTags.length === 0
                ? <span className="text-[12px] text-slate-500">Tags appear after posts are added.</span>
                : popularTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => setFilters((prev) => ({ ...prev, search: tag }))} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100">#{tag}</button>
                ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <h2 className="text-[14px] font-semibold text-slate-900">Community Guidelines</h2>
            </div>
            <ul className="space-y-2">
              {GUIDELINES.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={12} /></span>{item}
                </li>
              ))}
            </ul>
            <button type="button" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">Learn more <ArrowRight size={13} /></button>
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {detailProblem && (
          <CommentsModal
            problem={{ ...detailProblem, ...([...problems, ...myProblems].find((item) => item.id === detailProblem.id) || {}), comments: detailProblem.comments, views: detailProblem.views }}
            comments={detailComments}
            loading={detailLoading}
            commentText={detailCommentText}
            setCommentText={setDetailCommentText}
            posting={postingDetailComment}
            onPost={submitDetailComment}
            onLike={handleLikeProblem}
            onSave={handleSaveProblem}
            userName={userName}
            formatTimeAgo={formatTimeAgo}
            onClose={() => setDetailProblem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const OverviewStat = ({ icon, tone, value, label }) => (
  <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 p-2.5">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{React.createElement(icon, { size: 16 })}</span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[16px] font-bold leading-none text-slate-900">{value}</p>
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">Live</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
    </div>
  </div>
);

const DiscussionCard = ({ problem, index, onOpen, onLike, onSave, onEdit, onDelete, canManage, formatTimeAgo }) => {
  const solved = Number(problem.comments || 0) > 0 && problem.solutionText;
  const isTeacher = problem.authorType === 'teacher';
  const roleLine = isTeacher
    ? 'Teacher'
    : [problem.authorGrade ? `Class ${problem.authorGrade}` : '', 'Student'].filter(Boolean).join(' • ');
  const difficultyClass = problem.difficulty === 'easy'
    ? 'bg-emerald-50 text-emerald-700'
    : problem.difficulty === 'hard' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700';
  const tags = [problem.subject, problem.chapter, ...(problem.tags || [])].filter(Boolean).filter((tag, i, arr) => arr.indexOf(tag) === i).slice(0, 4);

  return (
    <Motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-xl border border-slate-200 bg-white px-4 pb-2.5 pt-3.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar initials={problem.teacherAvatar} src={problem.authorPhoto} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-900">{problem.teacherName}</p>
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"><Star size={10} className="fill-amber-400 text-amber-400" />Top Contributor</span>
          </div>
          <p className="text-[11px] text-slate-500">{roleLine} <span className="mx-1">•</span>{formatTimeAgo(problem.timestamp)}</p>
        </div>
        <div className="flex items-center gap-2">
          {solved && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"><Star size={10} />Accepted Solution</span>}
          {isTeacher && <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">Teacher response</span>}
          {canManage && <button type="button" onClick={() => onEdit(problem)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" title="Edit"><Edit3 size={14} /></button>}
          {canManage && <button type="button" onClick={() => onDelete(problem.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50" title="Delete"><X size={14} /></button>}
        </div>
      </div>

      <button type="button" onClick={() => onOpen(problem)} className="mt-2 block text-left text-[16px] font-semibold leading-snug text-slate-900 hover:text-blue-700">{problem.title}</button>
      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">{problem.problemText}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">#{tag}</span>)}
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${difficultyClass}`}>{problem.difficulty}</span>
      </div>

      <div className="mt-2.5 flex items-center gap-5 border-t border-slate-100 pt-2 text-[12px] text-slate-600">
        <button type="button" onClick={() => onLike(problem.id)} className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.isLiked ? 'text-blue-600' : ''}`}>
          <ThumbsUp size={15} className={problem.isLiked ? 'fill-current' : ''} />{problem.likes}
        </button>
        <button type="button" onClick={() => onOpen(problem)} className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.comments > 0 ? 'text-blue-600' : ''}`}>
          <MessageSquare size={15} />{problem.comments}
        </button>
        <span className="inline-flex items-center gap-1.5"><Eye size={15} />{problem.views}</span>
        <button type="button" onClick={() => onSave(problem.id)} className={`ml-auto inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.isSaved ? 'text-blue-600' : ''}`}>
          <Bookmark size={15} className={problem.isSaved ? 'fill-current' : ''} />{problem.isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </Motion.article>
  );
};

const Badge = ({ tone, icon, label }) => {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${tones[tone]}`}>{React.createElement(icon, { size: 12 })}{label}</span>;
};

const Avatar = ({ initials, src, size }) => {
  const [broken, setBroken] = useState(false);
  const sizeClass = size === 'lg' ? 'h-10 w-10 text-[13px]' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-[12px]';
  if (src && !broken) {
    return <img src={src} alt={initials} onError={() => setBroken(true)} className={`shrink-0 rounded-full object-cover ${sizeClass}`} />;
  }
  return <div className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ${sizeClass}`}>{initials}</div>;
};

const KnowledgeEditor = ({ newProblem, setNewProblem, editingProblemId, submitting, onCancel, onSubmit, addHint, updateHint, removeHint, addTag, removeTag }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Solution Workspace</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">{editingProblemId ? 'Edit knowledge thread' : 'Start a knowledge thread'}</h2>
        <p className="mt-1 text-sm text-slate-500">Markdown-style writing, hints, tags, and lightweight AI assistance for clear explanations.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {['Suggest Tags', 'Improve Formatting', 'Simplify Explanation', 'Generate Hints'].map((item) => <button key={item} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"><Sparkles size={13} className="mr-1 inline" />{item}</button>)}
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <InputField label="Thread title" value={newProblem.title} onChange={(value) => setNewProblem((prev) => ({ ...prev, title: value }))} placeholder="Write a searchable academic question..." />
        <div className="grid gap-4 md:grid-cols-3">
          <InputField label="Subject" value={newProblem.subject} onChange={(value) => setNewProblem((prev) => ({ ...prev, subject: value }))} placeholder="Mathematics" />
          <InputField label="Topic" value={newProblem.chapter} onChange={(value) => setNewProblem((prev) => ({ ...prev, chapter: value }))} placeholder="Algebra" />
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">Difficulty</span><select value={newProblem.difficulty} onChange={(event) => setNewProblem((prev) => ({ ...prev, difficulty: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        </div>
        <TextAreaField label="Problem discussion" value={newProblem.problemText} onChange={(value) => setNewProblem((prev) => ({ ...prev, problemText: value }))} rows={7} placeholder="Use markdown-like structure, equations, and context..." />
        <TextAreaField label="Solution / explanation" value={newProblem.solutionText} onChange={(value) => setNewProblem((prev) => ({ ...prev, solutionText: value }))} rows={6} placeholder="Step-by-step solution, accepted approach, or teacher explanation..." />
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Hint suggestions</p><button onClick={addHint} className="text-xs font-semibold text-indigo-600">Add hint</button></div>
          <div className="space-y-2">{newProblem.hints.map((hint, index) => <div key={index} className="flex gap-2"><input value={hint} onChange={(event) => updateHint(index, event.target.value)} placeholder={`Hint ${index + 1}`} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300" />{newProblem.hints.length > 1 && <button onClick={() => removeHint(index)} className="rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600">Remove</button>}</div>)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Tags</p>
          <div className="mb-3 flex flex-wrap gap-2">{newProblem.tags.map((tag) => <button key={tag} onClick={() => removeTag(tag)} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">#{tag} x</button>)}</div>
          <input onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(event.currentTarget.value.trim()); event.currentTarget.value = ''; } }} placeholder="Type a tag and press Enter" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300" />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Live preview</p><h3 className="mt-3 text-lg font-semibold text-slate-950">{newProblem.title || 'Untitled thread'}</h3><p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-slate-600">{newProblem.problemText || 'Your problem discussion preview appears here.'}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><p className="text-sm font-semibold text-cyan-900">AI assist layer</p><p className="mt-2 text-xs leading-5 text-cyan-800">Use lightweight assistance for formatting, tags, summaries, and hint ideas. Full AI workflows remain in AI Center.</p></div>
      </aside>
    </div>

    <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-5"><button onClick={onCancel} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button onClick={onSubmit} disabled={submitting || !newProblem.title || !newProblem.subject || !newProblem.problemText} className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Saving...' : editingProblemId ? 'Update Thread' : 'Publish Thread'}</button></div>
  </section>
);

const InputField = ({ label, value, onChange, placeholder }) => <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" /></label>;
const TextAreaField = ({ label, value, onChange, rows, placeholder }) => <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" /></label>;

const EmptyKnowledgeState = ({ onCreate }) => <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><Brain className="mx-auto h-12 w-12 text-slate-300" /><h3 className="mt-4 text-lg font-semibold text-slate-900">No discussions found</h3><p className="mt-2 text-sm text-slate-500">Try another filter or start a new academic thread.</p><button onClick={onCreate} className="mt-5 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Start Discussion</button></div>;

const CommentsModal = ({ problem, comments, loading, commentText, setCommentText, posting, onPost, onLike, onSave, userName, formatTimeAgo, onClose }) => {
  const listEndRef = React.useRef(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [comments.length]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tags = [problem.subject, problem.chapter, ...(problem.tags || [])].filter(Boolean).filter((tag, i, arr) => arr.indexOf(tag) === i).slice(0, 4);

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-220 flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <Motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }} className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="relative flex items-center justify-center border-b border-slate-200 px-4 py-3">
          <h3 className="text-[15px] font-semibold text-slate-900">{problem.teacherName}&apos;s Post</h3>
          <button type="button" onClick={onClose} className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2.5">
              <Avatar initials={problem.teacherAvatar} src={problem.authorPhoto} />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{problem.teacherName}</p>
                <p className="text-[11px] text-slate-500">{problem.authorType === 'teacher' ? 'Teacher' : 'Student'} • {formatTimeAgo(problem.timestamp)}</p>
              </div>
            </div>
            <h4 className="mt-2.5 text-[16px] font-semibold text-slate-900">{problem.title}</h4>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-slate-700">{problem.problemText}</p>
            {problem.solutionText && (
              <div className="mt-2.5 rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
                <p className="mb-1 text-[11px] font-semibold text-emerald-700">Solution</p>
                <p className="whitespace-pre-line text-[13px] leading-5 text-emerald-950">{problem.solutionText}</p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">#{tag}</span>)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white"><ThumbsUp size={9} /></span>{problem.likes}</span>
              <span>{comments.length} comments • {problem.views} views</span>
            </div>
          </div>

          <div className="mx-4 mt-2 grid grid-cols-3 border-y border-slate-200 py-1 text-[13px] font-medium text-slate-600">
            <button type="button" onClick={() => onLike(problem.id)} className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-slate-100 ${problem.isLiked ? 'text-blue-600' : ''}`}><ThumbsUp size={16} className={problem.isLiked ? 'fill-current' : ''} />Like</button>
            <button type="button" onClick={() => document.getElementById('alcove-comment-input')?.focus()} className="inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-slate-100"><MessageSquare size={16} />Comment</button>
            <button type="button" onClick={() => onSave(problem.id)} className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-slate-100 ${problem.isSaved ? 'text-blue-600' : ''}`}><Bookmark size={16} className={problem.isSaved ? 'fill-current' : ''} />{problem.isSaved ? 'Saved' : 'Save'}</button>
          </div>

          <div className="space-y-3 px-4 py-3">
            {loading ? (
              <div className="py-6 text-center text-[13px] text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading comments...</div>
            ) : comments.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-500">No comments yet. Be the first to comment.</p>
            ) : comments.map((comment, index) => {
              const isTeacher = String(comment?.authorType || '').toLowerCase() === 'teacher';
              return (
                <div key={comment._id || index} className="flex gap-2">
                  <Avatar initials={initialsOf(comment.authorName || 'User')} src={comment.authorPhoto} size="sm" />
                  <div className="min-w-0">
                    <div className="inline-block max-w-full rounded-2xl bg-slate-100 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
                        {comment.authorName || 'User'}
                        {isTeacher && <span className="rounded bg-violet-100 px-1.5 py-px text-[9px] font-medium text-violet-700">Teacher</span>}
                      </p>
                      <p className="whitespace-pre-wrap wrap-break-word text-[13px] leading-5 text-slate-800">{comment.text}</p>
                    </div>
                    <p className="mt-0.5 pl-3 text-[11px] text-slate-500">{comment.createdAt ? formatTimeAgo(new Date(comment.createdAt)) : ''}</p>
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5">
          <Avatar initials={initialsOf(userName)} size="sm" />
          <div className="flex flex-1 items-center rounded-full bg-slate-100 pr-1">
            <input
              id="alcove-comment-input"
              autoFocus
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!posting && commentText.trim()) onPost(); } }}
              placeholder={`Comment as ${userName}...`}
              className="flex-1 bg-transparent px-3 py-2 text-[13px] outline-none"
            />
            <button type="button" onClick={onPost} disabled={posting || !commentText.trim()} className="flex h-8 w-8 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400">
              {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

export default TeacherAlcove;
