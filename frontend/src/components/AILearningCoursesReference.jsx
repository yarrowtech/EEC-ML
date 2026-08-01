import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Target,
  Layers,
  Maximize2,
  Minimize2,
  Download,
  FileText,
  ClipboardList,
  Clock,
  ExternalLink,
  X,
  Paperclip,
  Upload,
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';
import { PaperclipHorizontalIcon } from '@phosphor-icons/react';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';
import WorksheetSubmitModal from './WorksheetSubmitModal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const DASHBOARD_ENDPOINT = `${API_BASE}/api/student/auth/dashboard`;
const FEEDBACK_CONTEXT_ENDPOINT = `${API_BASE}/api/student/auth/teacher-feedback/context`;
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;
const STUDENT_MATERIALS_ENDPOINT = `${API_BASE}/api/student/materials`;


const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const normalizeLabel = (value) => String(value || '').trim();

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const getAttachmentUrl = (item) => {
  if (!item || typeof item !== 'object') return '';
  const directUrl = item.url || item.href || item.link || item.attachmentUrl;
  if (directUrl) return directUrl;
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  return attachments.find((attachment) => attachment?.url)?.url || '';
};

const getInlineDocumentUrl = (rawUrl = '') => {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (url.includes('docs.google.com/gview')) return url;
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
};

const buildResourceTitle = (item, fallback) => String(item?.title || item?.name || fallback || 'Resource').trim();
const formatDateLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MaterialQuickActions = ({ material, onRead }) => {
  if (!material?.url && !material?.content) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {material.content && (
        <button
          type="button"
          onClick={() => onRead(material)}
          title="Read"
          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"
        >
          <FileText size={12} />
          Read
        </button>
      )}
      {material.url && (
        <>
          <a href={getInlineDocumentUrl(material.url)} target="_blank" rel="noreferrer" title="Open" className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">
            <ExternalLink size={12} />
            Open
          </a>
          <a href={material.url} download title="Download" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700">
            <Download size={12} />
            Download
          </a>
        </>
      )}
    </div>
  );
};

const UploadedResourcesPanel = () => {
  return (
    <></>
    // <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    //   <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    //     <div>
    //       <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Uploaded Resources</h2>
    //       <p className="text-sm text-slate-500">Teacher-published materials and assessments for this chapter.</p>
    //     </div>
    //     <span className="text-sm font-bold text-[#004b71]">{resources.length} item{resources.length === 1 ? '' : 's'}</span>
    //   </div>

    //   {resourcesByGroup.length === 0 ? (
    //     <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
    //       <p className="text-sm font-bold text-slate-700">No uploaded resources found for this chapter yet.</p>
    //       <p className="mt-1 text-xs text-slate-500">Published teacher uploads will appear here automatically.</p>
    //     </div>
    //   ) : (
    //     <div className="grid gap-4 lg:grid-cols-2">
    //       {resourcesByGroup.map((group) => {
    //         const Icon = group.icon;
    //         return (
    //           <div key={group.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    //             <div className="mb-3 flex items-center gap-2">
    //               <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#004b71]">
    //                 <Icon size={16} />
    //               </span>
    //               <div>
    //                 <p className="text-sm font-black text-slate-900">{group.title}</p>
    //                 <p className="text-xs text-slate-500">{group.items.length} available</p>
    //               </div>
    //             </div>
    //             <div className="space-y-2">
    //               {group.items.map((resource) => (
    //                 <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
    //                   <div className="min-w-0">
    //                     <p className="truncate text-sm font-bold text-slate-900">{resource.title}</p>
    //                     <p className="truncate text-xs text-slate-500">{resource.description || group.title}</p>
    //                   </div>
    //                   <div className="flex shrink-0 items-center gap-1">
    //                     {resource.content && (
    //                       <button
    //                         type="button"
    //                         onClick={() => setReaderResource(resource)}
    //                         className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#004b71] hover:bg-slate-50"
    //                       >
    //                         Read
    //                       </button>
    //                     )}
    //                     {resource.url ? (
    //                       <>
    //                         <a
    //                           href={getInlineDocumentUrl(resource.url)}
    //                           target="_blank"
    //                           rel="noreferrer"
    //                           className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#004b71] hover:bg-slate-50"
    //                         >
    //                           Open <ExternalLink size={12} />
    //                         </a>
    //                         <a
    //                           href={resource.url}
    //                           download
    //                           className="inline-flex items-center gap-1 rounded-lg bg-[#004b71] px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-110"
    //                         >
    //                           <Download size={12} /> Download
    //                         </a>
    //                       </>
    //                     ) : !resource.content ? (
    //                       <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500">Listed</span>
    //                     ) : null}
    //                   </div>
    //                 </div>
    //               ))}
    //             </div>
    //           </div>
    //         );
    //       })}
    //     </div>
    //   )}

    //   {readerResource && (
    //     <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
    //       <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
    //         <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
    //           <div className="min-w-0">
    //             <p className="text-xs font-bold uppercase tracking-wide text-[#004b71]">{readerResource.group}</p>
    //             <h3 className="truncate text-lg font-black text-slate-900">{readerResource.title}</h3>
    //           </div>
    //           <button
    //             type="button"
    //             onClick={() => setReaderResource(null)}
    //             className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
    //             aria-label="Close reader"
    //           >
    //             <X size={18} />
    //           </button>
    //         </div>
    //         <div className="max-h-[65vh] overflow-y-auto p-5">
    //           <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
    //             {stripHtml(readerResource.content)}
    //           </p>
    //         </div>
    //       </div>
    //     </div>
    //   )}
    // </section>
  );
};

