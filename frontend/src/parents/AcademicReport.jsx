import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  User,
  Filter,
  Printer,
  FileText,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadSingleReportCardPdf } from '../utils/reportCardPdf';
import { normalizeReportCard } from './reportCardShape';
import { parentApiJson } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const AcademicReport = () => {
  const navigate = useNavigate();
  const [reportCards, setReportCards] = useState([]);
  const [template, setTemplate] = useState(null);
  const [viewMode, setViewMode] = useState('detailed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const childOptions = useMemo(
    () => reportCards.map((c) => ({ id: String(c.studentId || ''), name: c.studentName || 'Student' })),
    [reportCards],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedStudentId = selectedOption?.id || '';

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
    <div className="min-h-screen bg-slate-50/50 p-4 font-sans antialiased sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Report Card"
        icon={BarChart3}
        subtitle="Official marks, subject totals and assessment history, as published by the school."
        actions={(
          <button
            onClick={handleExport}
            disabled={!selectedReport || loading || isExporting}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            <span>{isExporting ? 'Generating…' : 'Export PDF'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <User size={13} /> Child
            </p>
            {childOptions.length === 0
              ? <p className="text-sm text-slate-400">No linked children</p>
              : <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} label="Child" />}
          </div>
          <div className="space-y-1.5">
            <span id="academic-view-label" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Filter size={13} /> View
            </span>
            <div role="group" aria-labelledby="academic-view-label" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" data-flat>
              {['detailed', 'summary'].map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setViewMode(view)}
                  aria-pressed={viewMode === view}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                    viewMode === view ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PageHeader>

      {error && <ErrorState message={error} />}

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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">{stat.trend}</p>
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
          {selectedReport?.subjects.map((subject, idx) => {
            const subjectExams = selectedReport.exams.filter((exam) => String(exam.subject || '').trim().toLowerCase() === String(subject.name || '').trim().toLowerCase());
            const latestExam = subjectExams[subjectExams.length - 1];
            return (
            <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{subject.name}</span>
                  {latestExam && <span className="mt-1 block truncate text-xs text-slate-500">{latestExam.term || 'General'} · {latestExam.examName || 'Assessment'}</span>}
                </div>
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
            );
          })}
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
              <h2 className="text-lg font-semibold text-slate-900">Assessment History</h2>
            </div>
            {selectedReport?.generatedAt && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full">
                <Calendar size={12} />
                <span>Generated {new Date(selectedReport.generatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-5"><Loading label="report card" rows={4} /></div>
          ) : !selectedReport ? (
            <div className="p-5"><EmptyState icon={User} title="No report card yet" hint="The school hasn't published a report card for this child." /></div>
          ) : selectedReport.exams.length === 0 ? (
            <div className="p-5"><EmptyState icon={FileText} title="No exams recorded" hint="Exam results haven't been published for this cycle yet." /></div>
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
                    <React.Fragment key={idx}>
                    <tr className={`hover:bg-slate-50/50 transition-colors group ${exam.remarks ? 'border-b-0' : ''}`}>
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
                    {exam.remarks && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={6} className="px-6 pb-5 pt-0">
                          <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                            <User size={13} className="mt-0.5 shrink-0 text-amber-600" />
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Teacher Remarks</p>
                              <p className="mt-0.5 text-sm text-slate-700">{exam.remarks}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
