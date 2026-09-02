import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Clock, 
  Eye, 
  User, 
  Search, 
  Filter, 
  Calendar, 
  FileEdit, 
  ChevronRight, 
  AlertCircle,
  TrendingUp,
  Activity,
  Heart,
  Brain,
  Users,
  Smile,
  Zap,
  Star,
  MessageSquare,
  ClipboardList,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiJson } from './parentApi';

const POSITIVE_OPTIONS = ['Excellent', 'Good', 'Average', 'Needs Support'];
const SCORE_OPTIONS = ['High', 'Medium', 'Low'];
const CONCERN_OPTIONS = ['None', 'Mild', 'Moderate', 'High'];
const LIFE_OPTIONS = ['Healthy', 'Mostly Healthy', 'Inconsistent', 'Needs Attention'];
const field = (label, options) => ({ label, options });

const SECTIONS = [
  { title: 'Home Behavior', icon: Heart, color: 'text-rose-500 bg-rose-50', fields: [field('Obedience level', POSITIVE_OPTIONS), field('Respect towards elders', POSITIVE_OPTIONS), field('Listening habits', POSITIVE_OPTIONS), field('Following instructions', POSITIVE_OPTIONS), field('Discipline at home', POSITIVE_OPTIONS)] },
  { title: 'Communication', icon: MessageSquare, color: 'text-blue-500 bg-blue-50', fields: [field('Talks openly with parents', POSITIVE_OPTIONS), field('Expresses feelings clearly', POSITIVE_OPTIONS), field('Confidence in speaking', POSITIVE_OPTIONS), field('Shares daily experiences', POSITIVE_OPTIONS), field('Listening skills', POSITIVE_OPTIONS)] },
  { title: 'Emotional State', icon: Brain, color: 'text-purple-500 bg-purple-50', fields: [field('Mood stability', POSITIVE_OPTIONS), field('Anger control', POSITIVE_OPTIONS), field('Sensitivity level', SCORE_OPTIONS), field('Stress or anxiety signs', CONCERN_OPTIONS), field('Happiness level', SCORE_OPTIONS)] },
  { title: 'Social Skills', icon: Users, color: 'text-emerald-500 bg-emerald-50', fields: [field('Interaction with siblings', POSITIVE_OPTIONS), field('Behavior with relatives', POSITIVE_OPTIONS), field('Making friends outside school', POSITIVE_OPTIONS), field('Sharing and caring nature', POSITIVE_OPTIONS), field('Conflict handling', POSITIVE_OPTIONS)] },
  { title: 'Habits', icon: Zap, color: 'text-amber-500 bg-amber-50', fields: [field('Completes daily tasks', POSITIVE_OPTIONS), field('Helps in household work', POSITIVE_OPTIONS), field('Time management', POSITIVE_OPTIONS), field('Follows routine', POSITIVE_OPTIONS), field('Screen time control', POSITIVE_OPTIONS)] },
  { title: 'Lifestyle', icon: Activity, color: 'text-cyan-500 bg-cyan-50', fields: [field('Sleep pattern', LIFE_OPTIONS), field('Eating habits', LIFE_OPTIONS), field('Mobile/TV usage', LIFE_OPTIONS), field('Outdoor activity', LIFE_OPTIONS), field('Physical activity level', LIFE_OPTIONS)] },
  { title: 'Hobbies', icon: Star, color: 'text-yellow-500 bg-yellow-50', fields: [field('Hobbies (sports, music, drawing, etc.)', POSITIVE_OPTIONS), field('Creativity at home', POSITIVE_OPTIONS), field('Learning new things', POSITIVE_OPTIONS), field('Passion areas', POSITIVE_OPTIONS)] },
  { title: 'Personality', icon: Smile, color: 'text-orange-500 bg-orange-50', fields: [field('Confidence', POSITIVE_OPTIONS), field('Independence', POSITIVE_OPTIONS), field('Honesty', POSITIVE_OPTIONS), field('Patience', POSITIVE_OPTIONS), field('Adaptability', POSITIVE_OPTIONS)] },
  { title: 'Key Concerns', icon: AlertCircle, color: 'text-red-500 bg-red-50', fields: [field('Behavioral issues', CONCERN_OPTIONS), field('Addiction (mobile, games, etc.)', CONCERN_OPTIONS), field('Fear or anxiety', CONCERN_OPTIONS), field('Sudden changes in behavior', CONCERN_OPTIONS)] },
];

