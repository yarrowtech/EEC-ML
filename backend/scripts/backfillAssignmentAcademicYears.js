require('dotenv').config();

const mongoose = require('mongoose');
const AcademicYear = require('../models/AcademicYear');
const Assignment = require('../models/Assignment');

const applyChanges = process.argv.includes('--apply');

const legacyPublishedFilter = (academicYear) => ({
  schoolId: academicYear.schoolId,
  status: 'active',
  publishedForStudentPortal: true,
  classId: { $ne: null },
  sectionId: { $ne: null },
  teacherId: { $ne: null },
  createdAt: {
    $gte: academicYear.startDate,
    $lte: academicYear.endDate,
  },
  $or: [
    { academicYearId: { $exists: false } },
    { academicYearId: null },
  ],
});

const run = async () => {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUrl) throw new Error('MONGODB_URL, MONGODB_URI, or MONGO_URI is required');

  await mongoose.connect(mongoUrl);

  const activeYears = await AcademicYear.find({ isActive: true })
    .select('_id schoolId name startDate endDate')
    .lean();

  let matchedCount = 0;
  let modifiedCount = 0;

  for (const academicYear of activeYears) {
    if (!academicYear.schoolId || !academicYear.startDate || !academicYear.endDate) continue;

    const filter = legacyPublishedFilter(academicYear);
    const matchingAssignments = await Assignment.countDocuments(filter);
    matchedCount += matchingAssignments;

    if (!applyChanges || matchingAssignments === 0) continue;

    const result = await Assignment.updateMany(filter, {
      $set: {
        academicYearId: academicYear._id,
        sessionName: academicYear.name || '',
      },
    });
    modifiedCount += result.modifiedCount || 0;
  }

  console.log(JSON.stringify({
    mode: applyChanges ? 'apply' : 'dry-run',
    activeYearsChecked: activeYears.length,
    matchedAssignments: matchedCount,
    modifiedAssignments: modifiedCount,
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // Best effort during a failed migration.
  }
  process.exit(1);
});
