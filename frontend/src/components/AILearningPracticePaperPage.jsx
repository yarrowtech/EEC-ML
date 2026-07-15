import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileText } from 'lucide-react';
import { deslugifyFromUrl } from '../utils/urlSlug';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const normalize = (value) => String(value || '').trim().toLowerCase();

const AILearningPracticePaperPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [papers, setPapers] = useState([]);

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

  const filteredPapers = useMemo(() => {
    const subjectKey = normalize(subject);
    const topicKey = normalize(topic);

    return papers.filter((paper) => {
      const paperSubject = normalize(paper?.subjectName);
      const chapter = normalize(paper?.chapter);
      const title = normalize(paper?.title);
      const subjectMatchOk = !subjectKey || paperSubject === subjectKey || paperSubject.includes(subjectKey);
      const topicMatchOk = !topicKey || chapter.includes(topicKey) || title.includes(topicKey);
      return subjectMatchOk && topicMatchOk;
    });
  }, [papers, subject, topic]);

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
      </div>
    </div>
  );
};

export default AILearningPracticePaperPage;
