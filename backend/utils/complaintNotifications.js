const Notification = require('../models/Notification');

// Bell notifications for the parent-complaint flow.
//   created → the assignee (class teacher / school admins). Super-admin tickets
//             surface through the Super Admin "Issues" badge instead, since a
//             platform-level super admin has no per-school notification feed.
//   status change → the parent who raised it.
// Failures are logged, never thrown: a notification must not block the ticket.

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

const safeCreate = async (doc, context) => {
  try {
    await Notification.create(doc);
  } catch (err) {
    console.warn(`Complaint notification failed (${context})`, err.message);
  }
};

const notifyComplaintCreated = async (ticket) => {
  if (!ticket?.schoolId) return;
  const parentName = ticket.requestDetails?.parentName || ticket.createdByName || 'A parent';
  const base = {
    schoolId: ticket.schoolId,
    title: 'New parent complaint',
    message: `${parentName} raised "${ticket.subject}" (${ticket.category || 'General'}, ${ticket.priority} priority). Ticket ${ticket.ticketNumber}.`,
    type: 'alert',
    kind: 'notification',
    eventType: 'COMPLAINT_CREATED',
    priority: ticket.priority === 'critical' || ticket.priority === 'high' ? 'high' : 'medium',
    category: 'general',
    createdByType: 'parent',
    createdByName: parentName,
  };

  if (ticket.targetRole === 'teacher' && ticket.requestDetails?.teacherId) {
    await safeCreate({
      ...base,
      audience: 'Teacher',
      targetRole: 'teacher',
      targetUserIds: [ticket.requestDetails.teacherId],
    }, 'teacher');
  } else if (ticket.targetRole === 'admin') {
    await safeCreate({ ...base, audience: 'Admin', targetRole: 'admin' }, 'admin');
  }
};

const notifyParentComplaintStatus = async (ticket, { previousStatus, actorName } = {}) => {
  const parentId = ticket?.requestDetails?.parentId;
  if (!ticket?.schoolId || !parentId || ticket.createdByRole !== 'parent') return;
  if (!ticket.status || ticket.status === previousStatus) return;

  const label = STATUS_LABELS[ticket.status] || ticket.status;
  const note = ticket.resolutionNotes ? ` Note: ${String(ticket.resolutionNotes).slice(0, 200)}` : '';
  await safeCreate({
    schoolId: ticket.schoolId,
    title: `Complaint ${label.toLowerCase()}`,
    message: `Your complaint "${ticket.subject}" (${ticket.ticketNumber}) is now ${label}${actorName ? ` — updated by ${actorName}` : ''}.${note}`,
    audience: 'Parent',
    targetRole: 'parent',
    targetUserIds: [parentId],
    type: 'general',
    kind: 'notification',
    eventType: 'COMPLAINT_STATUS_CHANGED',
    priority: ticket.status === 'resolved' ? 'medium' : 'low',
    category: 'general',
    createdByType: 'admin',
    createdByName: actorName || '',
  }, 'parent');
};

module.exports = { notifyComplaintCreated, notifyParentComplaintStatus };