const AILearningCoursesReference = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDetailsView = searchParams.get('view') === 'details';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [smartLearningSubjects, setSmartLearningSubjects] = useState([]);
  const [realMaterials, setRealMaterials] = useState([]);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [worksheetModal, setWorksheetModal] = useState(null);
  const [submittedWorksheets, setSubmittedWorksheets] = useState(new Set());
  const moduleRef = useRef(null);
  const detailsViewRef = useRef(null);

  // Extract topic from URL
  const urlMatch = location.pathname.match(/\/topic\/([^/]+)$/);
  const topicSlug = urlMatch?.[1] ? deslugifyFromUrl(urlMatch[1]) : 'Topic';
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const subjectSlug = subjectMatch?.[1] ? deslugifyFromUrl(subjectMatch[1]) : 'Subject';

  // Load progress from localStorage
  useEffect(() => {
    const storageKey = `learning-topic-progress-${normalizeKey(subjectSlug)}-${normalizeKey(topicSlug)}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(data.completedSteps || []);
        setOverallProgress(data.percentage || 0);
      } catch (err) {
        console.error('Failed to load progress:', err);
      }
    }
  }, [subjectSlug, topicSlug]);

  // Fetch user data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setLoading(false);
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const [dashRes, contextRes] = await Promise.all([
          fetchCachedJson(DASHBOARD_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(FEEDBACK_CONTEXT_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
        ]);

        const [mapRes] = await Promise.all([
          fetchCachedJson(SMART_LEARNING_MAP_ENDPOINT, {
            ttlMs: 60 * 1000,
            forceRefresh: true,
            fetchOptions: { headers },
          }).catch(() => ({ data: { subjects: [] } })),
        ]);

        setProfile(dashRes?.data?.profile || null);
        setContexts(Array.isArray(contextRes?.data?.teachers) ? contextRes.data.teachers : []);
        setSmartLearningSubjects(Array.isArray(mapRes?.data?.subjects) ? mapRes.data.subjects : []);

        // Fetch real published teaching materials for this subject
        try {
          const materialsUrl = new URL(STUDENT_MATERIALS_ENDPOINT);
          if (subjectSlug) materialsUrl.searchParams.set('subject', subjectSlug);
          materialsUrl.searchParams.set('limit', '100');
          const materialsRes = await fetch(materialsUrl.toString(), { headers });
          if (materialsRes.ok) {
            const materialsJson = await materialsRes.json();
            const allMaterials = Array.isArray(materialsJson?.materials) ? materialsJson.materials : [];
            // Filter to only materials whose chapterTitle or topicTitle matches the current topicSlug
            const topicKey = normalizeKey(topicSlug);
            const filtered = allMaterials.filter((m) => {
              const chKey = normalizeKey(m?.chapterTitle || '');
              const tKey = normalizeKey(m?.topicTitle || '');
              return chKey === topicKey || tKey === topicKey || chKey.includes(topicKey) || topicKey.includes(chKey);
            });
            const mapped = filtered.map((m) => {
              const firstAttachment = Array.isArray(m.attachments) ? m.attachments.find((a) => a?.url) : null;
              return {
                id: m._id || m.id || m.title,
                title: String(m.title || '').trim() || 'Teaching Material',
                group: 'Material',
                description: String(m.typeLabel || m.category || m.subjectName || '').trim(),
                content: String(m.content || '').trim(),
                url: firstAttachment?.url || '',
                publishedAt: m.publishedAt || m.createdAt || null,
                formatLabel: String(m.typeLabel || m.category || 'Material').trim(),
              };
            });
            setRealMaterials(mapped);
          }
        } catch {
          // Non-critical — fall back to smart learning map data
        }
      } catch (err) {
        setError(err?.message || 'Failed to load learning data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [subjectSlug, topicSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedMentors = useMemo(() => {
    const teacherSet = new Set();
    contexts.forEach((ctx) => {
      const teacher = String(ctx?.teacherName || '').trim();
      if (teacher) teacherSet.add(teacher);
    });
    return Array.from(teacherSet);
  }, [contexts]);

  const selectedSmartSubject = useMemo(() => {
    const subjectKey = normalizeKey(subjectSlug);
    const contextSubject = contexts.find((ctx) => normalizeKey(ctx?.subjectName) === subjectKey);
    return smartLearningSubjects.find((subject) => (
      (contextSubject?.subjectId && subject?.subjectId && String(subject.subjectId) === String(contextSubject.subjectId)) ||
      normalizeKey(subject?.key || subject?.title) === subjectKey
    ));
  }, [contexts, smartLearningSubjects, subjectSlug]);

  const selectedChapter = useMemo(() => {
    const lookup = normalizeKey(topicSlug);
    const chapters = Array.isArray(selectedSmartSubject?.chapters) ? selectedSmartSubject.chapters : [];
    return chapters.find((chapter) => normalizeKey(chapter?.title || chapter?.id) === lookup) || null;
  }, [selectedSmartSubject, topicSlug]);

  const selectedChapterMeta = useMemo(() => selectedChapter?.meta || {}, [selectedChapter]);

  const selectedTopicFromMap = useMemo(() => {
    const lookup = normalizeKey(topicSlug);
    if (selectedChapter) return null;

    const chapters = Array.isArray(selectedSmartSubject?.chapters) ? selectedSmartSubject.chapters : [];
    for (const chapter of chapters) {
      const topics = Array.isArray(chapter?.topics) ? chapter.topics : [];
      const topic = topics.find((item) => normalizeKey(item?.title || item?.id) === lookup);
      if (topic) return { chapter, topic };
    }
    return null;
  }, [selectedChapter, selectedSmartSubject, topicSlug]);

  const mapScope = useMemo(() => {
    if (selectedChapter) {
      const topics = Array.isArray(selectedChapter.topics) ? selectedChapter.topics : [];
      return {
        label: selectedChapter.title,
        chapterTitle: selectedChapter.title,
        topics,
        chapterMeta: selectedChapterMeta,
        chapterUploads: Array.isArray(selectedChapter.uploads) ? selectedChapter.uploads : [],
      };
    }

    if (selectedTopicFromMap?.topic) {
      return {
        label: selectedTopicFromMap.topic.title,
        chapterTitle: selectedTopicFromMap.chapter?.title || '',
        topics: [selectedTopicFromMap.topic],
        chapterUploads: [],
      };
    }

    return {
      label: topicSlug,
      chapterTitle: '',
      topics: [],
      chapterMeta: {},
      chapterUploads: [],
    };
  }, [selectedChapter, selectedChapterMeta, selectedTopicFromMap, topicSlug]);

  const chapterMaterials = useMemo(() => {
    const resources = [];
    const seen = new Set();
    const addResource = (item, group, fallbackTitle) => {
      const title = buildResourceTitle(item, fallbackTitle);
      if (!title) return;
      const url = getAttachmentUrl(item);
      const key = [group, title, url].map(normalizeKey).join('::');
      if (seen.has(key)) return;
      seen.add(key);
      resources.push({
        id: item?.id || item?._id || key,
        title,
        group,
        description: item?.description || item?.typeLabel || item?.learningType || item?.paperType || item?.bucket || '',
        content: item?.content || item?.description || '',
        url,
        publishedAt: item?.publishedAt || item?.createdAt || item?.dueDate || null,
        formatLabel: normalizeLabel(item?.bucket || item?.typeLabel || item?.learningType || item?.materialType || item?.type || 'File'),
      });
    };

    const allowedMaterialBuckets = new Set(['study materials', 'presentations', 'images', 'experiments', 'report upload', 'additional resources']);
    mapScope.chapterUploads.forEach((upload) => {
      const bucket = normalizeKey(upload?.bucket);
      if (bucket && !allowedMaterialBuckets.has(bucket)) return;
      addResource(upload, 'Material', upload?.title);
    });
    mapScope.topics.forEach((topic) => {
      (topic.subtopics || []).forEach((subtopic) => {
        (subtopic.materials || []).forEach((material) => addResource(material, 'Material', material?.title));
      });
    });

    return resources;
  }, [mapScope]);

  const chapterAssessments = useMemo(() => {
    const resources = [];
    const seen = new Set();
    const addAssessment = (item, fallbackTitle) => {
      const title = buildResourceTitle(item, fallbackTitle);
      if (!title) return;
      const url = getAttachmentUrl(item);
      const key = ['Assessment', title, url].map(normalizeKey).join('::');
      if (seen.has(key)) return;
      seen.add(key);
      resources.push({
        id: item?.id || item?._id || key,
        title,
        group: 'Assessment',
        description: item?.description || item?.typeLabel || item?.learningType || item?.paperType || 'Assessment',
        content: item?.content || item?.description || '',
        url,
        publishedAt: item?.publishedAt || item?.createdAt || item?.dueDate || null,
        formatLabel: normalizeLabel(item?.typeLabel || item?.learningType || item?.materialType || item?.paperType || 'Assessment'),
      });
    };

    mapScope.chapterUploads.forEach((upload) => {
      const bucket = normalizeKey(upload?.bucket);
      if (bucket.includes('assessment') || bucket.includes('practice papers') || bucket.includes('tryout')) {
        addAssessment(upload, upload?.title);
      }
    });

    mapScope.topics.forEach((topic) => {
      (topic.subtopics || []).forEach((subtopic) => {
        (subtopic.assessments || []).forEach((assessment) => addAssessment(assessment, assessment?.title));
      });
    });

    return resources;
  }, [mapScope]);

  const learningMaterials = useMemo(
    () => (realMaterials.length > 0 ? realMaterials : chapterMaterials),
    [realMaterials, chapterMaterials],
  );

  const assessmentItems = useMemo(() => chapterAssessments, [chapterAssessments]);

  const chapterWorksheets = useMemo(() => {
    const downloadLinks = [];
    const submittableAssignments = [];
    const seenLinks = new Set();
    const seenAssignments = new Set();

    mapScope.topics.forEach((topic) => {
      (topic.subtopics || []).forEach((subtopic) => {
        (subtopic.worksheetUploads || []).forEach((upload) => {
          if (!upload.url || seenLinks.has(upload.url)) return;
          seenLinks.add(upload.url);
          downloadLinks.push({ id: upload.id, title: upload.title || 'Worksheet', url: upload.url });
        });
        (subtopic.assignments || []).forEach((assignment) => {
          if (seenAssignments.has(assignment.id)) return;
          seenAssignments.add(assignment.id);
          submittableAssignments.push({ ...assignment, _id: assignment.id });
        });
      });
    });

    return { downloadLinks, submittableAssignments };
  }, [mapScope]);

  const chapterLearningObjectives = useMemo(() => {
    const objectives = Array.isArray(selectedChapterMeta.learningObjectives)
      ? selectedChapterMeta.learningObjectives.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return objectives;
  }, [selectedChapterMeta]);

  const chapterInstructionalFlow = useMemo(() => {
    const flow = Array.isArray(selectedChapterMeta.instructionalFlow)
      ? selectedChapterMeta.instructionalFlow.filter((item) => item && typeof item === 'object')
      : []; 
    if (!flow.length) return [];
    return flow.map((step, index) => ({
      id: step.id || `step-${index + 1}`,
      title: String(step.title || step.description || `Step ${index + 1}`).trim(),
      duration: Number(step.duration || 0) || 0,
      type: String(step.type || step.phase || `Step ${index + 1}`).trim(),
    }));
  }, [selectedChapterMeta]);

  // Progress is based only on the instructional flow published for this topic.
  useEffect(() => {
    const storageKey = `learning-topic-progress-${normalizeKey(subjectSlug)}-${normalizeKey(topicSlug)}`;
    const totalSteps = chapterInstructionalFlow.length;
    const percentage = totalSteps > 0
      ? Math.round((completedSteps.length / totalSteps) * 100)
      : 0;
    const data = {
      completedSteps,
      percentage,
      lastAccessed: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Storage full/unavailable (private mode, quota exceeded) — progress
      // tracking is best-effort and must not crash the page.
    }
    setOverallProgress(percentage);
  }, [completedSteps, chapterInstructionalFlow.length, subjectSlug, topicSlug]);

  const chapterIntroduction = String(selectedChapterMeta.introduction || '').trim();
  const chapterExplanation = String(selectedChapterMeta.explanation || '').trim();
  const chapterRecap = String(selectedChapterMeta.recap || '').trim();
  const hasTopicData = Boolean(selectedChapter || selectedTopicFromMap?.topic);

  const chapterDateLabel = formatDateLabel(selectedChapterMeta.date || selectedChapter?.date);
  const chapterDayLabel = selectedChapterMeta.day || (selectedChapterMeta.date ? new Date(selectedChapterMeta.date).toLocaleDateString('en-US', { weekday: 'long' }) : '') || '';
  const chapterDurationLabel = selectedChapterMeta.duration || (chapterInstructionalFlow.length > 0 ? `${chapterInstructionalFlow.reduce((sum, step) => sum + Number(step.duration || 0), 0)} Min` : '');

  const normalizedTopicSlug = slugifyForUrl(topicSlug);
  const normalizedSubjectSlug = slugifyForUrl(subjectSlug);
  const readingContent = useMemo(() => {
    const sourceMaterials = chapterMaterials.filter((item) => String(item.content || '').trim());
    if (!sourceMaterials.length) return { intro: '', sections: [] };

    const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const first = sourceMaterials[0];
    const intro = strip(first?.content).slice(0, 900);
    const sections = sourceMaterials.slice(1, 6).map((item) => ({
      title: item.title || 'Learning Note',
      text: strip(item.content).slice(0, 1200),
    })).filter((sec) => sec.text);

    return { intro, sections };
  }, [chapterMaterials]);

  const openDetailsPage = () => {
    navigate(
      `/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}?view=details`
    );
  };

  const closeDetailsPage = () => {
    navigate(
      `/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}`,
      { replace: true }
    );
  };
  const goBackToSubjectTopics = () => {
    navigate(`/student/smart-learning-courses/subject/${normalizedSubjectSlug}`);
  };
  const toggleDetailsFullscreen = async () => {
    try {
      if (!document.fullscreenElement && detailsViewRef.current) {
        await detailsViewRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      setError('Fullscreen mode is not available on this device/browser.');
    }
  };
  const introductionText = chapterIntroduction || readingContent.intro;
  const detailSections = useMemo(() => ([
    { id: 'introduction', title: 'Introduction', text: introductionText },
    ...(chapterExplanation ? [{ id: 'explanation', title: 'Explanation', text: chapterExplanation }] : []),
    ...readingContent.sections.map((section, index) => ({
      id: `section-${index + 1}`,
      title: section.title,
      text: section.text,
    })),
    ...(chapterRecap ? [{ id: 'recap', title: 'Quick Recap', text: chapterRecap }] : []),
  ]).filter((section) => String(section.text || '').trim()), [readingContent, introductionText, chapterExplanation, chapterRecap]);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [activeFlowStepId, setActiveFlowStepId] = useState(null);
  const [activeDetailSection, setActiveDetailSection] = useState('introduction');
  const detailSectionRefs = useRef({});
  const detailsScrollRef = useRef(null);

  useEffect(() => {
    if (!isDetailsView) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveDetailSection(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.2, 0.4, 0.6] }
    );

    detailSections.forEach((section) => {
      const node = detailSectionRefs.current[section.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [isDetailsView, detailSections]);

  const detailProgress = useMemo(() => {
    const idx = detailSections.findIndex((section) => section.id === activeDetailSection);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / detailSections.length) * 100);
  }, [activeDetailSection, detailSections]);

  const jumpToDetailSection = (sectionId) => {
    const node = detailSectionRefs.current[sectionId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDetailsScroll = () => {
    const container = detailsScrollRef.current;
    if (!container || !detailSections.length) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= 8) {
      setActiveDetailSection(detailSections[detailSections.length - 1].id);
    }
  };

  const goToTryoutSection = () => {
    navigate(`/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}/assessment/tryout-section`);
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (required = 8) => {
        if (y + required > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addTitle = (text) => {
        ensureSpace(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 34, 62);
        doc.setFontSize(16);
        doc.text(text, margin, y);
        y += 8;
      };

      const addHeading = (text) => {
        ensureSpace(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(12);
        doc.text(text, margin, y);
        y += 6;
      };

      const addParagraph = (text) => {
        const lines = doc.splitTextToSize(String(text || ''), contentWidth);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(10);
        lines.forEach((line) => {
          ensureSpace(5);
          doc.text(line, margin, y);
          y += 4.8;
        });
        y += 1.5;
      };

      const addBullet = (text) => {
        const bulletIndent = 4;
        const wrapped = doc.splitTextToSize(String(text || ''), contentWidth - bulletIndent - 2);
        wrapped.forEach((line, idx) => {
          ensureSpace(5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(55, 65, 81);
          doc.setFontSize(10);
          doc.text(idx === 0 ? '•' : ' ', margin, y);
          doc.text(line, margin + bulletIndent, y);
          y += 4.8;
        });
      };

      addTitle(`${topicSlug} - Smart Learning Resources`);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Subject: ${subjectSlug}`, margin, y);
      y += 5;
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, margin, y);
      y += 7;

      addHeading('Reading Mode Content');
      addParagraph(introductionText);
      readingContent.sections.forEach((section, index) => {
        addHeading(`${index + 1}. ${section.title}`);
        addParagraph(section.text);
      });

      addHeading('Learning Objectives');
      chapterLearningObjectives.forEach((objective) => addBullet(objective));
      y += 3;

      addHeading('Instructional Flow');
      chapterInstructionalFlow.forEach((step, index) => {
        addBullet(`${index + 1}. ${step.type} - ${step.title} (${step.duration} min)`);
      });
      y += 3;

      addHeading('Materials');
      learningMaterials.forEach((material) => addBullet(`${material.title}: ${material.description}`));
      y += 3;

      addHeading('Assessment Resources');
      assessmentItems.forEach((item) => addBullet(`${item.title}: ${item.description}`));
      y += 3;

      if (assignedMentors.length) {
        addHeading('Assigned Mentors');
        assignedMentors.forEach((mentor) => addBullet(mentor));
      }

      const safeTopic = String(topicSlug || 'topic')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      doc.save(`smart-learning-${safeTopic || 'topic'}-resources.pdf`);
    } catch {
      setError('Unable to generate PDF right now. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && moduleRef.current) {
        await moduleRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      setError('Fullscreen mode is not available on this device/browser.');
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const isDetailsFullscreen = document.fullscreenElement === detailsViewRef.current;
      const isLearningFullscreen = document.fullscreenElement === moduleRef.current;
      setIsFullscreen(isDetailsFullscreen || isLearningFullscreen);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f6] p-6 text-sm text-slate-500">
        Loading published learning data…
      </div>
    );
  }

  if (!hasTopicData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f6] p-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-slate-900">Topic not found</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            No published learning data was found for “{topicSlug}” in “{subjectSlug}”.
          </p>
          <button
            type="button"
            onClick={goBackToSubjectTopics}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Back to subject
          </button>
        </div>
      </div>
    );
  }

  if (isDetailsView) {
    const sectionIdx = Math.max(1, detailSections.findIndex((s) => s.id === activeDetailSection) + 1);
    const practiceResources = [...assessmentItems, ...chapterWorksheets.downloadLinks];

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
          .rdr-playfair { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
          .rdr-inter { font-family: 'Inter', system-ui, sans-serif; }
          .rdr-scroll::-webkit-scrollbar { width: 3px; }
          .rdr-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); border-radius: 10px; }
          .rdr-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 10px; }
          @keyframes rdr-pulse-dot { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
          .rdr-dot { animation: rdr-pulse-dot 2s ease-in-out infinite; display:inline-block; width:6px; height:6px; border-radius:50%; background:#4ade80; }
          @media (max-width: 860px) {
            .rdr-reader-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 520px) {
            .rdr-book-title { font-size: 26px !important; }
            .rdr-book-page { padding: 20px 18px 24px !important; }
          }
        `}</style>

        <div
          ref={(node) => { detailsViewRef.current = node; detailsScrollRef.current = node; }}
          onScroll={handleDetailsScroll}
          style={{ minHeight: '100vh', overflowY: 'auto', background: '#f5f4f1', padding: 20 }}
        >
          {/* Nav row */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ maxWidth: 1100, margin: '0 auto 20px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <button
              type="button"
              onClick={closeDetailsPage}
              className="rdr-inter"
              style={{ display:'inline-flex', alignItems:'center', gap:8, borderRadius:40, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(255,255,255,0.85)', backdropFilter:'blur(12px)', padding:'8px 18px', fontSize:13, fontWeight:600, color:'#2d2d2d', cursor:'pointer' }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={toggleDetailsFullscreen}
              className="rdr-inter"
              style={{ display:'inline-flex', alignItems:'center', gap:8, borderRadius:40, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(255,255,255,0.85)', backdropFilter:'blur(12px)', padding:'8px 18px', fontSize:13, fontWeight:600, color:'#2d2d2d', cursor:'pointer' }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit' : 'Full Screen'}
            </button>
          </motion.div>

          {/* Reader grid */}
          <div
            className="rdr-reader-grid"
            style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 340px', gap:28, alignItems:'start' }}
          >
            {/* ── Book page ── */}
            <AnimatePresence>
              {!isPracticeMode && (
                <motion.div
                  key="book-page"
                  initial={{ opacity:0, y:20 }}
                  animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0, y:-16, transition:{ duration:0.22 } }}
                  transition={{ duration:0.42, ease:[0.25,0.46,0.45,0.94] }}
                  className="rdr-book-page"
                  style={{
                    background:'rgba(255,255,255,0.72)',
                    backdropFilter:'blur(22px) saturate(180%)',
                    WebkitBackdropFilter:'blur(22px) saturate(180%)',
                    borderRadius:32,
                    border:'1px solid rgba(0,0,0,0.06)',
                    padding:'40px 44px 36px',
                    boxShadow:'0 20px 60px -12px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.8)',
                    position:'relative',
                    overflow:'hidden',
                  }}
                >
                  {/* Radial light sheen */}
                  <div style={{ position:'absolute', top:'-50%', left:'-50%', width:'200%', height:'200%', background:'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.42) 0%, transparent 60%)', pointerEvents:'none' }} />

                  {/* Chapter meta */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, paddingBottom:20, borderBottom:'1px solid rgba(0,0,0,0.04)', position:'relative', zIndex:1 }}>
                    <span className="rdr-playfair" style={{ fontSize:12, fontWeight:600, letterSpacing:'4px', textTransform:'uppercase', color:'rgba(0,0,0,0.25)', background:'rgba(0,0,0,0.025)', padding:'6px 18px', borderRadius:40, border:'1px solid rgba(0,0,0,0.04)' }}>
                      {mapScope.chapterTitle || subjectSlug}
                    </span>
                    <span className="rdr-inter" style={{ display:'flex', alignItems:'center', gap:12, fontSize:13, color:'rgba(0,0,0,0.25)', fontWeight:400 }}>
                      <span className="rdr-dot" />
                      Reading
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="rdr-playfair rdr-book-title" style={{ fontSize:38, fontWeight:700, lineHeight:1.2, marginBottom:8, color:'#1a1a1a', letterSpacing:'-0.5px', position:'relative', zIndex:1 }}>
                    {topicSlug}
                  </h1>
                  <p className="rdr-inter" style={{ fontSize:15, color:'rgba(0,0,0,0.3)', fontWeight:300, marginBottom:28, letterSpacing:'0.3px', fontStyle:'italic', position:'relative', zIndex:1 }}>
                    {mapScope.label && mapScope.label !== topicSlug ? mapScope.label : `${subjectSlug} · Immersive Reader`}
                  </p>

                  {/* Theory sections */}
                  <div className="rdr-scroll" style={{ display:'flex', flexDirection:'column', gap:24, maxHeight:420, overflowY:'auto', paddingRight:8, position:'relative', zIndex:1 }}>
                    {detailSections.length > 0 ? (
                      detailSections.map((section, idx) => (
                        <motion.div
                          key={section.id}
                          id={section.id}
                          ref={(node) => { detailSectionRefs.current[section.id] = node; }}
                          initial={{ opacity:0, x:-10 }}
                          animate={{ opacity:1, x:0 }}
                          transition={{ delay: idx * 0.07, duration:0.38 }}
                          style={{
                            paddingLeft:20,
                            borderLeft:`2px solid ${activeDetailSection === section.id ? 'rgba(139,92,246,0.22)' : 'rgba(0,0,0,0.04)'}`,
                            transition:'border-left-color 0.3s',
                          }}
                        >
                          <p className="rdr-inter" style={{ fontSize:16, lineHeight:1.85, color:'rgba(0,0,0,0.68)', fontWeight:300, letterSpacing:'0.2px' }}>
                            {section.text}
                          </p>
                          <span className="rdr-inter" style={{ display:'inline-block', marginTop:9, fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:1, color:'rgba(0,0,0,0.15)', background:'rgba(0,0,0,0.025)', padding:'2px 12px', borderRadius:20 }}>
                            {section.title}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <p className="rdr-inter" style={{ fontSize:15, color:'rgba(0,0,0,0.28)', fontStyle:'italic', textAlign:'center', padding:'32px 0' }}>
                        No reading content published for this topic yet.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sidebar ── */}
            <AnimatePresence>
              {!isPracticeMode && (
                <motion.div
                  key="sidebar"
                  initial={{ opacity:0, x:20 }}
                  animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:20, transition:{ duration:0.22 } }}
                  transition={{ duration:0.4, delay:0.1 }}
                  style={{ display:'flex', flexDirection:'column', gap:20 }}
                >
                  {/* Progress ring widget */}
                  <motion.div
                    initial={{ opacity:0, scale:0.95 }}
                    animate={{ opacity:1, scale:1 }}
                    transition={{ delay:0.18, duration:0.4 }}
                    style={{ background:'rgba(255,255,255,0.72)', backdropFilter:'blur(16px) saturate(180%)', WebkitBackdropFilter:'blur(16px) saturate(180%)', borderRadius:32, border:'1px solid rgba(0,0,0,0.04)', padding:'24px 26px 28px', boxShadow:'0 20px 40px -12px rgba(0,0,0,0.04)' }}
                  >
                    <p className="rdr-inter" style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:2, color:'rgba(0,0,0,0.15)', marginBottom:14 }}>Progress</p>
                    <div style={{ display:'flex', alignItems:'center', gap:18 }}>
                      {/* Conic ring */}
                      <motion.div
                        animate={{ background: `conic-gradient(#7c3aed ${detailProgress}%, rgba(0,0,0,0.04) ${detailProgress}%)` }}
                        transition={{ duration:0.5 }}
                        style={{ width:62, height:62, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexShrink:0 }}
                      >
                        <div style={{ position:'absolute', width:50, height:50, borderRadius:'50%', background:'rgba(255,255,255,0.88)' }} />
                        <span className="rdr-playfair" style={{ position:'relative', zIndex:2, fontSize:15, fontWeight:600, color:'#1a1a1a' }}>
                          {detailProgress}%
                        </span>
                      </motion.div>
                      <div className="rdr-inter" style={{ fontSize:14, color:'rgba(0,0,0,0.35)', fontWeight:300, lineHeight:1.5 }}>
                        <strong style={{ color:'rgba(0,0,0,0.7)', fontWeight:500 }}>{detailProgress}%</strong> read<br />
                        <span style={{ fontSize:12, color:'rgba(0,0,0,0.18)' }}>
                          {sectionIdx} of {detailSections.length} section{detailSections.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Launch Practice button */}
                  <motion.div
                    initial={{ opacity:0, y:10 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ delay:0.24, duration:0.38 }}
                    style={{ background:'rgba(255,255,255,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderRadius:32, border:'1px solid rgba(0,0,0,0.04)', padding:'20px 24px 22px', boxShadow:'0 20px 40px -12px rgba(0,0,0,0.04)' }}
                  >
                    <p className="rdr-inter" style={{ fontSize:12, color:'rgba(0,0,0,0.2)', fontWeight:400, letterSpacing:'0.5px', marginBottom:12 }}>
                      Ready to test your understanding?
                    </p>
                    <motion.button
                      type="button"
                      whileHover={{ scale:1.01, boxShadow:'0 8px 30px rgba(124,58,237,0.07)', borderColor:'rgba(124,58,237,0.16)' }}
                      whileTap={{ scale:0.97 }}
                      onClick={() => setIsPracticeMode(true)}
                      className="rdr-inter"
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(135deg, rgba(124,58,237,0.045), rgba(124,58,237,0.01))', border:'1px solid rgba(124,58,237,0.09)', borderRadius:60, padding:'14px 20px 14px 26px', fontSize:15, fontWeight:500, color:'#1a1a1a', cursor:'pointer' }}
                    >
                      <span>Launch Practice</span>
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'50%', background:'rgba(124,58,237,0.05)', fontSize:18, color:'#7c3aed' }}>✧</span>
                    </motion.button>
                  </motion.div>

                  {/* Section navigator */}
                  {detailSections.length > 1 && (
                    <motion.div
                      initial={{ opacity:0, y:10 }}
                      animate={{ opacity:1, y:0 }}
                      transition={{ delay:0.3, duration:0.38 }}
                      style={{ background:'rgba(255,255,255,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderRadius:32, border:'1px solid rgba(0,0,0,0.04)', padding:'20px 24px', boxShadow:'0 20px 40px -12px rgba(0,0,0,0.04)' }}
                    >
                      <p className="rdr-inter" style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:2, color:'rgba(0,0,0,0.15)', marginBottom:12 }}>Sections</p>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {detailSections.map((section) => (
                          <motion.button
                            key={section.id}
                            type="button"
                            whileHover={{ color:'#7c3aed' }}
                            onClick={() => jumpToDetailSection(section.id)}
                            className="rdr-inter"
                            style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:'4px 0', fontSize:13, fontWeight: activeDetailSection === section.id ? 600 : 400, color: activeDetailSection === section.id ? '#7c3aed' : 'rgba(0,0,0,0.35)', transition:'color 0.2s', display:'block', width:'100%' }}
                          >
                            {section.title}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Practice panel (full-span) ── */}
            <AnimatePresence>
              {isPracticeMode && (
                <motion.div
                  key="practice-panel"
                  initial={{ opacity:0, y:32, scale:0.98 }}
                  animate={{ opacity:1, y:0, scale:1 }}
                  exit={{ opacity:0, y:24, scale:0.98 }}
                  transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
                  style={{ gridColumn:'1 / -1', background:'rgba(255,255,255,0.82)', backdropFilter:'blur(22px) saturate(180%)', WebkitBackdropFilter:'blur(22px) saturate(180%)', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', padding:'32px 34px 34px', boxShadow:'0 20px 60px -12px rgba(0,0,0,0.07)' }}
                >
                  {/* Panel header */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, paddingBottom:16, borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                    <h3 className="rdr-playfair" style={{ fontSize:28, fontWeight:600, color:'#1a1a1a', letterSpacing:'-0.3px' }}>✦ Practice Paper</h3>
                    <span className="rdr-inter" style={{ fontSize:12, fontWeight:500, color:'rgba(0,0,0,0.22)', background:'rgba(0,0,0,0.025)', padding:'4px 16px', borderRadius:40, border:'1px solid rgba(0,0,0,0.04)' }}>
                      {practiceResources.length} resource{practiceResources.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Resource list */}
                  <div style={{ display:'grid', gap:14, marginBottom:24 }}>
                    {practiceResources.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'40px 20px' }}>
                        <p className="rdr-inter" style={{ fontSize:15, color:'rgba(0,0,0,0.28)', fontStyle:'italic', marginBottom:8 }}>
                          No practice materials uploaded for this topic yet.
                        </p>
                        <p className="rdr-inter" style={{ fontSize:13, color:'rgba(0,0,0,0.18)' }}>
                          Try the interactive Tryout Section below!
                        </p>
                      </div>
                    ) : (
                      practiceResources.map((item, idx) => (
                        <motion.div
                          key={item.id || idx}
                          initial={{ opacity:0, x:-10 }}
                          animate={{ opacity:1, x:0 }}
                          transition={{ delay: idx * 0.055 }}
                          style={{ background:'rgba(255,255,255,0.5)', borderRadius:20, padding:'18px 22px', border:'1px solid rgba(0,0,0,0.035)' }}
                        >
                          <p className="rdr-inter" style={{ fontSize:15, fontWeight:400, color:'rgba(0,0,0,0.75)', marginBottom:12 }}>
                            <span style={{ color:'rgba(124,58,237,0.4)', fontWeight:600, marginRight:8 }}>
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {item.title}
                          </p>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 12px' }}>
                            {item.url && (
                              <>
                                <a href={getInlineDocumentUrl(item.url)} target="_blank" rel="noreferrer" className="rdr-inter" style={{ fontSize:13, color:'#7c3aed', background:'rgba(124,58,237,0.06)', padding:'4px 14px', borderRadius:40, border:'1px solid rgba(124,58,237,0.1)', textDecoration:'none', fontWeight:500 }}>
                                  Open
                                </a>
                                <a href={item.url} download className="rdr-inter" style={{ fontSize:13, color:'#7c3aed', background:'rgba(124,58,237,0.06)', padding:'4px 14px', borderRadius:40, border:'1px solid rgba(124,58,237,0.1)', textDecoration:'none', fontWeight:500 }}>
                                  Download
                                </a>
                              </>
                            )}
                            {item.content && (
                              <button
                                type="button"
                                onClick={() => setActiveMaterial(item)}
                                className="rdr-inter"
                                style={{ fontSize:13, color:'#7c3aed', background:'rgba(124,58,237,0.06)', padding:'4px 14px', borderRadius:40, border:'1px solid rgba(124,58,237,0.1)', fontWeight:500, cursor:'pointer' }}
                              >
                                Read
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Worksheet assignments in practice panel */}
                  {chapterWorksheets.submittableAssignments.length > 0 && (
                    <div style={{ marginBottom:24, display:'flex', flexDirection:'column', gap:12 }}>
                      <p className="rdr-inter" style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:2, color:'rgba(0,0,0,0.18)' }}>Worksheet Assignments</p>
                      {chapterWorksheets.submittableAssignments.map((assignment) => {
                        const isSubmitted = submittedWorksheets.has(assignment._id);
                        const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                        return (
                          <div key={assignment._id} style={{ background:'rgba(255,255,255,0.5)', borderRadius:20, padding:'16px 20px', border:'1px solid rgba(0,0,0,0.035)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
                              <FileText size={15} style={{ color:'#7c3aed', flexShrink:0 }} />
                              <p className="rdr-inter" style={{ fontSize:14, fontWeight:500, color:'rgba(0,0,0,0.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{assignment.title}</p>
                              {isSubmitted && (
                                <span className="rdr-inter" style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:4, borderRadius:40, background:'rgba(16,185,129,0.1)', padding:'2px 10px', fontSize:10, fontWeight:700, color:'#059669' }}>
                                  <CheckCircle2 size={10} /> Submitted
                                </span>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:8 }}>
                              {attachmentUrl && (
                                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="rdr-inter" style={{ fontSize:13, color:'#7c3aed', background:'rgba(124,58,237,0.06)', padding:'5px 14px', borderRadius:40, border:'1px solid rgba(124,58,237,0.1)', textDecoration:'none', fontWeight:500 }}>
                                  <Download size={11} style={{ display:'inline', marginRight:4, verticalAlign:'middle' }} />Download
                                </a>
                              )}
                              {!isSubmitted ? (
                                <button type="button" onClick={() => setWorksheetModal(assignment)} className="rdr-inter" style={{ fontSize:13, color:'white', background:'#7c3aed', padding:'5px 14px', borderRadius:40, border:'none', fontWeight:500, cursor:'pointer' }}>
                                  Submit
                                </button>
                              ) : (
                                <span className="rdr-inter" style={{ fontSize:12, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                                  <CheckCircle2 size={12} /> Done
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Panel footer */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:16, borderTop:'1px solid rgba(0,0,0,0.04)', flexWrap:'wrap', gap:12 }}>
                    <motion.button
                      type="button"
                      whileHover={{ color:'rgba(0,0,0,0.55)' }}
                      onClick={() => setIsPracticeMode(false)}
                      className="rdr-inter"
                      style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:14, color:'rgba(0,0,0,0.22)' }}
                    >
                      ← Return to theory
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale:1.025, boxShadow:'0 12px 32px rgba(124,58,237,0.26)' }}
                      whileTap={{ scale:0.97 }}
                      onClick={goToTryoutSection}
                      className="rdr-inter"
                      style={{ background:'linear-gradient(135deg, #7c3aed, #a855f7)', color:'white', border:'none', borderRadius:60, padding:'14px 32px', fontSize:15, fontWeight:600, cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,0.22)' }}
                    >
                      Try Full Tryout →
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Worksheets strip (theory view only) */}
          {!isPracticeMode && (chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
            <motion.section
              initial={{ opacity:0, y:12 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:0.35 }}
              style={{ maxWidth:1100, margin:'28px auto 0', background:'rgba(238,240,255,0.7)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderRadius:28, border:'1px solid rgba(99,102,241,0.12)', padding:'20px 24px' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <ClipboardList size={18} style={{ color:'#6366f1' }} />
                <h2 className="rdr-inter" style={{ fontSize:15, fontWeight:800, color:'#1e1b4b' }}>Worksheets</h2>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {chapterWorksheets.downloadLinks.map((link) => (
                  <div key={link.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'white', borderRadius:16, padding:'12px 16px', border:'1px solid rgba(99,102,241,0.1)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                      <FileText size={14} style={{ color:'#6366f1', flexShrink:0 }} />
                      <p className="rdr-inter" style={{ fontSize:13, fontWeight:600, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.title}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:5, borderRadius:40, background:'#6366f1', padding:'6px 14px', fontSize:12, fontWeight:700, color:'white', textDecoration:'none' }}>
                      <Download size={11} /> Download
                    </a>
                  </div>
                ))}
                {chapterWorksheets.submittableAssignments.map((assignment) => {
                  const isSubmitted = submittedWorksheets.has(assignment._id);
                  const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                  return (
                    <div key={assignment._id} style={{ background:'white', borderRadius:16, padding:'12px 16px', border:'1px solid rgba(99,102,241,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                        <FileText size={14} style={{ color:'#6366f1', flexShrink:0 }} />
                        <p className="rdr-inter" style={{ fontSize:13, fontWeight:600, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{assignment.title}</p>
                        {isSubmitted && (
                          <span className="rdr-inter" style={{ flexShrink:0, borderRadius:40, background:'rgba(16,185,129,0.1)', padding:'2px 10px', fontSize:10, fontWeight:700, color:'#059669' }}>
                            Submitted
                          </span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        {attachmentUrl && (
                          <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, borderRadius:40, border:'1px solid rgba(99,102,241,0.2)', background:'rgba(99,102,241,0.06)', padding:'5px 12px', fontSize:12, fontWeight:600, color:'#6366f1', textDecoration:'none' }}>
                            <Download size={11} /> Download
                          </a>
                        )}
                        {!isSubmitted ? (
                          <button type="button" onClick={() => setWorksheetModal(assignment)} style={{ borderRadius:40, background:'#6366f1', padding:'5px 14px', fontSize:12, fontWeight:700, color:'white', border:'none', cursor:'pointer' }}>
                            Submit
                          </button>
                        ) : (
                          <span className="rdr-inter" style={{ fontSize:12, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                            <CheckCircle2 size={12} /> Done
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          <div style={{ maxWidth:1100, margin:'0 auto', paddingBottom:32 }} />
        </div>

        {worksheetModal && (
          <WorksheetSubmitModal
            assignment={worksheetModal}
            onClose={() => setWorksheetModal(null)}
            onSubmitted={() => {
              setSubmittedWorksheets((prev) => new Set([...prev, worksheetModal._id]));
              setWorksheetModal(null);
            }}
          />
        )}

        {activeMaterial && (
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)', padding:16 }}
          >
            <motion.div
              initial={{ scale:0.94, y:20 }}
              animate={{ scale:1, y:0 }}
              style={{ width:'100%', maxWidth:680, maxHeight:'85vh', overflow:'hidden', borderRadius:24, background:'white', boxShadow:'0 40px 80px rgba(0,0,0,0.18)' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'18px 22px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                <h3 className="rdr-inter" style={{ fontSize:16, fontWeight:800, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeMaterial.title}</h3>
                <button type="button" onClick={() => setActiveMaterial(null)} style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', color:'#666', padding:6, borderRadius:8, display:'flex' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ maxHeight:'65vh', overflowY:'auto', padding:22 }}>
                <p className="rdr-inter" style={{ whiteSpace:'pre-wrap', fontSize:14, lineHeight:1.8, color:'#374151' }}>{stripHtml(activeMaterial.content)}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </>
    );
  }

  // Initialise activeFlowStepId to first step on first render
  const resolvedActiveFlowStepId = activeFlowStepId ?? (chapterInstructionalFlow[0]?.id ?? null);

  const handleFlowStepClick = (stepId) => {
    setActiveFlowStepId(stepId);
    setCompletedSteps((prev) => {
      if (prev.includes(stepId)) return prev;
      return [...prev, stepId];
    });
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  };
  const pillVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
  };
  const flowVariants = {
    hidden: { opacity: 0, x: 14 },
    visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.08, duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] } }),
  };

  return (
    <div
      ref={moduleRef}
      style={{
        minHeight: '100vh',
        background: '#f2f0f5',
        backgroundImage: 'radial-gradient(ellipse at 10% 20%, rgba(180,160,220,0.09) 0%, transparent 60%), radial-gradient(ellipse at 90% 80%, rgba(120,100,200,0.07) 0%, transparent 50%)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '28px 20px 48px',
        color: '#1a142b',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        .tr-playfair { font-family: 'Playfair Display', Georgia, serif; }
        .tr-inter { font-family: 'Inter', -apple-system, sans-serif; }
        .tr-scroll::-webkit-scrollbar { width: 3px; }
        .tr-scroll::-webkit-scrollbar-thumb { background: rgba(120,100,200,0.15); border-radius: 10px; }
        @keyframes tr-badge-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes tr-glow-dot { 0%,100%{box-shadow:0 0 12px rgba(107,92,173,0.12)} 50%{box-shadow:0 0 22px rgba(107,92,173,0.28)} }
        @keyframes tr-float-icon { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes tr-hint-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .tr-badge-pulse { animation: tr-badge-pulse 3s ease-in-out infinite; }
        .tr-glow-dot { animation: tr-glow-dot 2s ease-in-out infinite; }
        .tr-float-icon { animation: tr-float-icon 4s ease-in-out infinite; }
        .tr-hint-pulse { animation: tr-hint-pulse 3s ease-in-out infinite; }
        @media (max-width: 820px) { .tr-grid-two { grid-template-columns: 1fr !important; gap: 24px !important; } }
        @media (max-width: 480px) { .tr-meta-grid { grid-template-columns: 1fr !important; } .tr-top-bar { flex-direction: column; align-items: flex-start !important; } .tr-card { padding: 20px 16px 24px !important; border-radius: 28px !important; } }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="tr-card"
        style={{
          maxWidth: 1020,
          width: '100%',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          borderRadius: 36,
          boxShadow: '0 8px 48px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.6)',
          padding: '40px 44px 44px',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {/* ── Top bar ── */}
        <div
          className="tr-top-bar"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={goBackToSubjectTopics}
              className="tr-inter"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 40, border: '1px solid rgba(120,100,200,0.14)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#4a3a5c', cursor: 'pointer' }}
            >
              <ArrowLeft size={14} /> Back
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="tr-inter"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 40, border: '1px solid rgba(120,100,200,0.14)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#4a3a5c', cursor: 'pointer', opacity: downloadingPdf ? 0.6 : 1 }}
            >
              <Download size={13} />
              <span>{downloadingPdf ? 'Preparing…' : 'PDF'}</span>
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={toggleFullscreen}
              className="tr-inter"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 40, border: '1px solid rgba(120,100,200,0.14)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#4a3a5c', cursor: 'pointer' }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </motion.button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              className="tr-badge-pulse tr-inter"
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#7a6a8f', background: 'rgba(160,140,200,0.10)', padding: '7px 20px', borderRadius: 40, border: '1px solid rgba(160,140,200,0.08)' }}
            >
              ✦ Topic Reader
            </span>
            <span className="tr-playfair" style={{ fontSize: 22, fontWeight: 600, color: '#1a142b', letterSpacing: '-0.3px', marginLeft: 8 }}>
              {mapScope.chapterTitle || subjectSlug}
            </span>
            <span className="tr-inter" style={{ fontSize: 14, fontWeight: 400, color: '#9a8aaa', fontStyle: 'normal', background: 'rgba(160,140,200,0.06)', padding: '2px 14px', borderRadius: 30, border: '1px solid rgba(160,140,200,0.06)', marginLeft: 4 }}>
              {topicSlug}
            </span>
          </div>
        </div>

        {/* ── Two-column grid ── */}
        <div
          className="tr-grid-two"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px 44px', marginTop: 4 }}
        >

          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Meta pills 2×2 */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="tr-meta-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
            >
              {[
                { label: 'Date', value: chapterDateLabel || 'Not set', light: false },
                { label: 'Day', value: chapterDayLabel || '—', light: false },
                { label: 'Duration', value: chapterDurationLabel || '—', light: false },
                { label: 'Step by Step', value: `${completedSteps.length} / ${chapterInstructionalFlow.length}`, light: true },
              ].map((pill) => (
                <motion.div
                  key={pill.label}
                  variants={pillVariants}
                  whileHover={{ y: -2, background: 'rgba(255,255,255,0.82)', boxShadow: '0 4px 16px rgba(120,100,200,0.07)' }}
                  style={{ background: 'rgba(255,255,255,0.52)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 18, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.4)', cursor: 'default' }}
                >
                  <div className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#9a8aaa', marginBottom: 4 }}>{pill.label}</div>
                  <div className="tr-inter" style={{ fontSize: 15, fontWeight: pill.light ? 400 : 600, color: pill.light ? '#4a3a5c' : '#1a142b' }}>{pill.value}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Progress block */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ background: 'rgba(255,255,255,0.52)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 22, padding: '22px 26px 24px', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="tr-inter" style={{ fontSize: 13, fontWeight: 500, color: '#4a3a5c' }}>Reading Progress</span>
                <span className="tr-inter" style={{ fontSize: 13, fontWeight: 600, color: '#1a142b', background: 'rgba(120,100,200,0.06)', padding: '2px 12px', borderRadius: 30 }}>
                  {overallProgress}%
                </span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'rgba(120,100,200,0.08)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{ height: '100%', background: 'linear-gradient(90deg,#8b7ac8,#6b5cad)', borderRadius: 10 }}
                />
              </div>
              <div className="tr-inter" style={{ fontSize: 13, color: '#9a8aaa', fontWeight: 400 }}>
                <strong style={{ color: '#1a142b', fontWeight: 600 }}>{completedSteps.length}</strong> of {chapterInstructionalFlow.length} learning steps completed
              </div>
              <motion.button
                type="button"
                whileHover={{ gap: 12, borderBottomColor: '#6b5cad', color: '#4a3a7a' }}
                onClick={openDetailsPage}
                className="tr-inter"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14, fontWeight: 500, color: '#6b5cad', background: 'none', border: 'none', borderBottom: '1.5px solid rgba(107,92,173,0.14)', paddingBottom: 3, cursor: 'pointer', transition: 'all 0.3s ease' }}
              >
                Read Full Article <motion.span whileHover={{ x: 6 }} style={{ display: 'inline-block', transition: '0.3s' }}>→</motion.span>
              </motion.button>
            </motion.div>

            {/* Learning Objectives */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.42 }}
            >
              <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 10 }}>
                Learning Objectives
              </p>
              {chapterLearningObjectives.length === 0 ? (
                <p className="tr-inter" style={{ fontSize: 13, color: '#b0a0c0', fontStyle: 'italic' }}>No objectives published for this topic.</p>
              ) : (
                <motion.ul
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  style={{ listStyle: 'none', padding: 0 }}
                >
                  {chapterLearningObjectives.map((obj, idx) => (
                    <motion.li
                      key={idx}
                      variants={pillVariants}
                      className="tr-inter"
                      style={{ fontSize: 14, fontWeight: 400, color: '#1a142b', padding: '8px 0', borderBottom: '1px solid rgba(120,100,200,0.04)', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                    >
                      <span style={{ width: 5, height: 5, marginTop: 7, background: 'linear-gradient(135deg,#8b7ac8,#6b5cad)', borderRadius: '50%', flexShrink: 0, opacity: 0.45 }} />
                      {obj}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </motion.div>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Instructional Flow */}
            <div>
              <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 10 }}>
                Instructional Flow
              </p>
              {chapterInstructionalFlow.length === 0 ? (
                <p className="tr-inter" style={{ fontSize: 13, color: '#b0a0c0', fontStyle: 'italic' }}>No instructional flow provided yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {chapterInstructionalFlow.map((step, idx) => {
                    const isActive = resolvedActiveFlowStepId === step.id;
                    const isDone = completedSteps.includes(step.id);
                    return (
                      <motion.div
                        key={step.id}
                        custom={idx}
                        variants={flowVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ x: 4, background: isActive ? 'rgba(107,92,173,0.07)' : 'rgba(255,255,255,0.58)' }}
                        onClick={() => handleFlowStepClick(step.id)}
                        className="tr-inter"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: 16,
                          background: isActive ? 'rgba(107,92,173,0.06)' : 'rgba(255,255,255,0.32)',
                          border: `1px solid ${isActive ? 'rgba(107,92,173,0.09)' : 'rgba(255,255,255,0.32)'}`,
                          cursor: 'pointer',
                          transition: 'background 0.3s, border-color 0.3s',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Step indicator dot */}
                        <motion.span
                          animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                          transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                          className={isActive ? 'tr-glow-dot' : ''}
                          style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isActive ? '#6b5cad' : isDone ? '#6b5cad' : 'rgba(107,92,173,0.10)', transition: 'background 0.3s' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#6b5cad' : '#9a8aaa', width: 28, flexShrink: 0, fontFeatureSettings: '"tnum"', transition: 'color 0.3s' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a142b', flexShrink: 0, flex: 1 }}>{step.type || step.phase}</span>
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#9a8aaa', letterSpacing: '0.2px', flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.title}</span>
                        {step.duration > 0 && (
                          <motion.span
                            whileHover={{ scale: 1.06 }}
                            style={{ fontSize: 11, fontWeight: 500, color: isActive ? '#6b5cad' : '#b0a0c0', background: isActive ? 'rgba(107,92,173,0.06)' : 'rgba(120,100,200,0.04)', padding: '2px 12px', borderRadius: 30, border: `1px solid ${isActive ? 'rgba(107,92,173,0.08)' : 'rgba(120,100,200,0.04)'}`, whiteSpace: 'nowrap', transition: 'all 0.3s' }}
                          >
                            ⏱ {step.duration} min
                          </motion.span>
                        )}
                        {isDone && (
                          <CheckCircle2 size={14} style={{ color: '#6b5cad', opacity: 0.6, flexShrink: 0 }} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Materials */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.42 }}
            >
              <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 10 }}>
                Materials
              </p>
              {learningMaterials.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(4px)', borderRadius: 16, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <p className="tr-inter" style={{ fontSize: 13, color: '#9a8aaa', fontStyle: 'italic' }}>No chapter material uploaded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {learningMaterials.map((material, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.06 }}
                      whileHover={{ y: -2, background: 'rgba(255,255,255,0.58)', boxShadow: '0 4px 16px rgba(120,100,200,0.05)' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', background: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.3)', transition: 'background 0.3s, box-shadow 0.3s' }}
                    >
                      <span style={{ fontSize: 18, opacity: 0.5, flexShrink: 0 }}>📄</span>
                      <span className="tr-inter" style={{ fontSize: 14, fontWeight: 500, color: '#1a142b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{material.title}</span>
                      <span className="tr-inter" style={{ fontSize: 11, color: '#9a8aaa', fontWeight: 400, letterSpacing: '0.5px', textTransform: 'uppercase', flexShrink: 0 }}>
                        {normalizeLabel(material.formatLabel || material.description || 'File')}
                      </span>
                      <MaterialQuickActions material={material} onRead={setActiveMaterial} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Assessment */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36, duration: 0.42 }}
            >
              <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 10 }}>
                Assessment
              </p>
              <div style={{ background: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: 22, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.3)' }}>
                {assessmentItems.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '4px 0' }}>
                    <div className="tr-float-icon" style={{ fontSize: 32, opacity: 0.15, marginBottom: 10 }}>📋</div>
                    <p className="tr-inter" style={{ fontSize: 15, fontWeight: 500, color: '#1a142b' }}>No assessment uploaded yet.</p>
                    <p className="tr-inter" style={{ fontSize: 13, color: '#9a8aaa', fontWeight: 400, marginTop: 4 }}>Teacher assessment files will appear here.</p>
                    <span className="tr-hint-pulse tr-inter" style={{ marginTop: 12, fontSize: 12, color: '#b0a0c0', background: 'rgba(120,100,200,0.04)', padding: '4px 16px', borderRadius: 30, border: '1px dashed rgba(120,100,200,0.1)' }}>
                      awaiting upload
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {assessmentItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="tr-inter" style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#7a6a8f', background: 'rgba(120,100,200,0.07)', padding: '3px 10px', borderRadius: 20 }}>
                          {normalizeLabel(item.formatLabel || 'Assessment')}
                        </span>
                        <span className="tr-inter" style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1a142b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                        <MaterialQuickActions material={item} onRead={setActiveMaterial} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

          </div>{/* /right col */}
        </div>{/* /grid */}

        {/* ── Worksheets (below grid) ── */}
        {(chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.45 }}
            style={{ marginTop: 32, background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 24, padding: '22px 26px', border: '1px solid rgba(255,255,255,0.4)' }}
          >
            <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 14 }}>Worksheets</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
              {chapterWorksheets.downloadLinks.map((link) => (
                <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(255,255,255,0.55)', borderRadius: 16, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <FileText size={14} style={{ color: '#6b5cad', flexShrink: 0 }} />
                    <p className="tr-inter" style={{ fontSize: 13, fontWeight: 600, color: '#1a142b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</p>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 30, background: '#6b5cad', padding: '5px 14px', fontSize: 12, fontWeight: 600, color: 'white', textDecoration: 'none' }}>
                    <Download size={11} /> Download
                  </a>
                </div>
              ))}
              {chapterWorksheets.submittableAssignments.map((assignment) => {
                const isSubmitted = submittedWorksheets.has(assignment._id);
                const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                return (
                  <div key={assignment._id} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.55)', borderRadius: 16, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <FileText size={14} style={{ color: '#6b5cad', flexShrink: 0 }} />
                      <p className="tr-inter" style={{ fontSize: 13, fontWeight: 600, color: '#1a142b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignment.title}</p>
                      {isSubmitted && (
                        <span className="tr-inter" style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,0.1)', padding: '2px 10px', borderRadius: 30 }}>Submitted</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {attachmentUrl && (
                        <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 30, border: '1px solid rgba(107,92,173,0.2)', background: 'rgba(107,92,173,0.05)', padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#6b5cad', textDecoration: 'none' }}>
                          <Download size={10} /> Download
                        </a>
                      )}
                      {!isSubmitted ? (
                        <button type="button" onClick={() => setWorksheetModal(assignment)} style={{ borderRadius: 30, background: '#6b5cad', padding: '4px 14px', fontSize: 12, fontWeight: 700, color: 'white', border: 'none', cursor: 'pointer' }}>
                          Submit
                        </button>
                      ) : (
                        <span className="tr-inter" style={{ fontSize: 12, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Explanation + Recap ── */}
        {(chapterExplanation || chapterRecap) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.45 }}
            style={{ marginTop: 28, display: 'grid', gridTemplateColumns: chapterExplanation && chapterRecap ? '1fr 1fr' : '1fr', gap: 20 }}
          >
            {chapterExplanation && (
              <div style={{ background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(8px)', borderRadius: 22, padding: '22px 24px', border: '1px solid rgba(255,255,255,0.4)' }}>
                <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 12 }}>Step-by-Step Explanation</p>
                <p className="tr-inter" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.75, color: '#1a142b' }}>{chapterExplanation}</p>
              </div>
            )}
            {chapterRecap && (
              <div style={{ background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(8px)', borderRadius: 22, padding: '22px 24px', border: '1px solid rgba(255,255,255,0.4)' }}>
                <p className="tr-inter" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#9a8aaa', marginBottom: 12 }}>Quick Recap</p>
                <p className="tr-inter" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.75, color: '#1a142b' }}>{chapterRecap}</p>
              </div>
            )}
          </motion.div>
        )}

        <UploadedResourcesPanel resources={[...learningMaterials, ...assessmentItems]} />
      </motion.div>

      {/* ── Modals ── */}
      {worksheetModal && (
        <WorksheetSubmitModal
          assignment={worksheetModal}
          onClose={() => setWorksheetModal(null)}
          onSubmitted={() => {
            setSubmittedWorksheets((prev) => new Set([...prev, worksheetModal._id]));
            setWorksheetModal(null);
          }}
        />
      )}

      <AnimatePresence>
        {activeMaterial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,20,43,0.55)', padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.93, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 18 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: '100%', maxWidth: 680, maxHeight: '85vh', overflow: 'hidden', borderRadius: 28, background: 'white', boxShadow: '0 40px 80px rgba(26,20,43,0.18)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', borderBottom: '1px solid rgba(120,100,200,0.08)', background: 'rgba(160,140,200,0.04)' }}>
                <h3 className="tr-playfair" style={{ fontSize: 17, fontWeight: 600, color: '#1a142b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeMaterial.title}</h3>
                <button type="button" onClick={() => setActiveMaterial(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#7a6a8f', padding: 6, display: 'flex', borderRadius: 8 }}>
                  <X size={18} />
                </button>
              </div>
              <div className="tr-scroll" style={{ maxHeight: '65vh', overflowY: 'auto', padding: 22 }}>
                <p className="tr-inter" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, color: '#1a142b' }}>{stripHtml(activeMaterial.content)}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ position: 'fixed', bottom: 20, right: 20, maxWidth: 380, borderRadius: 16, background: 'rgba(255,245,245,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(200,100,100,0.15)', padding: '12px 18px', boxShadow: '0 8px 32px rgba(200,100,100,0.1)' }}
        >
          <p className="tr-inter" style={{ fontSize: 13, fontWeight: 600, color: '#c53030' }}>{error}</p>
        </motion.div>
      )}
    </div>
  );
};

export default AILearningCoursesReference;
