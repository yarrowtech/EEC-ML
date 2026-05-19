import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  Calendar,
  User,
  Target,
  Package,
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  Upload,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const STUDENT_PORTAL_TOPIC_TEMPLATES = {
  hindi: [
    { title: 'क्यों जीमल और कैसे - केसालिया', subtopics: ['पाठ परिचय', 'मुख्य शब्दार्थ', 'अभ्यास प्रश्न'] },
    { title: 'कब आऊँ', subtopics: ['कवि परिचय', 'भावार्थ', 'वस्तुनिष्ठ प्रश्न'] },
    { title: 'मेरे संग की औरतें', subtopics: ['पाठ सार', 'चरित्र विश्लेषण', 'लघु उत्तरीय प्रश्न'] },
  ],
  english: [
    { title: 'Reading Comprehension', subtopics: ['Passage 1', 'Passage 2', 'Inference Questions'] },
    { title: 'Grammar Quest', subtopics: ['Tenses', 'Subject Verb Agreement', 'Modals'] },
    { title: 'Writing Skills', subtopics: ['Notice', 'Letter', 'Essay'] },
  ],
  mathematics: [
    { title: 'Number System', subtopics: ['Rational Numbers', 'Operations', 'Word Problems'] },
    { title: 'Algebra', subtopics: ['Expressions', 'Identities', 'Linear Equations'] },
    { title: 'Geometry', subtopics: ['Triangles', 'Circles', 'Constructions'] },
  ],
  science: [
    { title: 'Physics Basics', subtopics: ['Force', 'Motion', 'Energy'] },
    { title: 'Chemistry Basics', subtopics: ['Atoms', 'Compounds', 'Reactions'] },
    { title: 'Biology Basics', subtopics: ['Cell', 'Tissues', 'Nutrition'] },
  ],
};

const normalizeSubjectKey = (value) => String(value || '').trim().toLowerCase();

const emptyForm = {
  classId: '',
  sectionId: '',
  subjectId: '',
  title: '',
  subject: '',
  date: '',
  learningObjectives: [''],
  materialsNeeded: [''],
  additionalNotes: '',
  plannerContent: { chapters: [] },
};

const createEmptySubTopic = () => ({
  id: `subtopic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  learningPaths: [''],
  studyMaterials: [''],
  mindMaps: [''],
  worksheets: [''],
  referenceMaterials: [''],
  tryoutSections: [''],
  selfAssessments: [''],
  questionPapers: {
    basic: '',
    intermediate: '',
    advanced: '',
  },
});

const createEmptyTopic = () => ({
  id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  subTopics: [createEmptySubTopic()],
});

const createEmptyChapter = () => ({
  id: `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  topics: [createEmptyTopic()],
});

const emptyStatusForm = {
  date: '',
  status: 'pending',
  completionPercent: 0,
  isCompleted: false,
  remarks: '',
};

const statusTone = {
  completed: 'bg-green-100 text-green-700 border-green-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  pending: 'bg-purple-50 text-purple-700 border-purple-200',
};

const prettifyStatus = (value) => {
  if (value === 'in_progress') return 'In Progress';
  if (value === 'completed') return 'Completed';
  return 'Pending';
};

