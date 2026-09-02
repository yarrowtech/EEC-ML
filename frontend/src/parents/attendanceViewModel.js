export const getLocalMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const mapAttendanceChildForDashboard = (child = {}) => {
  const monthlySummary = child.monthlySummary || {};

  return {
    ...(child.student || {}),
    attendancePercentage: monthlySummary.attendancePercentage ?? 0,
    presentDays: monthlySummary.presentDays ?? 0,
    totalDays: monthlySummary.totalClasses ?? 0,
  };
};
