import { useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SuperAdminLayout from './SuperAdminLayout';
import Overview from './pages/Overview';
import Requests from './pages/Requests';
import Feedback from './pages/Feedback';
import Issues from './pages/Issues';
import Credentials from './pages/Credentials';
import Operations from './pages/Operations';
import IDPass from './pages/IDPass';
import ActiveSchools from './pages/ActiveSchools';
import RequestDetails from './pages/RequestDetails';
import Organizations from './pages/Organizations';
import {
  initialSchoolRequests
} from './mockData';

const API_BASE = import.meta.env.VITE_API_URL;
const SCHOOL_CREDENTIAL_STORAGE_KEY = 'superAdminSchoolCredentials';

const normalizeCampuses = (school = {}) => {
  if (Array.isArray(school.campuses) && school.campuses.length > 0) {
    return school.campuses;
  }
  if (school.campusName) {
    return [{ name: school.campusName, campusType: 'Main' }];
  }
  return [];
};

const campusKeyFor = (campus = {}, index = 0) => {
  const rawKey = campus.id || campus._id || campus.campusId || campus.name || `campus-${index}`;
  return String(rawKey);
};

const normalizeStoredCredentials = (stored = {}) => {
  if (!stored || typeof stored !== 'object') return {};
  return Object.entries(stored).reduce((acc, [schoolId, entry]) => {
    if (!entry || typeof entry !== 'object') {
      return acc;
    }
    if (entry.campuses && typeof entry.campuses === 'object') {
      acc[schoolId] = entry;
      return acc;
    }
    if (entry.code || entry.password) {
      acc[schoolId] = { campuses: { default: entry } };
      return acc;
    }
    acc[schoolId] = entry;
    return acc;
  }, {});
};

const normalizeRegistration = (school = {}) => {
  const campusList = normalizeCampuses(school);
  return {
    id: school._id || school.id || `REQ-${Date.now()}`,
    schoolName: school.name || 'New School',
    board: school.boardOther || school.board || 'Not specified',
    studentCount: school.estimatedUsers || 'Pending',
    contactPerson: school.contactPersonName || school.contactPerson || 'Registrar',
    contactEmail: school.officialEmail || school.contactEmail || 'N/A',
    contactPhone: school.contactPhone,
    submittedAt: school.submittedAt || school.createdAt || new Date().toISOString(),
    status: school.registrationStatus || 'pending',
    notes: school.adminNotes || school.rejectionReason || 'Awaiting review',
    campuses: campusList.length || school.campusCount || 0,
    campusList,
    schoolType: school.schoolType,
    academicYearStructure: school.academicYearStructure,
    estimatedUsers: school.estimatedUsers,
    address: school.address,
    verificationDocs: school.verificationDocs,
    logo: school.logo,
    source: 'api'
  };
};

const SuperAdminApp = () => {
  const [profile, setProfile] = useState({
    name: 'Platform Control',
    role: 'Super Administrator',
    email: 'superadmin@eec.in',
    avatar: ''
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [requests, setRequests] = useState(initialSchoolRequests);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [requestBulkDeleteLoading, setRequestBulkDeleteLoading] = useState(false);
  const [activeSchools, setActiveSchools] = useState([]);
  const [activeSchoolsLoading, setActiveSchoolsLoading] = useState(false);
  const [activeSchoolsError, setActiveSchoolsError] = useState(null);
  const [schoolAdmins, setSchoolAdmins] = useState([]);
  const [schoolAdminsError, setSchoolAdminsError] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState(null);
  const [issuesLastSyncedAt, setIssuesLastSyncedAt] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [complianceItems, setComplianceItems] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [supportSettings, setSupportSettings] = useState({
    phoneNumber: '+91 90420 56789',
    email: 'support@eecschools.com',
    availableDays: 'Mon - Fri',
    availableTime: '8 AM - 6 PM IST',
    onCall24x7: true
  });
  const [supportSettingsLoading, setSupportSettingsLoading] = useState(false);
  const [supportSettingsSaving, setSupportSettingsSaving] = useState(false);
  const [supportSettingsError, setSupportSettingsError] = useState(null);
  const [schoolCredentials, setSchoolCredentials] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(SCHOOL_CREDENTIAL_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeStoredCredentials(parsed && typeof parsed === 'object' ? parsed : {});
    } catch (error) {
      console.error('Failed to parse stored school credentials', error);
      return {};
    }
  });
  const [credentials, setCredentials] = useState(() =>
    initialSchoolRequests.reduce((acc, school) => {
      acc[school.id] = {
        password: '',
        status: 'not_generated',
        lastGenerated: null,
        lastReset: null
      };
      return acc;
    }, {})
  );

  const normalizeFeedbackItem = useCallback((item) => {
    if (!item) return null;
    return {
      id: item.id || item._id,
      topic: item.subject || item.requestDetails?.subject || 'Product feedback',
      schoolName: item.schoolName || 'Unknown school',
      submittedAt: item.createdAt || item.submittedAt || new Date().toISOString(),
      sentiment: item.requestDetails?.sentiment || 'neutral',
      status: item.status || 'open',
      message: item.message || item.requestDetails?.message || '',
      response: item.resolutionNotes || ''
    };
  }, []);

  const normalizeIssueItem = useCallback((issue) => {
    if (!issue) return null;
    return {
      id: issue.id || issue._id,
      title: issue.title || 'Issue',
      severity: issue.severity || 'medium',
      reportedBy: issue.reportedBy || issue.schoolName || 'Unknown school',
      schoolName: issue.schoolName || issue.reportedBy || 'Unknown school',
      schoolId: issue.schoolId || null,
      reportedAt: issue.reportedAt || issue.createdAt || new Date().toISOString(),
      resolvedAt: issue.resolvedAt || null,
      status: issue.status || 'open',
      owner: issue.owner || 'Support',
      description: issue.description || '',
      resolutionNotes: issue.resolutionNotes || '',
      source: 'issue',
      sourceId: issue.id || issue._id
    };
  }, []);

  const normalizeComplaintAsIssue = useCallback((complaint) => {
    if (!complaint) return null;
    const impactLevel = complaint.requestDetails?.impactLevel || 'medium';
    const severityMap = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical'
    };
    const statusMap = {
      open: 'open',
      in_progress: 'investigating',
      resolved: 'resolved'
    };
    return {
      id: complaint.id || complaint._id,
      title:
        complaint.subject ||
        `Complaint • ${complaint.requestDetails?.topic || complaint.category || 'General'}`,
      severity: severityMap[impactLevel] || 'medium',
      reportedBy: complaint.schoolName || 'Unknown school',
      schoolName: complaint.schoolName || 'Unknown school',
      schoolId: complaint.schoolId || null,
      reportedAt: complaint.createdAt || complaint.submittedAt || new Date().toISOString(),
      resolvedAt: complaint.resolvedAt || null,
      status: statusMap[complaint.status] || 'open',
      owner: complaint.owner || 'Support Desk',
      description: complaint.message || complaint.requestDetails?.description || '',
      resolutionNotes: complaint.resolutionNotes || '',
      source: 'support_complaint',
      sourceId: complaint.id || complaint._id
    };
  }, []);

  const generateSecurePassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@$%&*';
    const rules = [uppercase, lowercase, digits, symbols];
    let password = rules.map((set) => set[Math.floor(Math.random() * set.length)]).join('');
    const allChars = `${uppercase}${lowercase}${digits}${symbols}`;
    while (password.length < 12) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  };

  const resolveRequestCampuses = useCallback((request) => {
    if (!request) return [];
    if (Array.isArray(request.campusList) && request.campusList.length > 0) {
      return request.campusList;
    }
    if (Array.isArray(request.campuses) && request.campuses.length > 0) {
      return request.campuses;
    }
    if (request.campusName) {
      return [{ name: request.campusName, campusType: 'Main' }];
    }
    return [
      {
        name: request.schoolName || request.name || 'Main Campus',
        campusType: 'Main'
      }
    ];
  }, []);

  const insights = useMemo(() => {
    const pending = requests.filter((req) => req.status === 'pending').length;
    const activeCount = activeSchools.length;
    const openIssues = issues.filter((issue) => issue.status !== 'resolved').length;
    const pendingFeedback = feedbackItems.filter((item) => item.status !== 'resolved').length;

    return [
      { label: 'Pending approvals', value: pending, change: pending ? `+${pending} awaiting` : 'Up to date' },
      { label: 'Active schools', value: activeCount, change: `${activeCount} active` },
      { label: 'Feedback queue', value: pendingFeedback, change: pendingFeedback ? 'Needs response' : 'Inbox clear' },
      { label: 'Issues to resolve', value: openIssues, change: openIssues ? 'Prioritise today' : 'All clear' }
    ];
  }, [requests, activeSchools.length, issues, feedbackItems]);
  const persistSchoolCredentials = useCallback((next) => {
    try {
      localStorage.setItem(SCHOOL_CREDENTIAL_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to persist school credentials', error);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setRequests(initialSchoolRequests);
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools/registrations/unapproved`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Unable to load unapproved school registrations');
      }
      const data = await response.json();
      const normalized = Array.isArray(data) ? data.map(normalizeRegistration) : [];
      setRequests(normalized);
    } catch (error) {
      console.error('Failed to fetch registrations', error);
      setRequestError(error.message || 'Unable to load registrations');
    } finally {
      setRequestLoading(false);
    }
  }, []);

  const fetchActiveSchools = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setActiveSchools([]);
      return;
    }
    setActiveSchoolsLoading(true);
    setActiveSchoolsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Unable to load active schools');
      }
      const data = await response.json();
      const schools = Array.isArray(data) ? data : [];
      setActiveSchools(schools);
    } catch (error) {
      console.error('Failed to load active schools', error);
      setActiveSchoolsError(error.message || 'Unable to load active schools');
    } finally {
      setActiveSchoolsLoading(false);
    }
  }, []);

  const fetchSchoolAdmins = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setSchoolAdmins([]);
      return;
    }
    setSchoolAdminsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/school-admins`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Unable to load school admins');
      }
      const data = await response.json();
      setSchoolAdmins(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load school admins', error);
      setSchoolAdminsError(error.message || 'Unable to load school admins');
    }
  }, []);

  const fetchFeedback = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setFeedbackItems([]);
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/requests?supportType=feedback`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to load feedback');
      }
      const data = await response.json();
      setFeedbackItems(
        Array.isArray(data) ? data.map((entry) => normalizeFeedbackItem(entry)).filter(Boolean) : []
      );
    } catch (error) {
      console.error('Failed to fetch feedback', error);
      setFeedbackError(error.message || 'Unable to fetch feedback');
    } finally {
      setFeedbackLoading(false);
    }
  }, [normalizeFeedbackItem]);

  const fetchIssues = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setIssues([]);
      setIssuesError(null);
      setIssuesLoading(false);
      return;
    }
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const [issuesResponse, complaintsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/issues`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/api/support/requests?supportType=complaint`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      if (!issuesResponse.ok) {
        throw new Error('Failed to load issues');
      }
      if (!complaintsResponse.ok) {
        throw new Error('Failed to load complaints');
      }

      const [issuesData, complaintsData] = await Promise.all([
        issuesResponse.json(),
        complaintsResponse.json()
      ]);

      const normalizedIssues = Array.isArray(issuesData)
        ? issuesData.map((entry) => normalizeIssueItem(entry)).filter(Boolean)
        : [];
      const normalizedComplaints = Array.isArray(complaintsData)
        ? complaintsData.map((entry) => normalizeComplaintAsIssue(entry)).filter(Boolean)
        : [];

      const merged = [...normalizedIssues, ...normalizedComplaints].sort(
        (a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime()
      );
      setIssues(merged);
      setIssuesLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch issues', error);
      setIssuesError(error.message || 'Unable to load issues');
    } finally {
      setIssuesLoading(false);
    }
  }, [normalizeComplaintAsIssue, normalizeIssueItem]);

  const fetchSupportSettings = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      return;
    }
    setSupportSettingsLoading(true);
    setSupportSettingsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/settings`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to load support settings');
      }
      const data = await response.json();
      setSupportSettings((prev) => ({
        ...prev,
        ...(data || {}),
        onCall24x7: data?.onCall24x7 !== false
      }));
    } catch (error) {
      console.error('Failed to fetch support settings', error);
      setSupportSettingsError(error.message || 'Unable to load support settings');
    } finally {
      setSupportSettingsLoading(false);
    }
  }, []);

  const fetchOperationsData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setAnnouncements([]);
      setComplianceItems([]);
      setActivityFeed([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/operations/data`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to load operations data');
      }
      const data = await response.json().catch(() => ({}));
      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
      setComplianceItems(Array.isArray(data?.complianceItems) ? data.complianceItems : []);
      setActivityFeed(Array.isArray(data?.activityFeed) ? data.activityFeed : []);
    } catch (error) {
      console.error('Failed to fetch operations data', error);
      setAnnouncements([]);
      setComplianceItems([]);
      setActivityFeed([]);
    }
  }, []);

  const handleSupportSettingsSave = useCallback(async (nextSettings = {}) => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) return false;
    setSupportSettingsSaving(true);
    setSupportSettingsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(nextSettings)
      });
      if (!response.ok) {
        throw new Error('Failed to save support settings');
      }
      const data = await response.json();
      setSupportSettings((prev) => ({
        ...prev,
        ...(data || {}),
        onCall24x7: data?.onCall24x7 !== false
      }));
      return true;
    } catch (error) {
      console.error('Failed to save support settings', error);
      setSupportSettingsError(error.message || 'Unable to save support settings');
      return false;
    } finally {
      setSupportSettingsSaving(false);
    }
  }, []);

  useEffect(() => {
    setCredentials((prev) => {
      const updated = { ...prev };
      requests.forEach((request) => {
        if (!updated[request.id]) {
          updated[request.id] = {
            password: '',
            status: 'not_generated',
            lastGenerated: null,
            lastReset: null
          };
        }
      });
      return updated;
    });
  }, [requests]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchActiveSchools();
  }, [fetchActiveSchools]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchIssues();
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchIssues]);

  useEffect(() => {
    fetchSupportSettings();
  }, [fetchSupportSettings]);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

  useEffect(() => {
    const handleRefresh = () => fetchRequests();
    window.addEventListener('super-admin-refresh-requests', handleRefresh);
    return () => window.removeEventListener('super-admin-refresh-requests', handleRefresh);
  }, [fetchRequests]);

  useEffect(() => {
    persistSchoolCredentials(schoolCredentials);
  }, [schoolCredentials, persistSchoolCredentials]);

  const buildSchoolInitials = (value = '') =>
    String(value || '')
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean)
      .map((word) => word[0].toUpperCase())
      .join('');

  const generateSchoolCode = (request = {}, usedCodes = new Set()) => {
    const initials = buildSchoolInitials(request?.schoolName || request?.name) || 'SCH';
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const candidate = `EEC-${initials}-${suffix}`;
      if (!usedCodes.has(candidate)) return candidate;
    }
    return `EEC-${initials}-${String(Date.now()).slice(-4)}`;
  };

  const generateSchoolPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@$%&*';
    const pool = `${uppercase}${lowercase}${digits}${symbols}`;
    let password = [
      uppercase[Math.floor(Math.random() * uppercase.length)],
      lowercase[Math.floor(Math.random() * lowercase.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ].join('');
    while (password.length < 12) {
      password += pool[Math.floor(Math.random() * pool.length)];
    }
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  };

  const createSchoolAdminAccount = useCallback(async (request, code, password, status = 'active', campus = null) => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      return;
    }
    const campusId = campus?.id || campus?._id || campus?.campusId;
    const payload = {
      username: code,
      password,
      name: request.schoolName || request.name,
      email: request.contactEmail || request.officialEmail || '',
      avatar: request.logo || request.avatar || '',
      schoolId: request.schoolId || request.id,
      status,
      campusId,
      campusName: campus?.name,
      campusType: campus?.campusType
    };
    const response = await fetch(`${API_BASE}/api/admin/auth/school-admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let message = 'Unable to create school admin';
      try {
        const data = await response.json();
        message = data?.error || message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
  }, []);

  const handleSchoolCredentialGenerate = async (request, campus, campusIndex = 0, status = 'active') => {
    if (!request?.id) return;
    const campusKey = campusKeyFor(campus, campusIndex);
    const campusName = campus?.name || `Campus ${campusIndex + 1}`;
    const current = schoolCredentials[request.id] && typeof schoolCredentials[request.id] === 'object'
      ? schoolCredentials[request.id]
      : {};
    const existingCampuses = current.campuses && typeof current.campuses === 'object'
      ? Object.values(current.campuses)
      : [];
    const usedCodes = new Set(
      existingCampuses
        .map((entry) => String(entry?.code || '').trim())
        .filter(Boolean)
    );
    const code = generateSchoolCode(request, usedCodes);
    const password = generateSchoolPassword();
    const entry = {
      code,
      password,
      generatedAt: new Date().toISOString(),
      schoolName: request.schoolName || request.name,
      campusName,
      campusType: campus?.campusType || 'Campus',
      campusId: campus?.id || campus?._id || campus?.campusId
    };
    setSchoolCredentials((prev) => {
      const currentEntry = prev[request.id] && typeof prev[request.id] === 'object' ? prev[request.id] : {};
      const nextCampuses = currentEntry.campuses && typeof currentEntry.campuses === 'object' ? { ...currentEntry.campuses } : {};
      nextCampuses[campusKey] = entry;
      return {
        ...prev,
        [request.id]: {
          ...currentEntry,
          campuses: nextCampuses
        }
      };
    });
    try {
      await createSchoolAdminAccount(request, code, password, status, campus);
    } catch (error) {
      console.error('Failed to create school admin', error);
      setRequestError(error.message || 'Unable to create school admin');
    }
    return entry;
  };

  const handleDeleteAllPendingRequests = useCallback(async (confirmText) => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) return;
    if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
      throw new Error('Type DELETE to confirm this action.');
    }

    setRequestBulkDeleteLoading(true);
    setRequestError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools/registrations/pending?confirm=DELETE`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete pending requests');
      }
      setRequests([]);
      setSchoolCredentials((prev) => {
        if (!prev || typeof prev !== 'object') return {};
        const next = { ...prev };
        requests.forEach((request) => {
          delete next[request.id];
        });
        return next;
      });
      await fetchRequests();
      return data;
    } catch (error) {
      console.error('Failed to delete pending requests', error);
      setRequestError(error.message || 'Unable to delete pending requests');
      throw error;
    } finally {
      setRequestBulkDeleteLoading(false);
    }
  }, [fetchRequests, requests]);

  const handleRequestUpdate = async (requestId, status, note, options = {}) => {
    const selectedRequest = requests.find((item) => item.id === requestId);
    if (!selectedRequest) return;

    setRequestError(null);

    if (status === 'review') {
      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                notes: note ?? request.notes,
                updatedAt: new Date().toISOString()
              }
            : request
        )
      );
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !API_BASE) return;

    if (status === 'approved' || status === 'rejected') {
      try {
        const endpoint =
          status === 'approved'
            ? `${API_BASE}/api/schools/registrations/${requestId}/approve`
            : `${API_BASE}/api/schools/registrations/${requestId}/reject`;
        const body =
          status === 'approved'
            ? { adminNotes: note || '' }
            : { rejectionReason: note || 'Rejected by admin' };
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Unable to update registration');
        }

        if (status === 'approved') {
          setRequests((prev) => prev.filter((request) => request.id !== requestId));
        } else {
          setRequests((prev) =>
            prev.map((request) =>
              request.id === requestId
                ? {
                    ...request,
                    status: 'rejected',
                    notes: body.rejectionReason,
                    updatedAt: new Date().toISOString()
                  }
                : request
            )
          );
        }
      } catch (error) {
        console.error('Failed to update registration', error);
        setRequestError(error.message || 'Unable to update registration');
        throw error;
      }
    }

    if (status === 'approved') {
      const campusList = resolveRequestCampuses(selectedRequest);
      const credentialBucket = schoolCredentials[requestId] || {};
      const campusCredentials =
        credentialBucket.campuses && typeof credentialBucket.campuses === 'object'
          ? credentialBucket.campuses
          : {};
      const manualCredentials = Array.isArray(options?.approvalCredentials)
        ? options.approvalCredentials
            .filter((entry) => entry?.code && entry?.password)
            .map((entry) => ({
              code: String(entry.code).trim(),
              password: String(entry.password).trim(),
              campusName: entry.campusName || '',
              campusType: entry.campusType || 'Campus',
              campusId: entry.campusId || null,
            }))
        : [];

      const approvalCredentials = [];

      if (manualCredentials.length > 0) {
        for (let i = 0; i < manualCredentials.length; i += 1) {
          const entry = manualCredentials[i];
          const campus =
            campusList.find((item) => String(item?.id || item?._id || item?.campusId || '') === String(entry.campusId || ''))
            || campusList.find((item) => String(item?.name || '').trim().toLowerCase() === String(entry.campusName || '').trim().toLowerCase())
            || campusList[i]
            || null;

          approvalCredentials.push({
            code: entry.code,
            password: entry.password,
            campusName: entry.campusName || campus?.name || `Campus ${i + 1}`,
            campusType: entry.campusType || campus?.campusType || 'Campus',
            campusId: entry.campusId || campus?.id || campus?._id || campus?.campusId || null,
          });

          try {
            await createSchoolAdminAccount(selectedRequest, entry.code, entry.password, 'active', campus);
          } catch (error) {
            console.error('Failed to create school admin', error);
            setRequestError(error.message || 'Unable to create school admin');
          }
        }
      } else {
        for (let i = 0; i < campusList.length; i += 1) {
          const campus = campusList[i];
          const campusKey = campusKeyFor(campus, i);
          const existingCredential =
            campusCredentials[campusKey] ||
            campusCredentials.default ||
            (i === 0 && credentialBucket?.code && credentialBucket?.password ? credentialBucket : null);

          if (existingCredential?.code && existingCredential?.password) {
            approvalCredentials.push({
              code: existingCredential.code,
              password: existingCredential.password,
              campusName: existingCredential.campusName || campus?.name || `Campus ${i + 1}`,
              campusType: existingCredential.campusType || campus?.campusType || 'Campus',
              campusId: existingCredential.campusId || campus?.id || campus?._id || campus?.campusId
            });
            try {
              await createSchoolAdminAccount(selectedRequest, existingCredential.code, existingCredential.password, 'active', campus);
              continue;
            } catch (error) {
              console.error('Failed to create school admin', error);
              setRequestError(error.message || 'Unable to create school admin');
            }
          }

          const generated = await handleSchoolCredentialGenerate(selectedRequest, campus, i, 'active');
          if (generated) {
            approvalCredentials.push(generated);
          }
        }
      }

      if (approvalCredentials.length > 0) {
        try {
          const token = localStorage.getItem('token');
          if (token && API_BASE) {
            await fetch(`${API_BASE}/api/admin/auth/school-admins/notify-credentials`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                schoolId: selectedRequest.schoolId || selectedRequest.id,
                schoolName: selectedRequest.schoolName || selectedRequest.name,
                contactEmail: options?.contactEmail || selectedRequest.contactEmail || selectedRequest.officialEmail,
                campuses: approvalCredentials.map((entry) => ({
                  campusName: entry.campusName,
                  campusType: entry.campusType,
                  username: entry.code,
                  password: entry.password
                }))
              })
            });
          }
        } catch (error) {
          console.error('Failed to send approval email', error);
        }
      }
    }
  };

  const handleFeedbackUpdate = useCallback(
    async (feedbackId, updates = {}) => {
      setFeedbackItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? {
                ...item,
                ...updates,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );

      const token = localStorage.getItem('token');
      if (!token || !API_BASE) {
        return;
      }

      try {
        const payload = {};
        if (updates.status) {
          payload.status = updates.status;
        }
        if (updates.response !== undefined) {
          payload.resolutionNotes = updates.response;
        }

        const response = await fetch(`${API_BASE}/api/support/requests/${feedbackId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error('Failed to update feedback');
        }
        const data = await response.json();
        const normalized = normalizeFeedbackItem(data);
        if (normalized) {
          setFeedbackItems((prev) => prev.map((item) => (item.id === feedbackId ? normalized : item)));
        }
      } catch (error) {
        console.error('Failed to update feedback', error);
        fetchFeedback();
      }
    },
    [fetchFeedback, normalizeFeedbackItem]
  );

  const handleIssueUpdate = useCallback(
    async (issueId, updates = {}) => {
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                ...updates,
                updatedAt: new Date().toISOString()
              }
            : issue
        )
      );

      const token = localStorage.getItem('token');
      if (!token || !API_BASE) {
        return;
      }

      const issue = issues.find((item) => item.id === issueId);
      if (!issue?.sourceId) return;

      try {
        if (issue.source === 'support_complaint') {
          const supportStatusMap = {
            open: 'open',
            investigating: 'in_progress',
            resolved: 'resolved'
          };
          const payload = {
            status: updates.status ? supportStatusMap[updates.status] || updates.status : undefined,
            owner: updates.owner,
            resolutionNotes: updates.resolutionNotes
          };
          const response = await fetch(`${API_BASE}/api/support/requests/${issue.sourceId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            throw new Error('Failed to update complaint');
          }
          await fetchIssues();
          return;
        }

        const response = await fetch(`${API_BASE}/api/issues/${issue.sourceId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });
        if (!response.ok) {
          throw new Error('Failed to update issue');
        }
        await fetchIssues();
      } catch (error) {
        console.error('Failed to update issue', error);
        fetchIssues();
      }
    },
    [fetchIssues, issues]
  );

  const handleAnnouncementCreate = async ({ title, message, audience }) => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      return true;
    }

    try {
      const response = await fetch(`${API_BASE}/api/super-admin/announcements/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, message, audience, priority: 'medium' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send broadcast');
      }

      if (data?.announcement) {
        setAnnouncements((prev) => [data.announcement, ...prev]);
      } else {
        await fetchOperationsData();
      }
      if (data?.activity) {
        setActivityFeed((prev) => [data.activity, ...prev]);
      }
      return true;
    } catch (error) {
      console.error('Failed to broadcast announcement', error);
      return false;
    }
  };

  const handleComplianceUpdate = async (itemId, status) => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE || !itemId) return false;
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/operations/compliance/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update compliance item');
      }
      if (data?.item) {
        setComplianceItems((prev) => prev.map((item) => (item.id === itemId ? data.item : item)));
      } else {
        await fetchOperationsData();
      }
      if (data?.activity) {
        setActivityFeed((prev) => [data.activity, ...prev]);
      }
      return true;
    } catch (error) {
      console.error('Failed to update compliance item', error);
      return false;
    }
  };

  const handleCredentialGenerate = (schoolId) => {
    const password = generateSecurePassword();
    setCredentials((prev) => ({
      ...prev,
      [schoolId]: {
        ...prev[schoolId],
        password,
        status: 'generated',
        lastGenerated: new Date().toISOString()
      }
    }));
  };

  const handleCredentialReset = (schoolId) => {
    setCredentials((prev) => ({
      ...prev,
      [schoolId]: {
        ...prev[schoolId],
        status: 'reset_sent',
        lastReset: new Date().toISOString()
      }
    }));
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        setProfile((prev) => ({
          ...prev,
          name: data.name || data.username || prev.name,
          email: data.email || data.username || prev.email,
          avatar: data.avatar || ''
        }));
      } catch (err) {
        console.error('Failed to load super admin profile', err);
      }
    };

    fetchProfile();
  }, []);

  return (
    <SuperAdminLayout
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
      insights={insights}
      profile={profile}
    >
      <Routes>
        <Route path="overview" element={
          <Overview
            requests={requests}
            feedbackItems={feedbackItems}
            issues={issues}
            requestLoading={requestLoading}
            bulkDeleteLoading={requestBulkDeleteLoading}
            requestError={requestError}
            onRefreshRequests={fetchRequests}
            onDeleteAllPendingRequests={handleDeleteAllPendingRequests}
            onRequestAction={handleRequestUpdate}
            onIssueUpdate={handleIssueUpdate}
            onFeedbackUpdate={handleFeedbackUpdate}
          />
        } />
        <Route path="requests" element={
          <Requests
            requests={requests}
            onRequestAction={handleRequestUpdate}
            loading={requestLoading}
            bulkDeleteLoading={requestBulkDeleteLoading}
            error={requestError}
            onRefresh={fetchRequests}
            onDeleteAllPendingRequests={handleDeleteAllPendingRequests}
            schoolCredentials={schoolCredentials}
            onGenerateSchoolCredentials={handleSchoolCredentialGenerate}
          />
        } />
        <Route path="requests/:requestId" element={<RequestDetails requests={requests} />} />
        <Route path="feedback" element={
          <Feedback
            feedbackItems={feedbackItems}
            onFeedbackUpdate={handleFeedbackUpdate}
            loading={feedbackLoading}
            error={feedbackError}
            onRefresh={fetchFeedback}
          />
        } />
        <Route path="issues" element={
          <Issues
            issues={issues}
            onIssueUpdate={handleIssueUpdate}
            loading={issuesLoading}
            error={issuesError}
            onRefresh={fetchIssues}
            lastSyncedAt={issuesLastSyncedAt}
          />
        } />
        <Route path="credentials" element={
          <Credentials
            requests={requests}
            credentialState={credentials}
            onGenerateCredential={handleCredentialGenerate}
            onResetCredential={handleCredentialReset}
          />
        } />
        <Route path="operations" element={
          <Operations
            announcements={announcements}
            onCreateAnnouncement={handleAnnouncementCreate}
            complianceItems={complianceItems}
            onComplianceUpdate={handleComplianceUpdate}
            activityFeed={activityFeed}
            supportSettings={supportSettings}
            supportSettingsLoading={supportSettingsLoading}
            supportSettingsSaving={supportSettingsSaving}
            supportSettingsError={supportSettingsError}
            onSaveSupportSettings={handleSupportSettingsSave}
          />
        } />
        <Route path="id-pass" element={<IDPass profile={profile} />} />
        <Route
          path="active-schools"
          element={
            <ActiveSchools
              fetchActiveSchools={fetchActiveSchools}
              fetchSchoolAdmins={fetchSchoolAdmins}
              loading={activeSchoolsLoading}
              error={activeSchoolsError || schoolAdminsError}
              schools={activeSchools}
              admins={schoolAdmins}
            />
          }
        />
        <Route path="organizations" element={<Organizations />} />
        <Route index element={<Navigate to="/super-admin/overview" replace />} />
        <Route path="*" element={<Navigate to="/super-admin/overview" replace />} />
      </Routes>
    </SuperAdminLayout>
  );
};

export default SuperAdminApp;
