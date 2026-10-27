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
  Hash,
  ArrowLeft,
  Globe,
  Lock,
  CalendarClock,
  MoreHorizontal,
  Trash2,
  Star,
  Activity,
  Users,
  ShieldCheck,
  Check,
  ArrowRight,
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

// e.g. "27 October, 2026, 4:05 PM"
const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'long' })}, ${date.getFullYear()}, ${time}`;
};

// <input type="datetime-local"> wants local time without a zone: "YYYY-MM-DDTHH:mm".
const toLocalInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// "5" + "A" -> "Class 5 - A"; leaves names that already start with "Class" alone.
const classSectionLabel = (grade, section) => {
  const name = String(grade || '').trim();
  const base = /^class/i.test(name) ? name : `Class ${name}`;
  return section ? `${base} - ${section}` : base;
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
  const [navView, setNavView] = useState('home'); // 'home' | 'liked' | 'saved' | 'mine' | 'polls'
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
      authorUserId: String(post?.authorUserId || post?.author?._id || post?.author || ''),
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
      isSaved: Boolean(post.isSaved),
      views: Number(post.viewCount) || 0,
      authorPhoto: post?.authorPhoto || '',
      images: Array.isArray(post.images) ? post.images.map((image) => image?.url).filter(Boolean) : [],
      poll: post.poll || null,
      audience: post.audience === 'classes' ? 'classes' : 'school',
      audienceClasses: Array.isArray(post.audienceClasses) ? post.audienceClasses : []
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
      if (navView === 'liked') params.append('liked', 'true');
      else if (navView === 'saved') params.append('saved', 'true');
      else if (navView === 'polls') { params.append('mine', 'true'); params.append('hasPoll', 'true'); }
      else params.append('mine', 'true');
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
  }, [viewMode, navView, filters.subject, filters.difficulty, filters.search]);

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

  const handleSaveProblem = async (problemId) => {
    try {
      const res = await fetch(`${API}/api/alcove/posts/${problemId}/save`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Save failed');
      }
      const { saved } = await res.json();
      const applySave = (problem) => (problem.id === problemId ? { ...problem, isSaved: Boolean(saved) } : problem);
      setProblems((prev) => prev.map(applySave));
      setMyProblems((prev) => (navView === 'saved' && !saved
        ? prev.filter((problem) => problem.id !== problemId)
        : prev.map(applySave)));
      setDetailProblem((prev) => (prev ? applySave(prev) : prev));
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Save failed', text: err.message || 'Could not save post' });
    }
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
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    const days = Math.floor(diffInMinutes / 1440);
    if (days < 5) return `${days}d ago`;
    // e.g. "27 October, 2026"
    return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'long' })}, ${date.getFullYear()}`;
  };

  const [createOpen, setCreateOpen] = useState(false); // false | 'text' | 'photo' | 'poll'
  const [lightboxImage, setLightboxImage] = useState(null);
  const [profile, setProfile] = useState(() => ({ name: readUserName(), photo: '', id: '' }));
  const userName = profile.name;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(`${API}/api/teacher/auth/profile`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setProfile((prev) => ({ name: data.name || prev.name, photo: data.profilePic || '', id: String(data._id || data.id || '') }));
      } catch { /* keep fallback name */ }
    };
    loadProfile();
  }, []);

  // Class-sections this teacher teaches, offered as post audiences.
  const [classOptions, setClassOptions] = useState([]);
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await fetch(`${API}/api/teacher/dashboard/allocations`, { headers: authHeaders() });
        if (!res.ok) return;
        const items = await res.json().catch(() => []);
        const seen = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
          const sectionId = String(item?.sectionId?._id || item?.sectionId || '');
          const className = item?.classId?.name || item?.className || '';
          const sectionName = item?.sectionId?.name || item?.sectionName || '';
          if (!sectionId || !className || seen.has(sectionId)) return;
          seen.set(sectionId, {
            classId: String(item?.classId?._id || item?.classId || ''),
            sectionId,
            label: classSectionLabel(className, sectionName),
          });
        });
        setClassOptions([...seen.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })));
      } catch { /* audience picker falls back to school only */ }
    };
    loadClasses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPost = async ({ text, images, poll, tags, audience }) => {
    const tagSubject = SUBJECTS.find((subject) => tags.some((tag) => tag.toLowerCase() === subject.name.replace(/\s+/g, '').toLowerCase()));
    const form = new FormData();
    form.append('problemText', text);
    form.append('subject', tagSubject?.name || 'General');
    form.append('tags', JSON.stringify(tags));
    form.append('audience', JSON.stringify(audience));
    if (poll) form.append('poll', JSON.stringify(poll));
    images.forEach((file) => form.append('images', file));
    const res = await fetch(`${API}/api/alcove/posts`, { method: 'POST', headers: authHeaders(), body: form });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Could not create post');
    }
    setCreateOpen(false);
    fetchProblems();
    if (viewMode === 'my-problems') fetchMyProblems();
  };

  const applyPollUpdate = (problemId, poll) => {
    const applyPoll = (problem) => (problem.id === problemId ? { ...problem, poll } : problem);
    setProblems((prev) => prev.map(applyPoll));
    setMyProblems((prev) => prev.map(applyPoll));
    setDetailProblem((prev) => (prev ? applyPoll(prev) : prev));
  };

  const handleVote = async (problemId, optionIndex) => {
    try {
      const res = await fetch(`${API}/api/alcove/posts/${problemId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ optionIndex }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Vote failed');
      }
      const { poll } = await res.json();
      applyPollUpdate(problemId, poll);
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Vote failed', text: err.message || 'Could not record vote' });
    }
  };

  const isOwnPost = (problem) => Boolean(profile.id) && problem.authorType === 'teacher' && problem.authorUserId === profile.id;

  // Counts come from the loaded feed; the section page itself loads the full list from the API.
  const hubStats = useMemo(() => ({
    liked: problems.filter((item) => item.isLiked).length,
    saved: problems.filter((item) => item.isSaved).length,
    mine: problems.filter(isOwnPost).length,
    polls: problems.filter((item) => isOwnPost(item) && item.poll?.question).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [problems, profile.id]);

  const SECTIONS = {
    liked: { title: 'Liked Posts', empty: 'Posts you like will show up here.' },
    saved: { title: 'Saved Posts', empty: 'Posts you save will show up here.' },
    mine: { title: 'My Contributions', empty: 'Posts you create will show up here.' },
    polls: { title: 'Poll Results', empty: 'Polls you create will show up here with everyone who voted.' },
  };

  const selectSection = (id) => {
    const next = navView === id ? 'home' : id;
    setNavView(next);
    setViewMode(next === 'home' ? 'wall' : 'my-problems');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [viewMode, myProblems, problems, navView]);

  const tagSuggestions = useMemo(() => {
    const seen = new Set();
    return [...problems.flatMap((problem) => problem.tags || []), ...popularTags, ...SUBJECTS.map((subject) => subject.name)]
      .map((tag) => String(tag).replace(/\s+/g, ''))
      .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
  }, [problems, popularTags]);

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
                {navView !== 'home' && (
                  <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                    <button type="button" onClick={() => selectSection('home')} title="Back to feed" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={16} /></button>
                    <div>
                      <h2 className="text-[15px] font-semibold text-slate-900">{SECTIONS[navView].title}</h2>
                      <p className="text-[12px] text-slate-500">{loading ? 'Loading...' : `${activeProblems.length} post${activeProblems.length === 1 ? '' : 's'}`}</p>
                    </div>
                  </section>
                )}

                {/* Composer */}
                {navView === 'home' && <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(userName)} src={profile.photo} size="lg" />
                    <button
                      type="button"
                      onClick={() => setCreateOpen('text')}
                      className="min-w-0 flex-1 truncate rounded-full bg-slate-100 px-4 py-2.5 text-left text-[13px] text-slate-500 transition hover:bg-slate-200"
                    >
                      Share a question, ideas, or resources with the community
                    </button>
                    <button type="button" title="Photo" onClick={() => setCreateOpen('photo')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100"><ImageIcon size={20} className="text-emerald-500" /></button>
                    <button type="button" title="Poll" onClick={() => setCreateOpen('poll')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100"><BarChart3 size={20} className="text-blue-600" /></button>
                  </div>
                </section>}

                {loading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
                {!loading && navView === 'polls' && activeProblems.map((problem) => (
                  <PollResultsCard key={problem.id} problem={problem} authHeaders={authHeaders} formatTimeAgo={formatTimeAgo} onPollUpdate={applyPollUpdate} />
                ))}
                {!loading && navView !== 'polls' && activeProblems.map((problem, index) => (
                  <DiscussionCard
                    key={problem.id}
                    problem={problem}
                    index={index}
                    onOpen={openProblemDetails}
                    onLike={handleLikeProblem}
                    onSave={handleSaveProblem}
                    onEdit={startEditProblem}
                    onDelete={handleDeleteProblem}
                    onVote={handleVote}
                    isOwn={isOwnPost(problem)}
                    onImageOpen={setLightboxImage}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))}
                {!loading && activeProblems.length === 0 && (navView === 'home'
                  ? <EmptyKnowledgeState onCreate={() => setCreateOpen('text')} />
                  : <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500">{SECTIONS[navView].empty}</p>)}
              </Motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right rail */}
        <aside className="hidden space-y-3 self-start xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <h2 className="mb-3 text-[14px] font-semibold text-slate-900">Community Overview</h2>
            <div className="grid grid-cols-2 gap-2">
              <OverviewStat icon={ThumbsUp} tone="bg-blue-50 text-blue-600" value={hubStats.liked} label="Liked Posts" active={navView === 'liked'} onClick={() => selectSection('liked')} />
              <OverviewStat icon={Bookmark} tone="bg-amber-50 text-amber-500" value={hubStats.saved} label="Saved Posts" active={navView === 'saved'} onClick={() => selectSection('saved')} />
              <OverviewStat icon={Pencil} tone="bg-emerald-50 text-emerald-600" value={hubStats.mine} label="My Contributions" active={navView === 'mine'} onClick={() => selectSection('mine')} />
              <OverviewStat icon={BarChart3} tone="bg-indigo-50 text-indigo-600" value={hubStats.polls} label="Poll Results" active={navView === 'polls'} onClick={() => selectSection('polls')} />
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
            onVote={handleVote}
            onImageOpen={setLightboxImage}
            userName={userName}
            userPhoto={profile.photo}
            formatTimeAgo={formatTimeAgo}
            onClose={() => setDetailProblem(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen && (
          <CreatePostModal
            initialAction={createOpen}
            userName={userName}
            userPhoto={profile.photo}
            tagSuggestions={tagSuggestions}
            classOptions={classOptions}
            onSubmit={createPost}
            onClose={() => setCreateOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}
      </AnimatePresence>
    </div>
  );
};

const OverviewStat = ({ icon, tone, value, label, active, onClick }) => (
  <button type="button" onClick={onClick} className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/40 ${active ? 'border-blue-500 bg-blue-50/60' : 'border-slate-100'}`}>
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{React.createElement(icon, { size: 16 })}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[16px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
    </div>
  </button>
);

const voterRoleLine = (voter) => {
  if (voter.userType === 'teacher') return 'Teacher';
  if (voter.userType !== 'student') return voter.userType ? voter.userType[0].toUpperCase() + voter.userType.slice(1) : 'User';
  const placement = [voter.grade ? `Class ${voter.grade}` : '', voter.section ? `Section ${voter.section}` : ''].filter(Boolean).join(' • ');
  return placement ? `Student • ${placement}` : 'Student';
};

const PollCloseControls = ({ problem, authHeaders, onPollUpdate }) => {
  const poll = problem.poll || {};
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (body) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/alcove/posts/${problem.id}/poll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update poll');
      onPollUpdate(problem.id, data.poll);
      setScheduling(false);
      setWhen('');
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Poll update failed', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const closeNow = async () => {
    const result = await Swal.fire({ icon: 'question', title: 'Close this poll now?', text: 'No one will be able to vote after it closes.', showCancelButton: true, confirmButtonText: 'Close poll' });
    if (result.isConfirmed) send({ action: 'close' });
  };

  if (poll.isClosed) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600"><Lock size={13} />Poll closed</span>
        <button type="button" disabled={busy} onClick={() => send({ action: 'reopen' })} className="text-[12px] font-semibold text-blue-600 hover:underline disabled:opacity-50">Reopen poll</button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-[12px] text-slate-600">
          {poll.closesAt ? <>Closes automatically on <b className="text-amber-700">{formatDateTime(poll.closesAt)}</b></> : 'Poll is open'}
        </span>
        <button type="button" disabled={busy} onClick={closeNow} className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><Lock size={12} />Close now</button>
        <button type="button" disabled={busy} onClick={() => setScheduling((prev) => !prev)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><CalendarClock size={12} />{poll.closesAt ? 'Change schedule' : 'Schedule close'}</button>
        {poll.closesAt && <button type="button" disabled={busy} onClick={() => send({ action: 'reopen' })} className="text-[12px] font-semibold text-slate-500 hover:underline">Cancel schedule</button>}
      </div>
      {scheduling && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={when} min={toLocalInputValue(new Date(Date.now() + 60000))} onChange={(event) => setWhen(event.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400" />
          <button type="button" disabled={busy || !when} onClick={() => send({ action: 'schedule', closesAt: new Date(when).toISOString() })} className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Set</button>
        </div>
      )}
    </div>
  );
};

const PollResultsCard = ({ problem, authHeaders, formatTimeAgo, onPollUpdate }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openOption, setOpenOption] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/alcove/posts/${problem.id}/poll-voters`, { headers: authHeaders() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not load voters');
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id, problem.poll?.totalVotes]);

  const total = data ? data.options.reduce((sum, option) => sum + option.voters.length, 0) : 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-bold leading-snug text-slate-900">{problem.poll?.question}</p>
        <span className="shrink-0 text-[11px] text-slate-500">{formatTimeAgo(problem.timestamp)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-slate-500">{total} vote{total === 1 ? '' : 's'}</p>
      <PollCloseControls problem={problem} authHeaders={authHeaders} onPollUpdate={onPollUpdate} />

      {error && <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-[12px] text-rose-600">{error}</p>}
      {!data && !error && <div className="py-6 text-center text-[13px] text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading voters...</div>}

      {data && (
        <div className="mt-3 space-y-2">
          {data.options.map((option, index) => {
            const percent = total ? Math.round((option.voters.length / total) * 100) : 0;
            const expanded = openOption === index;
            return (
              <div key={index} className="rounded-lg border border-slate-200">
                <button type="button" onClick={() => setOpenOption(expanded ? null : index)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">{option.text}</span>
                      <span className="text-[12px] font-semibold text-slate-600">{option.voters.length} • {percent}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="border-t border-slate-100 px-3.5 py-2">
                    {option.voters.length === 0
                      ? <p className="py-1.5 text-[12px] text-slate-500">No votes yet.</p>
                      : (
                        <ul className="divide-y divide-slate-100">
                          {option.voters.map((voter) => (
                            <li key={`${voter.userType}:${voter.id}`} className="flex items-center gap-2.5 py-2">
                              <Avatar initials={initialsOf(voter.name)} src={voter.photo} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-slate-900">{voter.name}</p>
                                <p className="text-[11px] text-slate-500">{voterRoleLine(voter)}</p>
                              </div>
                              <span className="shrink-0 text-right text-[11px] text-slate-500">{voter.votedAt ? formatDateTime(voter.votedAt) : 'Time not recorded'}</span>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${voter.userType === 'teacher' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>{voter.userType === 'teacher' ? 'Teacher' : voter.userType === 'student' ? 'Student' : 'User'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
};

const postTags = (problem) => [problem.subject, problem.chapter, ...(problem.tags || [])]
  .filter((tag) => tag && tag !== 'General')
  .filter((tag, i, arr) => arr.indexOf(tag) === i)
  .slice(0, 4);

// Posts made through the composer store the first text line as the title, so
// only show the title separately when it adds something.
const showsSeparateTitle = (problem) => Boolean(problem.title)
  && problem.title.trim() !== String(problem.problemText || '').trim().split('\n')[0].trim()
  && problem.title !== problem.poll?.question
  && problem.title !== 'Photo post';

const PostImages = ({ images, onOpen }) => {
  if (!images?.length) return null;
  const grid = images.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <div className={`mt-2.5 grid gap-1 overflow-hidden rounded-lg ${grid}`}>
      {images.slice(0, 4).map((url, index) => (
        <button key={url} type="button" onClick={() => onOpen?.(url)} className={`block cursor-zoom-in ${images.length === 3 && index === 0 ? 'col-span-2' : ''}`}>
          <img src={url} alt="" loading="lazy" className={`w-full bg-slate-100 object-cover ${images.length === 1 ? 'max-h-[420px]' : 'h-48'}`} />
        </button>
      ))}
    </div>
  );
};

const ImageLightbox = ({ src, onClose }) => {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-230 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><X size={22} /></button>
      <Motion.img initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }} src={src} alt="" className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
    </Motion.div>
  );
};

const PostMenu = ({ onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><MoreHorizontal size={18} /></button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"><Trash2 size={15} />Delete post</button>
        </div>
      )}
    </div>
  );
};

const PollView = ({ poll, onVote }) => {
  const [selected, setSelected] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  if (!poll?.question) return null;
  const voted = poll.myVote >= 0;
  const closed = Boolean(poll.isClosed);
  const showResults = voted || closed;

  const submitVote = async (index) => {
    if (index < 0 || submitting) return;
    setSubmitting(true);
    try { await onVote(index); } finally { setSubmitting(false); setSelected(-1); }
  };

  return (
    <div className="mt-2">
      <p className="mb-2.5 text-[16px] font-bold leading-snug text-slate-900">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const percent = poll.totalVotes ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;
          const mine = poll.myVote === index;
          const picked = voted ? mine : selected === index;
          return (
            <button
              key={index}
              type="button"
              disabled={submitting || closed}
              // The server toggles: clicking your current choice removes the vote.
              onClick={() => { setSelected(mine ? -1 : index); submitVote(index); }}
              title={closed ? 'This poll is closed' : mine ? 'Click to remove your vote' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg border px-3.5 text-left transition disabled:cursor-default ${showResults ? 'py-2' : 'py-2.5'} ${picked ? 'border-blue-500 bg-blue-50/60' : `border-slate-200 ${closed ? '' : 'hover:border-slate-300'}`}`}
            >
              {picked && voted
                ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={13} strokeWidth={3} /></span>
                : <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${picked ? 'border-blue-600' : 'border-slate-400'}`}>{picked && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-900">{option.text}</span>
                {showResults && (
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <Motion.span initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.5 }} className={`block h-full rounded-full ${mine ? 'bg-blue-600' : 'bg-slate-400'}`} />
                  </span>
                )}
              </span>
              {showResults && <span className={`shrink-0 text-[13px] font-semibold ${mine ? 'text-blue-600' : 'text-slate-600'}`}>{percent}%</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-slate-500">
          {submitting ? 'Saving your vote...' : `${poll.totalVotes} vote${poll.totalVotes === 1 ? '' : 's'}`}
          {closed && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><Lock size={10} />Poll closed</span>}
          {!closed && poll.closesAt && <span className="ml-2 text-[11px] text-amber-600">Closes {formatDateTime(poll.closesAt)}</span>}
        </span>
        {voted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={10} strokeWidth={3} /></span>You voted
          </span>
        )}
      </div>
    </div>
  );
};

// Facebook-style "See more": clamp to 3 lines, offer the toggle only when the text overflows.
const ExpandableText = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = React.useRef(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return undefined;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="relative mt-1.5">
      <p ref={ref} className={`whitespace-pre-line text-[13px] leading-5 text-slate-700 ${expanded ? '' : 'line-clamp-3'}`}>
        {text}
        {expanded && (
          <button type="button" onClick={() => setExpanded(false)} className="ml-1 font-semibold text-slate-600 hover:underline">less</button>
        )}
      </p>
      {/* Sits over the end of the clamped third line, like Facebook's "… more". */}
      {!expanded && overflows && (
        <span className="absolute bottom-0 right-0 bg-white pl-1 text-[13px] leading-5 text-slate-700">
          …{' '}
          <button type="button" onClick={() => setExpanded(true)} className="font-semibold text-slate-600 hover:underline">more</button>
        </span>
      )}
    </div>
  );
};

const AudienceBadge = ({ problem }) => {
  if (problem.audience !== 'classes') return <span title="School community" className="inline-flex"><Globe size={11} /></span>;
  const labels = problem.audienceClasses.map((entry) => classSectionLabel(entry.grade, entry.section));
  return <span title={labels.join(', ')} className="inline-flex items-center gap-1"><Users size={11} />{labels.length === 1 ? labels[0] : `${labels.length} classes`}</span>;
};

const DiscussionCard = ({ problem, index, onOpen, onLike, onSave, onDelete, onVote, isOwn, onImageOpen, formatTimeAgo }) => {
  const isTeacher = problem.authorType === 'teacher';
  const roleLine = isTeacher
    ? 'Teacher'
    : [problem.authorGrade ? `Class ${problem.authorGrade}` : '', 'Student'].filter(Boolean).join(' • ');
  const tags = postTags(problem);

  return (
    <Motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-xl border border-slate-200 bg-white px-4 pb-2.5 pt-3.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar initials={problem.teacherAvatar} src={problem.authorPhoto} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-900">{problem.teacherName}</p>
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"><Star size={10} className="fill-amber-400 text-amber-400" />Top Contributor</span>
          </div>
          <p className="flex flex-wrap items-center text-[11px] text-slate-500">{roleLine}<span className="mx-1">•</span>{formatTimeAgo(problem.timestamp)}<span className="mx-1">•</span><AudienceBadge problem={problem} /></p>
        </div>
        {isOwn && <PostMenu onDelete={() => onDelete(problem.id)} />}
      </div>

      {showsSeparateTitle(problem) && <button type="button" onClick={() => onOpen(problem)} className="mt-2 block text-left text-[16px] font-semibold leading-snug text-slate-900 hover:text-blue-700">{problem.title}</button>}
      {problem.problemText && <ExpandableText text={problem.problemText} />}
      <PostImages images={problem.images} onOpen={onImageOpen} />
      <PollView poll={problem.poll} onVote={(optionIndex) => onVote(problem.id, optionIndex)} />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">#{tag}</span>)}
      </div>

      <div className="mt-2.5 flex items-center gap-5 border-t border-slate-100 pt-2 text-[12px] text-slate-600">
        <button type="button" onClick={() => onLike(problem.id)} className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.isLiked ? 'text-blue-600' : ''}`}>
          <ThumbsUp size={15} className={problem.isLiked ? 'fill-current' : ''} />{problem.likes}
        </button>
        <button type="button" onClick={() => onOpen(problem)} className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.comments > 0 ? 'text-blue-600' : ''}`}>
          <MessageSquare size={15} />{problem.comments}
        </button>
        <button type="button" onClick={() => onSave(problem.id)} className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${problem.isSaved ? 'text-blue-600' : ''}`}>
          <Bookmark size={15} className={problem.isSaved ? 'fill-current' : ''} />{problem.isSaved ? 'Saved' : 'Save'}
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5"><Eye size={15} />{problem.views}</span>
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