const REMARK_FIELDS = ['General observation', 'Strengths of the child', 'Areas needing improvement', 'Expectations from school'];

const buildRatings = () => {
  const out = {};
  SECTIONS.forEach((section) => section.fields.forEach((f) => { out[f.label] = ''; }));
  return out;
};

const buildRemarks = () => {
  const out = {};
  REMARK_FIELDS.forEach((f) => { out[f] = ''; });
  return out;
};

const getEmoji = (option) => {
  const value = String(option || '').toLowerCase();
  if (value.includes('excellent') || value.includes('healthy') || value === 'high') return '😀';
  if (value.includes('good') || value.includes('mostly') || value === 'medium') return '🙂';
  if (value.includes('average') || value.includes('inconsistent') || value.includes('mild')) return '😐';
  if (value.includes('low') || value.includes('needs') || value.includes('moderate')) return '😟';
  if (value.includes('none')) return '✅';
  return '🙂';
};

const concernBadge = (level) =>
  level === 'high' ? 'text-red-600 bg-red-100 border-red-200' : level === 'medium' ? 'text-amber-600 bg-amber-100 border-amber-200' : 'text-emerald-600 bg-emerald-100 border-emerald-200';

const parseSortNumber = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const n = Number(text);
  if (Number.isFinite(n)) return n;
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};

