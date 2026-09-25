const express = require('express');
const mongoose = require('mongoose');
const Holiday = require('../models/Holiday');
const School = require('../models/School');
const adminAuth = require('../middleware/adminAuth');
const { notifyHolidayChange } = require('../services/schoolCommunication');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const authParent = require('../middleware/authParent');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();

const normalizeHolidayDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const resolveAdminScope = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Valid schoolId is required' });
    return null;
  }
  return { schoolId, campusId: req.campusId || null };
};

const toPublicHoliday = (item) => ({
  _id: item._id,
  name: item.name,
  startDate: item.startDate || item.date,
  endDate: item.endDate || item.startDate || item.date,
  date: item.startDate || item.date,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const resolveHolidayRange = (payload = {}) => {
  const startDate = normalizeHolidayDate(payload.startDate || payload.date);
  const endDate = normalizeHolidayDate(payload.endDate || payload.startDate || payload.date);
  if (!startDate || !endDate) {
    return { error: 'Valid start and end date are required' };
  }
  if (endDate < startDate) {
    return { error: 'End date cannot be before start date' };
  }
  return { startDate, endDate };
};

const buildRangeQuery = (query = {}) => {
  const from = query?.from ? normalizeHolidayDate(query.from) : null;
  const to = query?.to ? normalizeHolidayDate(query.to) : null;
  return { from, to };
};

const intersectsRange = (holiday, from, to) => {
  if (!from && !to) return true;
  const start = normalizeHolidayDate(holiday?.startDate || holiday?.date);
  const end = normalizeHolidayDate(holiday?.endDate || holiday?.startDate || holiday?.date);
  if (!start || !end) return false;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
};

const filterByRange = (items, from, to) => items.filter((item) => intersectsRange(item, from, to));

const sortByRange = (items) =>
  [...items].sort((a, b) => {
    const aDate = new Date(a?.startDate || a?.date || 0).getTime();
    const bDate = new Date(b?.startDate || b?.date || 0).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
  });

const createScopeFilter = (scope) => ({
  schoolId: scope.schoolId,
  ...(scope.campusId ? { campusId: scope.campusId } : {}),
});

const toPublicList = (items) => items.map(toPublicHoliday);

const parseName = (value) => String(value || '').trim();

const resolveNameOrError = (value) => {
  const name = parseName(value);
  if (!name) {
    return { error: 'Holiday name is required' };
  }
  return { name };
};

const jsonError = (res, status, message) => res.status(status).json({ error: message });

const fromQueryToFiltered = (items, query) => {
  const { from, to } = buildRangeQuery(query);
  return filterByRange(items, from, to);
};

const loadScopedHolidays = async (scope) => {
  const items = await Holiday.find(createScopeFilter(scope)).lean();
  return sortByRange(items);
};

const loadPublicHolidays = async (scope, query) => {
  const scoped = await loadScopedHolidays(scope);
  const filtered = fromQueryToFiltered(scoped, query);
  return toPublicList(filtered);
};

router.post('/', adminAuth, async (req, res) => {
  try {
    const scope = resolveAdminScope(req, res);
    if (!scope) return;
    const { name, error: nameError } = resolveNameOrError(req.body?.name);
    if (nameError) return jsonError(res, 400, nameError);
    const { startDate, endDate, error: rangeError } = resolveHolidayRange(req.body || {});
    if (rangeError) return jsonError(res, 400, rangeError);

    const created = await Holiday.create({
      ...createScopeFilter(scope),
      name,
      startDate,
      endDate,
      date: startDate,
      createdBy: req.admin?.id || null,
    });

    notifyHolidayChange({ ...scope, holiday: created, action: 'created', createdBy: req.admin?.id || null })
      .catch((err) => console.error('Failed to send holiday notifications:', err.message));
    return res.status(201).json(toPublicHoliday(created));
  } catch (err) {
    if (err?.code === 11000) {
      return jsonError(res, 409, 'Holiday already exists for this start date');
    }
    return jsonError(res, 400, err.message || 'Unable to create holiday');
  }
});

router.get('/admin', adminAuth, async (req, res) => {
  try {
    const scope = resolveAdminScope(req, res);
    if (!scope) return;
    const items = await loadPublicHolidays(scope, req.query);
    return res.json(items);
  } catch (err) {
    return jsonError(res, 500, err.message || 'Unable to load holidays');
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const scope = resolveAdminScope(req, res);
    if (!scope) return;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return jsonError(res, 400, 'Invalid holiday id');
    }
    const deleted = await Holiday.findOneAndDelete({
      _id: id,
      ...createScopeFilter(scope),
    });
    if (!deleted) {
      return jsonError(res, 404, 'Holiday not found');
    }
    notifyHolidayChange({ ...scope, holiday: deleted, action: 'deleted', createdBy: req.admin?.id || null })
      .catch((err) => console.error('Failed to send holiday notifications:', err.message));
    return res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    return jsonError(res, 500, err.message || 'Unable to delete holiday');
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const scope = resolveAdminScope(req, res);
    if (!scope) return;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return jsonError(res, 400, 'Invalid holiday id');
    }

    const holiday = await Holiday.findOne({
      _id: id,
      ...createScopeFilter(scope),
    });
    if (!holiday) {
      return jsonError(res, 404, 'Holiday not found');
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const { name, error: nameError } = resolveNameOrError(req.body?.name);
      if (nameError) return jsonError(res, 400, nameError);
      holiday.name = name;
    }

    const wantsRangeUpdate =
      Object.prototype.hasOwnProperty.call(req.body || {}, 'startDate')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'endDate')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'date');

    if (wantsRangeUpdate) {
      const startSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'startDate')
        || Object.prototype.hasOwnProperty.call(req.body || {}, 'date')
        ? (req.body?.startDate || req.body?.date)
        : (holiday.startDate || holiday.date);
      const endSource = Object.prototype.hasOwnProperty.call(req.body || {}, 'endDate')
        ? req.body?.endDate
        : (req.body?.startDate || req.body?.date || holiday.endDate || holiday.startDate || holiday.date);

      const { startDate, endDate, error: rangeError } = resolveHolidayRange({
        startDate: startSource,
        endDate: endSource,
      });
      if (rangeError) return jsonError(res, 400, rangeError);
      holiday.startDate = startDate;
      holiday.endDate = endDate;
      holiday.date = startDate;
    }

    await holiday.save();
    // Silent when nothing visible (name/dates) actually changed.
    notifyHolidayChange({ ...scope, holiday, action: 'updated', createdBy: req.admin?.id || null })
      .catch((err) => console.error('Failed to send holiday notifications:', err.message));
    return res.json(toPublicHoliday(holiday));
  } catch (err) {
    if (err?.code === 11000) {
      return jsonError(res, 409, 'Holiday already exists for this start date');
    }
    return jsonError(res, 500, err.message || 'Unable to update holiday');
  }
});

