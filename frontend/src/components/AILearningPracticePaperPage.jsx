import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Upload } from 'lucide-react';
import { deslugifyFromUrl } from '../utils/urlSlug';
import WorksheetSubmitModal from './WorksheetSubmitModal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const normalize = (value) => String(value || '').trim().toLowerCase();

const AILearningPracticePaperPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [papers, setPapers] = useState([]);
  const [worksheetLoading, setWorksheetLoading] = useState(true);
  const [worksheetError, setWorksheetError] = useState('');
  const [worksheetAssignments, setWorksheetAssignments] = useState([]);
  const [worksheetModal, setWorksheetModal] = useState(null);
  const [submittedWorksheetIds, setSubmittedWorksheetIds] = useState(() => new Set());

  const topicMatch = location.pathname.match(/\/topic\/([^/]+)/);
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);

  const topic = topicMatch?.[1] ? deslugifyFromUrl(topicMatch[1]) : '';
  const subject = subjectMatch?.[1] ? deslugifyFromUrl(subjectMatch[1]) : '';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setPapers([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/practice-papers/student/papers?limit=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load practice papers');
        setPapers(Array.isArray(data?.papers) ? data.papers : []);
      } catch (err) {
        setError(err?.message || 'Unable to load practice papers');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadWorksheets = async () => {
      try {
        setWorksheetLoading(true);
        setWorksheetError('');

        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setWorksheetAssignments([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/assignment/student/assignments`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load worksheets');

        const assignments = Array.isArray(data) ? data : Array.isArray(data?.assignments) ? data.assignments : [];
        setWorksheetAssignments(assignments);
        setSubmittedWorksheetIds(new Set(
          assignments
            .filter((assignment) => ['submitted', 'graded', 'late'].includes(normalize(assignment?.submissionStatus)))
            .map((assignment) => String(assignment?._id || ''))
            .filter(Boolean)
        ));
      } catch (err) {
        setWorksheetError(err?.message || 'Unable to load worksheets');
        setWorksheetAssignments([]);
      } finally {
        setWorksheetLoading(false);
      }
    };

    loadWorksheets();
  }, [topic, subject]);

  const filteredPapers = useMemo(() => {
    const subjectKey = normalize(subject);
    const topicKey = normalize(topic);

    return papers.filter((paper) => {
      const paperSubject = normalize(paper?.subjectName);
      const chapter = normalize(paper?.chapter || paper?.chapterTitle);
      const topicTitle = normalize(paper?.topicTitle);
      const subTopicTitle = normalize(paper?.subTopicTitle);
      const topics = Array.isArray(paper?.topics) ? paper.topics.map(normalize) : [];
      const title = normalize(paper?.title);
      const subjectMatchOk = !subjectKey || paperSubject === subjectKey || paperSubject.includes(subjectKey);
      const topicMatchOk = !topicKey || [chapter, topicTitle, subTopicTitle, title, ...topics]
        .some((value) => value && (value === topicKey || value.includes(topicKey) || topicKey.includes(value)));
      return subjectMatchOk && topicMatchOk;
    });
  }, [papers, subject, topic]);

  const filteredWorksheets = useMemo(() => {
    const subjectKey = normalize(subject);
    const topicKey = normalize(topic);
    return worksheetAssignments.filter((assignment) => {
      const type = normalize(assignment?.type);
      if (type !== 'worksheet' && !type.includes('worksheet')) return false;

      const subjectFields = [assignment?.subjectName, assignment?.subject].map(normalize).filter(Boolean);
      const topicFields = [
        assignment?.topicTitle,
        assignment?.topic,
        assignment?.subTopicTitle,
        assignment?.chapterTitle,
        assignment?.title,
      ].map(normalize).filter(Boolean);

      const subjectMatchOk = !subjectKey || subjectFields.some((value) => (
        value === subjectKey || value.includes(subjectKey) || subjectKey.includes(value)
      ));
      const topicMatchOk = !topicKey || topicFields.some((value) => (
        value === topicKey || value.includes(topicKey) || topicKey.includes(value)
      ));
      return subjectMatchOk && topicMatchOk;
    });
  }, [worksheetAssignments, subject, topic]);

  const markWorksheetSubmitted = (assignmentId) => {
    setSubmittedWorksheetIds((previous) => new Set([...previous, String(assignmentId)]));
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] px-4 py-6 sm:px-6 lg:px-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
      <div className="mx-auto w-full max-w-[1100px] space-y-5">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#d8dce8] bg-white px-3 py-2 text-sm font-semibold text-[#00288e] hover:bg-[#eef4ff]"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a]">Assigned Practice Papers</h1>
          <p className="mt-1 text-sm text-[#475569]">{subject || 'Subject'} {topic ? `• ${topic}` : ''}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl bg-white animate-pulse" />)}
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <FileText className="mx-auto mb-3 text-slate-300" size={34} />
            <p className="text-base font-bold text-slate-800">No practice papers assigned yet</p>
            <p className="mt-1 text-sm text-slate-500">Your class teacher has not published papers for this subject/topic yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredPapers.map((paper) => (
              <div key={paper._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">{paper.title}</p>
                <p className="mt-1 text-sm text-slate-600">{paper.description || 'No description provided'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{paper.difficulty || 'medium'}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{paper.totalQuestions || 0} questions</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{paper.totalMarks || 0} marks</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{paper.className}-{paper.sectionName}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="space-y-4" aria-labelledby="topic-worksheets-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="topic-worksheets-heading" className="text-xl font-bold text-[#0f172a]">Worksheets</h2>
              <p className="mt-1 text-sm text-[#475569]">Download the teacher’s worksheet and submit your completed response here.</p>
            </div>
            {filteredWorksheets.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {filteredWorksheets.length} worksheet{filteredWorksheets.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {worksheetError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{worksheetError}</span>
            </div>
          )}

          {worksheetLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-white" />
          ) : filteredWorksheets.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-slate-800">No Worksheet</p>
                  <p className="mt-1 text-sm text-slate-500">No teacher-created worksheet is available for this topic yet.</p>
                </div>
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-400"
                >
                  <Upload size={16} /> Upload Worksheet
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredWorksheets.map((assignment) => {
                const assignmentId = String(assignment._id || assignment.id || '');
                const isSubmitted = submittedWorksheetIds.has(assignmentId);
                const attachments = Array.isArray(assignment.attachments) ? assignment.attachments.filter((item) => item?.url) : [];

                return (
                  <article key={assignmentId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <FileText size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900">{assignment.title || 'Worksheet'}</h3>
                        {assignment.description && <p className="mt-1 text-sm leading-5 text-slate-600">{assignment.description}</p>}
                        {assignment.dueDate && <p className="mt-2 text-xs font-semibold text-slate-400">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.url}-${index}`}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Download size={14} /> Download{attachments.length > 1 ? ` ${index + 1}` : ''}
                        </a>
                      ))}
                      <button
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => setWorksheetModal(assignment)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${isSubmitted ? 'cursor-not-allowed bg-emerald-50 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                      >
                        {isSubmitted ? <CheckCircle2 size={14} /> : <Upload size={14} />}
                        {isSubmitted ? 'Submitted' : 'Upload Worksheet'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {worksheetModal && (
        <WorksheetSubmitModal
          assignment={worksheetModal}
          onClose={() => setWorksheetModal(null)}
          onSubmitted={() => {
            markWorksheetSubmitted(worksheetModal._id || worksheetModal.id);
            setWorksheetModal(null);
          }}
        />
      )}
    </div>
  );
};

export default AILearningPracticePaperPage;