const CommentsModal = ({ problem, comments, loading, commentText, setCommentText, posting, onPost, onLike, onSave, onVote, onImageOpen, userName, userPhoto, formatTimeAgo, onClose }) => {
  const listEndRef = React.useRef(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [comments.length]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tags = postTags(problem);

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
            {showsSeparateTitle(problem) && <h4 className="mt-2.5 text-[16px] font-semibold text-slate-900">{problem.title}</h4>}
            {problem.problemText && <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-slate-700">{problem.problemText}</p>}
            <PostImages images={problem.images} onOpen={onImageOpen} />
            <PollView poll={problem.poll} onVote={(optionIndex) => onVote(problem.id, optionIndex)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">#{tag}</span>)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white"><ThumbsUp className='text-white' size={9} /></span>{problem.likes}</span>
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
          <Avatar initials={initialsOf(userName)} src={userPhoto} size="sm" />
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

const extractHashtags = (text) => Array.from(new Set((String(text).match(/#[\p{L}\p{N}_]+/gu) || []).map((tag) => tag.slice(1))));

const AudienceRow = ({ icon, title, subtitle, checked, disabled, onClick }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">{React.createElement(icon, { size: 15 })}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-semibold text-slate-900">{title}</span>
      <span className="block text-[11px] text-slate-500">{subtitle}</span>
    </span>
    <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${checked ? 'border-blue-600' : 'border-slate-400'}`}>{checked && <span className="h-2 w-2 rounded-full bg-blue-600" />}</span>
  </button>
);

const CreatePostModal = ({ initialAction, userName, userPhoto, tagSuggestions, classOptions = [], onSubmit, onClose }) => {
  const [text, setText] = useState('');
  const [audienceType, setAudienceType] = useState('school'); // 'school' | 'classes'
  const [audienceSections, setAudienceSections] = useState([]); // sectionIds
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [images, setImages] = useState([]); // [{ file, preview }]
  const [pollOpen, setPollOpen] = useState(initialAction === 'poll');
  const [poll, setPoll] = useState({ question: '', options: ['', ''] });
  const [hashQuery, setHashQuery] = useState(null); // { start, query } of the #token at the caret
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  const imagesRef = React.useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview)), []);
  // Opened from the composer's photo button: go straight to the file picker.
  useEffect(() => {
    if (initialAction === 'photo') fileInputRef.current?.click();
  }, [initialAction]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const suggestions = useMemo(() => {
    if (!hashQuery) return [];
    const query = hashQuery.query.toLowerCase();
    return tagSuggestions.filter((tag) => tag.toLowerCase().startsWith(query) && tag.toLowerCase() !== query).slice(0, 6);
  }, [hashQuery, tagSuggestions]);

  const updateHashQuery = (value, caret) => {
    const match = value.slice(0, caret).match(/#([\p{L}\p{N}_]*)$/u);
    setHashQuery(match ? { start: caret - match[0].length, query: match[1] } : null);
    setActiveSuggestion(0);
  };

  const applySuggestion = (tag) => {
    if (!hashQuery) return;
    const caret = hashQuery.start + hashQuery.query.length + 1;
    const next = `${text.slice(0, hashQuery.start)}#${tag} ${text.slice(caret)}`;
    const nextCaret = hashQuery.start + tag.length + 2;
    setText(next);
    setHashQuery(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const addImages = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    const room = 4 - images.length;
    if (files.length > room) Swal.fire({ icon: 'info', title: 'Up to 4 photos', text: 'Only the first photos were added.', timer: 1600, showConfirmButton: false });
    const tooBig = files.slice(0, room).filter((file) => file.size > 5 * 1024 * 1024);
    if (tooBig.length) Swal.fire({ icon: 'warning', title: 'Photo too large', text: 'Each photo must be 5MB or smaller.' });
    const accepted = files.slice(0, room).filter((file) => file.size <= 5 * 1024 * 1024);
    setImages((prev) => [...prev, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removeImage = (index) => setImages((prev) => {
    URL.revokeObjectURL(prev[index].preview);
    return prev.filter((_, i) => i !== index);
  });

  const pollOptions = poll.options.map((option) => option.trim()).filter(Boolean);
  const pollValid = pollOpen && poll.question.trim() && pollOptions.length >= 2;
  const pollIncomplete = pollOpen && !pollValid && (poll.question.trim() || pollOptions.length > 0);
  const audienceIncomplete = audienceType === 'classes' && audienceSections.length === 0;
  const canPost = !submitting && !pollIncomplete && !audienceIncomplete && (text.trim() || images.length || pollValid);
  const selectedClasses = classOptions.filter((option) => audienceSections.includes(option.sectionId));
  const audienceLabel = audienceType === 'school'
    ? 'School community'
    : selectedClasses.length === 0 ? 'Choose classes'
      : selectedClasses.length === 1 ? selectedClasses[0].label
        : `${selectedClasses.length} classes`;
  const toggleSection = (sectionId) => setAudienceSections((prev) => (
    prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
  ));

  const handleSubmit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    try {
      await onSubmit({
        text: text.trim(),
        images: images.map((image) => image.file),
        poll: pollValid ? { question: poll.question.trim(), options: pollOptions } : null,
        tags: extractHashtags(text),
        audience: audienceType === 'classes'
          ? { type: 'classes', classes: selectedClasses.map(({ classId, sectionId }) => ({ classId, sectionId })) }
          : { type: 'school' },
      });
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Post failed', text: err.message || 'Could not create post' });
    } finally {
      setSubmitting(false);
    }
  };

  const addBarButton = 'flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-slate-100';

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-220 flex items-center justify-center bg-white/70 p-3 backdrop-blur-[2px]" onClick={() => !submitting && onClose()}>
      <Motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} className="flex max-h-[90vh] w-full max-w-[500px] flex-col rounded-xl bg-white shadow-[0_12px_28px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.1)]" onClick={(event) => event.stopPropagation()}>
        <div className="relative flex items-center justify-center border-b border-slate-200 px-4 py-3.5">
          <h3 className="text-[18px] font-bold text-slate-900">Create post</h3>
          <button type="button" onClick={onClose} disabled={submitting} className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-3">
          <div className="flex items-center gap-2.5">
            <Avatar initials={initialsOf(userName)} src={userPhoto} size="lg" />
            <div>
              <p className="text-[14px] font-semibold text-slate-900">{userName}</p>
              <button type="button" onClick={() => setAudienceOpen((prev) => !prev)} className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                {audienceType === 'school' ? <Globe size={11} /> : <Users size={11} />}{audienceLabel}<ChevronDown size={11} className={`transition ${audienceOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {audienceOpen && (
            <div className="mt-2.5 rounded-lg border border-slate-200 p-2">
              <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Who can see your post?</p>
              <AudienceRow
                icon={Globe}
                title="School community"
                subtitle="Everyone in your school"
                checked={audienceType === 'school'}
                onClick={() => { setAudienceType('school'); setAudienceOpen(false); }}
              />
              <AudienceRow
                icon={Users}
                title="My classes"
                subtitle={classOptions.length ? 'Only students of the classes you pick, plus teachers' : 'No assigned classes found'}
                checked={audienceType === 'classes'}
                disabled={!classOptions.length}
                onClick={() => setAudienceType('classes')}
              />
              {audienceType === 'classes' && classOptions.length > 0 && (
                <div className="ml-10 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                  <button type="button" onClick={() => setAudienceSections(audienceSections.length === classOptions.length ? [] : classOptions.map((o) => o.sectionId))} className="mb-1 text-[11px] font-semibold text-blue-600 hover:underline">
                    {audienceSections.length === classOptions.length ? 'Clear all' : 'Select all'}
                  </button>
                  {classOptions.map((option) => (
                    <label key={option.sectionId} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={audienceSections.includes(option.sectionId)} onChange={() => toggleSection(option.sectionId)} className="h-3.5 w-3.5 accent-blue-600" />
                      {option.label}
                    </label>
                  ))}
                  {audienceIncomplete && <p className="text-[11px] text-amber-600">Pick at least one class.</p>}
                  <button type="button" disabled={audienceIncomplete} onClick={() => setAudienceOpen(false)} className="mt-1 rounded-md bg-blue-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40">Done</button>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              autoFocus
              value={text}
              rows={images.length || pollOpen ? 3 : 5}
              onChange={(event) => { setText(event.target.value); updateHashQuery(event.target.value, event.target.selectionStart); }}
              onClick={(event) => updateHashQuery(text, event.currentTarget.selectionStart)}
              onKeyDown={(event) => {
                if (!suggestions.length) return;
                if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion((i) => (i + 1) % suggestions.length); }
                else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length); }
                else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); applySuggestion(suggestions[activeSuggestion]); }
                else if (event.key === 'Escape') { event.stopPropagation(); setHashQuery(null); }
              }}
              onBlur={() => setTimeout(() => setHashQuery(null), 150)}
              // placeholder={`What's on your mind, ${userName.split(' ')[0]}?`}
              placeholder={`Share a question, ideas, or resources with the community`}
              className={`mt-3 w-full resize-none bg-transparent outline-none placeholder:text-slate-500 ${text.length < 80 && !images.length && !pollOpen ? 'text-[22px]' : 'text-[15px]'}`}
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 top-full z-10 -mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Suggested hashtags</p>
                {suggestions.map((tag, index) => (
                  <button key={tag} type="button" onMouseDown={(event) => { event.preventDefault(); applySuggestion(tag); }} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${index === activeSuggestion ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <Hash size={13} className="text-slate-400" />{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div className={`mb-3 grid gap-1.5 rounded-lg border border-slate-200 p-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {images.map((image, index) => (
                <div key={image.preview} className="relative">
                  <img src={image.preview} alt="" className={`w-full rounded-md object-cover ${images.length === 1 ? 'max-h-72' : 'h-32'}`} />
                  <button type="button" onClick={() => removeImage(index)} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {pollOpen && (
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><BarChart3 size={14} className="text-blue-600" />Poll</p>
                <button type="button" onClick={() => { setPollOpen(false); setPoll({ question: '', options: ['', ''] }); }} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={14} /></button>
              </div>
              <input value={poll.question} onChange={(event) => setPoll((prev) => ({ ...prev, question: event.target.value }))} placeholder="Ask a question..." className="mb-2 w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-400" />
              <div className="space-y-1.5">
                {poll.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input value={option} onChange={(event) => setPoll((prev) => ({ ...prev, options: prev.options.map((item, i) => (i === index ? event.target.value : item)) }))} placeholder={`Option ${index + 1}`} className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-blue-400" />
                    {poll.options.length > 2 && <button type="button" onClick={() => setPoll((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500"><X size={14} /></button>}
                  </div>
                ))}
              </div>
              {poll.options.length < 6 && <button type="button" onClick={() => setPoll((prev) => ({ ...prev, options: [...prev.options, ''] }))} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"><Plus size={13} />Add option</button>}
              {pollIncomplete && <p className="mt-1.5 text-[11px] text-amber-600">Add a question and at least two options.</p>}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2 shadow-sm">
            <p className="text-[14px] font-semibold text-slate-800">Add to your post</p>
            <div className="flex items-center gap-0.5">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => { addImages(event.target.files); event.target.value = ''; }} />
              <button type="button" title="Photo" onClick={() => fileInputRef.current?.click()} disabled={images.length >= 4} className={`${addBarButton} disabled:opacity-40`}><ImageIcon size={22} className="text-emerald-500" /></button>
              <button type="button" title="Poll" onClick={() => setPollOpen(true)} className={`${addBarButton} ${pollOpen ? 'bg-blue-50' : ''}`}><BarChart3 size={22} className="text-blue-600" /></button>
            </div>
          </div>
          <button type="button" onClick={handleSubmit} disabled={!canPost} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            {submitting && <Loader2 size={16} className="animate-spin" />}{submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

export default TeacherAlcove;
