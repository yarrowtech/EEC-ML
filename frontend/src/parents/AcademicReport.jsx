import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  User, 
  ChevronRight,
  Filter,
  Printer,
  FileText,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { downloadSingleReportCardPdf } from '../utils/reportCardPdf';
import { normalizeReportCard } from './reportCardShape';
import { parentApiJson } from './parentApi';

const AcademicReport = () => {
  const navigate = useNavigate();
  const [reportCards, setReportCards] = useState([]);
  const [template, setTemplate] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [viewMode, setViewMode] = useState('detailed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchRealData = async () => {
      if (!localStorage.getItem('token')) {
        setError('Please login to view academic reports.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await parentApiJson('/api/reports/report-cards/parent', {}, navigate);

        const cards = (Array.isArray(data.reportCards) ? data.reportCards : []).map(normalizeReportCard);
        setReportCards(cards);
        setTemplate(data.template);

        if (cards.length > 0) {
          setSelectedStudentId(String(cards[0].studentId));
        }
      } catch (err) {
        setError(err.message || 'Unable to load academic report');
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, []);

  const selectedReport = useMemo(
    () => reportCards.find((card) => String(card.studentId) === String(selectedStudentId)) || null,
    [reportCards, selectedStudentId]
  );

  const handleExport = async () => {
    if (!selectedReport) {
      toast.error('No report data to export');
      return;
    }

    setIsExporting(true);
    try {
      const success = await downloadSingleReportCardPdf({
        template,
        reportCard: selectedReport,
        fileName: `Academic_Report_${selectedReport.studentName.replace(/\s+/g, '_')}.pdf`
      });
      if (success) {
        toast.success('Report card downloaded successfully');
      } else {
        toast.error('Failed to generate report card');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Error generating PDF');
    } finally {
      setIsExporting(false);
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
              <BarChart3 size={14} />
              <span>Real-time Academic Data</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Academic Performance</h1>
            <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              Consolidated official report card data including subject totals, attendance, and assessment history.
            </p>
          </div>
          
          <button
            onClick={handleExport}
            disabled={!selectedReport || loading || isExporting}
            className="flex items-center justify-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
            <span>{isExporting ? 'Generating PDF...' : 'Export Snapshot'}</span>
          </button>
        </div>
      </header>

      {/* Control Panel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="academic-student" className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={14} />
              Select Child
            </label>
            <div className="relative group">
              <select
                id="academic-student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all cursor-pointer group-hover:bg-white"
              >
                {reportCards.length === 0 && <option value="">No linked children</option>}
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

          <div className="space-y-2">
            <span id="academic-view-label" className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Filter size={14} />
              Report View
            </span>
            <div role="group" aria-labelledby="academic-view-label" className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200">
              {['detailed', 'summary'].map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setViewMode(view)}
                  aria-pressed={viewMode === view}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                    viewMode === view
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}
      </section>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { 
            label: 'Overall Average', 
            value: selectedReport ? `${selectedReport.totals.percentage}%` : '—', 
            icon: TrendingUp, 
            color: 'bg-emerald-50 text-emerald-600',
            trend: 'Grand Total Average'
          },
          { 
            label: 'Total Marks', 
            value: selectedReport ? `${selectedReport.totals.obtainedMarks} / ${selectedReport.totals.totalMarks}` : '—', 
            icon: Award, 
            color: 'bg-amber-50 text-amber-600',
            trend: 'Combined score'
          },
          { 
            label: 'Academic Grade', 
            value: selectedReport ? selectedReport.totals.grade : '—', 
            icon: BookOpen, 
            color: 'bg-blue-50 text-blue-600',
            trend: 'Performance Level'
          },
          { 
            label: 'Assessments', 
            value: selectedReport ? selectedReport.exams.length : '0', 
            icon: FileText, 
            color: 'bg-purple-50 text-purple-600',
            trend: 'Total exam records'
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

      {/* Subject Wise Performance */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <BarChart3 size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Subject Performance</h2>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedReport?.subjects.map((subject, idx) => (
            <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all group">
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-800">{subject.name}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${gradeBadgeClass(subject.grade)}`}>
                  {subject.grade}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-tighter">
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
            <p className="col-span-full text-center text-slate-400 py-8 text-sm font-medium italic">
              No subject data available for this report.
            </p>
          )}
        </div>
      </section>

      {/* Assessment History */}
      {viewMode === 'detailed' && (
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <FileText size={16} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Assessment History</h2>
            </div>
            {selectedReport?.generatedAt && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full">
                <Calendar size={12} />
                <span>Generated {new Date(selectedReport.generatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500 tracking-wide">Syncing academic records...</p>
            </div>
          ) : !selectedReport ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="p-4 bg-slate-50 rounded-full">
                <User className="w-12 h-12 text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No report available</h3>
                <p className="text-sm text-slate-500">Could not retrieve academic records for this student.</p>
              </div>
            </div>
          ) : selectedReport.exams.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                <FileText size={48} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No Exams Recorded</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Official exam results have not been published for this academic cycle.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Assessment</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Term</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Marks</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Result</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReport.exams.map((exam, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-900">{exam.examName}</div>
                        <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                          {exam.date ? new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-slate-700">{exam.subject}</div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {exam.term || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-slate-900">
                          {exam.obtainedMarks} <span className="text-slate-400">/ {exam.totalMarks}</span>
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
                              <span>Passed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase tracking-wider">
                              <XCircle size={14} />
                              <span>Failed</span>
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
      )}

      {/*<footer className="text-center pb-8">
        <p className="text-xs font-medium text-slate-400">
          Electronic Educare • Official Academic Performance Report Card
        </p>
      </footer> */}
    </div>
  );
};

export default AcademicReport;
