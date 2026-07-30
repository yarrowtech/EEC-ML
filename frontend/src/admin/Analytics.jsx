import { useState, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  GraduationCap,
  DollarSign,
  Download,
  Activity,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  BookOpen,
  BarChart2,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const ALL_SESSIONS = 'All Sessions';
const ALL_CLASSES = 'All Classes';
const ALL_SECTIONS = 'All Sections';

const buildApiUrl = (path) => `${API_BASE}${path}`;

const normalizeSectionValue = (value) => (value === ALL_SECTIONS ? '' : value);
const normalizeClassToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^class\s*/i, '')
    .replace(/\s+/g, '');

const formatCurrency = (value) =>
  `Rs. ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(Math.round(value || 0))}`;
const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

const toAmountNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const buildFeeChartData = (invoices) => {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.push({
      key,
      month: date.toLocaleString('default', { month: 'short' }),
      paid: 0,
      pending: 0
    });
  }
  const map = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  invoices.forEach((invoice) => {
    const sourceDate = invoice.dueDate || invoice.createdAt;
    if (!sourceDate) return;
    const parsedDate = new Date(sourceDate);
    if (Number.isNaN(parsedDate.getTime())) return;
    const key = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
    const bucket = map.get(key);
    if (!bucket) return;
    const totalAmount = toAmountNumber(invoice.totalAmount);
    const balanceAmount = toAmountNumber(invoice.balanceAmount);
    const derivedPaid = Math.max(totalAmount - balanceAmount, 0);
    bucket.paid += derivedPaid;
    bucket.pending += balanceAmount;
  });
  return buckets.map(({ month, paid, pending }) => ({
    month,
    paid: Math.round(paid),
    pending: Math.round(pending)
  }));
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Recently';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const Analytics = ({ setShowAdminHeader }) => {
  const [selectedSession, setSelectedSession] = useState(ALL_SESSIONS);
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES);
  const [selectedSection, setSelectedSection] = useState(ALL_SECTIONS);
  const [sessionOptions, setSessionOptions] = useState([{ _id: '', name: ALL_SESSIONS }]);
  const [classCatalog, setClassCatalog] = useState([]);
  const [sectionCatalog, setSectionCatalog] = useState([]);
  const [classScopedSections, setClassScopedSections] = useState([]);
  const [progressAnalytics, setProgressAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [reportsSummary, setReportsSummary] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [feeInvoices, setFeeInvoices] = useState([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [masteryMatrix, setMasteryMatrix] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [teacherEffectiveness, setTeacherEffectiveness] = useState([]);
  const [teacherEffLoading, setTeacherEffLoading] = useState(false);

  useEffect(() => {
    setShowAdminHeader(true);
  }, [setShowAdminHeader]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadFilterOptions = async () => {
      try {
        const [yearsRes, classesRes, sectionsRes] = await Promise.all([
          fetch(buildApiUrl('/api/academic/years'), {
            headers: getAuthHeaders(),
            signal: controller.signal,
          }),
          fetch(buildApiUrl('/api/academic/classes'), {
            headers: getAuthHeaders(),
            signal: controller.signal,
          }),
          fetch(buildApiUrl('/api/academic/sections'), {
            headers: getAuthHeaders(),
            signal: controller.signal,
          }),
        ]);

        const [years, classes, sections] = await Promise.all([
          yearsRes.json().catch(() => []),
          classesRes.json().catch(() => []),
          sectionsRes.json().catch(() => []),
        ]);

        if (!controller.signal.aborted) {
          const normalizedYears = Array.isArray(years) ? years : [];
          const normalizedClasses = Array.isArray(classes) ? classes : [];
          const normalizedSections = Array.isArray(sections) ? sections : [];
          setSessionOptions([{ _id: '', name: ALL_SESSIONS }, ...normalizedYears]);
          setClassCatalog(normalizedClasses);
          setSectionCatalog(normalizedSections);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSessionOptions([{ _id: '', name: ALL_SESSIONS }]);
          setClassCatalog([]);
          setSectionCatalog([]);
        }
      }
    };
    loadFilterOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const selectedClassDoc = classCatalog.find((item) => item?.name === selectedClass);
    const classId = selectedClassDoc?._id ? String(selectedClassDoc._id) : '';

    const loadClassScopedSections = async () => {
      if (!classId) {
        setClassScopedSections([]);
        return;
      }
      try {
        const params = new URLSearchParams({ classId });
        const res = await fetch(buildApiUrl(`/api/academic/sections?${params.toString()}`), {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Unable to load sections');
        if (!controller.signal.aborted) {
          setClassScopedSections(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setClassScopedSections([]);
        }
      }
    };

    loadClassScopedSections();
    return () => controller.abort();
  }, [selectedClass, classCatalog]);

  const availableClassOptions = useMemo(
    () => [ALL_CLASSES, ...classCatalog.map((item) => item?.name).filter(Boolean)],
    [classCatalog]
  );

  const availableSectionOptions = useMemo(() => {
    if (selectedClass === ALL_CLASSES) return [ALL_SECTIONS];
    const scopedNames = classScopedSections
      .map((item) => item?.name)
      .filter(Boolean);
    if (scopedNames.length) return [ALL_SECTIONS, ...scopedNames];

    // Fallback: local catalog by classId (if scoped API returns empty unexpectedly).
    const selectedClassDoc = classCatalog.find((item) => item?.name === selectedClass);
    const fallbackNames = sectionCatalog
      .filter((item) => String(item?.classId) === String(selectedClassDoc?._id || ''))
      .map((item) => item?.name)
      .filter(Boolean);
    return [ALL_SECTIONS, ...fallbackNames];
  }, [selectedClass, classScopedSections, classCatalog, sectionCatalog]);

  useEffect(() => {
    if (selectedSection !== ALL_SECTIONS && !availableSectionOptions.includes(selectedSection)) {
      setSelectedSection(ALL_SECTIONS);
    }
  }, [availableSectionOptions, selectedSection]);

  useEffect(() => {
    const controller = new AbortController();
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      try {
        const params = new URLSearchParams();
        const grade = selectedClass === ALL_CLASSES ? '' : selectedClass;
        const section = normalizeSectionValue(selectedSection);
        const sessionObj = sessionOptions.find((item) => item?.name === selectedSession);
        const academicYearId = sessionObj?._id ? String(sessionObj._id) : '';
        if (grade) params.append('grade', grade);
        if (section) params.append('section', section);
        if (academicYearId) params.append('academicYearId', academicYearId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(buildApiUrl(`/api/progress/analytics${query}`), {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load performance analytics');
        }
        setProgressAnalytics(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setAnalyticsError(error.message || 'Unable to load performance analytics');
        }
      } finally {
        if (!controller.signal.aborted) {
          setAnalyticsLoading(false);
        }
      }
    };
    loadAnalytics();
    return () => controller.abort();
  }, [selectedClass, selectedSection, selectedSession, sessionOptions]);

  useEffect(() => {
    const controller = new AbortController();
    const loadReports = async () => {
      setReportsLoading(true);
      setReportsError('');
      try {
        const res = await fetch(buildApiUrl('/api/reports/summary'), {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load school summary');
        }
        setReportsSummary(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setReportsError(error.message || 'Unable to load school summary');
        }
      } finally {
        if (!controller.signal.aborted) {
          setReportsLoading(false);
        }
      }
    };
    loadReports();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadInvoices = async () => {
      setFeesLoading(true);
      setFeesError('');
      try {
        const res = await fetch(buildApiUrl('/api/fees/invoices'), {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load fees data');
        }
        setFeeInvoices(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFeesError(error.message || 'Unable to load fees data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setFeesLoading(false);
        }
      }
    };
    loadInvoices();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError('');
      try {
        const res = await fetch(buildApiUrl('/api/audit-logs'), {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load recent activity');
        }
        setAuditLogs(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setActivityError(error.message || 'Unable to load recent activity');
        }
      } finally {
        if (!controller.signal.aborted) {
          setActivityLoading(false);
        }
      }
    };
    loadActivity();
    return () => controller.abort();
  }, []);

  const fetchMasteryMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/admin-analytics/mastery-matrix'), { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMasteryMatrix(data.data || null);
    } catch { /* silent */ }
    finally { setMatrixLoading(false); }
  }, []);

  const fetchTeacherEffectiveness = useCallback(async () => {
    setTeacherEffLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/admin-analytics/teacher-effectiveness'), { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTeacherEffectiveness(data.data || []);
    } catch { /* silent */ }
    finally { setTeacherEffLoading(false); }
  }, []);

  useEffect(() => { fetchMasteryMatrix(); fetchTeacherEffectiveness(); }, [fetchMasteryMatrix, fetchTeacherEffectiveness]);

  const attendanceRate = useMemo(() => {
    if (!reportsSummary?.attendance) return 0;
    const { present = 0, totalMarked = 0 } = reportsSummary.attendance;
    if (!totalMarked) return 0;
    return Math.round((present / totalMarked) * 100);
  }, [reportsSummary]);

  const subjectPerformance = useMemo(() => {
    if (!progressAnalytics?.subjectPerformance) return [];
    return Object.entries(progressAnalytics.subjectPerformance)
      .map(([subject, stats]) => ({
        subject,
        averageScore: stats.averageScore || 0,
        studentCount: stats.studentCount || 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [progressAnalytics]);

  const gradeDistributionData = useMemo(() => {
    if (!progressAnalytics?.gradeDistribution) return [];
    const colors = {
      'A+': '#0ea5e9',
      'A': '#10b981',
      'B+': '#3b82f6',
      'B': '#60a5fa',
      'C+': '#f59e0b',
      'C': '#f97316',
      'D': '#ef4444',
      'F': '#6b7280',
    };
    return Object.entries(progressAnalytics.gradeDistribution).map(([grade, count]) => ({
      grade,
      students: count,
      color: colors[grade] || '#94a3b8',
    }));
  }, [progressAnalytics]);

  const attendanceData = useMemo(() => {
    if (!reportsSummary?.attendance) return [];
    const { present = 0, absent = 0, totalMarked = 0 } = reportsSummary.attendance;
    const others = Math.max(totalMarked - present - absent, 0);
    const slices = [
      { name: 'Present', value: present, color: '#10b981' },
      { name: 'Absent', value: absent, color: '#ef4444' },
    ];
    if (others > 0) {
      slices.push({ name: 'Other', value: others, color: '#f59e0b' });
    }
    return slices.filter((slice) => slice.value > 0);
  }, [reportsSummary]);

  const improvementStats = useMemo(() => {
    if (!progressAnalytics?.improvementTrends) return [];
    const colors = {
      improving: '#10b981',
      stable: '#6b7280',
      declining: '#ef4444',
    };
    const total = Object.values(progressAnalytics.improvementTrends).reduce((sum, value) => sum + value, 0);
    return Object.entries(progressAnalytics.improvementTrends).map(([label, count]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value: total ? Math.round((count / total) * 100) : 0,
      count,
      color: colors[label] || '#3b82f6',
    }));
  }, [progressAnalytics]);

  const filteredInvoices = useMemo(() => {
    const sessionObj = sessionOptions.find((item) => item?.name === selectedSession);
    const academicYearId = sessionObj?._id ? String(sessionObj._id) : '';
    const selectedClassToken = normalizeClassToken(selectedClass === ALL_CLASSES ? '' : selectedClass);
    const section = normalizeSectionValue(selectedSection);
    return feeInvoices.filter((invoice) => {
      const invoiceYearId = invoice?.academicYearId ? String(invoice.academicYearId) : '';
      const classValueToken = normalizeClassToken(invoice.className || '');
      const sectionValue = (invoice.section || '').toUpperCase();
      const sessionMatches = !academicYearId || invoiceYearId === academicYearId;
      const gradeMatches = !selectedClassToken || classValueToken === selectedClassToken;
      const sectionMatches = !section || sectionValue === section.toUpperCase();
      return sessionMatches && gradeMatches && sectionMatches;
    });
  }, [feeInvoices, selectedClass, selectedSection, selectedSession, sessionOptions]);

  const feesChartData = useMemo(() => buildFeeChartData(filteredInvoices), [filteredInvoices]);

  const filteredFeeTotals = useMemo(
    () =>
      filteredInvoices.reduce(
        (acc, invoice) => {
          const totalAmount = toAmountNumber(invoice?.totalAmount);
          const balanceAmount = toAmountNumber(invoice?.balanceAmount);
          const derivedPaid = Math.max(totalAmount - balanceAmount, 0);
          acc.paidAmount += derivedPaid;
          acc.balanceAmount += balanceAmount;
          return acc;
        },
        { paidAmount: 0, balanceAmount: 0 }
      ),
    [filteredInvoices]
  );

  const isFilterApplied =
    selectedSession !== ALL_SESSIONS ||
    selectedClass !== ALL_CLASSES ||
    selectedSection !== ALL_SECTIONS;

  const scopedStudentCount = Number(progressAnalytics?.totalStudents ?? reportsSummary?.users?.students ?? 0);
  const scopedAttendanceRate = Number(
    progressAnalytics?.attendanceRate ?? attendanceRate ?? 0
  );
  const scopedAverageScore = Number(progressAnalytics?.averageScore ?? 0);

  const recentActivity = useMemo(() => {
    if (!auditLogs.length) return [];
    const palette = ['blue', 'green', 'purple', 'orange'];
    return auditLogs.slice(0, 6).map((log, index) => ({
      id: log._id || index,
      teacher: log.meta?.actorName || log.actorType || 'Admin',
      action: log.action || 'Update',
      subject: log.entity || log.meta?.entityName || 'Record',
      time: formatRelativeTime(log.createdAt),
      color: palette[index % palette.length],
    }));
  }, [auditLogs]);

  const keyMetrics = useMemo(() => {
    const totalStudents = scopedStudentCount;
    const improvement = progressAnalytics?.improvementTrends || {};
    const improvingCount = improvement.improving || 0;
    const decliningCount = improvement.declining || 0;
    const paidAmount = filteredFeeTotals.paidAmount;
    const balanceAmount = filteredFeeTotals.balanceAmount;

    return [
      {
        title: 'Total Students',
        value: formatNumber(totalStudents),
        change: reportsSummary?.users?.teachers ? `${reportsSummary.users.teachers} teachers` : '',
        trend: 'up',
        icon: Users,
        color: 'blue',
        description: isFilterApplied ? 'In selected filters' : 'Active in this school',
      },
      {
        title: 'Attendance Rate',
        value: `${Math.max(0, Math.round(scopedAttendanceRate))}%`,
        change: `${formatNumber(totalStudents)} students in scope`,
        trend: scopedAttendanceRate >= 85 ? 'up' : 'down',
        icon: CheckCircle,
        color: 'green',
        description: isFilterApplied ? 'Filtered attendance' : 'Across all classes',
      },
      {
        title: 'Average Score',
        value: `${Math.max(0, Math.round(scopedAverageScore))}%`,
        change: `${improvingCount} improving`,
        trend: improvingCount >= decliningCount ? 'up' : 'down',
        icon: GraduationCap,
        color: 'purple',
        description: 'Subject mastery',
      },
      {
        title: 'Fees Collected',
        value: formatCurrency(paidAmount),
        change: `Outstanding ${formatCurrency(balanceAmount)}`,
        trend: paidAmount >= balanceAmount ? 'up' : 'down',
        icon: DollarSign,
        color: 'orange',
        description: isFilterApplied ? 'Filtered collections' : 'Collections to date',
      },
    ];
  }, [
    scopedStudentCount,
    scopedAttendanceRate,
    scopedAverageScore,
    filteredFeeTotals,
    progressAnalytics,
    reportsSummary,
    isFilterApplied,
  ]);

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        icon: 'text-blue-500',
        gradient: 'from-blue-500 to-blue-600',
        light: 'bg-blue-100'
      },
      green: {
        bg: 'bg-green-50',
        text: 'text-green-600',
        icon: 'text-green-500',
        gradient: 'from-green-500 to-green-600',
        light: 'bg-green-100'
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        icon: 'text-purple-500',
        gradient: 'from-purple-500 to-purple-600',
        light: 'bg-purple-100'
      },
      orange: {
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        icon: 'text-orange-500',
        gradient: 'from-orange-500 to-orange-600',
        light: 'bg-orange-100'
      }
    };
    return colors[color] || colors.blue;
  };

  const exportAnalyticsToPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const now = new Date();
    const generatedAt = now.toLocaleString('en-IN');
    const generatedDate = now.toISOString().slice(0, 10);
    let yPos = 48;

    const colors = {
      brand: [37, 99, 235],
      brandDark: [30, 64, 175],
      accent: [99, 102, 241],
      surface: [248, 250, 252],
      border: [226, 232, 240],
      text: [30, 41, 59],
      muted: [100, 116, 139],
      success: [16, 185, 129],
      warn: [245, 158, 11],
    };

    const drawPageTopBar = () => {
      // Continuation pages: keep only a thin accent strip to avoid overlaying content.
      pdf.setFillColor(...colors.accent);
      pdf.rect(0, 0, pageWidth, 1.8, 'F');
    };

    const ensureSpace = (required = 8) => {
      if (yPos + required > pageHeight - 16) {
        pdf.addPage();
        drawPageTopBar();
        yPos = 18;
      }
    };

    const addSectionTitle = (title) => {
      ensureSpace(10);
      pdf.setFillColor(...colors.brand);
      pdf.roundedRect(margin, yPos - 1, contentWidth, 7, 1.2, 1.2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11.5);
      pdf.setFont(undefined, 'bold');
      pdf.text(title, margin + 3, yPos + 3.8);
      pdf.setTextColor(...colors.text);
      yPos += 10;
    };

    const addKVRows = (rows) => {
      rows.forEach(([label, value], idx) => {
        ensureSpace(7);
        if (idx % 2 === 0) {
          pdf.setFillColor(245, 247, 250);
          pdf.rect(margin, yPos - 1.8, contentWidth, 6.2, 'F');
        }
        pdf.setFontSize(9.5);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(...colors.text);
        pdf.text(`${label}:`, margin + 2, yPos + 2);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(...colors.muted);
        const wrapped = pdf.splitTextToSize(String(value ?? ''), contentWidth - 44);
        pdf.text(wrapped, margin + 38, yPos + 2);
        yPos += Math.max(6, wrapped.length * 4);
      });
      yPos += 1.5;
    };

    const addDataTable = (headers, rows) => {
      const colWidth = contentWidth / headers.length;
      ensureSpace(11);
      pdf.setFillColor(...colors.brandDark);
      pdf.rect(margin, yPos - 1, contentWidth, 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      headers.forEach((header, idx) => {
        pdf.text(String(header), margin + idx * colWidth + 2, yPos + 3.4);
      });
      yPos += 8;

      pdf.setTextColor(...colors.text);
      pdf.setFont(undefined, 'normal');
      if (!rows.length) {
        ensureSpace(7);
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos - 1.8, contentWidth, 6.5, 'F');
        pdf.text('No records available', margin + 2, yPos + 2.1);
        yPos += 8;
        return;
      }

      rows.forEach((row, rowIdx) => {
        ensureSpace(7);
        if (rowIdx % 2 === 0) {
          pdf.setFillColor(247, 250, 252);
          pdf.rect(margin, yPos - 1.8, contentWidth, 6.4, 'F');
        }
        row.forEach((cell, colIdx) => {
          const text = String(cell ?? '');
          const clipped = text.length > 26 ? `${text.slice(0, 25)}...` : text;
          pdf.text(clipped, margin + colIdx * colWidth + 2, yPos + 2.1);
        });
        yPos += 6.5;
      });
      yPos += 2;
    };

    // Header block
    pdf.setFillColor(...colors.brandDark);
    pdf.rect(0, 0, pageWidth, 36, 'F');
    pdf.setFillColor(...colors.accent);
    pdf.rect(0, 34, pageWidth, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('Admin Analytics Report', margin, 14);
    pdf.setFontSize(9.5);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated: ${generatedAt}`, margin, 21);
    pdf.text(
      `Session: ${selectedSession} | Class: ${selectedClass} | Section: ${selectedSection}`,
      margin,
      27
    );
    pdf.setTextColor(...colors.text);

    // Key metric cards
    addSectionTitle('Key Metrics');
    const cards = keyMetrics.slice(0, 4);
    const cardGap = 4;
    const cardWidth = (contentWidth - cardGap) / 2;
    const cardHeight = 16;
    cards.forEach((metric, idx) => {
      if (idx % 2 === 0) ensureSpace(cardHeight + 2);
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = margin + col * (cardWidth + cardGap);
      const y = yPos + row * (cardHeight + 3);
      pdf.setFillColor(...colors.surface);
      pdf.setDrawColor(...colors.border);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
      pdf.setFillColor(...colors.brand);
      pdf.rect(x, y, cardWidth, 2, 'F');
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...colors.muted);
      pdf.text(metric.title, x + 2, y + 6.5);
      pdf.setFontSize(11);
      pdf.setTextColor(...colors.text);
      pdf.text(String(metric.value), x + 2, y + 11.8);
      if (metric.change) {
        pdf.setFontSize(7.5);
        pdf.setTextColor(...colors.accent);
        const changeText = String(metric.change);
        pdf.text(changeText.length > 30 ? `${changeText.slice(0, 29)}...` : changeText, x + 2, y + 15);
      }
    });
    yPos += Math.ceil(cards.length / 2) * (cardHeight + 3) + 1;

    addSectionTitle('Attendance & Users');
    addKVRows([
      ['Attendance Rate', `${Math.max(0, Math.round(scopedAttendanceRate))}%`],
      ['Students In Scope', formatNumber(scopedStudentCount)],
      ['Average Score', `${Math.max(0, Math.round(scopedAverageScore))}%`],
      ['Teachers', formatNumber(reportsSummary?.users?.teachers || 0)],
      ['Scope', isFilterApplied ? 'Filtered values' : 'School-wide values'],
    ]);

    addSectionTitle('Fees Overview');
    addKVRows([
      ['Collected', formatCurrency(filteredFeeTotals.paidAmount || 0)],
      ['Outstanding', formatCurrency(filteredFeeTotals.balanceAmount || 0)],
      ['Total Invoiced', formatCurrency((filteredFeeTotals.paidAmount || 0) + (filteredFeeTotals.balanceAmount || 0))],
      ['Invoices In Scope', formatNumber(filteredInvoices.length)],
    ]);

    addSectionTitle('Fees Collection Trend (6 Months)');
    addDataTable(
      ['Month', 'Collected', 'Pending'],
      feesChartData.map((item) => [item.month, formatCurrency(item.paid), formatCurrency(item.pending)])
    );

    addSectionTitle('Subject Performance');
    addDataTable(
      ['Subject', 'Average', 'Students'],
      subjectPerformance.slice(0, 12).map((item) => [
        item.subject,
        `${item.averageScore}%`,
        formatNumber(item.studentCount),
      ])
    );

    addSectionTitle('Grade Distribution');
    addDataTable(
      ['Grade', 'Students'],
      gradeDistributionData.map((item) => [item.grade, formatNumber(item.students)])
    );

    addSectionTitle('Improvement Trends');
    addDataTable(
      ['Trend', 'Count', 'Share'],
      improvementStats.map((item) => [item.label, formatNumber(item.count), `${item.value}%`])
    );

    addSectionTitle('Recent Admin Activity');
    addDataTable(
      ['Actor', 'Action', 'Entity', 'Time'],
      recentActivity.map((item) => [item.teacher, item.action, item.subject, item.time])
    );

    ensureSpace(10);
    pdf.setDrawColor(...colors.border);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setFontSize(8.5);
    pdf.setTextColor(...colors.muted);
    pdf.text(
      'Source: Filtered progress analytics, fees invoices, school summary, and audit logs.',
      margin,
      pageHeight - 9
    );

    pdf.save(`admin-analytics-report-${generatedDate}.pdf`);
  };

  const activeErrors = [analyticsError, reportsError, feesError, activityError].filter(Boolean);
  const initialLoading =
    (analyticsLoading || reportsLoading) &&
    !progressAnalytics &&
    !reportsSummary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-5">
        {initialLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-flex mb-5">
                <div className="w-16 h-16 rounded-full border-4 border-blue-100"></div>
                <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute inset-0"></div>
              </div>
              <p className="text-gray-500 font-medium">Loading analytics...</p>
              <p className="text-gray-400 text-sm mt-1">Fetching data from all sources</p>
            </div>
          </div>
        ) : (
          <>
            {activeErrors.length > 0 && (
              <div className="space-y-2">
                {activeErrors.map((err, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Page Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
              <div className="px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Comprehensive insights &amp; performance metrics</p>
                  </div>
                </div>
                <button
                  onClick={exportAnalyticsToPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Filters</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Academic Session</label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors"
                  >
                    {sessionOptions.map((session) => (
                      <option key={session?._id || ALL_SESSIONS} value={session?.name || ALL_SESSIONS}>
                        {session?.name || ALL_SESSIONS}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors"
                  >
                    {availableClassOptions.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Section</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors"
                  >
                    {availableSectionOptions.map((section) => (
                      <option key={section} value={section}>
                        {section === ALL_SECTIONS ? section : `Section ${section}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSession(ALL_SESSIONS);
                      setSelectedClass(ALL_CLASSES);
                      setSelectedSection(ALL_SECTIONS);
                    }}
                    className="w-full px-3 py-2.5 text-sm font-medium border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {keyMetrics.map((metric, idx) => {
                const Icon = metric.icon;
                const colors = getColorClasses(metric.color);
                const TrendIcon = metric.trend === 'up' ? TrendingUp : TrendingDown;

                return (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                    <div className={`h-1 bg-gradient-to-r ${colors.gradient}`}></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl ${colors.bg} group-hover:scale-105 transition-transform`}>
                          <Icon className={`w-5 h-5 ${colors.icon}`} />
                        </div>
                        {metric.change && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium max-w-[130px] ${
                            metric.trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            <TrendIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{metric.change}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{metric.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</p>
                      <p className="text-xs text-gray-400">{metric.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2 bg-indigo-50 rounded-xl mt-0.5">
                    <Activity className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Subject Performance</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Average scores by subject</p>
                  </div>
                </div>
                {analyticsLoading && !subjectPerformance.length ? (
                  <div className="flex items-center justify-center py-14 text-gray-400 text-sm">Loading performance data...</div>
                ) : subjectPerformance.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={subjectPerformance}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="subject" stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)'
                        }}
                      />
                      <Area type="monotone" dataKey="averageScore" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#scoreGradient)" name="Average Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                    <GraduationCap className="w-12 h-12 mb-3" />
                    <p className="text-sm text-gray-400">No subject analytics available yet.</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 rounded-xl mt-0.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Fees Collection</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Paid vs pending — last 6 months</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 flex-shrink-0">
                    {selectedSession === ALL_SESSIONS ? 'All Sessions' : selectedSession}
                  </span>
                </div>
                {feesLoading && !feesChartData.length ? (
                  <div className="flex items-center justify-center py-14 text-gray-400 text-sm">Loading fee analytics...</div>
                ) : feesChartData.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={feesChartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Collected" maxBarSize={36} />
                      <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pending" maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                    <DollarSign className="w-12 h-12 mb-3" />
                    <p className="text-sm text-gray-400">No fee data for this filter.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Attendance</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Based on reported sessions</p>
                  </div>
                  <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-center">
                    <p className="text-base font-bold text-emerald-600 leading-none">{attendanceRate || 0}%</p>
                    <p className="text-xs text-emerald-400 mt-0.5">Present</p>
                  </div>
                </div>
                {reportsLoading && !attendanceData.length ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 text-sm">Loading...</div>
                ) : attendanceData.length ? (
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <ResponsiveContainer width="50%" height={170}>
                      <PieChart>
                        <Pie
                          data={attendanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={68}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {attendanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {attendanceData.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-xs font-medium text-gray-600">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold text-gray-900">{formatNumber(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <CheckCircle className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-400">No attendance data recorded.</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-0.5">Subject Progress</h2>
                <p className="text-xs text-gray-400 mb-5">Average mastery across subjects</p>
                <div className="space-y-4">
                  {subjectPerformance.slice(0, 6).map((course, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-gray-700 truncate mr-2">{course.subject}</span>
                        <span className="text-xs font-bold text-gray-900 flex-shrink-0">{course.averageScore}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${course.averageScore}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  {!subjectPerformance.length && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                      <GraduationCap className="w-10 h-10 mb-2" />
                      <p className="text-sm text-gray-400">No subject performance data available.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-0.5">Grade Distribution</h2>
                <p className="text-xs text-gray-400 mb-5">Latest performance snapshot</p>
                {gradeDistributionData.length ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={gradeDistributionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis type="category" dataKey="grade" stroke="#e5e7eb" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)'
                        }}
                      />
                      <Bar dataKey="students" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {gradeDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <FileText className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-400">No grade distribution data yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2 bg-purple-50 rounded-xl mt-0.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Improvement Trends</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Student momentum over the last term</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {improvementStats.length ? (
                    improvementStats.map((stat, idx) => (
                      <div key={idx} className="p-4 rounded-xl text-center" style={{ backgroundColor: stat.color + '10', border: `1px solid ${stat.color}25` }}>
                        <div className="w-3 h-3 rounded-full mx-auto mb-2.5" style={{ backgroundColor: stat.color }}></div>
                        <p className="text-2xl font-bold mb-0.5" style={{ color: stat.color }}>{stat.value}%</p>
                        <p className="text-xs font-semibold text-gray-700 mb-0.5">{stat.label}</p>
                        <p className="text-xs text-gray-400">{formatNumber(stat.count)} students</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 col-span-3 text-center py-8">No improvement data yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2 bg-orange-50 rounded-xl mt-0.5">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Latest admin actions</p>
                  </div>
                </div>
                {activityLoading && !recentActivity.length ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading activity...</div>
                ) : recentActivity.length ? (
                  <div className="space-y-1.5">
                    {recentActivity.map((activity) => {
                      const colors = getColorClasses(activity.color);
                      return (
                        <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                          <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                            <Activity className={`w-4 h-4 ${colors.icon}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{activity.teacher}</p>
                            <p className="text-xs text-gray-500 truncate">{activity.action}{activity.subject ? `: ${activity.subject}` : ''}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-50 group-hover:bg-white px-2 py-1 rounded-lg border border-gray-100">{activity.time}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                    <Clock className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-400">No recent activity logged.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── School-wide Mastery Matrix ─────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <BarChart2 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">School-wide Mastery Matrix</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Average mastery score per subject × class (from AI tutor activity)</p>
                  </div>
                </div>
                <button
                  onClick={fetchMasteryMatrix}
                  disabled={matrixLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition disabled:opacity-50"
                >
                  {matrixLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Refresh
                </button>
              </div>
              <div className="p-6">
                {matrixLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading matrix…</div>
                ) : !masteryMatrix || !masteryMatrix.grades?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                    <BookOpen className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-400">No mastery data yet. Data appears as students use the AI Tutor.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-gray-500 font-semibold px-3 py-2 bg-gray-50 rounded-tl-xl border border-gray-100 sticky left-0 z-10 min-w-[80px]">Class</th>
                          {masteryMatrix.subjects.map((subj) => (
                            <th key={subj} className="text-center text-gray-500 font-semibold px-3 py-2 bg-gray-50 border border-gray-100 min-w-[90px] truncate max-w-[110px]">{subj}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {masteryMatrix.grades.map((grade) => (
                          <tr key={grade}>
                            <td className="text-gray-700 font-semibold px-3 py-2.5 bg-gray-50 border border-gray-100 sticky left-0 z-10">{grade}</td>
                            {masteryMatrix.subjects.map((subj) => {
                              const score = masteryMatrix.matrix?.[grade]?.[subj];
                              const bg =
                                score == null ? 'bg-gray-50 text-gray-300' :
                                score >= 75 ? 'bg-emerald-100 text-emerald-700' :
                                score >= 55 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700';
                              return (
                                <td key={subj} className={`text-center px-3 py-2.5 border border-gray-100 font-bold ${bg}`}>
                                  {score != null ? `${score}%` : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" />≥75% Strong</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block" />55–74% Moderate</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" />&lt;55% Needs attention</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Teacher Effectiveness ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <GraduationCap className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Teacher Effectiveness</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Class mastery outcomes per teacher's subject</p>
                  </div>
                </div>
                <button
                  onClick={fetchTeacherEffectiveness}
                  disabled={teacherEffLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5 hover:bg-purple-100 transition disabled:opacity-50"
                >
                  {teacherEffLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Refresh
                </button>
              </div>
              <div className="p-6">
                {teacherEffLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
                ) : !teacherEffectiveness.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <Users className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-400">No teacher data available.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Teacher', 'Subject', 'Avg Mastery', 'Students', 'Topics Covered', 'Effectiveness'].map((h) => (
                            <th key={h} className="text-left text-gray-400 font-semibold uppercase tracking-wide px-3 py-2 text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teacherEffectiveness.map((t, i) => {
                          const effColor =
                            t.effectiveness === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            t.effectiveness === 'Moderate' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            t.effectiveness === 'No data' ? 'bg-gray-50 text-gray-400 border-gray-200' :
                            'bg-red-50 text-red-700 border-red-100';
                          const scoreColor =
                            t.avgClassMastery == null ? 'text-gray-300' :
                            t.avgClassMastery >= 75 ? 'text-emerald-600 font-bold' :
                            t.avgClassMastery >= 55 ? 'text-amber-600 font-bold' :
                            'text-red-600 font-bold';
                          return (
                            <tr key={t.teacherId} className={`border-b border-gray-50 hover:bg-gray-50 transition ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                              <td className="px-3 py-3 font-semibold text-gray-800">{t.name}</td>
                              <td className="px-3 py-3 text-gray-600">{t.subject}</td>
                              <td className={`px-3 py-3 ${scoreColor}`}>{t.avgClassMastery != null ? `${t.avgClassMastery}%` : '—'}</td>
                              <td className="px-3 py-3 text-gray-600">{t.studentCount}</td>
                              <td className="px-3 py-3 text-gray-600">{t.topicsCovered}</td>
                              <td className="px-3 py-3">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${effColor}`}>{t.effectiveness}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
