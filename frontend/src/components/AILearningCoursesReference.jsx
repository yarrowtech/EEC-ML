import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Target,
  Layers,
  Maximize2,
  Minimize2,
  Download,
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const DASHBOARD_ENDPOINT = `${API_BASE}/api/student/auth/dashboard`;
const FEEDBACK_CONTEXT_ENDPOINT = `${API_BASE}/api/student/auth/teacher-feedback/context`;
const STUDENT_learningMaterials_ENDPOINT = `${API_BASE}/api/student/materials?limit=100`;
const STUDENT_PAPERS_ENDPOINT = `${API_BASE}/api/practice-papers/student/papers?limit=100`;


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

const AILearningCoursesReference = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDetailsView = searchParams.get('view') === 'details';
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [teacherMaterials, setTeacherMaterials] = useState([]);
  const [practicePapers, setPracticePapers] = useState([]);
  const [activeStep, setActiveStep] = useState('step1');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const moduleRef = useRef(null);
  const detailsViewRef = useRef(null);

  // Extract topic from URL
  const urlMatch = location.pathname.match(/\/topic\/([^/]+)$/);
  const topicSlug = urlMatch?.[1] ? decodeURIComponent(urlMatch[1]) : 'Topic';
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const subjectSlug = subjectMatch?.[1] ? decodeURIComponent(subjectMatch[1]) : 'Subject';

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
    localStorage.setItem(storageKey, JSON.stringify(data));
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

        const [dashRes, contextRes, materialsRes, papersRes] = await Promise.all([
          fetchCachedJson(DASHBOARD_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(FEEDBACK_CONTEXT_ENDPOINT, { ttlMs: 2 * 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(STUDENT_learningMaterials_ENDPOINT, { ttlMs: 60 * 1000, fetchOptions: { headers } }),
          fetchCachedJson(STUDENT_PAPERS_ENDPOINT, { ttlMs: 60 * 1000, fetchOptions: { headers } }),
        ]);

        setStats(dashRes?.data?.stats || null);
        setProfile(dashRes?.data?.profile || null);
        setContexts(Array.isArray(contextRes?.data?.teachers) ? contextRes.data.teachers : []);
        setTeacherMaterials(Array.isArray(materialsRes?.data?.materials) ? materialsRes.data.materials : []);
        setPracticePapers(Array.isArray(papersRes?.data?.papers) ? papersRes.data.papers : []);
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

  const filteredTeacherMaterials = useMemo(() => {
    const subjectKey = String(subjectSlug || '').trim().toLowerCase();
    const topicKey = String(topicSlug || '').trim().toLowerCase();

    return teacherMaterials.filter((material) => {
      const materialSubject = String(material?.subjectName || '').trim().toLowerCase();
      const title = String(material?.title || '').trim().toLowerCase();
      const content = String(material?.content || '').trim().toLowerCase();
      const subjectMatch = !subjectKey || materialSubject === subjectKey || materialSubject.includes(subjectKey);
      const topicMatch = !topicKey || title.includes(topicKey) || content.includes(topicKey);
      return subjectMatch && topicMatch;
    });
  }, [teacherMaterials, subjectSlug, topicSlug]);

  const learningMaterials = useMemo(() => {
    return filteredTeacherMaterials.slice(0, 6).map((material) => ({
      title: material.title,
      description: material.typeLabel || material.category || 'Study Material',
    }));
  }, [filteredTeacherMaterials]);

  const assessmentItems = useMemo(() => {
    const papersCount = practicePapers.filter((paper) => String(paper?.title || '').toLowerCase().includes(String(topicSlug || '').toLowerCase()) || !topicSlug).length;
    const tryoutCount = filteredTeacherMaterials.filter((m) => String(m?.typeLabel || '').toLowerCase().includes('tryout')).length;
    return [
      { title: 'Practice Papers', description: papersCount > 0 ? `${papersCount} real papers available` : 'No real paper found' },
      { title: 'Tryout Section', description: tryoutCount > 0 ? `${tryoutCount} real tryout resources available` : 'No real tryout found' },
      { title: 'Self-Assessment', description: 'Based on published class materials only' },
    ];
  }, [practicePapers, filteredTeacherMaterials, topicSlug]);

  // Helper functions
  const toggleStepComplete = (stepId) => {
    if (completedSteps.includes(stepId)) {
      setCompletedSteps(completedSteps.filter(s => s !== stepId));
    } else {
      setCompletedSteps([...completedSteps, stepId]);
    }
  };

  const isPracticeUnlocked = overallProgress >= 75;
  const isAssessmentItemClickable = (itemTitle) => {
    const normalizedTitle = String(itemTitle || '').toLowerCase();
    return isPracticeUnlocked && (normalizedTitle === 'practice papers' || normalizedTitle === 'tryout section');
  };
  const getAssessmentStatusText = (itemTitle) => (isAssessmentItemClickable(itemTitle) ? 'Ready to start' : 'Unlocks at 75% progress');
  const normalizedTopicSlug = encodeURIComponent(String(topicSlug || '').trim());
  const normalizedSubjectSlug = encodeURIComponent(String(subjectSlug || '').trim());
  const readingContent = useMemo(() => {
    if (!filteredTeacherMaterials.length) return { intro: '', sections: [] };

    const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const first = filteredTeacherMaterials[0];
    const intro = strip(first?.content).slice(0, 900);
    const sections = filteredTeacherMaterials.slice(1, 6).map((item) => ({
      title: item.title || 'Learning Note',
      text: strip(item.content).slice(0, 1200),
    })).filter((sec) => sec.text);

    return { intro, sections };
  }, [filteredTeacherMaterials]);

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
    } catch (err) {
      setError('Fullscreen mode is not available on this device/browser.');
    }
  };
  const detailSections = useMemo(() => ([
    { id: 'introduction', title: 'Introduction', text: readingContent.intro },
    ...readingContent.sections.map((section, index) => ({
      id: `section-${index + 1}`,
      title: section.title,
      text: section.text,
    })),
  ]), [readingContent]);
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

  const handleAssessmentItemClick = (itemTitle) => {
    const normalizedTitle = String(itemTitle || '').toLowerCase();
    if (normalizedTitle === 'practice papers') {
      navigate(`/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}/assessment/practice-paper`);
      return;
    }
    if (normalizedTitle === 'tryout section') {
      navigate(`/student/smart-learning-courses/subject/${normalizedSubjectSlug}/topic/${normalizedTopicSlug}/assessment/tryout-section`);
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
      addParagraph(readingContent.intro);
      readingContent.sections.forEach((section, index) => {
        addHeading(`${index + 1}. ${section.title}`);
        addParagraph(section.text);
      });

      addHeading('Learning Objectives');
      LEARNING_OBJECTIVES.forEach((objective) => addBullet(objective));
      y += 3;

      addHeading('Instructional Flow');
      LEARNING_STEPS.forEach((step, index) => {
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
    } catch (err) {
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
    } catch (err) {
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
                  <p className="mb-6">{readingContent.intro}</p>
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
      <header className="h-14 border-b flex items-center justify-between px-4 sm:px-6 z-50 sticky top-0 flex-shrink-0" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderColor: '#e7e8e9' }}>
        <div className="flex items-center gap-2 sm:gap-6 flex-1 min-w-0">
          <button
            onClick={goBackToSubjectTopics}
            className="inline-flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors rounded-lg px-2 py-1 sm:px-3"
            style={{ color: '#004b71' }}
          >
            <ArrowLeft size={16} className="sm:w-[18px]" /> <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-4 w-px hidden sm:block" style={{ backgroundColor: '#cbd5e0' }}></div>
          <p className="text-[10px] sm:text-xs uppercase tracking-widest font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#707880' }}>
            {subjectSlug} • {profile?.className || 'Class'}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex px-4 py-1.5 text-sm font-bold hover:bg-slate-50 transition-colors rounded-lg items-center gap-2"
            style={{ color: '#004b71' }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1 sm:gap-2 text-white disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006494' }}
          >
            <Download size={14} className="sm:w-4" />
            <span className="hidden sm:inline">{downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </header>

      {/* Main Layout - Responsive Grid */}
      <main className="flex-1 w-full overflow-auto" style={{ padding: '12px' }}>
        {/* Desktop Grid Layout (lg and above) */}
        <div className="hidden lg:grid gap-3 h-full" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
          {/* Learning Objectives - Top Left */}
          <section className="col-span-3 row-span-3 rounded-2xl p-5 flex flex-col border shadow-sm overflow-hidden" style={{ backgroundColor: '#f3f4f5', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} style={{ color: '#5f4200' }} />
              <h2 className="text-lg font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Learning Objectives</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {LEARNING_OBJECTIVES.map((obj, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: '#7d5800' }}>
                    {idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: '#40484f' }}>{obj}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Instructional Flow - Middle Left */}
          <section className="col-span-3 row-span-3 rounded-2xl p-5 border shadow-sm flex flex-col overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={20} style={{ color: '#004b71' }} />
              <h2 className="text-lg font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Instructional Flow</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {LEARNING_STEPS.map((step, idx) => (
                <div key={step.id} className="relative pl-6" style={{ borderLeft: '1px solid rgba(0, 75, 113, 0.2)' }}>
                  <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#004b71' }}></div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-xs font-bold uppercase" style={{ color: '#004b71' }}>{step.type}</h3>
                    <span className="text-[10px] font-bold" style={{ color: '#a0aec0' }}>{step.duration}m</span>
                  </div>
                  <p className="text-xs leading-snug" style={{ color: '#40484f' }}>{step.title}</p>
                  {completedSteps.includes(step.id) && (
                    <div className="mt-2 text-[10px] font-bold flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <CheckCircle2 size={12} /> Completed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Large Featured Section - Center */}
          <section
            className="col-span-6 row-span-6 relative rounded-3xl overflow-hidden shadow-2xl cursor-pointer"
            style={{ border: '4px solid white' }}
            onClick={openDetailsPage}
            title={`Open ${topicSlug} details`}
          >
            <img
              alt="Featured learning visualization"
              className="absolute inset-0 w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjErJaMyDK5kjzTovLrASuyjKjQibbbK3m9j83ky5Y8NUw42gJ8rI2I2nvCTIMD9KarwXUrpyqZ3mOAtTehMrvrfM5zley6gduXzfL9s0lZtKH5TvmU1QxZQRQ1wUQAK9WMT7rZWr10yVa7fZAtEaFk1Eci3MupvnWlWRXxik3eIhP4eyhrZKKDf1u7wZOqKUuaCgcUyuFIQ3isA-SUievMVWvVKr1vYH5L9syrve9QLI6yCKDPzBpXuVusD2XRg-QobUMRlHoPDCZ"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-12" style={{ background: 'linear-gradient(to top, rgba(0, 75, 113, 0.95), rgba(0, 75, 113, 0.4), transparent)' }}>
              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl sm:text-6xl font-black text-white leading-[0.95] tracking-tighter" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {topicSlug}
                </h1>
                <p className="text-base sm:text-xl leading-relaxed opacity-90" style={{ fontFamily: 'Lexend, sans-serif', color: '#cbe6ff' }}>
                  A comprehensive learning experience designed to help you master key concepts through structured practice, visual aids, and interactive materials.
                </p>

                {/* Metadata Cards */}
                <div className="pt-6 flex gap-2 sm:gap-4 flex-wrap">
                  <div className="px-3 sm:px-4 py-2 rounded-xl border text-sm sm:text-base" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: 'rgba(255, 255, 255, 0.6)' }}>Total Duration</p>
                    <p className="text-sm font-bold text-white">
                      {LEARNING_STEPS.reduce((sum, step) => sum + step.duration, 0)} Min
                    </p>
                  </div>
                  <div className="px-3 sm:px-4 py-2 rounded-xl border text-sm sm:text-base" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: 'rgba(255, 255, 255, 0.6)' }}>Progress</p>
                    <p className="text-sm font-bold text-white">{overallProgress}%</p>
                  </div>
                  <div className="px-3 sm:px-4 py-2 rounded-xl border text-sm sm:text-base" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: 'rgba(255, 255, 255, 0.6)' }}>Steps Done</p>
                    <p className="text-sm font-bold text-white">
                      {completedSteps.length}/{LEARNING_STEPS.length}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-6 space-y-2">
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${overallProgress}%`,
                        background: 'linear-gradient(to right, #ffdea9, #ffba27, #ffd386)'
                      }}
                    ></div>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'Work Sans, sans-serif' }}>
                    {completedSteps.length} of {LEARNING_STEPS.length} learning steps completed
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Materials - Bottom Right Top */}
          <section className="col-span-3 row-span-3 rounded-2xl p-5 flex flex-col border shadow-sm overflow-hidden" style={{ backgroundColor: 'rgba(171, 238, 203, 0.1)', borderColor: 'rgba(171, 238, 203, 0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Layers size={20} style={{ color: '#2c694e' }} />
              <h2 className="text-lg font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Materials</h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {learningMaterials.map((material, idx) => (
                <div key={idx} className="p-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: '#ffffff', border: '1px solid #f3f4f5' }}>
                  <span className="text-2xl flex-shrink-0">
                    {idx === 0 ? '💻' : idx === 1 ? '📊' : '📚'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: '#191c1d' }}>{material.title}</p>
                    <p className="text-[10px] truncate" style={{ fontFamily: 'Work Sans, sans-serif', color: '#40484f' }}>{material.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Assessment & Practice - Bottom Right Bottom */}
          <section className="col-span-3 row-span-3 rounded-2xl p-5 flex flex-col border shadow-sm overflow-hidden" style={{ backgroundColor: '#e7e8e9', borderColor: '#e1e3e4' }}>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} style={{ color: '#004b71' }} />
              <h2 className="text-lg font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Assessment</h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              <p className="text-xs italic leading-relaxed mb-4" style={{ color: '#40484f' }}>
                Measure mastery through structured practice and self-assessment tools.
              </p>
              {assessmentItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAssessmentItemClick(item.title)}
                  className={`w-full p-3 rounded-xl border text-left ${isAssessmentItemClickable(item.title) ? 'hover:shadow-sm' : ''}`}
                  style={{ backgroundColor: isAssessmentItemClickable(item.title) ? '#ffffff' : '#f8fafc', borderColor: '#c0c7d0', cursor: isAssessmentItemClickable(item.title) ? 'pointer' : 'default' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} style={{ color: isAssessmentItemClickable(item.title) ? '#004b71' : '#94a3b8' }} />
                    <h4 className="text-xs font-bold truncate" style={{ color: isPracticeUnlocked ? '#004b71' : '#40484f' }}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[10px]" style={{ color: '#40484f' }}>
                    {item.description}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold" style={{ color: isAssessmentItemClickable(item.title) ? '#166534' : '#64748b' }}>
                    {getAssessmentStatusText(item.title)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Tablet Layout (md-lg) */}
        <div className="hidden md:grid lg:hidden gap-3 auto-rows-max" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {/* Learning Objectives */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm overflow-hidden max-h-96" style={{ backgroundColor: '#f3f4f5', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} style={{ color: '#5f4200' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Learning Objectives</h2>
            </div>
            <div className="overflow-y-auto space-y-3 text-sm" style={{ scrollbarWidth: 'thin' }}>
              {LEARNING_OBJECTIVES.map((obj, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: '#7d5800' }}>
                    {idx + 1}
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: '#40484f' }}>{obj}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Instructional Flow */}
          <section className="rounded-2xl p-4 border shadow-sm flex flex-col overflow-hidden max-h-96" style={{ backgroundColor: '#ffffff', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={18} style={{ color: '#004b71' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Instructional Flow</h2>
            </div>
            <div className="overflow-y-auto space-y-4 text-xs" style={{ scrollbarWidth: 'thin' }}>
              {LEARNING_STEPS.map((step, idx) => (
                <div key={step.id} className="relative pl-5" style={{ borderLeft: '1px solid rgba(0, 75, 113, 0.2)' }}>
                  <div className="absolute -left-[3px] top-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#004b71' }}></div>
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="font-bold uppercase" style={{ color: '#004b71', fontSize: '9px' }}>{step.type}</h3>
                    <span className="font-bold" style={{ color: '#a0aec0', fontSize: '8px' }}>{step.duration}m</span>
                  </div>
                  <p className="leading-snug" style={{ color: '#40484f' }}>{step.title}</p>
                  {completedSteps.includes(step.id) && (
                    <div className="mt-1 text-[9px] font-bold flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <CheckCircle2 size={10} /> Done
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Featured Section */}
          <section
            className="col-span-2 relative rounded-2xl overflow-hidden shadow-lg h-[45vw] min-h-[280px] max-h-[420px] cursor-pointer"
            style={{ border: '3px solid white' }}
            onClick={openDetailsPage}
            title={`Open ${topicSlug} details`}
          >
            <img
              alt="Featured learning visualization"
              className="absolute inset-0 w-full h-full object-cover object-center"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjErJaMyDK5kjzTovLrASuyjKjQibbbK3m9j83ky5Y8NUw42gJ8rI2I2nvCTIMD9KarwXUrpyqZ3mOAtTehMrvrfM5zley6gduXzfL9s0lZtKH5TvmU1QxZQRQ1wUQAK9WMT7rZWr10yVa7fZAtEaFk1Eci3MupvnWlWRXxik3eIhP4eyhrZKKDf1u7wZOqKUuaCgcUyuFIQ3isA-SUievMVWvVKr1vYH5L9syrve9QLI6yCKDPzBpXuVusD2XRg-QobUMRlHoPDCZ"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-6" style={{ background: 'linear-gradient(to top, rgba(0, 75, 113, 0.95), rgba(0, 75, 113, 0.4), transparent)' }}>
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {topicSlug}
                </h1>
                <p className="text-xs sm:text-sm opacity-90" style={{ fontFamily: 'Lexend, sans-serif', color: '#cbe6ff' }}>
                  Master key concepts through structured practice and interactive materials.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <div className="px-2 py-1 rounded-lg border text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[8px] text-white/60" style={{ fontFamily: 'Work Sans, sans-serif' }}>Progress</p>
                    <p className="text-xs font-bold text-white">{overallProgress}%</p>
                  </div>
                  <div className="px-2 py-1 rounded-lg border text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[8px] text-white/60" style={{ fontFamily: 'Work Sans, sans-serif' }}>Steps</p>
                    <p className="text-xs font-bold text-white">{completedSteps.length}/{LEARNING_STEPS.length}</p>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${overallProgress}%`,
                      background: 'linear-gradient(to right, #ffdea9, #ffba27, #ffd386)'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          {/* Materials */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm overflow-hidden max-h-64" style={{ backgroundColor: 'rgba(171, 238, 203, 0.1)', borderColor: 'rgba(171, 238, 203, 0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={18} style={{ color: '#2c694e' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Materials</h2>
            </div>
            <div className="overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin' }}>
              {learningMaterials.map((material, idx) => (
                <div key={idx} className="p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#ffffff', border: '1px solid #f3f4f5' }}>
                  <span className="text-lg flex-shrink-0">
                    {idx === 0 ? '💻' : idx === 1 ? '📊' : '📚'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: '#191c1d' }}>{material.title}</p>
                    <p className="text-[9px] truncate" style={{ fontFamily: 'Work Sans, sans-serif', color: '#40484f' }}>{material.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Assessment */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm overflow-hidden max-h-64" style={{ backgroundColor: '#e7e8e9', borderColor: '#e1e3e4' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} style={{ color: '#004b71' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Assessment</h2>
            </div>
            <div className="overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin' }}>
              {assessmentItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAssessmentItemClick(item.title)}
                  className={`w-full p-2 rounded-lg border text-xs text-left ${isAssessmentItemClickable(item.title) ? 'hover:shadow-sm' : ''}`}
                  style={{ backgroundColor: isAssessmentItemClickable(item.title) ? '#ffffff' : '#f8fafc', borderColor: '#c0c7d0', cursor: isAssessmentItemClickable(item.title) ? 'pointer' : 'default' }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 size={14} style={{ color: isAssessmentItemClickable(item.title) ? '#004b71' : '#94a3b8' }} />
                    <h4 className="font-bold text-[11px] truncate" style={{ color: isPracticeUnlocked ? '#004b71' : '#40484f' }}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[9px]" style={{ color: '#40484f' }}>
                    {item.description}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold" style={{ color: isAssessmentItemClickable(item.title) ? '#166534' : '#64748b' }}>
                    {getAssessmentStatusText(item.title)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Mobile Layout (below md) */}
        <div className="md:hidden space-y-3">
          {/* Featured Section First */}
          <section
            className="relative rounded-2xl overflow-hidden shadow-lg h-[56vw] min-h-[220px] max-h-[360px] cursor-pointer"
            style={{ border: '3px solid white' }}
            onClick={openDetailsPage}
            title={`Open ${topicSlug} details`}
          >
            <img
              alt="Featured learning visualization"
              className="absolute inset-0 w-full h-full object-cover object-center"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjErJaMyDK5kjzTovLrASuyjKjQibbbK3m9j83ky5Y8NUw42gJ8rI2I2nvCTIMD9KarwXUrpyqZ3mOAtTehMrvrfM5zley6gduXzfL9s0lZtKH5TvmU1QxZQRQ1wUQAK9WMT7rZWr10yVa7fZAtEaFk1Eci3MupvnWlWRXxik3eIhP4eyhrZKKDf1u7wZOqKUuaCgcUyuFIQ3isA-SUievMVWvVKr1vYH5L9syrve9QLI6yCKDPzBpXuVusD2XRg-QobUMRlHoPDCZ"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-4" style={{ background: 'linear-gradient(to top, rgba(0, 75, 113, 0.95), rgba(0, 75, 113, 0.4), transparent)' }}>
              <div className="space-y-2">
                <h1 className="text-xl font-black text-white leading-tight tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {topicSlug}
                </h1>
                <p className="text-xs opacity-90" style={{ fontFamily: 'Lexend, sans-serif', color: '#cbe6ff' }}>
                  Master key concepts through structured practice.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <div className="px-2 py-1 rounded-lg border text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[8px] text-white/60">Progress</p>
                    <p className="text-xs font-bold text-white">{overallProgress}%</p>
                  </div>
                  <div className="px-2 py-1 rounded-lg border text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-[8px] text-white/60">Steps</p>
                    <p className="text-xs font-bold text-white">{completedSteps.length}/{LEARNING_STEPS.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Learning Objectives */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm" style={{ backgroundColor: '#f3f4f5', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} style={{ color: '#5f4200' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Learning Objectives</h2>
            </div>
            <div className="space-y-3 text-sm">
              {LEARNING_OBJECTIVES.map((obj, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: '#7d5800' }}>
                    {idx + 1}
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: '#40484f' }}>{obj}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Instructional Flow */}
          <section className="rounded-2xl p-4 border shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e7e8e9' }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={18} style={{ color: '#004b71' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Instructional Flow</h2>
            </div>
            <div className="space-y-4 text-xs">
              {LEARNING_STEPS.map((step, idx) => (
                <div key={step.id} className="relative pl-5" style={{ borderLeft: '1px solid rgba(0, 75, 113, 0.2)' }}>
                  <div className="absolute -left-[3px] top-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#004b71' }}></div>
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="font-bold uppercase" style={{ color: '#004b71', fontSize: '9px' }}>{step.type}</h3>
                    <span className="font-bold" style={{ color: '#a0aec0', fontSize: '8px' }}>{step.duration}m</span>
                  </div>
                  <p className="leading-snug" style={{ color: '#40484f' }}>{step.title}</p>
                  {completedSteps.includes(step.id) && (
                    <div className="mt-1 text-[9px] font-bold flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <CheckCircle2 size={10} /> Done
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Materials */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm" style={{ backgroundColor: 'rgba(171, 238, 203, 0.1)', borderColor: 'rgba(171, 238, 203, 0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={18} style={{ color: '#2c694e' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Materials</h2>
            </div>
            <div className="space-y-2">
              {learningMaterials.map((material, idx) => (
                <div key={idx} className="p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#ffffff', border: '1px solid #f3f4f5' }}>
                  <span className="text-lg flex-shrink-0">
                    {idx === 0 ? '💻' : idx === 1 ? '📊' : '📚'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: '#191c1d' }}>{material.title}</p>
                    <p className="text-[9px] truncate" style={{ fontFamily: 'Work Sans, sans-serif', color: '#40484f' }}>{material.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Assessment */}
          <section className="rounded-2xl p-4 flex flex-col border shadow-sm" style={{ backgroundColor: '#e7e8e9', borderColor: '#e1e3e4' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} style={{ color: '#004b71' }} />
              <h2 className="text-base font-black" style={{ fontFamily: 'Manrope, sans-serif', color: '#191c1d' }}>Assessment</h2>
            </div>
            <div className="space-y-2">
              {assessmentItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAssessmentItemClick(item.title)}
                  className={`w-full p-2 rounded-lg border text-xs text-left ${isAssessmentItemClickable(item.title) ? 'hover:shadow-sm' : ''}`}
                  style={{ backgroundColor: isAssessmentItemClickable(item.title) ? '#ffffff' : '#f8fafc', borderColor: '#c0c7d0', cursor: isAssessmentItemClickable(item.title) ? 'pointer' : 'default' }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 size={14} style={{ color: isAssessmentItemClickable(item.title) ? '#004b71' : '#94a3b8' }} />
                    <h4 className="font-bold text-[11px] truncate" style={{ color: isPracticeUnlocked ? '#004b71' : '#40484f' }}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[9px]" style={{ color: '#40484f' }}>
                    {item.description}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold" style={{ color: isAssessmentItemClickable(item.title) ? '#166534' : '#64748b' }}>
                    {getAssessmentStatusText(item.title)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

      </main>

      {/* Error Notification */}
      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg max-w-md border" style={{ backgroundColor: '#ffdad6', borderColor: '#ba1a1a', color: '#93000a' }}>
          <p className="text-sm font-semibold">{error}</p>
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