const LessonPlanDashboard = ({ variant = 'default' }) => {
  const isSmartVariant = variant === 'smart-teaching';
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [completionEntries, setCompletionEntries] = useState([]);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState(emptyStatusForm);
  const [uploadingAssetKey, setUploadingAssetKey] = useState('');
  const [publishingSubtopicKey, setPublishingSubtopicKey] = useState('');

  const plannerArrayFields = useMemo(() => ([
    ['learningPaths', 'Learning Path'],
    ['studyMaterials', 'Study Material (upload/link/text)'],
    ['mindMaps', 'Mind Map'],
    ['worksheets', 'Worksheet'],
    ['referenceMaterials', 'Reference Material'],
    ['tryoutSections', 'Tryout Section'],
    ['selfAssessments', 'Self Assessment'],
  ]), []);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    };
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/my`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load lesson plans');
      const items = Array.isArray(data) ? data : [];
      setLessonPlans(items);
      setSelectedPlanId((prev) => {
        if (prev && items.some((item) => item._id === prev)) return prev;
        return items[0]?._id || '';
      });
    } catch (err) {
      setError(err.message || 'Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async ({ classId = '', sectionId = '' } = {}) => {
    try {
      setLoadingOptions(true);
      const query = new URLSearchParams();
      if (classId) query.set('classId', classId);
      if (sectionId) query.set('sectionId', sectionId);
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/options?${query.toString()}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load options');
      setClasses(Array.isArray(data?.classes) ? data.classes : []);
      setSections(Array.isArray(data?.sections) ? data.sections : []);
      setSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
    } catch (err) {
      setError(err.message || 'Failed to load options');
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadCompletionStatuses = async (planId) => {
    if (!planId) {
      setCompletionEntries([]);
      return;
    }
    try {
      setLoadingCompletion(true);
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/${planId}/status`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load completion status');
      setCompletionEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load completion status');
      setCompletionEntries([]);
    } finally {
      setLoadingCompletion(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    loadCompletionStatuses(selectedPlanId);
  }, [selectedPlanId]);

  const filteredPlans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return lessonPlans;
    return lessonPlans.filter((plan) => {
      return [plan.title, plan.subject, plan.className, plan.sectionName]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q));
    });
  }, [lessonPlans, searchTerm]);

  const selectedPlan = useMemo(
    () => filteredPlans.find((plan) => plan._id === selectedPlanId) || filteredPlans[0] || null,
    [filteredPlans, selectedPlanId]
  );

  const sanitizePlannerContent = (value) => {
    const chapters = Array.isArray(value?.chapters) ? value.chapters : [];
    return {
      chapters: chapters.map((chapter) => ({
        id: chapter?.id || `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: chapter?.title || '',
        topics: Array.isArray(chapter?.topics) && chapter.topics.length
          ? chapter.topics.map((topic) => ({
              id: topic?.id || `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: topic?.title || '',
              subTopics: Array.isArray(topic?.subTopics) && topic.subTopics.length
                ? topic.subTopics.map((subTopic) => ({
                    id: subTopic?.id || `subtopic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    title: subTopic?.title || '',
                    learningPaths: Array.isArray(subTopic?.learningPaths) && subTopic.learningPaths.length
                      ? subTopic.learningPaths
                      : [''],
                    studyMaterials: Array.isArray(subTopic?.studyMaterials) && subTopic.studyMaterials.length
                      ? subTopic.studyMaterials
                      : [''],
                    mindMaps: Array.isArray(subTopic?.mindMaps) && subTopic.mindMaps.length
                      ? subTopic.mindMaps
                      : [''],
                    worksheets: Array.isArray(subTopic?.worksheets) && subTopic.worksheets.length
                      ? subTopic.worksheets
                      : [''],
                    referenceMaterials: Array.isArray(subTopic?.referenceMaterials) && subTopic.referenceMaterials.length
                      ? subTopic.referenceMaterials
                      : [''],
                    tryoutSections: Array.isArray(subTopic?.tryoutSections) && subTopic.tryoutSections.length
                      ? subTopic.tryoutSections
                      : [''],
                    selfAssessments: Array.isArray(subTopic?.selfAssessments) && subTopic.selfAssessments.length
                      ? subTopic.selfAssessments
                      : [''],
                    questionPapers: {
                      basic: subTopic?.questionPapers?.basic || '',
                      intermediate: subTopic?.questionPapers?.intermediate || '',
                      advanced: subTopic?.questionPapers?.advanced || '',
                    },
                  }))
                : [createEmptySubTopic()],
            }))
          : [createEmptyTopic()],
      })),
    };
  };

  const updateArrayField = (field, index, value) => {
    setForm((prev) => {
      const next = [...prev[field]];
      next[index] = value;
      return { ...prev, [field]: next };
    });
  };

  const addArrayField = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayField = (field, index) => {
    setForm((prev) => {
      const next = prev[field].filter((_, idx) => idx !== index);
      return { ...prev, [field]: next.length ? next : [''] };
    });
  };

  const updatePlanner = (updater) => {
    setForm((prev) => {
      const nextPlanner = sanitizePlannerContent(prev.plannerContent);
      updater(nextPlanner);
      return { ...prev, plannerContent: nextPlanner };
    });
  };

  const addChapter = () => updatePlanner((planner) => planner.chapters.push(createEmptyChapter()));
  const removeChapter = (chapterIndex) =>
    updatePlanner((planner) => {
      planner.chapters = planner.chapters.filter((_, idx) => idx !== chapterIndex);
    });
  const updateChapterField = (chapterIndex, value) =>
    updatePlanner((planner) => {
      if (!planner.chapters[chapterIndex]) return;
      planner.chapters[chapterIndex].title = value;
    });

  const addTopic = (chapterIndex) =>
    updatePlanner((planner) => {
      planner.chapters[chapterIndex]?.topics?.push(createEmptyTopic());
    });
  const removeTopic = (chapterIndex, topicIndex) =>
    updatePlanner((planner) => {
      const chapter = planner.chapters[chapterIndex];
      if (!chapter) return;
      chapter.topics = chapter.topics.filter((_, idx) => idx !== topicIndex);
      if (!chapter.topics.length) chapter.topics = [createEmptyTopic()];
    });
  const updateTopicField = (chapterIndex, topicIndex, value) =>
    updatePlanner((planner) => {
      const topic = planner.chapters[chapterIndex]?.topics?.[topicIndex];
      if (!topic) return;
      topic.title = value;
    });

  const addSubTopic = (chapterIndex, topicIndex) =>
    updatePlanner((planner) => {
      planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.push(createEmptySubTopic());
    });
  const removeSubTopic = (chapterIndex, topicIndex, subTopicIndex) =>
    updatePlanner((planner) => {
      const topic = planner.chapters[chapterIndex]?.topics?.[topicIndex];
      if (!topic) return;
      topic.subTopics = topic.subTopics.filter((_, idx) => idx !== subTopicIndex);
      if (!topic.subTopics.length) topic.subTopics = [createEmptySubTopic()];
    });
  const updateSubTopicField = (chapterIndex, topicIndex, subTopicIndex, field, value) =>
    updatePlanner((planner) => {
      const subTopic = planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.[subTopicIndex];
      if (!subTopic) return;
      subTopic[field] = value;
    });

  const addSubTopicArrayItem = (chapterIndex, topicIndex, subTopicIndex, field) =>
    updatePlanner((planner) => {
      const arr = planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.[subTopicIndex]?.[field];
      if (!Array.isArray(arr)) return;
      arr.push('');
    });
  const updateSubTopicArrayItem = (chapterIndex, topicIndex, subTopicIndex, field, itemIndex, value) =>
    updatePlanner((planner) => {
      const arr = planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.[subTopicIndex]?.[field];
      if (!Array.isArray(arr) || !arr[itemIndex] && arr[itemIndex] !== '') return;
      arr[itemIndex] = value;
    });
  const removeSubTopicArrayItem = (chapterIndex, topicIndex, subTopicIndex, field, itemIndex) =>
    updatePlanner((planner) => {
      const subTopic = planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.[subTopicIndex];
      if (!subTopic || !Array.isArray(subTopic[field])) return;
      subTopic[field] = subTopic[field].filter((_, idx) => idx !== itemIndex);
      if (!subTopic[field].length) subTopic[field] = [''];
    });

  const updateQuestionPaperLevel = (chapterIndex, topicIndex, subTopicIndex, level, value) =>
    updatePlanner((planner) => {
      const subTopic = planner.chapters[chapterIndex]?.topics?.[topicIndex]?.subTopics?.[subTopicIndex];
      if (!subTopic?.questionPapers) return;
      subTopic.questionPapers[level] = value;
    });

  const handlePlannerFileUpload = async (chapterIndex, topicIndex, subTopicIndex, field, entryIndex) => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt';

    picker.onchange = async (event) => {
      const file = event?.target?.files?.[0];
      if (!file) return;

      const uploadKey = [chapterIndex, topicIndex, subTopicIndex, field, entryIndex].join(':');
      try {
        setUploadingAssetKey(uploadKey);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'lesson_planner_assets');
        formData.append('tags', 'lesson_planner,smart_learning,teacher_upload');

        const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.message || 'Upload failed');

        const uploaded = data?.files?.[0];
        const url = uploaded?.secure_url || uploaded?.url || '';
        if (!url) throw new Error('Upload URL not found');

        updateSubTopicArrayItem(chapterIndex, topicIndex, subTopicIndex, field, entryIndex, url);
      } catch (err) {
        setError(err?.message || 'Failed to upload file');
      } finally {
        setUploadingAssetKey('');
      }
    };

    picker.click();
  };

  const openCreateModal = async () => {
    setEditingPlanId('');
    setForm(emptyForm);
    setShowModal(true);
    await loadOptions();
  };

  const openEditModal = async (plan) => {
    const classId = String(plan?.classId || '');
    const sectionId = String(plan?.sectionId || '');
    const subjectId = String(plan?.subjectId || '');

    setEditingPlanId(String(plan?._id || ''));
    setForm({
      classId,
      sectionId,
      subjectId,
      title: plan?.title || '',
      subject: plan?.subject || '',
      date: plan?.date ? new Date(plan.date).toISOString().slice(0, 10) : '',
      learningObjectives:
        Array.isArray(plan?.learningObjectives) && plan.learningObjectives.length
          ? plan.learningObjectives
          : [''],
      materialsNeeded:
        Array.isArray(plan?.materialsNeeded) && plan.materialsNeeded.length
          ? plan.materialsNeeded
          : [''],
      additionalNotes: plan?.additionalNotes || '',
      plannerContent: sanitizePlannerContent(plan?.plannerContent),
    });

    setShowModal(true);
    await loadOptions({ classId, sectionId });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlanId('');
    setForm(emptyForm);
  };

  const openCreateStatusModal = () => {
    setEditingStatusId('');
    setStatusForm({
      ...emptyStatusForm,
      date: selectedPlan?.date ? new Date(selectedPlan.date).toISOString().slice(0, 10) : '',
    });
    setShowStatusModal(true);
  };

  const openEditStatusModal = (entry) => {
    setEditingStatusId(String(entry?._id || ''));
    setStatusForm({
      date: entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : '',
      status: entry?.status || 'pending',
      completionPercent: Number.isFinite(Number(entry?.completionPercent)) ? Number(entry.completionPercent) : 0,
      isCompleted: Boolean(entry?.isCompleted),
      remarks: entry?.remarks || '',
    });
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setEditingStatusId('');
    setStatusForm(emptyStatusForm);
  };

  const onClassChange = async (classId) => {
    setForm((prev) => ({
      ...prev,
      classId,
      sectionId: '',
      subjectId: '',
      subject: '',
    }));
    setSubjects([]);
    if (classId) {
      await loadOptions({ classId });
    } else {
      setSections([]);
    }
  };

  const onSectionChange = async (sectionId) => {
    const classId = form.classId;
    setForm((prev) => ({
      ...prev,
      sectionId,
      subjectId: '',
      subject: '',
    }));
    if (classId && sectionId) {
      await loadOptions({ classId, sectionId });
    } else {
      setSubjects([]);
    }
  };

  const loadStudentPortalTemplate = () => {
    const subjectKey = normalizeSubjectKey(form.subject);
    const templateTopics = STUDENT_PORTAL_TOPIC_TEMPLATES[subjectKey] || [];

    if (!templateTopics.length) {
      setError('No student-portal template found for this subject yet. Add chapters manually.');
      return;
    }

    if (!window.confirm('Replace current chapter/topic structure with student-portal template?')) return;

    setForm((prev) => {
      const chapter = createEmptyChapter();
      chapter.title = (prev.subject || 'Subject') + ' Smart Learning Plan';
      chapter.topics = templateTopics.map((topic) => ({
        id: 'topic-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        title: topic.title,
        subTopics: (topic.subtopics || []).map((sub) => ({
          ...createEmptySubTopic(),
          title: sub,
        })),
      }));

      return {
        ...prev,
        plannerContent: { chapters: [chapter] },
      };
    });
    setError('');
  };

  const onSubjectChange = (subjectId) => {
    if (!subjectId) {
      setForm((prev) => ({ ...prev, subjectId: '', subject: '' }));
      return;
    }
    const selected = subjects.find((item) => item.subjectId === subjectId);
    setForm((prev) => ({
      ...prev,
      subjectId,
      subject: selected?.subjectName || '',
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');

      const payload = {
        classId: form.classId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        title: form.title,
        subject: form.subject,
        date: form.date,
        learningObjectives: form.learningObjectives.map((v) => String(v || '').trim()).filter(Boolean),
        materialsNeeded: form.materialsNeeded.map((v) => String(v || '').trim()).filter(Boolean),
        additionalNotes: form.additionalNotes,
        plannerContent: sanitizePlannerContent(form.plannerContent),
      };

      const isEdit = Boolean(editingPlanId);
      const endpoint = isEdit
        ? `${API_BASE}/api/lesson-plans/teacher/${editingPlanId}`
        : `${API_BASE}/api/lesson-plans/teacher`;

      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || (isEdit ? 'Failed to update lesson plan' : 'Failed to create lesson plan'));
      }

      closeModal();
      await loadPlans();
    } catch (err) {
      setError(err.message || (editingPlanId ? 'Failed to update lesson plan' : 'Failed to create lesson plan'));
    } finally {
      setSaving(false);
    }
  };

  const publishSubtopicToStudentPortal = async (chapterIndex, topicIndex, subTopicIndex) => {
    if (!selectedPlan?._id) return;

    const key = [selectedPlan._id, chapterIndex, topicIndex, subTopicIndex].join(':');
    try {
      setPublishingSubtopicKey(key);
      setError('');

      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/${selectedPlan._id}/publish-subtopic`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ chapterIndex, topicIndex, subTopicIndex, publishPracticePaper: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish subtopic');

      window.alert('Published to student portal successfully.');
    } catch (err) {
      setError(err.message || 'Failed to publish subtopic');
    } finally {
      setPublishingSubtopicKey('');
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm('Delete this lesson plan?')) return;
    try {
      setError('');
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/${planId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete lesson plan');
      await loadPlans();
    } catch (err) {
      setError(err.message || 'Failed to delete lesson plan');
    }
  };

  const submitStatusForm = async (e) => {
    e.preventDefault();
    if (!selectedPlan?._id) return;

    try {
      setSavingStatus(true);
      setError('');
      const payload = {
        date: statusForm.date,
        status: statusForm.status,
        completionPercent: Number(statusForm.completionPercent || 0),
        isCompleted: Boolean(statusForm.isCompleted),
        remarks: statusForm.remarks,
      };

      const isEdit = Boolean(editingStatusId);
      const endpoint = isEdit
        ? `${API_BASE}/api/lesson-plans/teacher/${selectedPlan._id}/status/${editingStatusId}`
        : `${API_BASE}/api/lesson-plans/teacher/${selectedPlan._id}/status`;

      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (isEdit ? 'Failed to update status' : 'Failed to save status'));

      closeStatusModal();
      await loadCompletionStatuses(selectedPlan._id);
    } catch (err) {
      setError(err.message || (editingStatusId ? 'Failed to update status' : 'Failed to save status'));
    } finally {
      setSavingStatus(false);
    }
  };

  const deleteStatus = async (statusId) => {
    if (!selectedPlan?._id || !statusId) return;
    if (!window.confirm('Delete this completion status?')) return;
    try {
      setError('');
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/${selectedPlan._id}/status/${statusId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete status');
      await loadCompletionStatuses(selectedPlan._id);
    } catch (err) {
      setError(err.message || 'Failed to delete status');
    }
  };

  return (
    <div className={isSmartVariant ? 'bg-transparent p-0 space-y-6' : 'min-h-screen bg-slate-50 p-6 space-y-6'}>
      <div className={`border-[2.5px] border-purple-300 rounded-2xl p-6 shadow-sm ${isSmartVariant ? 'bg-white/95 backdrop-blur-sm' : 'bg-white'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isSmartVariant ? 'Smart Teaching Lesson Planner' : 'My Lesson Plans'}
              </h1>
              <p className="text-sm text-gray-500">
                {isSmartVariant
                  ? 'Assigned Subject → Chapter → Topic → Sub Topic → Learning Path → Materials → Assessments'
                  : 'Manage your own lesson plans'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search plans"
                className="pl-9 pr-3 py-2 border-[2px] border-purple-200 rounded-xl bg-purple-50 text-sm focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-[2px] border-purple-400 text-purple-700 text-sm hover:bg-purple-50"
            >
              <Plus className="w-4 h-4" />
              {isSmartVariant ? 'Create Planner' : 'Add Plan'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border-[2.5px] border-purple-300 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-purple-100 text-sm text-gray-600 bg-purple-50/40">
            {loading ? 'Loading...' : `${filteredPlans.length} plan(s)`}
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-purple-100">
            {!loading && filteredPlans.length === 0 && (
              <div className="p-6 text-sm text-gray-500">No lesson plans yet.</div>
            )}
            {filteredPlans.map((plan) => (
              <button
                key={plan._id}
                onClick={() => setSelectedPlanId(plan._id)}
                className={`w-full text-left p-4 transition ${
                  selectedPlan?._id === plan._id ? 'bg-purple-50 border-l-4 border-purple-400' : 'hover:bg-purple-50'
                }`}
              >
                <p className="font-medium text-gray-900">{plan.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {plan.subject} • Class {plan.className} - {plan.sectionName}
                </p>
                <p className="text-xs text-gray-500 mt-1">{new Date(plan.date).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border-[2.5px] border-purple-300 rounded-2xl p-6 shadow-sm">
          {!selectedPlan ? (
            <p className="text-sm text-gray-500">Select a lesson plan to view details.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedPlan.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {selectedPlan.teacherName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedPlan.date).toLocaleDateString()}
                    </span>
                    <span>{selectedPlan.subject}</span>
                    <span>
                      Class {selectedPlan.className} - Section {selectedPlan.sectionName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedPlan)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border-[2px] border-purple-300 text-purple-700 hover:bg-purple-50 text-sm"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => deletePlan(selectedPlan._id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border-[2px] border-red-200 text-red-700 hover:bg-red-50 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border-[2px] border-purple-200 bg-purple-50 p-4">
                  <h3 className="font-medium text-purple-800 flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" />
                    Learning Objectives
                  </h3>
                  <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                    {(selectedPlan.learningObjectives || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border-[2px] border-purple-200 bg-purple-50 p-4">
                  <h3 className="font-medium text-purple-800 flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4" />
                    Materials Needed
                  </h3>
                  <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                    {(selectedPlan.materialsNeeded || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border-[2px] border-purple-200 bg-purple-50 p-4">
                <h3 className="font-medium text-purple-800 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  Additional Notes
                </h3>
                <p className="text-sm text-gray-700">{selectedPlan.additionalNotes || '—'}</p>
              </div>

              <div className="rounded-xl border-[2px] border-purple-200 bg-purple-50 p-4">
                <h3 className="font-medium text-purple-800 mb-3">Lesson Planner Structure</h3>
                {Array.isArray(selectedPlan?.plannerContent?.chapters) && selectedPlan.plannerContent.chapters.length ? (
                  <div className="space-y-3">
                    {selectedPlan.plannerContent.chapters.map((chapter, chapterIndex) => (
                      <div key={chapter.id || chapterIndex} className="rounded-lg border border-purple-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-800">
                          Chapter {chapterIndex + 1}: {chapter.title || 'Untitled Chapter'}
                        </p>
                        <div className="mt-2 space-y-2">
                          {(chapter.topics || []).map((topic, topicIndex) => (
                            <div key={topic.id || topicIndex} className="rounded-md border border-slate-200 p-2">
                              <p className="text-xs font-semibold text-slate-700">
                                Topic {chapterIndex + 1}.{topicIndex + 1}: {topic.title || 'Untitled Topic'}
                              </p>
                              <div className="mt-1 space-y-1">
                                {(topic.subTopics || []).map((subTopic, subTopicIndex) => (
                                  <div key={subTopic.id || subTopicIndex} className="flex items-start justify-between gap-2 text-xs text-gray-600">
                                    <p>
                                      Sub Topic {chapterIndex + 1}.{topicIndex + 1}.{subTopicIndex + 1}: {subTopic.title || 'Untitled'} •
                                      LP: {(subTopic.learningPaths || []).filter(Boolean).length} •
                                      Materials: {(subTopic.studyMaterials || []).filter(Boolean).length} •
                                      Mind Maps: {(subTopic.mindMaps || []).filter(Boolean).length} •
                                      Worksheets: {(subTopic.worksheets || []).filter(Boolean).length} •
                                      References: {(subTopic.referenceMaterials || []).filter(Boolean).length} •
                                      Tryout: {(subTopic.tryoutSections || []).filter(Boolean).length} •
                                      Self Assess: {(subTopic.selfAssessments || []).filter(Boolean).length}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => publishSubtopicToStudentPortal(chapterIndex, topicIndex, subTopicIndex)}
                                      disabled={publishingSubtopicKey === [selectedPlan._id, chapterIndex, topicIndex, subTopicIndex].join(':')}
                                      className="shrink-0 rounded border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                    >
                                      {publishingSubtopicKey === [selectedPlan._id, chapterIndex, topicIndex, subTopicIndex].join(':') ? 'Publishing...' : 'Publish to Student Portal'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No chapter/topic structure added yet.</p>
                )}
              </div>

              <div className="rounded-xl border-[2.5px] border-purple-300 bg-purple-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="font-medium text-slate-800 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Syllabus Completion Status (Date-wise)
                  </h3>
                  <button
                    onClick={openCreateStatusModal}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border-[2px] border-purple-400 text-purple-700 text-xs hover:bg-purple-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Status
                  </button>
                </div>

                {loadingCompletion ? (
                  <p className="text-sm text-gray-500">Loading status...</p>
                ) : completionEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No completion status added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {completionEntries.map((entry) => {
                      const statusValue = entry?.status || 'pending';
                      const tone = statusTone[statusValue] || statusTone.pending;
                      return (
                        <div key={entry._id} className="rounded-xl border-[2px] border-purple-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <span className="font-medium">{new Date(entry.date).toLocaleDateString()}</span>
                              <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${tone}`}>
                                {prettifyStatus(statusValue)}
                              </span>
                              <span className="text-xs text-gray-500">{entry.completionPercent || 0}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditStatusModal(entry)}
                                className="px-2 py-1 border-[2px] border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteStatus(entry._id)}
                                className="px-2 py-1 border-[2px] border-red-200 text-red-700 rounded-md hover:bg-red-50 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {entry.remarks ? <p className="mt-1 text-xs text-gray-600">{entry.remarks}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-[2.5px] border-purple-300 w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-xl">
            <div className="p-5 border-b border-purple-100 flex items-center justify-between bg-purple-50/40 rounded-t-3xl">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPlanId ? 'Edit Lesson Plan' : 'Create Lesson Plan'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitForm} className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                  <select
                    value={form.classId}
                    onChange={(e) => onClassChange(e.target.value)}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
                  <select
                    value={form.sectionId}
                    onChange={(e) => onSectionChange(e.target.value)}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                    disabled={!form.classId}
                  >
                    <option value="">Select Section</option>
                    {sections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allocated Subject *</label>
                  <select
                    value={form.subjectId}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                    disabled={!form.sectionId || loadingOptions}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((item) => (
                      <option key={item.subjectId} value={item.subjectId}>
                        {item.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Learning Objectives *</label>
                <div className="space-y-2">
                  {form.learningObjectives.map((item, idx) => (
                    <div key={`obj-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateArrayField('learningObjectives', idx, e.target.value)}
                        className="flex-1 border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayField('learningObjectives', idx)}
                        className="px-3 border rounded-lg"
                      >
                        -
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addArrayField('learningObjectives')}
                  className="mt-2 text-sm text-blue-600"
                >
                  + Add Objective
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Materials Needed *</label>
                <div className="space-y-2">
                  {form.materialsNeeded.map((item, idx) => (
                    <div key={`mat-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateArrayField('materialsNeeded', idx, e.target.value)}
                        className="flex-1 border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayField('materialsNeeded', idx)}
                        className="px-3 border rounded-lg"
                      >
                        -
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addArrayField('materialsNeeded')}
                  className="mt-2 text-sm text-blue-600"
                >
                  + Add Material
                </button>
              </div>

              <div className="rounded-2xl border-[2px] border-purple-300 bg-purple-50/40 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Structured Lesson Planner (Student Portal Aligned)
                    </h3>
                    <p className="text-xs text-gray-600">
                      Assigned Subject: {form.subject || 'Select allocated subject first'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSmartVariant && (
                      <button
                        type="button"
                        onClick={loadStudentPortalTemplate}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-white text-xs"
                      >
                        <BookOpen className="w-3 h-3" />
                        Load Student Portal Template
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addChapter}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 bg-white text-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Add Chapter
                    </button>
                  </div>
                </div>

                {sanitizePlannerContent(form.plannerContent).chapters.length === 0 ? (
                  <p className="text-xs text-gray-600">No chapters added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sanitizePlannerContent(form.plannerContent).chapters.map((chapter, chapterIndex) => (
                      <div key={chapter.id || chapterIndex} className="rounded-xl border border-purple-200 bg-white p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={chapter.title}
                            onChange={(e) => updateChapterField(chapterIndex, e.target.value)}
                            className="flex-1 border border-purple-200 rounded-lg px-3 py-2 text-sm"
                            placeholder={`Chapter ${chapterIndex + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => addTopic(chapterIndex)}
                            className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-700"
                          >
                            + Topic
                          </button>
                          <button
                            type="button"
                            onClick={() => removeChapter(chapterIndex)}
                            className="px-2 py-1 text-xs rounded border border-red-200 text-red-700"
                          >
                            Remove
                          </button>
                        </div>

                        {(chapter.topics || []).map((topic, topicIndex) => (
                          <div key={topic.id || topicIndex} className="rounded-lg border border-slate-200 p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={topic.title}
                                onChange={(e) => updateTopicField(chapterIndex, topicIndex, e.target.value)}
                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                placeholder={`Topic ${chapterIndex + 1}.${topicIndex + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => addSubTopic(chapterIndex, topicIndex)}
                                className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-700"
                              >
                                + Sub Topic
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTopic(chapterIndex, topicIndex)}
                                className="px-2 py-1 text-xs rounded border border-red-200 text-red-700"
                              >
                                Remove
                              </button>
                            </div>

                            {(topic.subTopics || []).map((subTopic, subTopicIndex) => (
                              <div key={subTopic.id || subTopicIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={subTopic.title}
                                    onChange={(e) => updateSubTopicField(chapterIndex, topicIndex, subTopicIndex, 'title', e.target.value)}
                                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    placeholder={`Sub Topic ${chapterIndex + 1}.${topicIndex + 1}.${subTopicIndex + 1}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSubTopic(chapterIndex, topicIndex, subTopicIndex)}
                                    className="px-2 py-1 text-xs rounded border border-red-200 text-red-700 bg-white"
                                  >
                                    Remove
                                  </button>
                                </div>

                                {plannerArrayFields.map(([field, label]) => (
                                  <div key={field} className="rounded-md border border-slate-200 bg-white p-2">
                                    <p className="text-xs font-medium text-slate-700 mb-2">{label}</p>
                                    {(subTopic[field] || ['']).map((entry, entryIndex) => (
                                      <div key={`${field}-${entryIndex}`} className="flex gap-2 mb-2 last:mb-0">
                                        <input
                                          type="text"
                                          value={entry}
                                          onChange={(e) =>
                                            updateSubTopicArrayItem(
                                              chapterIndex,
                                              topicIndex,
                                              subTopicIndex,
                                              field,
                                              entryIndex,
                                              e.target.value
                                            )
                                          }
                                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs"
                                          placeholder={`Add ${label.toLowerCase()}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handlePlannerFileUpload(chapterIndex, topicIndex, subTopicIndex, field, entryIndex)
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-200 text-blue-700"
                                        >
                                          <Upload className="w-3 h-3" />
                                          {uploadingAssetKey === [chapterIndex, topicIndex, subTopicIndex, field, entryIndex].join(':') ? 'Uploading...' : 'Upload'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeSubTopicArrayItem(chapterIndex, topicIndex, subTopicIndex, field, entryIndex)
                                          }
                                          className="px-2 py-1 text-xs rounded border border-red-200 text-red-700"
                                        >
                                          -
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => addSubTopicArrayItem(chapterIndex, topicIndex, subTopicIndex, field)}
                                      className="text-xs text-blue-700"
                                    >
                                      + Add {label}
                                    </button>
                                  </div>
                                ))}

                                <div className="rounded-md border border-slate-200 bg-white p-2">
                                  <p className="text-xs font-medium text-slate-700 mb-2">Question Paper Builder</p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {['basic', 'intermediate', 'advanced'].map((level) => (
                                      <div key={level}>
                                        <label className="block text-[11px] text-slate-600 mb-1 capitalize">{level}</label>
                                        <textarea
                                          rows={2}
                                          value={subTopic.questionPapers?.[level] || ''}
                                          onChange={(e) =>
                                            updateQuestionPaperLevel(
                                              chapterIndex,
                                              topicIndex,
                                              subTopicIndex,
                                              level,
                                              e.target.value
                                            )
                                          }
                                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                                          placeholder={`Add ${level} question paper outline`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => setForm((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                  rows={4}
                  className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border-[2px] border-purple-200 rounded-xl text-purple-700 bg-purple-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingOptions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingPlanId ? 'Update Lesson Plan' : 'Create Lesson Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatusModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-[2.5px] border-purple-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-purple-100 flex items-center justify-between bg-purple-50/40">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingStatusId ? 'Edit Completion Status' : 'Add Completion Status'}
              </h2>
              <button onClick={closeStatusModal} className="p-2 rounded-lg hover:bg-purple-100">
                <X className="w-5 h-5 text-purple-500" />
              </button>
            </div>

            <form onSubmit={submitStatusForm} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={statusForm.date}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={statusForm.status}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completion %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={statusForm.completionPercent}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                      setStatusForm((prev) => ({ ...prev, completionPercent: value }));
                    }}
                    className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={statusForm.isCompleted}
                      onChange={(e) =>
                        setStatusForm((prev) => ({
                          ...prev,
                          isCompleted: e.target.checked,
                          status: e.target.checked ? 'completed' : prev.status,
                          completionPercent: e.target.checked ? 100 : prev.completionPercent,
                        }))
                      }
                      className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-200"
                    />
                    Mark as completed
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={statusForm.remarks}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  className="w-full border-[2px] border-purple-200 rounded-xl px-3 py-2 bg-purple-50 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="px-4 py-2 border-[2px] border-purple-200 rounded-xl text-purple-700 bg-purple-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingStatus ? 'Saving...' : editingStatusId ? 'Update Status' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanDashboard;
