const express = require('express');
const principalAuth = require('../middleware/principalAuth');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StaffUser = require('../models/StaffUser');
const Admin = require('../models/Admin');
const ClassModel = require('../models/Class');
const Subject = require('../models/Subject');
const StudentProgress = require('../models/StudentProgress');
const Exam = require('../models/Exam');
const FeeInvoice = require('../models/FeeInvoice');
const FeePayment = require('../models/FeePayment');
const TeacherExpense = require('../models/TeacherExpense');
const Notification = require('../models/Notification');
const SupportRequest = require('../models/SupportRequest');
const Issue = require('../models/Issue');
const ExamResult = require('../models/ExamResult');
const Holiday = require('../models/Holiday');
const Building = require('../models/Building');
const Floor = require('../models/Floor');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');

const EXPENSE_CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

const router = express.Router();

const getSchoolFilter = (req) => {
  const filter = { schoolId: req.schoolId };
  if (req.campusId) {
    filter.$or = [
      { campusId: req.campusId },
      { campusId: { $exists: false } },
      { campusId: null },
    ];
  }
  return filter;
};

const buildAttendanceTrend = (students, monthsBack = 6) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const bucket = new Map();

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    bucket.set(key, { total: 0, present: 0, label: date.toLocaleString('en-US', { month: 'short' }) });
  }

  students.forEach((student) => {
    (student.attendance || []).forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate < start) return;
      const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      if (!bucket.has(key)) return;
      const data = bucket.get(key);
      data.total += 1;
      if (entry.status === 'present') {
        data.present += 1;
      }
    });
  });

  return Array.from(bucket.values()).map((item) => ({
    month: item.label,
    rate: item.total ? Number(((item.present / item.total) * 100).toFixed(1)) : 0,
  }));
};

