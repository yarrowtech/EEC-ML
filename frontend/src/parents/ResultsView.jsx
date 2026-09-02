import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Award,
  TrendingUp,
  Calendar,
  User,
  ChevronRight,
  Filter,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadSingleReportCardPdf } from '../utils/reportCardPdf';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { normalizeReportCard } from './reportCardShape';
import { parentApiJson } from './parentApi';

const ResultsView = () => {
  const navigate = useNavigate();
  const [reportCards, setReportCards] = useState([]);
  const [template, setTemplate] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingReportCard, setDownloadingReportCard] = useState(false);

  useEffect(() => {
    const loadRealResults = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Parent') {
          setError('Please login as a parent to view results.');
          setLoading(false);
          return;
        }

        const payload = await parentApiJson('/api/reports/report-cards/parent', {}, navigate);
        const cards = (Array.isArray(payload?.reportCards) ? payload.reportCards : []).map(normalizeReportCard);
        setReportCards(cards);
        setTemplate(payload.template);
        if (cards.length > 0) {
          setSelectedStudentId(String(cards[0].studentId));
        }
      } catch (err) {
        console.error('Parent results fetch error:', err);
        setError(err.message || 'Unable to load results');
        setReportCards([]);
      } finally {
        setLoading(false);
      }
    };
    loadRealResults();
  }, []);

  const selectedReport = useMemo(() => {
    if (!reportCards.length) return null;
    return reportCards.find((card) => String(card.studentId) === String(selectedStudentId)) || reportCards[0];
  }, [reportCards, selectedStudentId]);

  const handleDownloadReportCard = async () => {
    if (!selectedReport) {
      toast.error('No report data available to download');
      return;
    }
    
    setDownloadingReportCard(true);
    try {
      const success = await downloadSingleReportCardPdf({
        template,
        reportCard: selectedReport,
        fileName: `Report_Card_${selectedReport.studentName.replace(/\s+/g, '_')}.pdf`,
      });
      if (success) {
        toast.success('Official report card downloaded');
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (err) {
      toast.error(err.message || 'Unable to download report card');
    } finally {
      setDownloadingReportCard(false);
    }
  };

  const gradeBadgeClass = (grade = '') => {
    const g = String(grade).toUpperCase();
    if (g.startsWith('A')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (g.startsWith('B')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (g.startsWith('C')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (g.startsWith('D')) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <header className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm group transition-all hover:shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Star size={14} className="fill-amber-500 text-amber-500" />
              <span>Official Academic Records</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Performance Results</h1>
            <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              Consolidated outcome of published assessments, subject-wise analysis, and downloadable report cards.
            </p>
          </div>
          
          <button
            onClick={handleDownloadReportCard}
            disabled={!selectedReport || loading || downloadingReportCard}
            className="flex items-center justify-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
          >
            {downloadingReportCard ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span>{downloadingReportCard ? 'Preparing PDF...' : 'Download Report Card'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Control Panel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="results-student" className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={14} />
              Select Student
            </label>
            <div className="relative group">
              <select
                id="results-student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all cursor-pointer group-hover:bg-white"
              >
                {reportCards.length === 0 && <option value="">No published results</option>}
                {reportCards.map((card) => (
                  <option key={card.studentId} value={card.studentId}>
                    {formatStudentDisplay({
                      studentName: card.studentName,
                      username: card.username,
                      studentCode: card.studentCode,
                      roll: card.roll,
                      grade: card.grade,
                      section: card.section
                    })}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="bg-slate-50/50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm text-slate-400">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Academic Year</p>
                <p className="text-sm font-bold text-slate-700">{selectedReport?.academicYear || 'Current Cycle'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outcome Date</p>
              <p className="text-sm font-bold text-slate-700">{selectedReport?.generatedAt ? new Date(selectedReport.generatedAt).toLocaleDateString() : 'TBA'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            label: 'Overall Average',
            value: selectedReport?.totals ? `${selectedReport.totals.percentage}%` : '—',
            icon: TrendingUp,
            color: 'bg-emerald-50 text-emerald-600',
            trend: 'Performance Level'
          },
          {
            label: 'Aggregate Marks',
            value: selectedReport?.totals ? `${selectedReport.totals.obtainedMarks} / ${selectedReport.totals.totalMarks}` : '—',
            icon: BarChart3,
            color: 'bg-amber-50 text-amber-600',
            trend: 'Total Score'
          },
          {
            label: 'Final Grade',
            value: selectedReport?.totals?.grade || '—',
            icon: Award,
            color: 'bg-indigo-50 text-indigo-600',
            trend: 'Certification Level'
          },
          {
            label: 'Assessment Count',
            value: selectedReport ? (selectedReport.exams?.length ?? 0) : '0',
            icon: BookOpen,
            color: 'bg-cyan-50 text-cyan-600',
            trend: 'Total Components'
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-2">{stat.trend}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Subject Performance Grid */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <BarChart3 size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Subject Analysis</h2>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedReport?.subjects.map((subject, idx) => (
            <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-800 truncate pr-2">{subject.name}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${gradeBadgeClass(subject.grade)}`}>
                  {subject.grade}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                  <span>Score: {subject.obtainedMarks} / {subject.totalMarks}</span>
                  <span>{subject.percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      subject.percentage >= 80 ? 'bg-emerald-500' : 
                      subject.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${subject.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {(!selectedReport || selectedReport.subjects.length === 0) && !loading && (
            <div className="col-span-full text-center py-12 text-slate-400">
              <FileText size={48} className="mx-auto mb-3 opacity-10" />
              <p className="text-sm font-medium italic">No subject data recorded for this student.</p>
            </div>
          )}
        </div>
      </section>

      {/* Assessment History */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <FileText size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Detailed Assessment Log</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-sm font-medium text-slate-500 tracking-wide font-mono">CALCULATING OUTCOMES...</p>
          </div>
        ) : !selectedReport ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="p-4 bg-slate-50 rounded-full">
              <User className="w-12 h-12 text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Result unavailable</h3>
              <p className="text-sm text-slate-500">No official records found for the selected student.</p>
            </div>
          </div>
        ) : selectedReport.exams.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="p-4 bg-slate-50 rounded-full text-slate-300">
              <FileText size={48} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">No Assessment Records</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Consolidated assessment records will appear here once teachers publish results.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Component Name</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Term</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Obtained / Max</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Percentage</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedReport.exams.map((exam, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{exam.examName}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        {exam.date ? new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-slate-700">{exam.subject}</div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {exam.term || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-black text-slate-900 tracking-tight">
                        {exam.obtainedMarks} <span className="text-slate-300 font-normal">/ {exam.totalMarks}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[60px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              exam.percentage >= 80 ? 'bg-emerald-500' : 
                              exam.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${exam.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{exam.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {exam.status === 'pass' || exam.percentage >= 40 ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 size={14} />
                            <span>Qualified</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase tracking-wider">
                            <XCircle size={14} />
                            <span>Unqualified</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ResultsView;
