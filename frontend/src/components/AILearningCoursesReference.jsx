import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
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
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';
import { PaperclipHorizontalIcon } from '@phosphor-icons/react';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const DASHBOARD_ENDPOINT = `${API_BASE}/api/student/auth/dashboard`;
const FEEDBACK_CONTEXT_ENDPOINT = `${API_BASE}/api/student/auth/teacher-feedback/context`;
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;


const LEARNING_STEPS = [
  { id: 'step1', title: 'Introduction & Overview', duration: 10, type: 'The Hook' },
  { id: 'step2', title: 'Core Concepts & Theory', duration: 25, type: 'Instruction' },
  { id: 'step3', title: 'Practice & Application', duration: 30, type: 'Guided Practice' },
  { id: 'step4', title: 'Review & Self-Assessment', duration: 15, type: 'Synthesis' },
];

const LEARNING_OBJECTIVES = [
  'Master the fundamental concepts and principles of the topic with comprehensive understanding',
  'Apply learned concepts to solve real-world problems and complex scenarios',
  'Synthesize knowledge to create meaningful connections between related topics',
];

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

const UploadedResourcesPanel = ({ resources }) => {
  const [readerResource, setReaderResource] = useState(null);
  const groups = [
    { key: 'Material', title: 'Materials', icon: FileText },
    { key: 'Uploaded Material', title: 'Uploaded Files', icon: Layers },
    { key: 'Worksheet Upload', title: 'Worksheet Uploads', icon: ClipboardList },
    { key: 'Worksheet', title: 'Worksheets', icon: ClipboardList },
    { key: 'Assessment', title: 'Assessments', icon: CheckCircle2 },
  ];

  const resourcesByGroup = groups.map((group) => ({
    ...group,
    items: resources.filter((resource) => resource.group === group.key),
  })).filter((group) => group.items.length > 0);

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
  const [profile, setProfile] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [smartLearningSubjects, setSmartLearningSubjects] = useState([]);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const moduleRef = useRef(null);
  const detailsViewRef = useRef(null);

  // Extract topic from URL
  const urlMatch = location.pathname.match(/\/topic\/([^/]+)$/);
  const topicSlug = urlMatch?.[1] ? deslugifyFromUrl(urlMatch[1]) : 'Topic';
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const subjectSlug = subjectMatch?.[1] ? deslugifyFromUrl(subjectMatch[1]) : 'Subject';

  // Load progress from localStorage
  useEffect(() => {
    const storageKey = `learning-topic-progress-${topicSlug}`;
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
  }, [topicSlug]);

  // Save progress to localStorage
  useEffect(() => {
    const storageKey = `learning-topic-progress-${topicSlug}`;
    const percentage = LEARNING_STEPS.length > 0
      ? Math.round((completedSteps.length / LEARNING_STEPS.length) * 100)
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
  }, [completedSteps, topicSlug]);

  // Fetch user data
  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') return;

        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const [dashRes, contextRes] = await Promise.all([
          fetchCachedJson(DASHBOARD_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(FEEDBACK_CONTEXT_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
        ]);

        const [mapRes] = await Promise.all([
          fetchCachedJson(SMART_LEARNING_MAP_ENDPOINT, { ttlMs: 60 * 1000, fetchOptions: { headers } }).catch(() => ({ data: { subjects: [] } })),
        ]);

        setProfile(dashRes?.data?.profile || null);
        setContexts(Array.isArray(contextRes?.data?.teachers) ? contextRes.data.teachers : []);
        setSmartLearningSubjects(Array.isArray(mapRes?.data?.subjects) ? mapRes.data.subjects : []);
      } catch (err) {
        setError(err?.message || 'Failed to load learning data');
      }
    };

    load();
  }, []);

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

  const learningMaterials = useMemo(() => chapterMaterials, [chapterMaterials]);

  const assessmentItems = useMemo(() => chapterAssessments, [chapterAssessments]);

  const chapterLearningObjectives = useMemo(() => {
    const objectives = Array.isArray(selectedChapterMeta.learningObjectives)
      ? selectedChapterMeta.learningObjectives.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return objectives.length > 0 ? objectives : LEARNING_OBJECTIVES;
  }, [selectedChapterMeta]);

  const chapterInstructionalFlow = useMemo(() => {
    const flow = Array.isArray(selectedChapterMeta.instructionalFlow)
      ? selectedChapterMeta.instructionalFlow.filter((item) => item && typeof item === 'object')
      : []; 
    if (!flow.length) return [];
    return flow.map((step, index) => ({
      id: step.id || `step-${index + 1}`,
      title: String(step.title || step.description || `Step ${index + 1}`).trim(),
      duration: Number(step.duration || 0) || LEARNING_STEPS[index % LEARNING_STEPS.length]?.duration || 0,
      type: String(step.type || step.phase || `Step ${index + 1}`).trim(),
    }));
  }, [selectedChapterMeta]);

  const chapterIntroduction = String(selectedChapterMeta.introduction || '').trim();
  const chapterExplanation = String(selectedChapterMeta.explanation || '').trim();
  const chapterRecap = String(selectedChapterMeta.recap || '').trim();

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
    ...readingContent.sections.map((section, index) => ({
      id: `section-${index + 1}`,
      title: section.title,
      text: section.text,
    })),
  ]), [readingContent, introductionText]);
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

  if (isDetailsView) {
    return (
      <div
        ref={(node) => {
          detailsViewRef.current = node;
          detailsScrollRef.current = node;
        }}
        onScroll={handleDetailsScroll}
        className="h-screen overflow-y-auto bg-[#f9f9f7] px-4 py-5 md:px-8 lg:px-12"
        style={{ fontFamily: 'Work Sans, sans-serif', color: '#1a1c1b' }}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-5 flex items-center gap-2">
            <button
              onClick={closeDetailsPage}
              className="inline-flex items-center gap-2 rounded border border-[#c4c7c7] bg-white px-3 py-2 text-sm font-semibold text-[#2f3130] hover:bg-[#f4f4f2]"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={toggleDetailsFullscreen}
              className="inline-flex items-center gap-2 rounded border border-[#c4c7c7] bg-white px-3 py-2 text-sm font-semibold text-[#2f3130] hover:bg-[#f4f4f2]"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            </button>
          </div>

          <section className="relative min-h-[420px] rounded overflow-hidden">
            <img
              alt="Topic cover"
              className="absolute inset-0 h-full w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPcy9M6aEX_21YYZwpZqit5NcXlZqs15W9c4XW8kG9iGkvycGh_kYPIqXj5YKYud58IjEwCxWPJcjir6ndjWeLU7IrE4o9xNPsAvQW2gzdwSXhA9QKh2zh6AeXU2pJnKSObeVH5w38mKTlafryBC7LA0yaGMGUqVKo3EzyFyaSBB7_nQzeazhUYDXfaP1Rn6wFG7s0mCs6DqnfjP594oKHutJVB3iqTgcz5gj6kpISXIcuTLIPaITH1c-NkMVVlvM37DTLMWmP8kQ"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/20" />
            <div className="relative flex h-full flex-col justify-end px-5 pb-10 sm:px-10">
              <span className="mb-3 text-[10px] uppercase tracking-[0.16em] text-white/80">Topic Reader</span>
              <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-6xl" style={{ fontFamily: 'Newsreader, serif' }}>
                {topicSlug}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-xl">
                A comprehensive learning experience designed to help you master key concepts through structured practice, visual aids, and interactive materials.
              </p>
            </div>
          </section>

          <main className="mt-10 flex flex-col gap-10 md:flex-row md:gap-14">
            <aside className="hidden w-1/4 md:block">
              <div className="sticky top-8">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#444748]">Reading Progress</p>
                <div className="mt-4 flex">
                  <div className="mr-4 relative w-[2px] bg-[#dbdbdb]">
                    <div className="absolute left-0 top-0 w-[2px] bg-black transition-all duration-300" style={{ height: `${detailProgress}%` }} />
                  </div>
                  <div className="space-y-6 text-xs uppercase tracking-[0.12em] text-[#444748]">
                    {detailSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => jumpToDetailSection(section.id)}
                        className={`block text-left hover:text-black ${activeDetailSection === section.id ? 'text-black font-semibold' : 'text-[#444748]'}`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-6 text-sm text-[#444748]">{detailProgress}% read</p>
              </div>
            </aside>

            <div className="mx-auto w-full max-w-[720px]">
              <article className="text-[20px] leading-[1.85] text-[#1a1c1b]" style={{ fontFamily: 'Newsreader, serif' }}>
                <section
                  id="introduction"
                  ref={(node) => {
                    detailSectionRefs.current.introduction = node;
                  }}
                  className="mb-12 scroll-mt-24"
                >
                  <h2 className="mb-6 text-3xl italic text-black">Understanding the Landscape</h2>
                  <p className="mb-6">{introductionText}</p>
                </section>

                <div className="my-12">
                  <img
                    className="aspect-video w-full rounded object-cover"
                    alt="Topic inline visual"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFvrS7k6fBFpvew6Q3BLld583PcM3nKdKP_LC4GJPPITQloaLhSZV1jsAJPqCxMBv5htj8emBhzSxuI876N-gsnrGOKQSRgQkQFIsUbOqnHsTgdLnWyVuNKmlyEKhEukVdSlBbruFxLu-XLwTBdqaYXg4zs2KZrvDaoyq1RLozs1osmcf9vVVjVOKYSq_o2GJnuvJoc3fiNpwyqHnBHbQkcCQEQr_fuqpxVVp2OddInG2fzoXRR326-3vQ5GNupv9NtjqPtgQNUxw"
                  />
                  <p className="mt-3 text-sm italic text-[#444748]" style={{ fontFamily: 'Work Sans, sans-serif' }}>
                    Fig 1.1: Foundational ideas and conceptual structure of {topicSlug}.
                  </p>
                </div>

                {readingContent.sections.map((section, index) => (
                  <section
                    key={section.title}
                    id={`section-${index + 1}`}
                    ref={(node) => {
                      detailSectionRefs.current[`section-${index + 1}`] = node;
                    }}
                    className="mb-12 scroll-mt-24"
                  >
                    <h3 className="mb-6 text-3xl italic text-black">{section.title}</h3>
                    <p className="mb-6">{section.text}</p>
                    {index === 0 && (
                      <blockquote className="mb-6 border-l-2 border-[#6e5c40] pl-6 text-2xl italic leading-snug text-[#6e5c40]">
                        "Clear concepts create confident problem solvers."
                      </blockquote>
                    )}
                  </section>
                ))}
              </article>
            </div>
          </main>
          <footer className="mt-8 border-t border-[#d7d9d8] pt-5 pb-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={goToTryoutSection}
                className="inline-flex items-center rounded-2xl px-8 py-4 text-base font-bold text-white transition-all duration-500 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#9cc3ff] focus:ring-offset-2 group"
                style={{
                  background: 'linear-gradient(135deg, #0f6fff 0%, #4f8dff 100%)',
                  boxShadow: '0 8px 20px rgba(15, 111, 255, 0.25), 0 0 30px rgba(79, 141, 255, 0.15)',
                  animation: 'tryoutSoftEntrance 800ms cubic-bezier(0.34, 1.56, 0.64, 1), tryoutSoftGlow 3.5s ease-in-out 900ms infinite',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Try Tryout
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </div>
          </footer>
          <style>{`
            @keyframes tryoutSoftEntrance {
              0% {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            @keyframes tryoutSoftGlow {
              0%, 100% {
                transform: translateY(0);
                filter: drop-shadow(0 8px 20px rgba(15, 111, 255, 0.25));
              }
              50% {
                transform: translateY(-3px);
                filter: drop-shadow(0 12px 28px rgba(15, 111, 255, 0.35));
              }
            }
            button[style*="tryoutSoftEntrance"]:hover {
              transform: translateY(-4px);
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={moduleRef}
      className="min-h-screen w-full flex flex-col overflow-x-hidden"
      style={{ backgroundColor: '#f8f9fa', fontFamily: 'Lexend, sans-serif' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-indigo-100 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <button
            onClick={goBackToSubjectTopics}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 sm:text-sm"
          >
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
          </button>
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-indigo-500 sm:text-xs">
              {subjectSlug} • {profile?.className || 'Class'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleFullscreen}
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 sm:flex"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition-all hover:shadow-md disabled:opacity-70 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Download size={14} className="sm:size-4" />
            <span className="hidden sm:inline">{downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full overflow-auto bg-[#f8f9fc] p-3 sm:p-5 lg:p-6">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 sm:gap-5">

          {/* Hero */}
          <section
            className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-blue-600 to-purple-600 p-6 shadow-lg shadow-indigo-300/40 cursor-pointer sm:p-8 lg:p-10"
            onClick={openDetailsPage}
            title={`Open ${topicSlug} details`}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(white_1.5px,transparent_1.5px)] bg-size-[20px_20px] opacity-[0.06]" />
            <BookOpen className="pointer-events-none absolute -bottom-6 -right-6 size-40 rotate-12 text-white/10 transition-transform duration-500 group-hover:rotate-0 sm:size-56" />

            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <Target size={12} /> Topic Reader
              </span>
              <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {topicSlug}
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base lg:text-lg">
                A comprehensive learning experience designed to help you master key concepts through structured practice, visual aids, and interactive materials.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase text-white/60">Date</p>
                  <p className="text-sm font-bold text-white">{chapterDateLabel || 'Not set'}</p>
                </div>
                {chapterDayLabel && (
                  <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm">
                    <p className="text-[9px] font-bold uppercase text-white/60">Day</p>
                    <p className="text-sm font-bold text-white">{chapterDayLabel}</p>
                  </div>
                )}
                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase text-white/60">Duration</p>
                  <p className="text-sm font-bold text-white">{chapterDurationLabel || 'Not set'}</p>
                </div>
                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase text-white/60">Steps Done</p>
                  <p className="text-sm font-bold text-white">{completedSteps.length}/{chapterInstructionalFlow.length}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className="text-xs text-white/70">{completedSteps.length} of {chapterInstructionalFlow.length} learning steps completed</p>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-indigo-600 shadow-md transition-transform group-hover:translate-x-1">
                Read Full Article <ArrowRight size={16} />
              </div>
            </div>
          </section>

          {/* Content grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {/* Learning Objectives */}
            <section className="rounded-3xl border border-violet-100 bg-violet-50/60 p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-300">
                  <Target size={18} />
                </span>
                <h2 className="text-lg font-black text-slate-900">Learning Objectives</h2>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {chapterLearningObjectives.map((obj, idx) => (
                  <div key={idx} className="flex gap-3 rounded-2xl bg-white/70 p-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[11px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-700">{obj}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Instructional Flow */}
            <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-sm shadow-blue-300">
                  <BookOpen size={18} />
                </span>
                <h2 className="text-lg font-black text-slate-900">Instructional Flow</h2>
              </div>
              <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                {chapterInstructionalFlow.length > 0 ? chapterInstructionalFlow.map((step) => (
                  <div key={step.id} className="relative border-l-2 border-blue-200 pl-4">
                    <div className="absolute -left-[5px] top-1 size-2.5 rounded-full bg-blue-500" />
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-bold uppercase text-blue-600">{step.phase || step.type}</h3>
                      {step.duration > 0 && <span className="text-[10px] font-bold text-slate-400">{step.duration}m</span>}
                    </div>
                    <p className="text-sm leading-snug text-slate-700">{step.title}</p>
                    {completedSteps.includes(step.id) && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={12} /> Completed
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="pt-4 text-center text-xs text-slate-400">No instructional flow provided for this chapter.</p>
                )}
              </div>
            </section>

            {/* Materials */}
            <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-300">
                  <Layers size={18} />
                </span>
                <h2 className="text-lg font-black text-slate-900">Materials</h2>
              </div>
              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {learningMaterials.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-600">No chapter material uploaded yet.</p>
                    <p className="mt-1 text-xs text-slate-400">Only files from the material section will appear here.</p>
                  </div>
                ) : learningMaterials.map((material, idx) => (
                  <div key={idx} className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-white p-3">
                    <span className="inline-flex w-fit items-center rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                      {normalizeLabel(material.formatLabel || material.description || 'File')}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip size={15} className="shrink-0 text-emerald-600" />
                      <p className="truncate text-sm font-bold text-slate-800">{material.title}</p>
                    </div>
                    <MaterialQuickActions material={material} onRead={setActiveMaterial} />
                  </div>
                ))}
              </div>
            </section>

            {/* Assessment */}
            <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-300">
                  <CheckCircle2 size={18} />
                </span>
                <h2 className="text-lg font-black text-slate-900">Assessment</h2>
              </div>
              <p className="mb-3 text-xs italic text-slate-500">Only assessments uploaded or published by the teacher are shown here.</p>
              <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {assessmentItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-600">No assessment uploaded yet.</p>
                    <p className="mt-1 text-xs text-slate-400">Teacher assessment files will appear here.</p>
                  </div>
                ) : assessmentItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white p-3">
                    <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                      {normalizeLabel(item.formatLabel || item.description || 'Assessment')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{item.title}</p>
                      <p className="truncate text-xs text-slate-400">{item.description}</p>
                    </div>
                    <MaterialQuickActions material={item} onRead={setActiveMaterial} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Step-by-Step Explanation + Quick Recap */}
          {(chapterExplanation || chapterRecap) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {chapterExplanation && (
                <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm sm:p-6">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-sm shadow-blue-300">
                      <BookOpen size={18} />
                    </span>
                    <h2 className="text-lg font-black text-slate-900">Step-by-Step Explanation</h2>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{chapterExplanation}</p>
                  <p className="mt-3 text-xs italic text-slate-400">This content is provided by your teacher.</p>
                </section>
              )}
              {chapterRecap && (
                <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm sm:p-6">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-300">
                      <CheckCircle2 size={18} />
                    </span>
                    <h2 className="text-lg font-black text-slate-900">Quick Recap</h2>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{chapterRecap}</p>
                  <p className="mt-3 text-xs italic text-slate-400">Key takeaways from this lesson.</p>
                </section>
              )}
            </div>
          )}

          <UploadedResourcesPanel resources={[...learningMaterials, ...assessmentItems]} />
        </div>
      </main>

      {activeMaterial && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-linear-to-r from-indigo-50 to-purple-50 p-5">
              <h3 className="truncate text-lg font-black text-slate-900">{activeMaterial.title}</h3>
              <button
                type="button"
                onClick={() => setActiveMaterial(null)}
                className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-white/70"
                aria-label="Close reader"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {stripHtml(activeMaterial.content)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-md rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </div>
      )}

      <style>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        *::-webkit-scrollbar {
          width: 4px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default AILearningCoursesReference;
