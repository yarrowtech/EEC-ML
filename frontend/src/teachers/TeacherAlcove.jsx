import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { 
  BookOpen, 
  Search as SearchIcon, 
  MessageSquare, 
  Heart, 
  PlusCircle,
  Edit3,
  Eye,
  Share2,
  Save,
  FileText,
  Target,
  Lightbulb,
  Brain,
  CheckCircle,
  Clock,
  Tag,
  Bookmark,
  MoreVertical,
  Download,
  Users,
  X,
  Loader2,
  Trophy,
  Flame,
  GitFork,
  Sparkles,
  PenLine,
  MessageCircle,
  TrendingUp,
  CheckCircle2,
  Layers,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';

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
      views: Number(post.viewCount) || 0
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

  const filteredProblems = problems;

  const hubStats = useMemo(() => {
    const source = viewMode === 'my-problems' ? myProblems : problems;
    return {
      discussions: source.length,
      answers: source.reduce((sum, item) => sum + Number(item.comments || 0), 0),
      saves: source.reduce((sum, item) => sum + Number(item.saves || 0), 0),
      views: source.reduce((sum, item) => sum + Number(item.views || 0), 0),
    };
  }, [myProblems, problems, viewMode]);

  const trendingTopics = useMemo(() => {
    const counts = new Map();
    problems.forEach((problem) => {
      [problem.subject, problem.chapter, ...(problem.tags || [])].filter(Boolean).forEach((topic) => {
        counts.set(topic, (counts.get(topic) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [problems]);

  const topContributors = useMemo(() => {
    const contributors = new Map();
    problems.forEach((problem) => {
      const key = problem.teacherName || 'Contributor';
      const current = contributors.get(key) || { name: key, avatar: problem.teacherAvatar || 'T', posts: 0, score: 0 };
      contributors.set(key, {
        ...current,
        posts: current.posts + 1,
        score: current.score + Number(problem.likes || 0) + Number(problem.comments || 0) * 2 + Number(problem.views || 0),
      });
    });
    return Array.from(contributors.values()).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [problems]);

  const collections = useMemo(() => {
    const subjects = Array.from(new Set(problems.map((problem) => problem.subject).filter(Boolean))).slice(0, 4);
    const defaults = ['Algebra Mastery', 'Olympiad Archive', 'Revision Set', 'Physics Numericals'];
    return (subjects.length ? subjects : defaults).map((subject, index) => ({
      title: defaults[index] || `${subject} Collection`,
      subject,
      count: problems.filter((problem) => problem.subject === subject || (problem.tags || []).includes(subject)).length || Math.max(3, index + 4),
      accent: ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][index % 4],
    }));
  }, [problems]);

  const activeProblems = viewMode === 'my-problems' ? myProblems : filteredProblems;

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <Motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-300/50">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.45),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.55),transparent_38%),linear-gradient(135deg,#0f172a,#111827)]" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 backdrop-blur">
                  <GitFork size={14} /> Collaborative Academic Network
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Knowledge Hub</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                  Discover problem discussions, share solutions, mentor students, and build reusable academic knowledge with your school community.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Teacher picks', 'Accepted solutions', 'Markdown-ready', 'AI assisted'].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">{item}</span>
                  ))}
                </div>
              </div>
              <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
                <HubHeroMetric label="Discussions" value={hubStats.discussions} />
                <HubHeroMetric label="Community answers" value={hubStats.answers} />
              </div>
            </div>
          </div>
        </Motion.section>

        <div className="grid gap-4 md:grid-cols-4">
          <CommunityStat icon={MessageCircle} label="Problem discussions" value={hubStats.discussions} sub="Discover feed" tone="from-blue-500 to-indigo-500" />
          <CommunityStat icon={CheckCircle2} label="Shared answers" value={hubStats.answers} sub="Thread activity" tone="from-emerald-500 to-teal-500" />
          <CommunityStat icon={Bookmark} label="Saved posts" value={hubStats.saves} sub="Personal library" tone="from-amber-500 to-orange-500" />
          <CommunityStat icon={Eye} label="Knowledge views" value={hubStats.views} sub="Community reach" tone="from-violet-500 to-fuchsia-500" />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {[
                { id: 'wall', label: 'Discover Feed', icon: TrendingUp },
                { id: 'create', label: editingProblemId ? 'Edit Workspace' : 'Solution Workspace', icon: PenLine },
                { id: 'my-problems', label: 'My Contributions', icon: UserCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} type="button" onClick={() => { if (tab.id === 'create' && viewMode !== 'create') { setEditingProblemId(null); setNewProblem(emptyProblem); } setViewMode(tab.id); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${viewMode === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    <Icon size={15} />{tab.label}
                  </button>
                );
              })}
            </div>

            {viewMode !== 'create' && (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative lg:w-80">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Search discussions, tags, solutions" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
                </div>
                <select value={filters.subject} onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
                  <option value="">All subjects</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                </select>
                <select value={filters.difficulty} onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
                  <option value="">All levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 space-y-5">
            <AnimatePresence mode="wait">
              {viewMode === 'create' ? (
                <Motion.div key="editor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <KnowledgeEditor
                    newProblem={newProblem}
                    setNewProblem={setNewProblem}
                    editingProblemId={editingProblemId}
                    submitting={submitting}
                    onCancel={() => { setEditingProblemId(null); setNewProblem(emptyProblem); setViewMode('wall'); }}
                    onSubmit={handleCreateProblem}
                    addHint={addHint}
                    updateHint={updateHint}
                    removeHint={removeHint}
                    addTag={addTag}
                    removeTag={removeTag}
                  />
                </Motion.div>
              ) : (
                <Motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <FeedHeader viewMode={viewMode} loading={loading} count={activeProblems.length} onCreate={() => { setEditingProblemId(null); setNewProblem(emptyProblem); setViewMode('create'); }} />
                  {loading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
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
                  {!loading && activeProblems.length === 0 && <EmptyKnowledgeState onCreate={() => setViewMode('create')} />}
                </Motion.div>
              )}
            </AnimatePresence>
          </main>

          <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <CommunityPanel contributors={topContributors} topics={trendingTopics} />
            <CollectionsPanel collections={collections} />
            <AiAssistPanel />
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {detailProblem && (
          <DiscussionModal
            problem={detailProblem}
            comments={detailComments}
            viewers={detailViewers}
            loading={detailLoading}
            commentText={detailCommentText}
            setCommentText={setDetailCommentText}
            posting={postingDetailComment}
            onPost={submitDetailComment}
            onClose={() => setDetailProblem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const HubHeroMetric = ({ label, value }) => (
  <Motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">{label}</p>
    <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
  </Motion.div>
);

const CommunityStat = ({ icon, label, value, sub, tone }) => (
  <Motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg hover:shadow-slate-200/70">
    <div className="flex items-start justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${tone} text-white shadow-lg`}>{React.createElement(icon, { size: 18 })}</div>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Live</span>
    </div>
    <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
  </Motion.div>
);

const FeedHeader = ({ viewMode, loading, count, onCreate }) => (
  <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{viewMode === 'my-problems' ? 'My Contributions' : 'Discover Feed'}</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{viewMode === 'my-problems' ? 'Your academic contributions' : 'Active academic discussions'}</h2>
      <p className="mt-1 text-sm text-slate-500">{loading ? 'Loading community knowledge...' : `${count} thread${count === 1 ? '' : 's'} available`}</p>
    </div>
    <button onClick={onCreate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
      <PlusCircle size={16} /> Start Discussion
    </button>
  </div>
);

const DiscussionCard = ({ problem, index, onOpen, onLike, onSave, onEdit, onDelete, canManage, formatTimeAgo }) => {
  const solved = Number(problem.comments || 0) > 0 && problem.solutionText;
  return (
    <Motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} whileHover={{ y: -2 }} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-slate-200/70">
      <div className="flex gap-4">
        <div className="hidden w-16 shrink-0 space-y-2 text-center sm:block">
          <VoteStat value={problem.likes} label="likes" active={problem.isLiked} />
          <VoteStat value={problem.comments} label="answers" active={solved} />
          <VoteStat value={problem.views} label="views" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {solved && <Badge tone="emerald" icon={CheckCircle2} label="Accepted solution" />}
                {problem.authorType === 'teacher' ? <Badge tone="indigo" icon={UserCheck} label="Teacher response" /> : <Badge tone="cyan" icon={Users} label="Student thread" />}
                <Badge tone="slate" icon={Clock} label={formatTimeAgo(problem.timestamp)} />
              </div>
              <button onClick={() => onOpen(problem)} className="text-left text-xl font-semibold leading-snug text-slate-950 hover:text-indigo-700">{problem.title}</button>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{problem.problemText}</p>
            </div>
            <div className="flex items-center gap-2">
              <Avatar initials={problem.teacherAvatar} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{problem.teacherName}</p>
                <p className="text-[11px] text-slate-400">Top Contributor</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <TagPill label={problem.subject || 'General'} />
            <TagPill label={problem.chapter || 'Discussion'} />
            <DifficultyPill difficulty={problem.difficulty} />
            {(problem.tags || []).slice(0, 4).map((tag) => <TagPill key={tag} label={tag} muted />)}
          </div>

          {problem.solutionText && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700"><CheckCircle size={14} />Highlighted explanation</div>
              <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-emerald-950">{problem.solutionText}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton active={problem.isLiked} icon={Heart} label={`${problem.likes} Like`} onClick={() => onLike(problem.id)} />
              <ActionButton icon={MessageSquare} label={`${problem.comments} Discuss`} onClick={() => onOpen(problem)} />
              <ActionButton active={problem.isSaved} icon={Bookmark} label={problem.isSaved ? 'Saved' : 'Save'} onClick={() => onSave(problem.id)} />
              <ActionButton icon={Sparkles} label="AI summarize" onClick={() => onOpen(problem)} />
            </div>
            <div className="flex items-center gap-2">
              {canManage && <button onClick={() => onEdit(problem)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Edit3 size={14} className="mr-1 inline" />Edit</button>}
              {canManage && <button onClick={() => onDelete(problem.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>}
              <button onClick={() => onOpen(problem)} className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Open thread <ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </Motion.article>
  );
};

const VoteStat = ({ value, label, active }) => (
  <div className={`rounded-2xl border px-2 py-2 ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
    <p className="text-sm font-bold">{value}</p>
    <p className="text-[10px] font-semibold uppercase">{label}</p>
  </div>
);

const Badge = ({ tone, icon, label }) => {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${tones[tone]}`}>{React.createElement(icon, { size: 12 })}{label}</span>;
};

const TagPill = ({ label, muted }) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${muted ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700'}`}>#{label}</span>;

const DifficultyPill = ({ difficulty }) => {
  const classes = difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' : difficulty === 'hard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>{difficulty}</span>;
};

const ActionButton = ({ icon, label, onClick, active }) => (
  <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${active ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
    {React.createElement(icon, { size: 14, className: active ? 'fill-current' : '' })}{label}
  </button>
);

const Avatar = ({ initials }) => <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white shadow-sm">{initials}</div>;

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

const CommunityPanel = ({ contributors, topics }) => <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Flame size={17} className="text-orange-500" /><h2 className="text-sm font-semibold text-slate-950">Community Insights</h2></div><div className="space-y-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Top contributors</p>{contributors.length === 0 ? <p className="text-sm text-slate-500">No contributors yet.</p> : contributors.map((item) => <div key={item.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><Avatar initials={item.avatar} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{item.name}</p><p className="text-[11px] text-slate-400">{item.posts} posts · {item.score} reputation</p></div><Trophy size={15} className="text-amber-500" /></div>)}<div className="border-t border-slate-100 pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Trending topics</p><div className="flex flex-wrap gap-2">{topics.length === 0 ? <span className="text-sm text-slate-500">Topics appear after posts are added.</span> : topics.map((topic) => <span key={topic.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">#{topic.label} · {topic.count}</span>)}</div></div></div></section>;

const CollectionsPanel = ({ collections }) => <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Layers size={17} className="text-indigo-600" /><h2 className="text-sm font-semibold text-slate-950">Collaborative Collections</h2></div><div className="space-y-2">{collections.map((collection) => <div key={collection.title} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-center gap-3"><span className={`h-9 w-1.5 rounded-full ${collection.accent}`} /><div><p className="text-sm font-semibold text-slate-900">{collection.title}</p><p className="text-xs text-slate-400">{collection.count} reusable resources · {collection.subject}</p></div></div></div>)}</div></section>;

const AiAssistPanel = () => <section className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-cyan-700" /><h2 className="text-sm font-semibold text-cyan-950">AI Assist Layer</h2></div><div className="space-y-2">{['Summarize Discussion', 'Suggest Tags', 'Improve Formatting', 'Simplify Explanation', 'Generate Hint Suggestions'].map((item) => <button key={item} className="w-full rounded-2xl bg-white px-3 py-2 text-left text-xs font-semibold text-cyan-800 shadow-sm hover:bg-cyan-100">{item}</button>)}</div></section>;

const DiscussionModal = ({ problem, comments, viewers, loading, commentText, setCommentText, posting, onPost, onClose }) => (
  <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
    <Motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><div className="mb-2 flex flex-wrap gap-2"><Badge tone="indigo" icon={MessageSquare} label="Discussion thread" /><Badge tone="emerald" icon={CheckCircle2} label="Teacher-reviewed" /></div><h3 className="text-xl font-semibold text-slate-950">{problem.title}</h3><p className="mt-1 text-sm text-slate-500">{problem.subject} · {problem.chapter} · {problem.teacherName}</p></div><button onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={18} /></button></div>
      <div className="grid max-h-[calc(88vh-92px)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]"><main className="space-y-5 p-5"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="whitespace-pre-line text-sm leading-6 text-slate-700">{problem.problemText}</p></div>{problem.solutionText && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Accepted solution candidate</p><p className="whitespace-pre-line text-sm leading-6 text-emerald-950">{problem.solutionText}</p></div>}<div><h4 className="mb-3 text-sm font-semibold text-slate-950">Collaborative discussion</h4>{loading ? <div className="py-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading thread...</div> : <div className="space-y-3">{comments.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No replies yet. Start the discussion.</p> : comments.map((comment, index) => <ThreadReply key={comment._id || index} comment={comment} problem={problem} depth={index > 0 ? 1 : 0} />)}</div>}<div className="mt-4 flex gap-2"><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a teacher response, hint, or clarification..." className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" /><button onClick={onPost} disabled={posting || !commentText.trim()} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{posting ? 'Posting...' : 'Reply'}</button></div></div></main><aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0"><div className="grid grid-cols-3 gap-2 lg:grid-cols-1"><InfoMetric label="Replies" value={comments.length} /><InfoMetric label="Viewers" value={viewers.length} /><InfoMetric label="Likes" value={problem.likes} /></div><div className="mt-5 rounded-2xl bg-white p-4"><p className="text-sm font-semibold text-slate-900">AI context actions</p><div className="mt-3 space-y-2">{['Summarize thread', 'Extract hints', 'Simplify answer'].map((item) => <button key={item} className="w-full rounded-xl bg-cyan-50 px-3 py-2 text-left text-xs font-semibold text-cyan-800">{item}</button>)}</div></div></aside></div>
    </Motion.div>
  </Motion.div>
);

const ThreadReply = ({ comment, problem, depth }) => {
  const isAuthor = String(comment?.authorName || '').trim().toLowerCase() === String(problem?.authorName || problem?.teacherName || '').trim().toLowerCase();
  const isTeacher = String(comment?.authorType || '').toLowerCase() === 'teacher';
  return <Motion.div initial={{ opacity: 0, x: depth ? 10 : 0 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl border p-3 ${depth ? 'ml-5 border-slate-200 bg-white' : 'border-slate-200 bg-white'} ${isTeacher ? 'ring-1 ring-indigo-100' : ''}`}><div className="mb-1 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Avatar initials={(comment.authorName || 'U').slice(0, 2).toUpperCase()} /><p className="text-sm font-semibold text-slate-800">{comment.authorName || 'User'}</p>{isAuthor && <Badge tone="emerald" icon={CheckCircle2} label="Author" />}{isTeacher && <Badge tone="indigo" icon={UserCheck} label="Teacher" />}</div><p className="text-[11px] text-slate-400">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</p></div><p className="whitespace-pre-wrap pl-12 text-sm leading-6 text-slate-600">{comment.text}</p></Motion.div>;
};

const InfoMetric = ({ label, value }) => <div className="rounded-2xl bg-white p-3 text-center"><p className="text-lg font-semibold text-slate-950">{value}</p><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p></div>;

export default TeacherAlcove;
