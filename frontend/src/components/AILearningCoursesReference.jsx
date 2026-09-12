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
  ChevronRight,
  CalendarDays,
  Calendar,
  ListChecks,
  Lightbulb,
  MessageCircle,
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


// Shared "glass" card recipe used across the Smart Learning pages: frosted
// backdrop blur, soft purple border, gentle shadow. GLASS_INNER is the same
// idea at a smaller radius for nested rows/tiles.
const GLASS_CARD = 'rounded-3xl border border-violet-500/35 bg-white/60 backdrop-blur-[20px] backdrop-saturate-[1.8] shadow-[0_8px_32px_rgba(15,23,42,0.06)]';
const GLASS_INNER = 'rounded-xl border border-violet-500/35 bg-white/50 backdrop-blur-[20px]';
const GLASS_HOVER = 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(139,92,246,0.14)]';

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
          className="inline-flex items-center gap-1 rounded-lg border border-violet-500/35 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100"
        >
          <FileText size={12} />
          Read
        </button>
      )}
      {material.url && (
        <>
          <a href={getInlineDocumentUrl(material.url)} target="_blank" rel="noreferrer" title="Open" className="inline-flex items-center gap-1 rounded-lg border border-violet-500/35 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100">
            <ExternalLink size={12} />
            Open
          </a>
          <a href={material.url} download title="Download" className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-600">
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
    const sectionIdx = Math.max(1, detailSections.findIndex((s) => s.id === activeDetailSection) + 1);
    const practiceResources = [...assessmentItems, ...chapterWorksheets.downloadLinks];
    const totalWords = detailSections.reduce((sum, s) => sum + String(s?.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
    const readMinutes = detailSections.length > 0 ? Math.max(1, Math.round(totalWords / 200)) : 0;

    return (
      <>
        <style>{`
          .rdr-scroll::-webkit-scrollbar { width: 4px; }
          .rdr-scroll::-webkit-scrollbar-track { background: transparent; }
          .rdr-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.25); border-radius: 10px; }
          @keyframes rdr-pulse-dot { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
          .rdr-dot { animation: rdr-pulse-dot 2s ease-in-out infinite; display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981; }
        `}</style>

        <div
          ref={(node) => { detailsViewRef.current = node; detailsScrollRef.current = node; }}
          onScroll={handleDetailsScroll}
          className="w-full min-h-screen overflow-x-hidden overflow-y-auto bg-[#f1f5f9] p-3 sm:p-5"
        >
          {/* Nav row */}
          <div className="mx-auto mb-4 flex max-w-[1100px] flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={closeDetailsPage}
              className={`inline-flex items-center gap-2 rounded-full ${GLASS_INNER} px-4 py-2 text-sm font-semibold text-slate-700 ${GLASS_HOVER}`}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className={`flex items-center gap-1 rounded-full ${GLASS_INNER} p-1`}>
              <button
                type="button"
                onClick={() => setReaderFontScale(1)}
                aria-label="Normal text size"
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${readerFontScale === 1 ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white/60'}`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setReaderFontScale(1.15)}
                aria-label="Larger text size"
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${readerFontScale === 1.15 ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white/60'}`}
              >
                A+
              </button>
            </div>
            <button
              type="button"
              onClick={toggleDetailsFullscreen}
              className={`rounded-full ${GLASS_INNER} p-2.5 text-slate-500 ${GLASS_HOVER}`}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {!isPracticeMode && (
              <button
                type="button"
                onClick={() => setIsPracticeMode(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-600"
              >
                Next: Practice <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Reader grid */}
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
            {/* ── Book page ── */}
            {!isPracticeMode && (
              <div className={`${GLASS_CARD} p-5 sm:p-8`}>
                {/* Chapter meta */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/15 pb-5">
                  <span className="rounded-full bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                    {mapScope.chapterTitle || subjectSlug}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#8e9aaf]">
                    <span className="rdr-dot" />
                    {readMinutes > 0 ? `${readMinutes} min read` : 'Reading'}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] sm:text-4xl">{topicSlug}</h1>
                <p className="mb-7 mt-2 text-sm italic text-[#8e9aaf] sm:text-base">
                  {mapScope.label && mapScope.label !== topicSlug ? mapScope.label : `${subjectSlug} · Reading`}
                </p>

                {/* Theory sections */}
                <div className="rdr-scroll flex max-h-[min(460px,58vh)] flex-col gap-4 overflow-y-auto pr-2">
                  {detailSections.length > 0 ? (
                    detailSections.map((section) => (
                      <div
                        key={section.id}
                        id={section.id}
                        ref={(node) => { detailSectionRefs.current[section.id] = node; }}
                        className={`rounded-xl border p-4 transition-colors sm:p-5 ${activeDetailSection === section.id ? 'border-violet-500/45 bg-violet-500/[0.04]' : 'border-violet-500/20 bg-white/40'}`}
                      >
                        <span className="mb-2 inline-block rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {section.title}
                        </span>
                        <p className="leading-[1.85] text-slate-700" style={{ fontSize: `${15 * readerFontScale}px` }}>
                          {section.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm italic text-[#8e9aaf]">
                      No reading content published for this topic yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Sidebar ── */}
            {!isPracticeMode && (
              <div className="flex flex-col gap-5">
                {/* Progress ring widget */}
                <div className={`${GLASS_CARD} p-5`}>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Progress</p>
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-[62px] w-[62px] shrink-0 items-center justify-center">
                      <svg className="h-[62px] w-[62px] -rotate-90" viewBox="0 0 36 36">
                        <path className="text-white/70" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                        <path
                          className="text-violet-500 transition-all duration-500"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray={`${detailProgress}, 100`}
                        />
                      </svg>
                      <span className="absolute text-sm font-bold text-violet-600">{detailProgress}%</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      <strong className="text-slate-800">{detailProgress}%</strong> read
                      <div className="text-xs text-[#8e9aaf]">{sectionIdx} of {detailSections.length} section{detailSections.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>

                {/* Launch Practice button */}
                <div className={`${GLASS_CARD} p-5`}>
                  <p className="mb-3 text-xs text-[#8e9aaf]">Ready to test your understanding?</p>
                  <button
                    type="button"
                    onClick={() => setIsPracticeMode(true)}
                    className="flex w-full items-center justify-between rounded-full bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-500/15"
                  >
                    Launch Practice
                    <ArrowRight size={16} />
                  </button>
                </div>

                {/* Section navigator */}
                {detailSections.length > 1 && (
                  <div className={`${GLASS_CARD} p-5`}>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Sections</p>
                    <div className="flex flex-col gap-1">
                      {detailSections.map((section, idx) => {
                        const isPast = idx < sectionIdx - 1;
                        const isCurrent = activeDetailSection === section.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => jumpToDetailSection(section.id)}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${isCurrent ? 'font-semibold text-violet-600' : 'text-slate-500 hover:text-violet-600'}`}
                          >
                            {isPast ? (
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                            ) : (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                            )}
                            <span className="truncate">{section.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Practice panel (full-span) ── */}
            {isPracticeMode && (
              <div className={`col-span-full ${GLASS_CARD} p-5 sm:p-8`}>
                {/* Panel header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/15 pb-4">
                  <h3 className="text-xl font-bold text-[#0f172a] sm:text-2xl">Practice Paper</h3>
                  <span className={`rounded-full ${GLASS_INNER} px-3.5 py-1 text-xs font-semibold text-slate-500`}>
                    {practiceResources.length} resource{practiceResources.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Resource list */}
                <div className="mb-6 grid gap-3">
                  {practiceResources.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="mb-1 text-sm italic text-[#8e9aaf]">
                        No practice materials uploaded for this topic yet.
                      </p>
                      <p className="text-xs text-[#8e9aaf]">
                        Try the interactive Tryout Section below!
                      </p>
                    </div>
                  ) : (
                    practiceResources.map((item, idx) => (
                      <div key={item.id || idx} className={`${GLASS_INNER} p-4`}>
                        <p className="mb-2.5 text-sm text-slate-700">
                          <span className="mr-2 font-bold text-violet-400">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          {item.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.url && (
                            <>
                              <a href={getInlineDocumentUrl(item.url)} target="_blank" rel="noreferrer" className="rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                                Open
                              </a>
                              <a href={item.url} download className="rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                                Download
                              </a>
                            </>
                          )}
                          {item.content && (
                            <button
                              type="button"
                              onClick={() => setActiveMaterial(item)}
                              className="rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Worksheet Assignments</p>
                    {chapterWorksheets.submittableAssignments.map((assignment) => {
                      const isSubmitted = submittedWorksheets.has(assignment._id);
                      const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                      return (
                        <div key={assignment._id} className={`flex flex-wrap items-center justify-between gap-3 ${GLASS_INNER} p-3.5`}>
                          <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
                            <FileText size={15} className="shrink-0 text-violet-500" />
                            <p className="truncate text-sm font-semibold text-slate-700">{assignment.title}</p>
                            {isSubmitted && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                <CheckCircle2 size={10} /> Submitted
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {attachmentUrl && (
                              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                                <Download size={11} /> Download
                              </a>
                            )}
                            {!isSubmitted ? (
                              <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-600">
                                Submit
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-500/15 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPracticeMode(false)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft size={14} /> Return to theory
                  </button>
                  <button
                    type="button"
                    onClick={goToTryoutSection}
                    className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-600"
                  >
                    Try Full Tryout <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Worksheets strip (theory view only) */}
          {!isPracticeMode && (chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
            <section className={`mx-auto mt-6 max-w-[1100px] ${GLASS_CARD} p-5`}>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <ClipboardList size={18} />
                </div>
                <h2 className="text-base font-bold text-[#0f172a]">Worksheets</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {chapterWorksheets.downloadLinks.map((link) => (
                  <div key={link.id} className={`flex items-center justify-between gap-3 ${GLASS_INNER} p-3`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0 text-violet-500" />
                      <p className="truncate text-sm font-semibold text-slate-700">{link.title}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600">
                      <Download size={11} /> Download
                    </a>
                  </div>
                ))}
                {chapterWorksheets.submittableAssignments.map((assignment) => {
                  const isSubmitted = submittedWorksheets.has(assignment._id);
                  const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                  return (
                    <div key={assignment._id} className={`flex flex-wrap items-center justify-between gap-3 ${GLASS_INNER} p-3`}>
                      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                        <FileText size={14} className="shrink-0 text-violet-500" />
                        <p className="truncate text-sm font-semibold text-slate-700">{assignment.title}</p>
                        {isSubmitted && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Submitted</span>}
                      </div>
                      <div className="flex gap-2">
                        {attachmentUrl && (
                          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                            <Download size={11} /> Download
                          </a>
                        )}
                        {!isSubmitted ? (
                          <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-600">Submit</button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={12} /> Done</span>
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
            <div
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
            </div>
          </div>
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

  const stepsDoneLabel = `${completedSteps.length}/${chapterInstructionalFlow.length || 0} (${overallProgress}%)`;
  const progressStatusLabel = overallProgress === 0 ? 'Ready to begin!' : overallProgress === 100 ? 'Topic complete!' : `${overallProgress}% complete`;
  const heroDescription = chapterIntroduction || 'Explore this topic step by step, then try the practice questions when you’re ready.';
  const classChip = profile?.grade ? `Class ${profile.grade}${profile.section ? ` • ${profile.section}` : ''} curriculum` : '';

  return (
    <div ref={moduleRef} className="min-h-screen w-full bg-[#f1f5f9]">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={goBackToSubjectTopics} className={`inline-flex items-center gap-1.5 rounded-xl ${GLASS_INNER} px-3 py-2 text-sm font-bold text-violet-600 ${GLASS_HOVER}`}>
              <ArrowLeft size={16} /> Back to Chapters
            </button>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-[#8e9aaf]">
              <ChevronRight size={14} className="text-slate-300" />
              <span>{subjectSlug}</span>
              {mapScope.chapterTitle && mapScope.chapterTitle !== topicSlug && (
                <>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span>{mapScope.chapterTitle}</span>
                </>
              )}
              <ChevronRight size={14} className="text-slate-300" />
              <span className="font-bold text-violet-600">{topicSlug}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDownloadPdf} disabled={downloadingPdf} className={`inline-flex items-center gap-1.5 rounded-xl ${GLASS_INNER} px-3 py-2 text-sm font-bold text-slate-600 ${GLASS_HOVER} disabled:opacity-60`}>
              <Download size={16} className="text-violet-500" /> {downloadingPdf ? 'Preparing…' : 'Download PDF'}
            </button>
            <button type="button" onClick={toggleFullscreen} className={`rounded-xl ${GLASS_INNER} p-2.5 text-slate-500 ${GLASS_HOVER}`}>
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" onClick={openDetailsPage} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-600">
              Start Reading <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Hero */}
        <section className={`relative mb-6 overflow-hidden ${GLASS_CARD} p-5 sm:p-8`}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-1/3 h-48 w-48 rounded-full bg-amber-100/50 blur-2xl" />
          <div className="relative z-10 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">Topic</span>
                {mapScope.chapterTitle && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">{mapScope.chapterTitle}</span>}
                {classChip && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8e9aaf]">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {classChip}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] sm:text-4xl">{topicSlug}</h1>
              <p className="mt-2 text-sm text-[#64748b] sm:text-base">{heroDescription}</p>
            </div>

            <div className={`flex w-full shrink-0 items-center gap-4 ${GLASS_INNER} p-4 lg:w-auto`}>
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <path className="text-white/70" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                  <path
                    className="text-violet-500 transition-all duration-700 ease-out"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${overallProgress}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base font-bold text-violet-600">{overallProgress}%</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Lesson Progress</span>
                <span className="text-sm font-bold text-slate-800">{progressStatusLabel}</span>
                <button type="button" onClick={openDetailsPage} className="mt-0.5 inline-flex items-center gap-1 text-left text-xs font-bold text-violet-600 hover:underline">
                  Read Full Article <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 border-t border-violet-500/15 pt-5 sm:grid-cols-4">
            {[
              { icon: CalendarDays, color: 'text-violet-600', label: 'Target Date', value: chapterDateLabel || 'Not set' },
              { icon: Calendar, color: 'text-violet-600', label: 'School Day', value: chapterDayLabel || '—' },
              { icon: Clock, color: 'text-amber-600', label: 'Total Duration', value: chapterDurationLabel || '—' },
              { icon: ListChecks, color: 'text-emerald-600', label: 'Completed Steps', value: stepsDoneLabel },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-3 ${GLASS_INNER} p-2.5`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#8e9aaf]">{stat.label}</p>
                  <p className="truncate text-sm font-bold text-slate-800">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Two column workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT: objectives + materials + assessment */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <div className={`${GLASS_CARD} p-5 sm:p-6`}>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <Lightbulb size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0f172a]">What You Will Learn</h2>
              </div>
              {chapterLearningObjectives.length === 0 ? (
                <p className="text-sm italic text-[#8e9aaf]">No objectives published for this topic.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {chapterLearningObjectives.map((objective, idx) => (
                    <div key={idx} className={`flex items-start gap-3 ${GLASS_INNER} p-3`}>
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">{idx + 1}</div>
                      <p className="text-sm font-medium text-slate-700">{objective}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`${GLASS_CARD} p-5 sm:p-6`}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <BookOpen size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0f172a]">Lesson Materials</h2>
              </div>
              {learningMaterials.length === 0 ? (
                <p className="text-sm italic text-[#8e9aaf]">No chapter material uploaded yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {learningMaterials.map((material, idx) => (
                    <div key={idx} className={`flex flex-wrap items-center gap-3 ${GLASS_INNER} p-3`}>
                      <FileText size={16} className="shrink-0 text-[#8e9aaf]" />
                      <span className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold text-slate-700">{material.title}</span>
                      <MaterialQuickActions material={material} onRead={setActiveMaterial} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`${GLASS_CARD} p-5 sm:p-6`}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <ClipboardList size={18} />
                </div>
                <h2 className="text-lg font-bold text-[#0f172a]">Assessment</h2>
              </div>
              {assessmentItems.length === 0 ? (
                <p className="text-sm italic text-[#8e9aaf]">No assessment uploaded yet. Teacher assessment files will appear here.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assessmentItems.map((item, idx) => (
                    <div key={idx} className={`flex flex-wrap items-center gap-3 ${GLASS_INNER} p-3`}>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{normalizeLabel(item.formatLabel || 'Assessment')}</span>
                      <span className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold text-slate-700">{item.title}</span>
                      <MaterialQuickActions material={item} onRead={setActiveMaterial} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: step-by-step roadmap */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Step-by-Step Learning Journey</h2>
                <p className="text-sm text-[#64748b]">Work through each step in order to finish this topic.</p>
              </div>
              <span className={`rounded-full ${GLASS_INNER} px-3 py-1 text-xs font-bold text-slate-500`}>Guided Flow</span>
            </div>

            {chapterInstructionalFlow.length === 0 ? (
              <div className={`${GLASS_CARD} p-6 text-center`}>
                <p className="text-sm italic text-[#8e9aaf]">No instructional flow provided yet.</p>
              </div>
            ) : (
              <div className="relative flex flex-col gap-4 pl-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-0.5 before:bg-violet-500/20 sm:pl-5 sm:before:left-[23px]">
                {chapterInstructionalFlow.map((step, idx) => {
                  const isActive = resolvedActiveFlowStepId === step.id;
                  const isDone = completedSteps.includes(step.id);
                  return (
                    <div key={step.id} className="relative flex items-start gap-3 sm:gap-4">
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow ring-4 ring-[#f1f5f9] sm:h-9 sm:w-9 ${
                        isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-violet-500 text-white' : 'bg-white/70 text-slate-500'
                      }`}>
                        {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                      </div>
                      <div className={`flex-1 ${GLASS_CARD} ${GLASS_HOVER} p-4 sm:p-5 ${isActive ? 'ring-2 ring-violet-300' : ''}`}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${isActive ? 'bg-violet-500/10 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{step.type}</span>
                            {step.duration > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                <Clock size={12} /> {step.duration} min
                              </span>
                            )}
                          </div>
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} /> Done</span>
                          ) : isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" /> In Progress
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-base font-bold text-[#0f172a] sm:text-lg">{step.title}</h3>
                        <div className="mt-3 flex items-center justify-end border-t border-violet-500/15 pt-3">
                          <button
                            type="button"
                            onClick={() => handleFlowStepClick(step.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
                              isDone ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-violet-500 text-white hover:bg-violet-600'
                            }`}
                          >
                            {isDone ? 'Revisit Step' : 'Explore Step'} <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Worksheets */}
        {(chapterWorksheets.downloadLinks.length > 0 || chapterWorksheets.submittableAssignments.length > 0) && (
          <section className={`mt-6 ${GLASS_CARD} p-5 sm:p-6`}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><ClipboardList size={18} /></div>
              <h2 className="text-lg font-bold text-[#0f172a]">Worksheets</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {chapterWorksheets.downloadLinks.map((link) => (
                <div key={link.id} className={`flex items-center justify-between gap-3 ${GLASS_INNER} p-3`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={16} className="shrink-0 text-violet-500" />
                    <p className="truncate text-sm font-semibold text-slate-700">{link.title}</p>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600">
                    <Download size={12} /> Download
                  </a>
                </div>
              ))}
              {chapterWorksheets.submittableAssignments.map((assignment) => {
                const isSubmitted = submittedWorksheets.has(assignment._id);
                const attachmentUrl = (assignment.attachments || [])[0]?.url || '';
                return (
                  <div key={assignment._id} className={`flex flex-col gap-2 ${GLASS_INNER} p-3`}>
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="shrink-0 text-violet-500" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{assignment.title}</p>
                      {isSubmitted && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Submitted</span>}
                    </div>
                    <div className="flex gap-2">
                      {attachmentUrl && (
                        <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-violet-500/35 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100">
                          <Download size={11} /> Download
                        </a>
                      )}
                      {!isSubmitted ? (
                        <button type="button" onClick={() => setWorksheetModal(assignment)} className="rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-600">Submit</button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={12} /> Done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Explanation + Recap */}
        {(chapterExplanation || chapterRecap) && (
          <section className={`mt-6 grid grid-cols-1 gap-5 ${chapterExplanation && chapterRecap ? 'lg:grid-cols-2' : ''}`}>
            {chapterExplanation && (
              <div className={`${GLASS_CARD} p-5 sm:p-6`}>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Step-by-Step Explanation</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{chapterExplanation}</p>
              </div>
            )}
            {chapterRecap && (
              <div className={`${GLASS_CARD} p-5 sm:p-6`}>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Quick Recap</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{chapterRecap}</p>
              </div>
            )}
          </section>
        )}

        {/* Need help footer */}
        <section className={`mt-6 flex flex-col items-start gap-4 ${GLASS_CARD} p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><MessageCircle size={20} /></div>
            <div>
              <span className="block text-sm font-bold text-[#0f172a]">Need help with this topic?</span>
              <span className="text-sm text-[#64748b]">Ask your teacher directly in the Class Wall.</span>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/student/assignments-academic-alcove')} className={`w-full shrink-0 rounded-xl ${GLASS_INNER} px-4 py-2 text-sm font-bold text-slate-700 ${GLASS_HOVER} sm:w-auto`}>
            Open Class Wall
          </button>
        </section>
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
