import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Loader, Puzzle, ChevronRight, ChevronDown, ArrowLeft, GraduationCap,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeQuestionType, typeMeta } from './AILearningTryoutSection';
import { slugifyForUrl } from '../utils/urlSlug';
import { groupLessonsByUnit } from '../teachers/components/lesson-plan-builder/chapterGroups';
import { fetchCachedJson, peekCachedJson } from '../utils/studentApiCache';
import { loadSmartLearningSubjects, peekSmartLearningSubjects } from '../utils/smartLearningMap';
import { PRACTICE_META_URL, PRACTICE_META_TTL_MS } from '../utils/studentDashboardPrefetch';

const normalizeTag = (value) => String(value || '').trim().toLowerCase();
const subjectsFromMeta = (data) => Array.isArray(data?.subjects) ? data.subjects : [];

const groupChapters = (chapters = []) => groupLessonsByUnit(chapters.map((chapter) => ({
  chapter,
  unitNumber: chapter.meta?.unitNumber,
  unitTitle: chapter.meta?.unitTitle,
})));

// Inter, matching the type family already applied to the Learning hub and
// Smart Learning subject cards — this page previously fell back to the
// browser default sans-serif.
const PORTAL_FONT = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };

// Same colour families as the Materials page
const SUBJECT_TONES = [
  { strip: 'from-violet-500 to-indigo-500', badge: 'bg-violet-700' },
  { strip: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-700' },
  { strip: 'from-sky-500 to-blue-500', badge: 'bg-sky-700' },
  { strip: 'from-amber-400 to-orange-500', badge: 'bg-amber-700' },
];

const PracticePapersPortal = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const tryoutSelection = state?.tryoutSelection;
  const [practiceData, setPracticeData] = useState(() => {
    const meta = peekCachedJson(PRACTICE_META_URL);
    const map = peekSmartLearningSubjects();
    return meta && map ? { subjects: subjectsFromMeta(meta.data), mapSubjects: map.subjects } : null;
  });
  const [activitiesError, setActivitiesError] = useState('');

  // Subject → Chapter → Topic context selectors
  const subjects = practiceData?.subjects;
  const mapSubjects = practiceData?.mapSubjects;
  const [subjectFilter, setSubjectFilter] = useState(tryoutSelection?.subjectId ?? 'all');
  const [chapterFilter, setChapterFilter] = useState(tryoutSelection?.chapterId ?? 'all');
  const [topicFilter, setTopicFilter] = useState(tryoutSelection?.topicId ?? 'all');
  const [step, setStep] = useState(tryoutSelection?.topicId ? 'formats' : tryoutSelection ? 'chapters' : 'subjects');
  const [collapsedChapterIds, setCollapsedChapterIds] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTeacherActivities = async () => {
      try {
        const [{ data }, mapSubjects] = await Promise.all([
          fetchCachedJson(PRACTICE_META_URL, {
            ttlMs: PRACTICE_META_TTL_MS,
            fetchOptions: { signal: controller.signal },
          }),
          loadSmartLearningSubjects({ signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setPracticeData({ subjects: subjectsFromMeta(data), mapSubjects });
        }
      } catch (err) {
        if (!controller.signal.aborted) setActivitiesError(err.message || 'Unable to load teacher activities');
      }
    };
    fetchTeacherActivities();
    return () => controller.abort();
  }, []);

  const selectedSubjectName = useMemo(
    () => subjects?.find((s) => String(s.id) === subjectFilter)?.name || '',
    [subjects, subjectFilter]
  );

  const selectedSubjectMapEntry = useMemo(() => {
    if (subjectFilter === 'all') return null;
    return mapSubjects?.find((s) => (
      (s.subjectId && String(s.subjectId) === subjectFilter)
      || (selectedSubjectName && String(s.title || '').toLowerCase() === selectedSubjectName.toLowerCase())
    )) || null;
  }, [mapSubjects, subjectFilter, selectedSubjectName]);

  // Chapters in ascending order: by their number (order / unit number / "Chapter N" in the title), then by title
  const chapters = useMemo(() => {
    const list = Array.isArray(selectedSubjectMapEntry?.chapters) ? selectedSubjectMapEntry.chapters : [];
    const numberOf = (c) => {
      const n = Number(c?.order ?? c?.unitNumber ?? c?.chapterNumber ?? c?.number);
      if (Number.isFinite(n) && n > 0) return n;
      const m = String(c?.title || '').match(/^\s*(?:chapter|unit|lesson)?\s*(\d+)/i);
      return m ? Number(m[1]) : Infinity;
    };
    const grouped = groupChapters(list);
    const chapterList = grouped.flatMap(({ key, unitNumber, unitTitle, lessons }) => {
      if (key === '__none__') return lessons.map(({ chapter }) => chapter);
      const topicsById = new Map();
      lessons.forEach(({ chapter }) => {
        (chapter.topics || []).forEach((topic) => {
          const topicKey = topic.id || topic.title;
          if (!topicsById.has(topicKey)) topicsById.set(topicKey, { ...topic, id: topicKey });
        });
      });
      return [{
        id: `unit:${key}`,
        title: unitTitle || lessons[0].chapter.title,
        unitNumber,
        topics: Array.from(topicsById.values()),
      }];
    });
    return chapterList
      .map((c, i) => ({ c, i, n: numberOf(c) }))
      .sort((a, b) => (a.n - b.n) || String(a.c?.title || '').localeCompare(String(b.c?.title || ''), undefined, { numeric: true }) || (a.i - b.i))
      .map(({ c }) => c);
  }, [selectedSubjectMapEntry]);
  const selectedChapterEntry = useMemo(
    () => chapters.find((c) => c.id === chapterFilter) || null,
    [chapters, chapterFilter]
  );
  const topics = selectedChapterEntry?.topics || [];
  const selectedTopicEntry = useMemo(
    () => topics.find((t) => t.id === topicFilter) || null,
    [topics, topicFilter]
  );
  const selectedChapterTitle = selectedChapterEntry?.title || '';
  const selectedTopicTitle = selectedTopicEntry?.title || '';

  const lessonTryoutTypes = new Map();
  const lessonTryouts = selectedSubjectMapEntry?.topics?.find(
    (topic) => normalizeTag(topic.title) === normalizeTag(selectedTopicTitle)
  )?.tryoutSections;
  for (const question of Array.isArray(lessonTryouts) ? lessonTryouts : []) {
    const type = normalizeQuestionType(question?.type);
    if (type) lessonTryoutTypes.set(type, (lessonTryoutTypes.get(type) || 0) + 1);
  }

  const openTryout = (type) => {
    const subjectSlug = slugifyForUrl(selectedSubjectMapEntry.key || selectedSubjectName);
    const topicSlug = slugifyForUrl(type ? selectedTopicTitle : 'All chapters');
    const query = new URLSearchParams(type ? { type } : { scope: 'chapters' });
    navigate(`/student/smart-learning-courses/subject/${subjectSlug}/topic/${topicSlug}/assessment/tryout-section?${query}`, {
      state: {
        tryoutSelection: {
          subjectId: subjectFilter,
          chapterId: type ? chapterFilter : undefined,
          topicId: type ? topicFilter : undefined,
        },
      },
    });
  };

  // ── Step navigation: Subjects → Chapters & lessons → Available practice ──
  const openSubjectStep = (id) => {
    setSubjectFilter(String(id));
    setChapterFilter('all');
    setTopicFilter('all');
    setCollapsedChapterIds([]);
    setStep('chapters');
  };
  const openPractice = (chapterId = 'all', topicId = 'all') => {
    setChapterFilter(chapterId);
    setTopicFilter(topicId);
    setStep('formats');
  };
  const goBack = () => {
    if (step === 'formats') setStep('chapters');
    else { setStep('subjects'); setSubjectFilter('all'); setChapterFilter('all'); setTopicFilter('all'); }
  };

  const subjectTone = (name) => SUBJECT_TONES[Array.from(String(name || '')).reduce((sum, c) => sum + c.charCodeAt(0), 0) % SUBJECT_TONES.length];
  const tone = subjectTone(selectedSubjectName);
  const availableFormats = Array.from(lessonTryoutTypes, ([key, count]) => {
    const { label, icon } = typeMeta(key);
    return { key, count, name: label, icon };
  });
  const chapterNo = selectedChapterEntry?.unitNumber || chapters.indexOf(selectedChapterEntry) + 1;
  const topicNo = selectedTopicEntry ? topics.findIndex((t) => t.id === selectedTopicEntry.id) + 1 : 0;

  const headerTitle = step === 'subjects' ? 'Practice' : selectedSubjectName || 'Practice';
  const headerSub = step === 'formats'
    ? (selectedTopicEntry ? `${chapterNo}.${topicNo} ${selectedTopicTitle}` : selectedChapterEntry ? `Chapter ${chapterNo} · ${selectedChapterTitle}` : 'Whole subject')
    : step === 'chapters' ? 'Choose a chapter or topic' : '';

  // Main list view
  return (
    <main className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f8f9fd] p-4 text-slate-900 shadow-sm sm:rounded-3xl sm:px-5" style={PORTAL_FONT}>
      {/* Header */}
      <div className="mb-5 flex shrink-0 flex-wrap items-center gap-3">
        {step !== 'subjects' && (
          <button type="button" onClick={goBack} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft size={14} /> {step === 'formats' ? 'Chapters' : 'All subjects'}
          </button>
        )}
        <div className="min-w-0 flex-1 basis-28">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{headerTitle}</h1>
          {headerSub && <p className="truncate text-xs font-medium text-slate-500">{headerSub}</p>}
        </div>
        {step === 'chapters' && chapters.length > 0 && (
          <button
            type="button"
            onClick={() => openTryout()}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Practice whole subject <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-2 custom-scrollbar" role="region" aria-label="Practice" tabIndex={0}>
        {!practiceData && activitiesError ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{activitiesError}</div>
        ) : !practiceData ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader className="h-5 w-5 animate-spin" />Loading your practice…</div>
        ) : step === 'subjects' ? (
          /* ── 1. Subjects ── */
          subjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-violet-400" />
              <h2 className="font-semibold">No subjects yet</h2>
              <p className="mt-1 text-sm text-slate-500">Practice from your teachers will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => {
                const t = subjectTone(subject.name);
                const mapEntry = mapSubjects.find((s) => (s.subjectId && String(s.subjectId) === String(subject.id)) || String(s.title || '').toLowerCase() === String(subject.name || '').toLowerCase());
                const chapterCount = groupChapters(mapEntry?.chapters || []).reduce(
                  (count, group) => count + (group.key === '__none__' ? group.lessons.length : 1), 0
                );
                return (
                  <button key={subject.id} type="button" onClick={() => openSubjectStep(subject.id)} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    <div className={`h-1 bg-gradient-to-r ${t.strip}`} />
                    <div className="flex items-center gap-3 p-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${t.badge} text-white shadow-sm`}><GraduationCap size={22} /></div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold">{subject.name}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{chapterCount} chapter{chapterCount === 1 ? '' : 's'}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : step === 'chapters' ? (
          /* ── 2. Chapters & lessons ── */
          <div className="grid grid-cols-1 items-start gap-4">
            {chapters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No chapters published for this subject yet.</div>
            ) : chapters.map((chapter, ci) => {
              const expanded = !collapsedChapterIds.includes(chapter.id);
              const chapterNumber = chapter.unitNumber || ci + 1;
              const chapterTopics = Array.isArray(chapter.topics) ? chapter.topics : [];
              return (
                <article key={chapter.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className={`h-1 bg-gradient-to-r ${tone.strip}`} />
                  <h2>
                    <button type="button" aria-expanded={expanded} onClick={() => setCollapsedChapterIds((ids) => expanded ? [...ids, chapter.id] : ids.filter((id) => id !== chapter.id))} className="flex w-full items-center gap-x-4 px-4 py-3 text-left hover:bg-indigo-50/50">
                      <span className={`shrink-0 rounded-full ${tone.badge} px-2.5 py-1.5 text-xs font-bold text-white shadow-sm`}>Chapter {chapterNumber}</span>
                      <span className="min-w-0 flex-1 break-words text-sm font-bold">{chapter.title}</span>
                      <span className="text-xs font-medium text-slate-500">{chapterTopics.length} {chapterTopics.length === 1 ? 'topic' : 'topics'}</span>
                      <ChevronDown size={16} aria-hidden="true" className={`text-indigo-700 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </h2>
                  {expanded && (
                    <div className="space-y-2 border-t border-indigo-100 bg-indigo-50/30 p-3">
                      <button type="button" onClick={() => openTryout()} className="flex w-full items-center gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-3 text-left text-sm font-bold hover:bg-indigo-50/50">
                        <span className="min-w-0 flex-1">Whole chapter</span>
                        <ChevronRight size={16} className="shrink-0 text-indigo-700" />
                      </button>
                      {chapterTopics.map((topic, ti) => (
                        <button key={topic.id || topic.title} type="button" onClick={() => openPractice(chapter.id, topic.id)} className="flex w-full items-center gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-3 text-left text-sm font-bold hover:bg-indigo-50/50">
                          <span className="min-w-0 flex-1 break-words">{chapterNumber}.{ti + 1} {topic.title}</span>
                          <ChevronRight size={16} className="shrink-0 text-indigo-700" />
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          /* ── 3. Available practice ── */
          availableFormats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Puzzle className="mx-auto mb-3 h-8 w-8 text-violet-400" />
              <h2 className="font-semibold">Nothing to practise here yet</h2>
              <p className="mt-1 text-sm text-slate-500">Try another chapter or topic.</p>
              <button type="button" onClick={goBack} className="mt-4 rounded-full bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800">Choose another</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:landscape:grid-cols-3">
              {availableFormats.map(({ key, name, icon: Icon, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openTryout(key)}
                  className="flex items-center gap-3 rounded-xl border border-l-4 border-slate-200 border-l-violet-500 bg-white p-4 text-left shadow-sm transition hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900">{name}</span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {count} {count === 1 ? 'question' : 'questions'} available
                    </span>
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700" aria-hidden="true">
                    <ChevronRight size={18} />
                  </span>
                </button>
              ))}
            </div>
          )
        )}
      </div>

    </main>
  );
};

export default PracticePapersPortal;
