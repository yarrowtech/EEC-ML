// Super Admin has no single-school Notification feed to poll (the generic
// /api/notifications/user endpoint requires a schoolId, which a
// platform-level super admin token doesn't carry). Its "notifications" are
// the pending items already fetched for the Requests/Issues/Feedback pages,
// so sidebar badges are derived from that same data instead of a separate
// unread-tracking system — a badge clears when the item is actually actioned
// (approved, resolved, responded to), not just viewed.
export const getSuperAdminNavCounts = ({ requests = [], issues = [], feedbackItems = [] } = {}) => ({
  '/super-admin/requests': requests.filter((req) => req.status === 'pending').length,
  '/super-admin/issues': issues.filter((issue) => issue.status !== 'resolved').length,
  '/super-admin/feedback': feedbackItems.filter((item) => item.status !== 'resolved').length,
});