router.get('/teacher', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || null;
    const campusId = req.campusId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return jsonError(res, 400, 'Valid schoolId is required');
    }
    const items = await loadPublicHolidays({ schoolId, campusId }, req.query);
    return res.json(items);
  } catch (err) {
    return jsonError(res, 500, err.message || 'Unable to load holidays');
  }
});

router.get('/student', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'holidays',
      action: 'holidays.fetch',
      targetType: 'student',
      targetId: req.user?.id,
      fromDate: req.query?.from || undefined,
      toDate: req.query?.to || undefined,
    });
    const schoolId = req.schoolId || null;
    const campusId = req.campusId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return jsonError(res, 400, 'Valid schoolId is required');
    }
    const items = await loadPublicHolidays({ schoolId, campusId }, req.query);
    logStudentPortalEvent(req, {
      feature: 'holidays',
      action: 'holidays.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: items.length,
    });
    return res.json(items);
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'holidays',
      action: 'holidays.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    return jsonError(res, 500, err.message || 'Unable to load holidays');
  }
});

router.get('/parent', authParent, async (req, res) => {
  try {
    const schoolId = req.schoolId || null;
    const campusId = req.campusId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return jsonError(res, 400, 'Valid schoolId is required');
    }
    const items = await loadPublicHolidays({ schoolId, campusId }, req.query);
    const school = await School.findById(schoolId).select('name address logo').lean();
    return res.json({
      holidays: items,
      school: {
        name: school?.name || '',
        address: school?.address || '',
        logo: school?.logo?.secure_url || school?.logo?.url || '',
      },
    });
  } catch (err) {
    return jsonError(res, 500, err.message || 'Unable to load holidays');
  }
});

module.exports = router;
