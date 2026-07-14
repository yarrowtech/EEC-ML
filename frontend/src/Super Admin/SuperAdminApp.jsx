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
import PaymentStatus from './pages/PaymentStatus';
import { ToastProvider, useToast } from './components/ToastProvider';

const API_BASE = import.meta.env.VITE_API_URL;
const ISSUE_POLL_INTERVAL_MS = 30000;

const normalizeCampuses = (school = {}) => {
  if (Array.isArray(school.campuses) && school.campuses.length > 0) {
    return school.campuses;
  }
  if (school.campusName) {
    return [{ name: school.campusName, campusType: 'Main' }];
  }
  return [];
};

const normalizeRegistration = (school = {}) => {
  const campusList = normalizeCampuses(school);
  return {
    id: school._id || school.id,
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

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const SuperAdminAppInner = () => {
  const toast = useToast();
  const [profile, setProfile] = useState({
    name: 'Platform Control',
    role: 'Super Administrator',
    email: 'superadmin@eec.in',
    avatar: ''
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
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

  const fetchRequests = useCallback(async () => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setRequests([]);
      setRequestError('Your session has expired. Please sign in again.');
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools/registrations/unapproved`, { headers });
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
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setActiveSchools([]);
      return;
    }
    setActiveSchoolsLoading(true);
    setActiveSchoolsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools`, { headers });
      if (!response.ok) {
        throw new Error('Unable to load active schools');
      }
      const data = await response.json();
      setActiveSchools(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load active schools', error);
      setActiveSchoolsError(error.message || 'Unable to load active schools');
    } finally {
      setActiveSchoolsLoading(false);
    }
  }, []);

  const fetchSchoolAdmins = useCallback(async () => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setSchoolAdmins([]);
      return;
    }
    setSchoolAdminsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/school-admins`, { headers });
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
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setFeedbackItems([]);
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/requests?supportType=feedback`, { headers });
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

  const fetchIssues = useCallback(async ({ silent = false } = {}) => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setIssues([]);
      setIssuesError(null);
      setIssuesLoading(false);
      return;
    }
    if (!silent) {
      setIssuesLoading(true);
    }
    setIssuesError(null);
    try {
      const [issuesResponse, complaintsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/issues`, { headers }),
        fetch(`${API_BASE}/api/support/requests?supportType=complaint`, { headers })
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
      if (!silent) {
        setIssuesError(error.message || 'Unable to load issues');
      }
    } finally {
      if (!silent) {
        setIssuesLoading(false);
      }
    }
  }, [normalizeComplaintAsIssue, normalizeIssueItem]);

  const fetchSupportSettings = useCallback(async () => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      return;
    }
    setSupportSettingsLoading(true);
    setSupportSettingsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/settings`, { headers });
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
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      setAnnouncements([]);
      setComplianceItems([]);
      setActivityFeed([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/operations/data`, { headers });
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
    const headers = authHeaders();
    if (!headers || !API_BASE) return false;
    setSupportSettingsSaving(true);
    setSupportSettingsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/support/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
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
      toast.success('Support settings saved');
      return true;
    } catch (error) {
      console.error('Failed to save support settings', error);
      setSupportSettingsError(error.message || 'Unable to save support settings');
      toast.error(error.message || 'Unable to save support settings');
      return false;
    } finally {
      setSupportSettingsSaving(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
    fetchActiveSchools();
    fetchFeedback();
    fetchIssues();
    fetchSupportSettings();
    fetchOperationsData();
  }, [fetchRequests, fetchActiveSchools, fetchFeedback, fetchIssues, fetchSupportSettings, fetchOperationsData]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Silent background refresh; skip entirely while the tab is hidden.
      if (document.visibilityState === 'visible') {
        fetchIssues({ silent: true });
      }
    }, ISSUE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchIssues]);

  useEffect(() => {
    const handleRefresh = () => fetchRequests();
    window.addEventListener('super-admin-refresh-requests', handleRefresh);
    return () => window.removeEventListener('super-admin-refresh-requests', handleRefresh);
  }, [fetchRequests]);

  const handleDeleteAllPendingRequests = useCallback(async (confirmText) => {
    const headers = authHeaders();
    if (!headers || !API_BASE) return;
    if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
      throw new Error('Type DELETE to confirm this action.');
    }

    setRequestBulkDeleteLoading(true);
    setRequestError(null);
    try {
      const response = await fetch(`${API_BASE}/api/schools/registrations/pending?confirm=DELETE`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete pending requests');
      }
      toast.success(`Deleted ${data?.deleted ?? 0} pending registration(s)`);
      await fetchRequests();
      return data;
    } catch (error) {
      console.error('Failed to delete pending requests', error);
      setRequestError(error.message || 'Unable to delete pending requests');
      toast.error(error.message || 'Unable to delete pending requests');
      throw error;
    } finally {
      setRequestBulkDeleteLoading(false);
    }
  }, [fetchRequests, toast]);

  /**
   * Approve/reject a registration. Approval is fully server-side: the backend
   * validates the transition, provisions campus admin accounts with
   * server-generated passwords, emails the school, and returns the issued
   * credentials exactly once so the UI can display them.
   */
  const handleRequestUpdate = useCallback(async (requestId, status, note, options = {}) => {
    const selectedRequest = requests.find((item) => String(item.id) === String(requestId));
    if (!selectedRequest) return null;

    setRequestError(null);

    if (status === 'review') {
      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? { ...request, status, notes: note ?? request.notes, updatedAt: new Date().toISOString() }
            : request
        )
      );
      return null;
    }

    const headers = authHeaders();
    if (!headers || !API_BASE) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (status !== 'approved' && status !== 'rejected') return null;

    try {
      const endpoint =
        status === 'approved'
          ? `${API_BASE}/api/schools/registrations/${requestId}/approve`
          : `${API_BASE}/api/schools/registrations/${requestId}/reject`;
      const body =
        status === 'approved'
          ? {
              adminNotes: note || '',
              contactEmail: options?.contactEmail || undefined,
              credentials: Array.isArray(options?.credentials) ? options.credentials : undefined
            }
          : { rejectionReason: note || 'Rejected by admin' };

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update registration');
      }

      if (status === 'approved') {
        setRequests((prev) => prev.filter((request) => request.id !== requestId));
        const emailNote = data?.emailSent === false
          ? 'Approved, but the credential email could not be sent — share the credentials manually.'
          : `Approved. Credentials emailed to ${data?.notifiedEmail || 'the school contact'}.`;
        (data?.emailSent === false ? toast.error : toast.success)(
          `${selectedRequest.schoolName}: ${emailNote}`
        );
        fetchActiveSchools();
        fetchSchoolAdmins();
      } else {
        setRequests((prev) =>
          prev.map((request) =>
            request.id === requestId
              ? { ...request, status: 'rejected', notes: body.rejectionReason, updatedAt: new Date().toISOString() }
              : request
          )
        );
        toast.success(`${selectedRequest.schoolName}: registration rejected`);
      }
      return data;
    } catch (error) {
      console.error('Failed to update registration', error);
      setRequestError(error.message || 'Unable to update registration');
      toast.error(error.message || 'Unable to update registration');
      throw error;
    }
  }, [requests, fetchActiveSchools, fetchSchoolAdmins, toast]);

  const handleFeedbackUpdate = useCallback(
    async (feedbackId, updates = {}) => {
      setFeedbackItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item
        )
      );

      const headers = authHeaders();
      if (!headers || !API_BASE) {
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
          headers: { 'Content-Type': 'application/json', ...headers },
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
        toast.success('Feedback updated');
      } catch (error) {
        console.error('Failed to update feedback', error);
        toast.error(error.message || 'Unable to update feedback');
        fetchFeedback();
      }
    },
    [fetchFeedback, normalizeFeedbackItem, toast]
  );

  const handleIssueUpdate = useCallback(
    async (issueId, updates = {}) => {
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? { ...issue, ...updates, updatedAt: new Date().toISOString() }
            : issue
        )
      );

      const headers = authHeaders();
      if (!headers || !API_BASE) {
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
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            throw new Error('Failed to update complaint');
          }
        } else {
          const response = await fetch(`${API_BASE}/api/issues/${issue.sourceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(updates)
          });
          if (!response.ok) {
            throw new Error('Failed to update issue');
          }
        }
        toast.success('Issue updated');
        await fetchIssues({ silent: true });
      } catch (error) {
        console.error('Failed to update issue', error);
        toast.error(error.message || 'Unable to update issue');
        fetchIssues({ silent: true });
      }
    },
    [fetchIssues, issues, toast]
  );

  const handleAnnouncementCreate = useCallback(async ({ title, message, audience }) => {
    const headers = authHeaders();
    if (!headers || !API_BASE) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/super-admin/announcements/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
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
      toast.success(`Broadcast sent to ${data?.targetSchools ?? 0} school(s)`);
      return true;
    } catch (error) {
      console.error('Failed to broadcast announcement', error);
      toast.error(error.message || 'Failed to send broadcast');
      return false;
    }
  }, [fetchOperationsData, toast]);

  const handleComplianceUpdate = useCallback(async (itemId, status) => {
    const headers = authHeaders();
    if (!headers || !API_BASE || !itemId) return false;
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/operations/compliance/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
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
      toast.success('Compliance item updated');
      return true;
    } catch (error) {
      console.error('Failed to update compliance item', error);
      toast.error(error.message || 'Failed to update compliance item');
      return false;
    }
  }, [fetchOperationsData, toast]);

  useEffect(() => {
    const fetchProfile = async () => {
      const headers = authHeaders();
      if (!headers || !API_BASE) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/auth/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers }
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
        <Route path="credentials" element={<Credentials />} />
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
        <Route path="organizations/payment-status" element={<PaymentStatus />} />
        <Route index element={<Navigate to="/super-admin/overview" replace />} />
        <Route path="*" element={<Navigate to="/super-admin/overview" replace />} />
      </Routes>
    </SuperAdminLayout>
  );
};

const SuperAdminApp = () => (
  <ToastProvider>
    <SuperAdminAppInner />
  </ToastProvider>
);

export default SuperAdminApp;