const ParentObservationNonAcademic = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ratings, setRatings] = useState(buildRatings);
  const [remarks, setRemarks] = useState(buildRemarks);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Parent') throw new Error('Please login as a parent to manage observations.');

        const [childrenPayload, observationsPayload] = await Promise.all([
          parentApiJson('/api/attendance/parent/children', {}, navigate),
          parentApiJson('/api/observations/parent', {}, navigate),
        ]);

        const childOptions = (childrenPayload.children || []).map((entry) => ({
          id: entry.student?._id || entry.studentId,
          name: entry.student?.name || 'Student',
          roll: entry.student?.roll || entry.student?.rollNo || entry.student?.rollNumber,
          session: entry.student?.session || '',
          className: entry.student?.grade || '',
          section: entry.student?.section || entry.student?.sectionName || '',
          studentCode: entry.student?.studentCode || '',
          username: entry.student?.username || '',
        }));
        const sessionSet = new Set(childOptions.map((c) => String(c.session || '').trim()).filter(Boolean));
        const classSet = new Set(childOptions.map((c) => String(c.className || '').trim()).filter(Boolean));
        const sectionSet = new Set(childOptions.map((c) => String(c.section || '').trim()).filter(Boolean));
        setSessionOptions([...sessionSet].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
        setClassOptions([...classSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        setSectionOptions([...sectionSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        setChildren(childOptions);
        setStudentId((prev) => prev || childOptions[0]?.id || '');
        setObservations(Array.isArray(observationsPayload.parentEntries) ? observationsPayload.parentEntries : []);
      } catch (err) {
        console.error('Parent observation load error:', err);
        setError(err.message || 'Unable to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedCount = useMemo(() => Object.values(ratings).filter(Boolean).length, [ratings]);
  const recentObservations = useMemo(() => observations.slice(0, 10), [observations]);
  const filteredChildren = useMemo(() => {
    return children
      .filter((child) => {
        if (selectedSession && String(child.session || '') !== selectedSession) return false;
        if (selectedClass && String(child.className || '') !== selectedClass) return false;
        if (selectedSection && String(child.section || '') !== selectedSection) return false;
        return true;
      })
      .sort((a, b) => {
        const rollA = parseSortNumber(a.roll);
        const rollB = parseSortNumber(b.roll);
        if (rollA !== rollB) return rollA - rollB;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
      });
  }, [children, selectedSession, selectedClass, selectedSection]);

  useEffect(() => {
    if (!filteredChildren.length) {
      setStudentId('');
      return;
    }
    const exists = filteredChildren.some((child) => String(child.id) === String(studentId));
    if (!exists) {
      setStudentId(String(filteredChildren[0].id));
    }
  }, [filteredChildren, studentId]);

  const concernLevel = useMemo(() => {
    const values = ['Behavioral issues', 'Addiction (mobile, games, etc.)', 'Fear or anxiety', 'Sudden changes in behavior']
      .map((k) => String(ratings[k] || '').toLowerCase());
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
      const remarkLines = REMARK_FIELDS.map((f) => `${f}: ${remarks[f] || '-'}`);

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
          date,
        }),
      }, navigate);

      setObservations((prev) => [saved, ...prev]);
      setRatings(buildRatings());
      setRemarks(buildRemarks());
      setDate(new Date().toISOString().split('T')[0]);
      toast.success('Observation recorded successfully');
    } catch (err) {
      console.error('Parent observation submit error:', err);
      setError(err.message || 'Unable to save observation');
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm group transition-all hover:shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Eye size={14} />
              <span>Wellbeing tracker</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Parent Observation</h1>
            <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              Record and track your child's behavior, communication, and emotional growth at home to help us provide better support at school.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-2xl p-4 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Main Form */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden transition-all">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                  <FileEdit size={16} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">New Observation</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full">
                <Calendar size={12} />
                <span>{new Date(date).toLocaleDateString()}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
              {/* Target Child Section */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="obs-session" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Academic Year</label>
                    <div className="relative group">
                      <select
                        id="obs-session"
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all cursor-pointer group-hover:bg-white"
                      >
                        <option value="">All Years</option>
                        {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="obs-class" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Class</label>
                    <div className="relative group">
                      <select
                        id="obs-class"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all cursor-pointer group-hover:bg-white"
                      >
                        <option value="">All Classes</option>
                        {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="obs-section" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Section</label>
                    <div className="relative group">
                      <select
                        id="obs-section"
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all cursor-pointer group-hover:bg-white"
                      >
                        <option value="">All Sections</option>
                        {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="obs-date" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Report Date</label>
                    <input
                      id="obs-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Users size={16} className="text-slate-400" />
                      Select Child
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-1 rounded-md border border-slate-100">
                      {filteredChildren.length} children matching filters
                    </span>
                  </div>
                  
                  {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 p-4 justify-center">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm font-medium">Syncing roster...</span>
                    </div>
                  ) : filteredChildren.length === 0 ? (
                    <div className="text-center p-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <Search size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No children found matching these filters.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar" role="radiogroup" aria-label="Select child for this observation">
                      {filteredChildren.map((child) => (
                        <label
                          key={child.id}
                          className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-all hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                            String(studentId) === String(child.id)
                              ? 'border-violet-500 bg-white ring-2 ring-violet-500/10 shadow-md'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            String(studentId) === String(child.id) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <User size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${String(studentId) === String(child.id) ? 'text-slate-900' : 'text-slate-700'}`}>
                              {child.name}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400">
                              {child.className} {child.section} • Roll {child.roll || '-'}
                            </p>
                          </div>
                          <input
                            type="radio"
                            name="selectedChild"
                            value={child.id}
                            checked={String(studentId) === String(child.id)}
                            onChange={(e) => setStudentId(e.target.value)}
                            className="sr-only"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assessment Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-6 bg-slate-900 rounded-2xl text-white">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-violet-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">{selectedCount} Fields Rated</span>
                  </div>
                  <div className="h-4 w-px bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Concern: <span className={concernLevel === 'high' ? 'text-rose-400' : concernLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400'}>{concernLevel.toUpperCase()}</span>
                    </span>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-slate-400 italic">Progress autosaved in session</div>
              </div>

              {/* Observation Sections */}
              <div className="space-y-12 pt-4">
                {SECTIONS.map((section, sIdx) => (
                  <div key={section.title} className="space-y-6">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${section.color} shadow-sm transition-transform hover:scale-110`}>
                        <section.icon size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">{section.title}</h3>
                        <p className="text-xs font-semibold text-slate-400">Section {sIdx + 1} Assessment</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                      {section.fields.map((f) => (
                        <fieldset key={f.label} className="space-y-3 group border-0 p-0 m-0">
                          <legend className="block text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                            {f.label}
                          </legend>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={f.label}>
                            {f.options.map((opt) => {
                              const active = ratings[f.label] === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => setRatings((prev) => ({ ...prev, [f.label]: opt }))}
                                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    active
                                      ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-500'
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="text-xl mb-1" aria-hidden="true">{getEmoji(opt)}</span>
                                  <span className="text-[11px] font-bold text-center leading-tight uppercase tracking-tighter">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Remarks Section */}
              <div className="space-y-6 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-violet-50 text-violet-500 shadow-sm">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Parent Remarks</h3>
                    <p className="text-xs font-semibold text-slate-400">Additional Qualitative Feedback</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {REMARK_FIELDS.map((f, idx) => (
                    <div key={f} className="space-y-2">
                      <label htmlFor={`obs-remark-${idx}`} className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{f}</label>
                      <textarea
                        id={`obs-remark-${idx}`}
                        rows={4}
                        value={remarks[f]}
                        onChange={(e) => setRemarks((prev) => ({ ...prev, [f]: e.target.value }))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-violet-100 focus:border-violet-400 outline-none transition-all resize-none placeholder:text-slate-400"
                        placeholder={`Share your thoughts on ${f.toLowerCase()}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <button 
                  type="submit" 
                  disabled={!isValid || submitting} 
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-3 ${
                    isValid 
                      ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200 active:scale-[0.98]' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {submitting ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                  <span>{submitting ? 'Recording Insight...' : 'Submit Observation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Insights */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-violet-400" />
              Quick Summary
            </h3>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-violet-300 uppercase tracking-widest">Active Child</p>
                  <p className="text-sm font-bold truncate max-w-[150px]">
                    {filteredChildren.find(c => String(c.id) === String(studentId))?.name || 'None Selected'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                  <User size={18} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-violet-300 uppercase tracking-widest">Total Logs</p>
                  <p className="text-xl font-bold">{observations.length}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-violet-300 uppercase tracking-widest">Urgency</p>
                  <p className={`text-xl font-bold ${concernLevel === 'high' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {concernLevel.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                Recent History
              </h2>
            </div>
            <div className="p-4">
              {recentObservations.length === 0 ? (
                <div className="text-center py-12 px-6 text-slate-400">
                  <ClipboardList size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-medium italic">Your recorded observations will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {recentObservations.map((obs) => (
                    <div key={obs.id} className="group relative border border-slate-100 rounded-2xl p-4 transition-all hover:bg-slate-50 hover:border-violet-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{obs.studentName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border uppercase tracking-wider ${concernBadge(obs.concernLevel || 'low')}`}>
                              {obs.concernLevel || 'low'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <Calendar size={10} />
                            <span>{obs.recordedAt ? new Date(obs.recordedAt).toLocaleDateString() : obs.date}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 line-clamp-2 leading-relaxed italic">
                        "{obs.observationText || obs.observation || 'No quantitative details recorded.'}"
                      </p>
                      {obs.behaviorNotes && (
                        <div className="mt-3 pt-3 border-t border-slate-100/50">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Qualitative Feedback</p>
                          <p className="text-[11px] text-slate-500 line-clamp-3 whitespace-pre-line">
                            {obs.behaviorNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default ParentObservationNonAcademic;