router.get('/overview', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    const [
      totalStudents,
      totalTeachers,
      totalStaff,
      totalParents,
      totalClasses,
      totalSubjects,
      studentProgress,
      feeSummary,
    ] = await Promise.all([
      StudentUser.countDocuments(schoolFilter),
      TeacherUser.countDocuments(schoolFilter),
      StaffUser.countDocuments(schoolFilter),
      ParentUser.countDocuments(schoolFilter),
      ClassModel.countDocuments(schoolFilter),
      Subject.countDocuments(schoolFilter),
      StudentProgress.find(schoolFilter, 'overallGrade').lean(),
      FeeInvoice.aggregate([
        { $match: schoolFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            balanceAmount: { $sum: '$balanceAmount' },
          },
        },
      ]),
    ]);

    const students = await StudentUser.find(schoolFilter, 'attendance').lean();
    let present = 0;
    let total = 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    students.forEach((student) => {
      (student.attendance || []).forEach((entry) => {
        const entryDate = new Date(entry.date);
        if (entryDate < cutoff) return;
        total += 1;
        if (entry.status === 'present') {
          present += 1;
        }
      });
    });

    const attendanceRate = total ? Number(((present / total) * 100).toFixed(1)) : 0;
    const attendanceTrend = buildAttendanceTrend(students, 6);

    const gradeMap = studentProgress.reduce((acc, curr) => {
      const grade = curr.overallGrade || 'C';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    const gradeDistribution = Object.entries(gradeMap).map(([grade, count]) => ({
      grade,
      count,
    }));

    const feeTotals = feeSummary[0] || { totalAmount: 0, paidAmount: 0, balanceAmount: 0 };
    const [recentNotifications, recentSupportRequests, recentIssues] = await Promise.all([
      Notification.find(schoolFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title priority createdAt')
        .lean(),
      SupportRequest.find({ schoolId: req.schoolId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('subject status priority createdAt')
        .lean(),
      Issue.find({ schoolId: req.schoolId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title status severity createdAt')
        .lean(),
    ]);

    const recentActivities = [
      ...recentNotifications.map((item) => ({
        id: `notice-${item._id}`,
        type: 'notification',
        action: item.title || 'New notification',
        status: item.priority || 'medium',
        createdAt: item.createdAt,
      })),
      ...recentSupportRequests.map((item) => ({
        id: `support-${item._id}`,
        type: 'support',
        action: item.subject || 'Support request raised',
        status: item.status || 'open',
        createdAt: item.createdAt,
      })),
      ...recentIssues.map((item) => ({
        id: `issue-${item._id}`,
        type: 'issue',
        action: item.title || 'Issue reported',
        status: item.status || item.severity || 'open',
        createdAt: item.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalStaff,
        totalParents,
        totalClasses,
        totalSubjects,
      },
      attendance: {
        rate: attendanceRate,
        present,
        total,
        trend: attendanceTrend,
      },
      fees: {
        totalAmount: feeTotals.totalAmount || 0,
        paidAmount: feeTotals.paidAmount || 0,
        balanceAmount: feeTotals.balanceAmount || 0,
      },
      performance: {
        gradeDistribution,
      },
      recentActivities,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students/analytics', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);
    const students = await StudentUser.find(schoolFilter, 'name grade attendance').lean();
    const studentIds = students.map((student) => student._id);

    const progressFilter = { schoolId: req.schoolId };
    if (studentIds.length > 0) {
      progressFilter.studentId = { $in: studentIds };
    }
    const studentProgressList = await StudentProgress.find(progressFilter, 'studentId overallGrade').lean();
    const gradeMap = studentProgressList.reduce((acc, item) => {
      const grade = item.overallGrade || 'C';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    const progressByStudent = new Map(
      studentProgressList.map((item) => [String(item.studentId), item.overallGrade || 'C'])
    );

    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    let attendanceTotal = 0;
    let attendancePresent = 0;

    const topStudents = students
      .map((student) => {
        let total = 0;
        let present = 0;
        (student.attendance || []).forEach((entry) => {
          const entryDate = new Date(entry.date);
          if (entryDate < last30) return;
          total += 1;
          if (entry.status === 'present') {
            present += 1;
          }
        });

        attendanceTotal += total;
        attendancePresent += present;
        return {
          id: student._id,
          name: student.name || 'Student',
          grade: student.grade || 'N/A',
          overallGrade: progressByStudent.get(String(student._id)) || 'C',
          attendanceRate: total ? Number(((present / total) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10);

    const highPerformers = (gradeMap['A+'] || 0) + (gradeMap.A || 0);
    const weakStudents = (gradeMap.D || 0) + (gradeMap.F || 0);

    res.json({
      summary: {
        totalStudents: students.length,
        attendanceRate: attendanceTotal
          ? Number(((attendancePresent / attendanceTotal) * 100).toFixed(1))
          : 0,
        gradedStudents: studentProgressList.length,
        highPerformers,
        weakStudents,
      },
      gradeDistribution: Object.entries(gradeMap)
        .map(([grade, count]) => ({ grade, students: count }))
        .sort((a, b) => b.students - a.students),
      topStudents,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staff/analytics', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);
    const adminFilter = req.campusId ? { ...schoolFilter, campusId: req.campusId } : schoolFilter;

    const [teachers, totalSupportStaff, totalAdmins] = await Promise.all([
      TeacherUser.find(schoolFilter, 'name subject department lastLoginAt').lean(),
      StaffUser.countDocuments(schoolFilter),
      Admin.countDocuments({ ...adminFilter, role: 'admin' }),
    ]);

    const teacherBySubject = teachers.reduce((acc, teacher) => {
      const key = teacher.subject || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const activeTeachers = teachers.filter((teacher) => {
      if (!teacher.lastLoginAt) return false;
      return new Date(teacher.lastLoginAt) >= last30;
    }).length;

    res.json({
      summary: {
        totalTeachers: teachers.length,
        activeTeachers,
        onLeaveTeachers: Math.max(teachers.length - activeTeachers, 0),
        supportStaff: totalSupportStaff,
        admins: totalAdmins,
      },
      staffRoles: [
        { role: 'Teachers', count: teachers.length },
        { role: 'Support Staff', count: totalSupportStaff },
        { role: 'Admin', count: totalAdmins },
      ],
      teacherBySubject: Object.entries(teacherBySubject).map(([subject, count]) => ({ subject, count })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/directory', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    const [teachers, staff, parents] = await Promise.all([
      TeacherUser.find(schoolFilter).select('name subject department email mobile lastLoginAt').lean(),
      StaffUser.find(schoolFilter).select('name role department email phone').lean(),
      ParentUser.find(schoolFilter).select('name email mobile phone').lean(),
    ]);

    const directory = [
      ...teachers.map((t) => ({
        id: t._id,
        role: 'Teacher',
        name: t.name || 'Teacher',
        subject: t.subject || '',
        department: t.department || '',
        email: t.email || '',
        phone: t.mobile || '',
      })),
      ...staff.map((s) => ({
        id: s._id,
        role: 'Staff',
        name: s.name || 'Staff',
        subject: '',
        department: s.department || '',
        email: s.email || '',
        phone: s.phone || '',
      })),
      ...parents.map((p) => ({
        id: p._id,
        role: 'Parent',
        name: p.name || 'Parent',
        subject: '',
        department: '',
        email: p.email || '',
        phone: p.mobile || p.phone || '',
      })),
    ];

    res.json(directory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teachers', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);
    const teachers = await TeacherUser.find(schoolFilter).select('-password').lean();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/academic/analytics', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);
    const progressFilter = { schoolId: req.schoolId };

    const [
      students,
      studentProgressList,
      exams,
      classes,
      subjects,
    ] = await Promise.all([
      StudentUser.find(schoolFilter, '_id name grade attendance').lean(),
      StudentProgress.find(progressFilter).lean(),
      Exam.find(schoolFilter).sort({ date: 1 }).limit(10).lean(),
      ClassModel.find(schoolFilter).lean(),
      Subject.find(schoolFilter).lean(),
    ]);

    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    // Grade Distribution
    const gradeMap = studentProgressList.reduce((acc, curr) => {
      const grade = curr.overallGrade || 'C';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    const totalGraded = studentProgressList.length || 1;
    const gradeDistribution = Object.entries(gradeMap).map(([grade, count]) => ({
      grade,
      count,
      percentage: Number(((count / totalGraded) * 100).toFixed(1)),
      color: grade.startsWith('A') ? 'emerald' : grade.startsWith('B') ? 'blue' : grade.startsWith('C') ? 'yellow' : 'red',
    })).sort((a, b) => b.count - a.count);

    // Subject Performance
    const subjectMap = new Map();
    studentProgressList.forEach((progress) => {
      (progress.progressMetrics || []).forEach((metric) => {
        if (!subjectMap.has(metric.subject)) {
          subjectMap.set(metric.subject, {
            totalScore: 0,
            count: 0,
            above80: 0,
          });
        }
        const data = subjectMap.get(metric.subject);
        data.totalScore += metric.averageScore || 0;
        data.count += 1;
        if ((metric.averageScore || 0) >= 80) {
          data.above80 += 1;
        }
      });
    });

    const subjectPerformance = Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      avgScore: Number((data.totalScore / (data.count || 1)).toFixed(1)),
      improvement: 0, // Mocked for now
      studentsAbove80: data.above80,
      totalStudents: data.count,
      trend: 'up',
    })).sort((a, b) => b.avgScore - a.avgScore);

    // Class Analytics
    const classAnalyticsMap = new Map();
    studentProgressList.forEach((progress) => {
      const student = studentMap.get(String(progress.studentId));
      if (!student) return;
      const grade = student.grade || 'N/A';
      if (!classAnalyticsMap.has(grade)) {
        classAnalyticsMap.set(grade, {
          totalStudents: 0,
          totalGPA: 0,
          topPerformers: 0,
          needsSupport: 0,
        });
      }
      const data = classAnalyticsMap.get(grade);
      data.totalStudents += 1;
      // Map overallGrade to a numeric value for "GPA" calculation
      const gradeValues = { 'A+': 4, 'A': 4, 'B+': 3.5, 'B': 3, 'C+': 2.5, 'C': 2, 'D': 1, 'F': 0 };
      data.totalGPA += gradeValues[progress.overallGrade] || 2;
      if (['A+', 'A'].includes(progress.overallGrade)) {
        data.topPerformers += 1;
      }
      if (['D', 'F'].includes(progress.overallGrade)) {
        data.needsSupport += 1;
      }
    });

    const classAnalytics = Array.from(classAnalyticsMap.entries()).map(([grade, data]) => ({
      grade,
      totalStudents: data.totalStudents,
      avgGPA: Number((data.totalGPA / (data.totalStudents || 1)).toFixed(1)),
      topPerformers: data.topPerformers,
      needsSupport: data.needsSupport,
    }));

    // Exam Schedule
    const examSchedule = exams.map((exam) => ({
      exam: exam.title || exam.term || 'Exam',
      date: exam.date,
      status: new Date(exam.date) < new Date() ? 'completed' : 'upcoming',
      subjects: 1,
    }));

    // Academic Overview
    const totalGPA = studentProgressList.reduce((acc, curr) => {
      const gradeValues = { 'A+': 100, 'A': 90, 'B+': 80, 'B': 70, 'C+': 60, 'C': 50, 'D': 40, 'F': 30 };
      return acc + (gradeValues[curr.overallGrade] || 50);
    }, 0);

    const academicOverview = {
      averageGPA: `${Number((totalGPA / (studentProgressList.length || 1)).toFixed(1))}%`,
      passRate: Number(((studentProgressList.filter(p => p.overallGrade !== 'F').length / (studentProgressList.length || 1)) * 100).toFixed(1)),
      honorsStudents: studentProgressList.filter(p => ['A+', 'A'].includes(p.overallGrade)).length,
      improvementRate: 0,
      attendanceRate: 0,
      homeworkCompletion: 0,
    };

    // Calculate attendance rate for academic overview
    let attTotal = 0;
    let attPresent = 0;
    students.forEach(s => {
      (s.attendance || []).forEach(e => {
        attTotal++;
        if (e.status === 'present') attPresent++;
      });
    });
    academicOverview.attendanceRate = attTotal ? Number(((attPresent / attTotal) * 100).toFixed(1)) : 0;

    res.json({
      academicOverview,
      gradeDistribution,
      subjectPerformance,
      classAnalytics,
      examSchedule,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/financial', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    // Get all students for the school/campus
    const students = await StudentUser.find(schoolFilter)
      .select('name grade section')
      .lean();
    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    // Build invoice filter
    const invoiceFilter = { ...schoolFilter };
    if (studentIds.length > 0) {
      invoiceFilter.studentId = { $in: studentIds };
    }

    // Get all invoices
    const invoices = await FeeInvoice.find(invoiceFilter).lean();

    // Calculate totals
    const totals = invoices.reduce(
      (acc, inv) => {
        acc.totalInvoiced += Number(inv.totalAmount || 0);
        acc.totalCollected += Number(inv.paidAmount || 0);
        acc.totalOutstanding += Number(inv.balanceAmount || 0);
        return acc;
      },
      {
        totalOutstanding: 0,
        totalCollected: 0,
        totalInvoiced: 0,
      }
    );

    // Calculate overdue invoices
    const today = new Date();
    const overdueInvoices = invoices.filter(
      (inv) => inv.dueDate && new Date(inv.dueDate) < today && Number(inv.balanceAmount || 0) > 0
    ).length;

    // Get recent payments
    const payments = await FeePayment.find(invoiceFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentPayments = payments.map((payment) => {
      const student = studentMap.get(String(payment.studentId));
      return {
        id: payment._id,
        studentName: student?.name || 'Student',
        className: student?.grade || '',
        section: student?.section || '',
        amount: payment.amount,
        paidOn: payment.paidOn || payment.createdAt,
        method: payment.method || 'cash',
        status: 'paid',
      };
    });

    // Calculate monthly revenue trend (last 8 months)
    const monthlyData = {};
    const now = new Date();

    // Initialize last 8 months
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthlyData[key] = {
        month: monthNames[d.getMonth()],
        revenue: 0,
        expenses: 0,
      };
    }

    // Aggregate payments by month
    payments.forEach((payment) => {
      const date = new Date(payment.paidOn || payment.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].revenue += Number(payment.amount || 0);
      }
    });

    // Real expense data: approved teacher expense claims (the only expense ledger in this system)
    const approvedExpenses = await TeacherExpense.find({ ...schoolFilter, status: 'Approved' }).lean();
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    approvedExpenses.forEach((expense) => {
      const date = new Date(expense.expenseDate);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].expenses += Number(expense.amount || 0);
      }
    });

    const revenueData = Object.values(monthlyData);

    const expenseCategoryTotals = new Map();
    approvedExpenses.forEach((expense) => {
      const category = expense.category || 'Other';
      expenseCategoryTotals.set(category, (expenseCategoryTotals.get(category) || 0) + Number(expense.amount || 0));
    });

    const expenseData = Array.from(expenseCategoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], index) => ({
        name,
        amount: Math.round(amount),
        value: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
        color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
      }));

    res.json({
      totals: {
        totalRevenue: Math.round(totals.totalCollected),
        totalExpenses: Math.round(totalExpenses),
        totalInvoiced: Math.round(totals.totalInvoiced),
        totalOutstanding: Math.round(totals.totalOutstanding),
        netProfit: Math.round(totals.totalCollected - totalExpenses),
        budgetUtilization: totals.totalInvoiced > 0
          ? Math.round((totals.totalCollected / totals.totalInvoiced) * 100)
          : 0,
        overdueInvoices,
      },
      revenueData,
      expenseData,
      expenseDataNote: 'Expense figures reflect approved teacher expense claims only; this system does not track payroll or infrastructure spend separately.',
      recentPayments,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/facilities', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    const [buildings, floors, rooms] = await Promise.all([
      Building.find(schoolFilter).sort({ order: 1, name: 1 }).lean(),
      Floor.find(schoolFilter)
        .populate('buildingId', 'name code order isActive')
        .sort({ order: 1, name: 1 })
        .lean(),
      Room.find(schoolFilter)
        .populate({
          path: 'floorId',
          select: 'name floorCode order isActive buildingId',
          populate: { path: 'buildingId', select: 'name code' },
        })
        .sort({ roomNumber: 1 })
        .lean(),
    ]);

    const roomIds = rooms.map((r) => r._id);
    const [examRoomIds, timetableRoomIds] = await Promise.all([
      roomIds.length
        ? Exam.find({ ...schoolFilter, roomId: { $in: roomIds } }).distinct('roomId')
        : [],
      roomIds.length
        ? Timetable.find({ ...schoolFilter, 'entries.roomId': { $in: roomIds } }).distinct('entries.roomId')
        : [],
    ]);
    const occupiedRoomIds = new Set([
      ...examRoomIds.map((id) => String(id)),
      ...timetableRoomIds.map((id) => String(id)),
    ]);

    const roomsWithUsage = rooms.map((room) => ({
      ...room,
      inUse: occupiedRoomIds.has(String(room._id)),
    }));

    const floorsByBuilding = new Map();
    floors.forEach((floor) => {
      const buildingId = String(floor.buildingId?._id || floor.buildingId || '');
      if (!floorsByBuilding.has(buildingId)) floorsByBuilding.set(buildingId, []);
      floorsByBuilding.get(buildingId).push(floor);
    });

    const roomsByFloor = new Map();
    roomsWithUsage.forEach((room) => {
      const floorId = String(room.floorId?._id || room.floorId || '');
      if (!roomsByFloor.has(floorId)) roomsByFloor.set(floorId, []);
      roomsByFloor.get(floorId).push(room);
    });

    const buildingsWithHierarchy = buildings.map((building) => ({
      ...building,
      floors: (floorsByBuilding.get(String(building._id)) || []).map((floor) => ({
        ...floor,
        rooms: roomsByFloor.get(String(floor._id)) || [],
      })),
    }));

    res.json({
      summary: {
        totalBuildings: buildings.length,
        totalFloors: floors.length,
        totalRooms: rooms.length,
        occupiedRooms: roomsWithUsage.filter((r) => r.inUse).length,
        freeRooms: roomsWithUsage.filter((r) => !r.inUse).length,
      },
      buildings: buildingsWithHierarchy,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/calendar', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    const [holidays, exams] = await Promise.all([
      Holiday.find(schoolFilter).lean(),
      Exam.find(schoolFilter).lean(),
    ]);

    const events = [
      ...holidays.map((h) => ({
        id: `holiday-${h._id}`,
        type: 'holiday',
        title: h.name,
        date: h.startDate || h.date,
        endDate: h.endDate || h.startDate || h.date,
      })),
      ...exams.map((e) => ({
        id: `exam-${e._id}`,
        type: 'exam',
        title: e.title || e.term || 'Exam',
        date: e.date,
        subject: e.subject || '',
      })),
    ]
      .filter((event) => event.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      events,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const schoolFilter = getSchoolFilter(req);

    const [students, examResults, feeSummary, approvedExpenses] = await Promise.all([
      StudentUser.find(schoolFilter, 'attendance').lean(),
      ExamResult.find(schoolFilter).lean(),
      FeeInvoice.aggregate([
        { $match: schoolFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            balanceAmount: { $sum: '$balanceAmount' },
          },
        },
      ]),
      TeacherExpense.find({ ...schoolFilter, status: 'Approved' }, 'amount').lean(),
    ]);

    const attendanceTrend = buildAttendanceTrend(students, 6);

    const gradedTotal = examResults.length || 1;
    const passCount = examResults.filter((r) => r.status === 'pass').length;
    const failCount = examResults.filter((r) => r.status === 'fail').length;
    const absentCount = examResults.filter((r) => r.status === 'absent').length;

    const gradeMap = examResults.reduce((acc, r) => {
      const grade = r.grade || 'Ungraded';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    const feeTotals = feeSummary[0] || { totalAmount: 0, paidAmount: 0, balanceAmount: 0 };
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    res.json({
      academic: {
        totalResults: examResults.length,
        passRate: Number(((passCount / gradedTotal) * 100).toFixed(1)),
        failRate: Number(((failCount / gradedTotal) * 100).toFixed(1)),
        absentRate: Number(((absentCount / gradedTotal) * 100).toFixed(1)),
        gradeDistribution: Object.entries(gradeMap).map(([grade, count]) => ({ grade, count })),
      },
      attendance: {
        trend: attendanceTrend,
      },
      financial: {
        totalRevenue: Math.round(feeTotals.paidAmount || 0),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round((feeTotals.paidAmount || 0) - totalExpenses),
        totalOutstanding: Math.round(feeTotals.balanceAmount || 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-message', principalAuth, async (req, res) => {
  // #swagger.tags = ['Principal Dashboard']
  try {
    const { title, message, recipients, audience, channelEmail, channelSms, priority, category } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    // Map audience from Principal's dropdown to Notification model's audience
    let resolvedAudience = 'All';
    if (audience === 'Teachers') resolvedAudience = 'Teacher';
    else if (audience === 'Parents') resolvedAudience = 'Parent';
    else if (audience === 'Staff') resolvedAudience = 'Staff';

    const notification = await Notification.create({
      schoolId: req.schoolId,
      campusId: req.campusId || null,
      title: String(title).trim(),
      message: String(message).trim(),
      audience: resolvedAudience,
      targetUserIds: Array.isArray(recipients) ? recipients : [],
      createdBy: req.principal?.id || null,
      createdByType: 'Principal',
      createdByName: req.principal?.name || 'Principal',
      type: 'announcement',
      priority: priority || 'medium',
      category: category || 'general',
      metadata: { channelEmail, channelSms }
    });

    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
