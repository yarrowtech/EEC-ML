/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

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
  CalendarDays,
  Calendar,
  ListChecks,
  Lightbulb,
  MessageCircle,
  Lock,
  Sparkles,
  Rocket,
  Compass,
  Video,
  Presentation,
  Newspaper,
  NotebookText,
  Image as ImageIcon,
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';
import { PaperclipHorizontalIcon } from '@phosphor-icons/react';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';
import WorksheetSubmitModal from './WorksheetSubmitModal';
import AILearningTryoutSection, { typeMeta, normalizeQuestionType } from './AILearningTryoutSection';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const DASHBOARD_ENDPOINT = `${API_BASE}/api/student/auth/dashboard`;
const FEEDBACK_CONTEXT_ENDPOINT = `${API_BASE}/api/student/auth/teacher-feedback/context`;
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;
const STUDENT_MATERIALS_ENDPOINT = `${API_BASE}/api/student/materials`;


// "Quest" visual system — mirrors Ref/student portal lesson plan/code.html's
// tailwind.config 1:1 across this whole page (primary #493ee5,
// surface-container-low #eff4ff, rounded-lg = 2rem, etc). Tailwind can't
// statically extract classes built from JS template literals, so those exact
// hex/radius values are written as literal arbitrary-value classes
// (bg-[#493ee5], rounded-[2rem]) directly in the JSX below rather than
// composed from a shared object — only the font needs a real JS value.
const QUEST_FONT = { fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" };

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

const getAttachmentDownloadUrl = (item) => {
  if (!item || typeof item !== 'object') return '';
  if (item.downloadUrl) return item.downloadUrl;
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  const match = attachments.find((attachment) => attachment?.url);
  return match?.downloadUrl || getAttachmentUrl(item);
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

// Classifies a material by its file extension (falling back to its label/
// description) so the Lesson Materials list can show a real thumbnail for
// images and a named, type-appropriate icon for everything else.
const MATERIAL_KIND_META = {
  image: { label: 'Image', icon: ImageIcon, tile: 'bg-[#eefff3] text-[#006847]' },
  video: { label: 'Video', icon: Video, tile: 'bg-[#ffdbcb] text-[#9e4300]' },
  ppt: { label: 'PPT', icon: Presentation, tile: 'bg-[#e2dfff] text-[#321ed2]' },
  pdf: { label: 'PDF', icon: FileText, tile: 'bg-[#eff4ff] text-[#493ee5]' },
  notes: { label: 'Notes', icon: NotebookText, tile: 'bg-[#eff4ff] text-[#493ee5]' },
  article: { label: 'Article', icon: Newspaper, tile: 'bg-[#eff4ff] text-[#464555]' },
};
const detectMaterialKind = (material) => {
  const url = String(material?.url || material?.downloadUrl || '');
  const hint = normalizeKey(`${material?.formatLabel || ''} ${material?.description || ''}`);
  if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i.test(url) || hint.includes('image')) return 'image';
  if (/\.(mp4|mov|webm|mkv|avi)(\?|#|$)/i.test(url) || hint.includes('video')) return 'video';
  if (/\.(ppt|pptx)(\?|#|$)/i.test(url) || hint.includes('presentation') || hint.includes('slide')) return 'ppt';
  if (/\.pdf(\?|#|$)/i.test(url) || hint.includes('pdf')) return 'pdf';
  if (/\.(doc|docx)(\?|#|$)/i.test(url) || hint.includes('notes') || hint.includes('document') || hint.includes('handout')) return 'notes';
  return 'article';
};

// iOS Safari (the majority of mobile student devices) never implements the
// Fullscreen API for arbitrary elements — document.fullscreenEnabled is
// false there — so the fullscreen button is hidden rather than shown as a
// dead control that just surfaces an error on tap.
const FULLSCREEN_SUPPORTED = typeof document !== 'undefined'
  && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

const MaterialQuickActions = ({ material, onRead }) => {
  if (!material?.url && !material?.content) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {material.content && (
        <button
          type="button"
          onClick={() => onRead(material)}
          title="Read"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#493ee5] transition-colors hover:bg-white"
        >
          <FileText size={14} />
        </button>
      )}
      {material.url && (
        <>
          <a href={getInlineDocumentUrl(material.url)} target="_blank" rel="noreferrer" title="Open" className="flex h-8 w-8 items-center justify-center rounded-full text-[#493ee5] transition-colors hover:bg-white">
            <ExternalLink size={14} />
          </a>
          <a href={material.downloadUrl || material.url} download title="Download" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#493ee5] text-white transition-colors hover:bg-[#3a30c9]">
            <Download size={14} />
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

  // Fetch profile, subject context, and smart learning map once on mount.
  // These are heavy calls; caching avoids re-fetching on every topic navigation.
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

        const [dashRes, contextRes, mapRes] = await Promise.all([
          fetchCachedJson(DASHBOARD_ENDPOINT, { ttlMs: 5 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(FEEDBACK_CONTEXT_ENDPOINT, { ttlMs: 5 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(SMART_LEARNING_MAP_ENDPOINT, {
            ttlMs: 3 * 60 * 1000,
            fetchOptions: { headers },
          }).catch(() => ({ data: { subjects: [] } })),
        ]);

        setProfile(dashRes?.data?.profile || null);
        setContexts(Array.isArray(contextRes?.data?.teachers) ? contextRes.data.teachers : []);
        setSmartLearningSubjects(Array.isArray(mapRes?.data?.subjects) ? mapRes.data.subjects : []);
      } catch (err) {
        setError(err?.message || 'Failed to load learning data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);  

  // Fetch real published teaching materials when the topic changes.
  // Uses fetchCachedJson so repeated visits to the same topic are instant.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (!token || userType !== 'Student') return;

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const materialsUrl = new URL(STUDENT_MATERIALS_ENDPOINT);
    if (subjectSlug) materialsUrl.searchParams.set('subject', subjectSlug);
    materialsUrl.searchParams.set('limit', '100');

    fetchCachedJson(materialsUrl.toString(), { ttlMs: 3 * 60 * 1000, fetchOptions: { headers } })
      .then((res) => {
        const allMaterials = Array.isArray(res?.data?.materials) ? res.data.materials : [];
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
            downloadUrl: firstAttachment?.downloadUrl || firstAttachment?.url || '',
            publishedAt: m.publishedAt || m.createdAt || null,
            formatLabel: String(m.typeLabel || m.category || 'Material').trim(),
          };
        });
        setRealMaterials(mapped);
      })
      .catch(() => {
        // Non-critical — fall back to smart learning map data
      });
  }, [subjectSlug, topicSlug]);  

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
      const downloadUrl = getAttachmentDownloadUrl(item);
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
        downloadUrl,
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
      const downloadUrl = getAttachmentDownloadUrl(item);
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
        downloadUrl,
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
  const chapterDidYouKnow = String(selectedChapterMeta.didYouKnow || '').trim();
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

  const openDetailsPage = (mode = '') => {
    const modeQuery = mode ? `&mode=${mode}` : '';
    navigate(
      `/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}?view=details${modeQuery}`
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
    ...(chapterDidYouKnow ? [{ id: 'did-you-know', title: 'Did You Know?', text: chapterDidYouKnow }] : []),
  ]).filter((section) => String(section.text || '').trim()), [readingContent, introductionText, chapterExplanation, chapterRecap, chapterDidYouKnow]);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  // Populated by the embedded AILearningTryoutSection once it loads the
  // assigned questions, so the "Choose Your Format" list above it can group
  // them by type without re-fetching/re-deriving the same data itself.
  const [assignedTryoutQuestions, setAssignedTryoutQuestions] = useState([]);
  const tryoutRef = useRef(null);
  const practiceFormats = useMemo(() => {
    const groups = new Map();
    assignedTryoutQuestions.forEach((question) => {
      const type = normalizeQuestionType(question?.type);
      if (!groups.has(type)) groups.set(type, { type, ...typeMeta(type), count: 0 });
      groups.get(type).count += 1;
    });
    return Array.from(groups.values());
  }, [assignedTryoutQuestions]);
  // The route doesn't remount when only the query string changes (e.g.
  // navigating from the overview page straight into ?mode=practice), so a
  // plain lazy-init read of the query param would miss that navigation —
  // this effect re-syncs on mount and on every subsequent URL change,
  // without overriding in-page toggles (Launch Practice / Return to theory)
  // that don't touch the URL.
  useEffect(() => {
    setIsPracticeMode(new URLSearchParams(location.search).get('mode') === 'practice');
  }, [location.search]);
  const [activeFlowStepId, setActiveFlowStepId] = useState(null);
  const [activeDetailSection, setActiveDetailSection] = useState('introduction');
  const [readerFontScale, setReaderFontScale] = useState(1);
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

  const handleDetailsScroll = () => {
    const container = detailsScrollRef.current;
    if (!container || !detailSections.length) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= 8) {
      setActiveDetailSection(detailSections[detailSections.length - 1].id);
    }
  };

  const handleDownloadAllMaterials = () => {
    const downloadable = learningMaterials.filter((material) => material.url || material.downloadUrl);
    downloadable.forEach((material, idx) => {
      const href = material.downloadUrl || material.url;
      if (!href) return;
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = href;
        link.download = material.title || 'lesson-material';
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, idx * 400);
    });
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
          <h1 className="text-xl font-bold text-slate-900">Topic not found</h1>
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
    const practiceResources = [...assessmentItems, ...chapterWorksheets.downloadLinks];
    const totalWords = detailSections.reduce((sum, s) => sum + String(s?.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
    const readMinutes = detailSections.length > 0 ? Math.max(1, Math.round(totalWords / 200)) : 0;

    return (
      <>
        <style>{`
          @keyframes rdr-pulse-dot { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
          .rdr-dot { animation: rdr-pulse-dot 2s ease-in-out infinite; display:inline-block; width:6px; height:6px; border-radius:50%; background:#006847; }
        `}</style>

        <div
          ref={(node) => { detailsViewRef.current = node; detailsScrollRef.current = node; }}
          onScroll={handleDetailsScroll}
          className={`w-full overflow-x-hidden overflow-y-auto bg-[#f8f9ff] p-3 sm:p-5 ${isFullscreen ? 'h-screen' : 'min-h-screen'}`}
          style={QUEST_FONT}
        >
          {/* Nav row */}
          <div className="mx-auto mb-4 flex max-w-[1100px] flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={closeDetailsPage}
              className="inline-flex items-center gap-2 rounded-full bg-[#eff4ff] px-4 py-2 text-sm font-semibold text-[#493ee5] transition-colors hover:bg-[#e6eeff]"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-1 rounded-full bg-[#eff4ff] p-1">
              <button
                type="button"
                onClick={() => setReaderFontScale(1)}
                aria-label="Normal text size"
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${readerFontScale === 1 ? 'bg-[#493ee5] text-white' : 'text-[#464555] hover:bg-white/60'}`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setReaderFontScale(1.15)}
                aria-label="Larger text size"
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${readerFontScale === 1.15 ? 'bg-[#493ee5] text-white' : 'text-[#464555] hover:bg-white/60'}`}
              >
                A+
              </button>
            </div>
            {FULLSCREEN_SUPPORTED && (
              <button
                type="button"
                onClick={toggleDetailsFullscreen}
                className="rounded-full bg-[#eff4ff] p-2.5 text-[#464555] transition-colors hover:bg-[#e6eeff]"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            {!isPracticeMode && (
              <button
                type="button"
                onClick={() => setIsPracticeMode(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#493ee5] to-[#635bff] px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              >
                Next: Practice <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Reader grid */}
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
            {/* ── Book page ── */}
            {!isPracticeMode && (
              <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-8">
                {/* Chapter meta */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#d5e3fc] pb-5">
                  <span className="rounded-full bg-[#e2dfff] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#321ed2]">
                    {mapScope.chapterTitle || subjectSlug}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#464555]">
                    <span className="rdr-dot" />
                    {readMinutes > 0 ? `${readMinutes} min read` : 'Reading'}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold tracking-tight text-[#0d1c2e] sm:text-4xl">{topicSlug}</h1>
                <p className="mb-7 mt-2 text-sm italic text-[#464555] sm:text-base">
                  {mapScope.label && mapScope.label !== topicSlug ? mapScope.label : `${subjectSlug} · Reading`}
                </p>

                {/* Theory sections */}
                <div className="flex flex-col gap-4">
                  {detailSections.length > 0 ? (
                    detailSections.map((section) => (
                      <div
                        key={section.id}
                        id={section.id}
                        ref={(node) => { detailSectionRefs.current[section.id] = node; }}
                        className={`rounded-[1.25rem] p-4 transition-colors sm:p-5 ${activeDetailSection === section.id ? 'bg-[#eff4ff]' : 'bg-[#f8f9ff]'}`}
                      >
                        <span className="mb-2 inline-block rounded-full bg-[#d5e3fc] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#0d1c2e]">
                          {section.title}
                        </span>
                        <p className="leading-[1.85] text-[#464555]" style={{ fontSize: `${15 * readerFontScale}px` }}>
                          {section.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm italic text-[#464555]">
                      No reading content published for this topic yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Sidebar ── */}
            {!isPracticeMode && (
              <div className="flex flex-col gap-5 lg:sticky lg:top-5">
                {/* Launch Practice button */}
                <div className="rounded-[2rem] bg-white p-5 shadow-sm">
                  <p className="mb-3 text-xs text-[#464555]">Ready to test your understanding?</p>
                  <button
                    type="button"
                    onClick={() => setIsPracticeMode(true)}
                    className="flex w-full items-center justify-between rounded-full bg-[#eff4ff] px-5 py-3 text-sm font-semibold text-[#493ee5] transition-colors hover:bg-[#e6eeff]"
                  >
                    Launch Practice
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Practice panel (full-span) ── */}
            {isPracticeMode && (
              <div className="col-span-full flex flex-col gap-6">
              {/* Choose Your Format — every assigned question type, grouped */}
              {practiceFormats.length > 0 && (
                <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#d5e3fc] pb-4">
                    <h3 className="text-xl font-bold text-[#0d1c2e] sm:text-2xl">Choose Your Format</h3>
                    <span className="rounded-full bg-[#eff4ff] px-3.5 py-1 text-xs font-semibold text-[#464555]">
                      {practiceFormats.length} format{practiceFormats.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {practiceFormats.map(({ type, label, icon: Icon, count }) => (
                      <div
                        key={type}
                        className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-[#eff4ff] p-4 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#493ee5] shadow-sm">
                            <Icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0d1c2e]">{label}</p>
                            <p className="text-xs font-semibold text-[#464555]">{count} question{count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => tryoutRef.current?.scrollToType(type)}
                          className="inline-flex shrink-0 items-center gap-1 self-stretch justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-[#493ee5] shadow-sm transition-colors hover:bg-[#e6eeff] sm:self-auto"
                        >
                          Start {label} <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-8">
                {/* Panel header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#d5e3fc] pb-4">
                  <h3 className="text-xl font-bold text-[#0d1c2e] sm:text-2xl">Practice Paper</h3>
                  <span className="rounded-full bg-[#eff4ff] px-3.5 py-1 text-xs font-semibold text-[#464555]">
                    {practiceResources.length} resource{practiceResources.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Resource list */}
                <div className="mb-6 grid gap-3">
                  {practiceResources.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="mb-1 text-sm italic text-[#464555]">
                        No practice materials uploaded for this topic yet.
                      </p>
                      <p className="text-xs text-[#464555]">
                        Try the interactive Tryout Section below!
                      </p>
                    </div>
                  ) : (
                    practiceResources.map((item, idx) => (
                      <div key={item.id || idx} className="rounded-2xl bg-[#eff4ff] p-4">
                        <p className="mb-2.5 text-sm text-[#0d1c2e]">
                          <span className="mr-2 font-bold text-[#635bff]">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          {item.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.url && (
                            <>
                              <a href={getInlineDocumentUrl(item.url)} target="_blank" rel="noreferrer" className="rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-semibold text-[#493ee5] hover:bg-[#eff4ff]">
                                Open
                              </a>
                              <a href={item.url} download className="rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-semibold text-[#493ee5] hover:bg-[#eff4ff]">
                                Download
                              </a>
                            </>
                          )}
                          {item.content && (
                            <button
                              type="button"
                              onClick={() => setActiveMaterial(item)}
                              className="rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-semibold text-[#493ee5] hover:bg-[#eff4ff]"
                            >
                              Read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Worksheet assignments in practice panel */}
                {chapterWorksheets.submittableAssignments.length > 0 && (
                  <div className="mb-6 flex flex-col gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#464555]">Worksheet Assignments</p>
                    {chapterWorksheets.submittableAssignments.map((assignment) => {
                      const isSubmitted = submittedWorksheets.has(assignment._id);
                      const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                      return (
                        <div key={assignment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#eff4ff] p-3.5">
                          <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
                            <FileText size={15} className="shrink-0 text-[#493ee5]" />
                            <p className="truncate text-sm font-semibold text-[#0d1c2e]">{assignment.title}</p>
                            {isSubmitted && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eefff3] px-2.5 py-0.5 text-[10px] font-bold text-[#006847]">
                                <CheckCircle2 size={10} /> Submitted
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {attachmentUrl && (
                              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-semibold text-[#493ee5] hover:bg-[#eff4ff]">
                                <Download size={11} /> Download
                              </a>
                            )}
                            {!isSubmitted ? (
                              <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-[#493ee5] px-3 py-1 text-xs font-bold text-white hover:bg-[#3a30c9]">
                                Submit
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006847]">
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d5e3fc] pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPracticeMode(false)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#464555] hover:text-[#0d1c2e]"
                  >
                    <ArrowLeft size={14} /> Return to theory
                  </button>
                </div>
              </div>

              {/* Interactive tryout — embedded directly, no separate page */}
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
                <AILearningTryoutSection
                  ref={tryoutRef}
                  assignedSubjectName={subjectSlug}
                  assignedTopicName={topicSlug}
                  onBack={() => setIsPracticeMode(false)}
                  onQuestionsLoaded={setAssignedTryoutQuestions}
                />
              </div>
              </div>
            )}
          </div>

          {/* Worksheets strip (theory view only) */}
          {!isPracticeMode && (chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
            <section className="mx-auto mt-6 max-w-[1100px] rounded-[2rem] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff4ff] text-[#493ee5]">
                  <ClipboardList size={18} />
                </div>
                <h2 className="text-base font-bold text-[#0d1c2e]">Worksheets</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {chapterWorksheets.downloadLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#eff4ff] p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0 text-[#493ee5]" />
                      <p className="truncate text-sm font-semibold text-[#0d1c2e]">{link.title}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#493ee5] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3a30c9]">
                      <Download size={11} /> Download
                    </a>
                  </div>
                ))}
                {chapterWorksheets.submittableAssignments.map((assignment) => {
                  const isSubmitted = submittedWorksheets.has(assignment._id);
                  const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                  return (
                    <div key={assignment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#eff4ff] p-3">
                      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                        <FileText size={14} className="shrink-0 text-[#493ee5]" />
                        <p className="truncate text-sm font-semibold text-[#0d1c2e]">{assignment.title}</p>
                        {isSubmitted && <span className="shrink-0 rounded-full bg-[#eefff3] px-2 py-0.5 text-[10px] font-bold text-[#006847]">Submitted</span>}
                      </div>
                      <div className="flex gap-2">
                        {attachmentUrl && (
                          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-semibold text-[#493ee5] hover:bg-[#eff4ff]">
                            <Download size={11} /> Download
                          </a>
                        )}
                        {!isSubmitted ? (
                          <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-[#493ee5] px-3 py-1 text-xs font-bold text-white hover:bg-[#3a30c9]">Submit</button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006847]"><CheckCircle2 size={12} /> Done</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0d1c2e]/50 p-4">
            <div
              className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(13,28,46,0.2)]"
              style={{ maxHeight: '85vh' }}
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#d5e3fc] bg-[#eff4ff] px-5 py-4">
                <h3 className="truncate text-base font-bold text-[#0d1c2e]">{activeMaterial.title}</h3>
                <button type="button" onClick={() => setActiveMaterial(null)} className="shrink-0 rounded-lg p-1.5 text-[#464555] hover:bg-white hover:text-[#0d1c2e]">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto p-5" style={{ maxHeight: '65vh' }}>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#464555]">{stripHtml(activeMaterial.content)}</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // A step is locked until the step directly before it has been completed —
  // the first step is always open.
  const isStepLocked = (idx) => idx > 0 && !completedSteps.includes(chapterInstructionalFlow[idx - 1]?.id);

  // Default the spotlighted step to the next incomplete one (falling back to
  // the first step) so the journey highlights what the student should do next.
  const resolvedActiveFlowStepId = activeFlowStepId
    ?? (chapterInstructionalFlow.find((step) => !completedSteps.includes(step.id))?.id
      ?? chapterInstructionalFlow[0]?.id
      ?? null);

  const handleFlowStepClick = (stepId, idx) => {
    if (isStepLocked(idx)) return;
    setActiveFlowStepId(stepId);
    setCompletedSteps((prev) => {
      if (prev.includes(stepId)) return prev;
      return [...prev, stepId];
    });
  };

  const stepsDoneLabel = `${completedSteps.length}/${chapterInstructionalFlow.length || 0} (${overallProgress}%)`;
  const progressStatusLabel = overallProgress === 0 ? 'Ready to begin!' : overallProgress === 100 ? 'Topic complete!' : `${overallProgress}% complete`;
  const heroDescription = chapterIntroduction || 'Explore this topic step by step, then try the practice questions when you’re ready.';
  const classChip = profile?.grade ? `Class ${profile.grade}${profile.section ? ` • ${profile.section}` : ''} curriculum` : '';
  // Only surface the chapter title as its own breadcrumb pill / title prefix
  // when it actually says something different from the topic name — a raw
  // !== comparison let near-duplicates (differing only in case/whitespace)
  // through and showed the same title twice.
  const showChapterTitle = Boolean(mapScope.chapterTitle) && normalizeKey(mapScope.chapterTitle) !== normalizeKey(topicSlug);

  // The step the student should tackle next — spotlighted the same way the
  // reference design highlights its "hero" milestone above the compact path.
  const spotlightStepIdx = chapterInstructionalFlow.findIndex((step) => step.id === resolvedActiveFlowStepId);
  const spotlightStep = spotlightStepIdx >= 0 ? chapterInstructionalFlow[spotlightStepIdx] : null;
  const spotlightDone = spotlightStep ? completedSteps.includes(spotlightStep.id) : false;

  return (
    <div ref={moduleRef} className={`w-full overflow-y-auto overflow-x-hidden bg-[#f8f9ff] ${isFullscreen ? 'h-screen' : 'min-h-screen'}`} style={QUEST_FONT}>
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb & Topic Eyebrow Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={goBackToSubjectTopics} className="inline-flex items-center gap-1.5 rounded-full bg-[#eff4ff] px-3 py-2 text-sm font-bold text-[#493ee5] transition-colors hover:bg-[#e6eeff]">
              <ArrowLeft size={16} /> Back to Chapters
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#eff4ff] px-3 py-1 text-xs font-bold text-[#493ee5]">
                {subjectSlug}{classChip ? ` • ${classChip}` : ''}
              </span>
              {showChapterTitle && (
                <>
                  <span className="text-[#c7c4d8]">•</span>
                  <span className="rounded-full bg-[#e2dfff] px-3 py-1 text-xs font-bold text-[#321ed2]">{mapScope.chapterTitle}</span>
                </>
              )}
              <span className="text-[#c7c4d8]">•</span>
              <span className="text-sm font-semibold text-[#464555]">{topicSlug}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {FULLSCREEN_SUPPORTED && (
              <button type="button" onClick={toggleFullscreen} className="rounded-full bg-[#eff4ff] p-2.5 text-[#464555] transition-colors hover:bg-[#e6eeff]">
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            )}
            <button type="button" onClick={handleDownloadPdf} disabled={downloadingPdf} className="inline-flex items-center gap-1.5 rounded-full bg-[#eff4ff] px-4 py-2 text-sm font-bold text-[#493ee5] transition-colors hover:bg-[#e6eeff] disabled:opacity-60">
              <Download size={18} /> {downloadingPdf ? 'Preparing…' : 'Offline Pack (PDF)'}
            </button>
          </div>
        </div>

        {/* Chapter Title & Narrative Overview Banner */}
        <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-white p-5 shadow-sm sm:p-8">
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex max-w-3xl flex-col gap-1">
              <div className="inline-flex items-center gap-1.5 text-[#9e4300]">
                <Compass size={20} />
                <span className="text-xs font-bold uppercase tracking-wide">Learning Journey</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0d1c2e] sm:text-4xl">
                {showChapterTitle ? `${mapScope.chapterTitle}: ${topicSlug}` : topicSlug}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-[#464555] sm:text-base">{heroDescription}</p>
            </div>

            {/* Mission Readiness Donut Ring */}
            <div className="flex w-full shrink-0 items-center justify-between gap-4 self-stretch rounded-[2rem] bg-[#eff4ff] px-6 py-4 sm:justify-start lg:w-auto lg:self-auto">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <path fill="none" stroke="#d5e3fc" strokeWidth="3.5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path
                    fill="none"
                    stroke="#493ee5"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${overallProgress}, 100`}
                    className="transition-all duration-700 ease-out"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-base font-bold text-[#493ee5]">{overallProgress}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#464555]">Quest Status</span>
                <span className="text-sm font-bold text-[#0d1c2e]">{progressStatusLabel}</span>
                <span className="text-xs font-semibold text-[#006847]">{completedSteps.length} of {chapterInstructionalFlow.length || 0} Completed</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 border-t border-[#d5e3fc] pt-5 sm:grid-cols-4">
            {[
              { icon: CalendarDays, label: 'Target Date', value: chapterDateLabel || 'Not set' },
              { icon: Calendar, label: 'School Day', value: chapterDayLabel || '—' },
              { icon: Clock, label: 'Total Duration', value: chapterDurationLabel || '—' },
              { icon: ListChecks, label: 'Completed Steps', value: stepsDoneLabel },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-2xl bg-[#eff4ff] p-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#493ee5] shadow-sm">
                  <stat.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#464555]">{stat.label}</p>
                  <p className="truncate text-sm font-bold text-[#0d1c2e]">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2-Zone Stage Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Zone 1: Hero Story Hook + Quest Path (8 cols) */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            {/* Hero Story Hook: the step to tackle next */}
            {spotlightStep && (
              <article className="overflow-hidden rounded-[2rem] bg-white shadow-md transition-shadow duration-300 hover:shadow-xl">
                <div className="relative bg-gradient-to-br from-[#493ee5] to-[#635bff] px-5 py-6 sm:px-8 sm:py-7">
                  <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative z-10 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9e4300] px-3 py-1 text-xs font-bold text-white shadow-md">
                      <Rocket size={14} /> Step {spotlightStepIdx + 1}: {spotlightStep.type}
                    </span>
                    {spotlightStep.duration > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0d1c2e] backdrop-blur-md">
                        <Clock size={12} /> {spotlightStep.duration} min
                      </span>
                    )}
                  </div>
                  <p className="relative z-10 mb-1 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#ffdbcb]">
                    <Sparkles size={12} /> {spotlightDone ? 'Worth revisiting' : 'Mission Briefing'}
                  </p>
                  <h2 className="relative z-10 text-xl font-bold leading-snug text-white drop-shadow-md sm:text-2xl">{spotlightStep.title}</h2>
                </div>
                <div className="flex flex-col gap-4 p-5 sm:p-6">
                  <p className="text-sm text-[#464555]">
                    {spotlightDone
                      ? 'You’ve completed this step — jump back in anytime.'
                      : 'Read through this step, then head to practice to lock it in.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { handleFlowStepClick(spotlightStep.id, spotlightStepIdx); openDetailsPage(); }}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#493ee5] to-[#635bff] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                    >
                      Start Step {spotlightStepIdx + 1}: Reading <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleFlowStepClick(spotlightStep.id, spotlightStepIdx); openDetailsPage('practice'); }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#dce9ff] px-5 py-3.5 text-sm font-bold text-[#0d1c2e] shadow-sm transition-all duration-200 hover:bg-[#e6eeff] hover:shadow active:scale-95"
                    >
                      <Target size={16} className="text-[#493ee5]" /> Start Practice
                    </button>
                    {learningMaterials.some((material) => material.url || material.downloadUrl) && (
                      <button
                        type="button"
                        onClick={handleDownloadAllMaterials}
                        className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-[#c7c4d8]/40 bg-[#eff4ff] px-4 py-3 text-sm font-bold text-[#493ee5] transition-colors hover:bg-[#e6eeff]"
                      >
                        <Download size={16} /> Download Material
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )}

            {/* Interactive Quest Path */}
            <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#0d1c2e]">Step-by-Step Learning Journey</h2>

              {chapterInstructionalFlow.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-[#464555]">No instructional flow provided yet.</p>
              ) : (
                <div className="relative flex flex-col gap-4 pl-6 before:absolute before:bottom-6 before:left-3 before:top-6 before:w-1 before:bg-[#d5e3fc] sm:pl-10 sm:before:left-5">
                  {chapterInstructionalFlow.map((step, idx) => {
                    const isLocked = isStepLocked(idx);
                    const isActive = !isLocked && resolvedActiveFlowStepId === step.id;
                    const isDone = completedSteps.includes(step.id);
                    const previousStepTitle = idx > 0 ? chapterInstructionalFlow[idx - 1]?.title : '';
                    return (
                      <div key={step.id} className={`group relative ${isLocked ? 'opacity-90' : ''}`}>
                        <div className={`absolute -left-6 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-transform sm:-left-10 sm:h-10 sm:w-10 ${
                          isDone || isActive
                            ? 'bg-[#493ee5] text-white shadow-md ring-4 ring-[#e2dfff] group-hover:scale-110'
                            : 'bg-[#e6eeff] text-[#464555] shadow-sm'
                        }`}>
                          {isDone ? <CheckCircle2 size={16} /> : isLocked ? <Lock size={14} /> : idx + 1}
                        </div>
                        <div className={`rounded-[1.25rem] p-4 transition-all ${isActive || isDone ? 'bg-[#eff4ff]' : 'bg-[#f8f9ff]'}`}>
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${isActive || isDone ? 'bg-[#493ee5] text-white' : 'bg-[#d5e3fc] text-[#0d1c2e]'}`}>{step.type}</span>
                              {step.duration > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#464555]">
                                  <Clock size={14} /> {step.duration} min
                                </span>
                              )}
                            </div>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006847]"><CheckCircle2 size={14} /> Done</span>
                            ) : isLocked ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#777587]"><Lock size={14} /> Locked</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdbcb] px-2 py-0.5 text-xs font-bold text-[#341100]">
                                <span className="h-2 w-2 animate-ping rounded-full bg-[#9e4300]" /> Ready to Read
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-[#0d1c2e]">{step.title}</h3>
                          <div className="mt-2 flex items-center justify-between pt-1">
                            {isLocked ? (
                              <>
                                <span className="text-xs font-semibold text-[#464555]">
                                  {previousStepTitle ? `Unlocks after "${previousStepTitle}"` : 'Complete the previous step to unlock'}
                                </span>
                                <span className="text-xs font-semibold text-[#777587]">Step {idx + 1} of {chapterInstructionalFlow.length}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-semibold text-[#493ee5]">Step {idx + 1} of {chapterInstructionalFlow.length}</span>
                                <button
                                  type="button"
                                  onClick={() => handleFlowStepClick(step.id, idx)}
                                  className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-bold shadow-sm transition-all active:scale-95 ${
                                    isDone ? 'bg-[#eefff3] text-[#006847] hover:shadow' : 'bg-[#493ee5] text-white hover:shadow'
                                  }`}
                                >
                                  {isDone ? 'Revisit' : 'Start Reading'} <BookOpen size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Zone 2: Focus Rail — objectives + materials + assessment */}
          <div className="flex flex-col gap-5 lg:col-span-4">
            <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff4ff] text-[#493ee5]">
                  <Lightbulb size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0d1c2e]">What You Will Learn</h2>
              </div>
              {chapterLearningObjectives.length === 0 ? (
                <p className="text-sm italic text-[#464555]">No objectives published for this topic.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {chapterLearningObjectives.map((objective, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-2xl bg-[#eff4ff] p-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#493ee5] text-xs font-bold text-white">{idx + 1}</div>
                      <p className="text-sm font-medium text-[#0d1c2e]">{objective}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff4ff] text-[#493ee5]">
                  <BookOpen size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0d1c2e]">Lesson Materials</h2>
              </div>
              {learningMaterials.length === 0 ? (
                <p className="text-sm italic text-[#464555]">No chapter material uploaded yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {learningMaterials.map((material, idx) => {
                    const kind = detectMaterialKind(material);
                    const meta = MATERIAL_KIND_META[kind];
                    const Icon = meta.icon;
                    return (
                      <div key={idx} className="flex items-center gap-3 rounded-2xl bg-[#eff4ff] p-2.5">
                        {kind === 'image' && material.url ? (
                          <img src={material.url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tile}`}>
                            <Icon size={18} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#0d1c2e]">{material.title}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#464555]">{meta.label}</p>
                        </div>
                        <MaterialQuickActions material={material} onRead={setActiveMaterial} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffdbcb] text-[#9e4300]">
                  <ClipboardList size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0d1c2e]">Assessment</h2>
              </div>
              {assessmentItems.length === 0 ? (
                <p className="text-sm italic text-[#464555]">No assessment uploaded yet. Teacher assessment files will appear here.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assessmentItems.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#eff4ff] p-3">
                      <span className="shrink-0 rounded-full bg-[#ffdbcb] px-2 py-0.5 text-[10px] font-bold uppercase text-[#793100]">{normalizeLabel(item.formatLabel || 'Assessment')}</span>
                      <span className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold text-[#0d1c2e]">{item.title}</span>
                      <MaterialQuickActions material={item} onRead={setActiveMaterial} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Worksheets */}
        {(chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
          <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff4ff] text-[#493ee5]"><ClipboardList size={18} /></div>
              <h2 className="text-lg font-bold text-[#0d1c2e]">Worksheets</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {chapterWorksheets.downloadLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#eff4ff] p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={16} className="shrink-0 text-[#493ee5]" />
                    <p className="truncate text-sm font-semibold text-[#0d1c2e]">{link.title}</p>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#493ee5] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3a30c9]">
                    <Download size={12} /> Download
                  </a>
                </div>
              ))}
              {chapterWorksheets.submittableAssignments.map((assignment) => {
                const isSubmitted = submittedWorksheets.has(assignment._id);
                const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                return (
                  <div key={assignment._id} className="flex flex-col gap-2 rounded-2xl bg-[#eff4ff] p-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="shrink-0 text-[#493ee5]" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0d1c2e]">{assignment.title}</p>
                      {isSubmitted && <span className="shrink-0 rounded-full bg-[#eefff3] px-2 py-0.5 text-[10px] font-bold text-[#006847]">Submitted</span>}
                    </div>
                    <div className="flex gap-2">
                      {attachmentUrl && (
                        <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#493ee5]/30 bg-white px-3 py-1 text-xs font-bold text-[#493ee5] hover:bg-[#eff4ff]">
                          <Download size={11} /> Download
                        </a>
                      )}
                      {!isSubmitted ? (
                        <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-[#493ee5] px-3 py-1 text-xs font-bold text-white hover:bg-[#3a30c9]">Submit</button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006847]"><CheckCircle2 size={12} /> Done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

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
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.93, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 18 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-500/35 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.2)] backdrop-blur-[20px] backdrop-saturate-[1.8]"
              style={{ maxHeight: '85vh' }}
            >
              <div className="flex items-center justify-between gap-4 border-b border-violet-500/15 bg-white/40 px-5 py-4">
                <h3 className="truncate text-base font-bold text-[#0f172a]">{activeMaterial.title}</h3>
                <button type="button" onClick={() => setActiveMaterial(null)} className="shrink-0 rounded-lg p-1.5 text-[#8e9aaf] hover:bg-white/60 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto p-5" style={{ maxHeight: '65vh' }}>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{stripHtml(activeMaterial.content)}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-5 right-5 max-w-sm rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 shadow-[0_8px_32px_rgba(200,100,100,0.1)] backdrop-blur-[12px]"
        >
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </motion.div>
      )}
    </div>
  );
};

export default AILearningCoursesReference;
