import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserCheck, Search, Calendar, Download, Users, Clock, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const formatStatus = (value) => {
  if (value === 'present') return 'Present';
  if (value === 'absent') return 'Absent';
  return 'Not Marked';
};

const getCheckInTime = (recordDate) => {
  if (!recordDate) return '-';
  const date = new Date(recordDate);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const AttendanceManagement = ({ setShowAdminHeader }) => {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingStudentId, setSavingStudentId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromMonth, setExportFromMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exportToMonth, setExportToMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    setShowAdminHeader(false);
  }, [setShowAdminHeader]);

  // Rapid date/month changes can leave two requests in flight; without this
  // guard, a slower response for an earlier date can resolve after a newer
  // one and silently overwrite `allRows` with attendance for the wrong date.
  const loadAttendanceRequestIdRef = useRef(0);

  const loadAttendance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      setLoading(false);
      return;
    }

    const requestId = ++loadAttendanceRequestIdRef.current;
    const isStale = () => loadAttendanceRequestIdRef.current !== requestId;

    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        date: selectedDate,
        month: selectedMonth,
      });

      const response = await fetch(`${API_BASE}/api/attendance/admin/students?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load attendance');
      }
      if (isStale()) return;

      const rows = Array.isArray(data?.students)
        ? data.students.map((student) => {
            const status = student?.selectedDateRecord?.status || '';
            return {
              id: student._id,
              username: student.username || '',
              name: student.name || 'Student',
              roll: student.roll || '',
              session: student.session || '',
              className: student.className || '',
              section: student.section || '',
              status,
              statusLabel: formatStatus(status),
              checkInTime: getCheckInTime(student?.selectedDateRecord?.date),
              overallSummary: student?.overallSummary || student?.monthlySummary || {
                totalClasses: 0,
                presentDays: 0,
                absentDays: 0,
                attendancePercentage: 0,
              },
            };
          })
        : [];

      setAllRows(rows);
    } catch (err) {
      if (isStale()) return;
      setError(err.message || 'Unable to load attendance data');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [selectedDate, selectedMonth]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const sessionOptions = useMemo(
    () => [...new Set(allRows.map((item) => item.session).filter(Boolean))],
    [allRows]
  );

  const classOptions = useMemo(() => {
    const source = selectedSession ? allRows.filter((item) => item.session === selectedSession) : allRows;
    return [...new Set(source.map((item) => item.className).filter(Boolean))];
  }, [allRows, selectedSession]);

  const sectionOptions = useMemo(() => {
    const source = allRows.filter(
      (item) => (!selectedSession || item.session === selectedSession) && (!selectedClass || item.className === selectedClass)
    );
    return [...new Set(source.map((item) => item.section).filter(Boolean))];
  }, [allRows, selectedClass, selectedSession]);

  const studentOptions = useMemo(() => {
    const source = allRows.filter(
      (item) =>
        (!selectedSession || item.session === selectedSession) &&
        (!selectedClass || item.className === selectedClass) &&
        (!selectedSection || item.section === selectedSection)
    );
    return source
      .map((item) => ({ id: item.id, name: item.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows, selectedClass, selectedSection, selectedSession]);

  const filteredRows = useMemo(
    () =>
      allRows.filter((item) => {
        if (selectedSession && item.session !== selectedSession) return false;
        if (selectedClass && item.className !== selectedClass) return false;
        if (selectedSection && item.section !== selectedSection) return false;
        if (selectedStudent && item.id !== selectedStudent) return false;
        if (searchTerm.trim() && !item.name.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
        return true;
      }),
    [allRows, searchTerm, selectedClass, selectedSection, selectedSession, selectedStudent]
  );

  const presentStudents = useMemo(
    () => filteredRows.filter((item) => item.status === 'present').length,
    [filteredRows]
  );

  // Per-student sequence guard: toggling the same student's status twice in
  // quick succession (e.g. present → absent → present) fires two requests,
  // and whichever happens to resolve LAST wins — which may not be the one
  // the admin clicked last. Track a sequence number per student so only the
  // most-recently-issued request for that student is allowed to apply.
  const attendanceToggleSeqRef = useRef({});

  const upsertAttendance = async (studentId, status) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const seq = (attendanceToggleSeqRef.current[studentId] = (attendanceToggleSeqRef.current[studentId] || 0) + 1);
    const isStale = () => attendanceToggleSeqRef.current[studentId] !== seq;

    setSavingStudentId(studentId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE}/api/attendance/admin/bulk-upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          entries: [{ studentId, status }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save attendance');
      }
      if (isStale()) return;

      setAllRows((prev) =>
        prev.map((item) =>
          item.id === studentId
            ? {
                ...item,
                status,
                statusLabel: formatStatus(status),
                checkInTime: status === 'present' ? getCheckInTime(new Date().toISOString()) : '-',
              }
            : item
        )
      );
      setSuccess('Attendance updated');
    } catch (err) {
      if (isStale()) return;
      setError(err.message || 'Could not update attendance');
    } finally {
      if (!isStale()) setSavingStudentId('');
    }
  };

  const listMonthsInRange = (fromMonth, toMonth) => {
    const result = [];
    const [fromYear, fromMon] = String(fromMonth).split('-').map(Number);
    const [toYear, toMon] = String(toMonth).split('-').map(Number);
    if (!fromYear || !fromMon || !toYear || !toMon) return result;
    const cursor = new Date(fromYear, fromMon - 1, 1);
    const end = new Date(toYear, toMon - 1, 1);
    while (cursor <= end) {
      result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  };

  const applyCenterAlignment = (worksheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[addr]) continue;
        worksheet[addr].s = {
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
  };

  const exportToExcel = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!exportFromMonth || !exportToMonth) {
      setError('Please select export from and to month.');
      return;
    }
    if (exportFromMonth > exportToMonth) {
      setError('From month must be before or equal to To month.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const months = listMonthsInRange(exportFromMonth, exportToMonth);
      if (!months.length) {
        setError('Invalid month range selected.');
        return;
      }

      const aggregateByStudent = new Map();
      for (const month of months) {
        const query = new URLSearchParams({
          month,
          date: `${month}-01`,
        });
        const response = await fetch(`${API_BASE}/api/attendance/admin/students?${query.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || `Failed to load attendance for ${month}`);
        }
        const students = Array.isArray(data?.students) ? data.students : [];
        students.forEach((student) => {
          const id = String(student?._id || '');
          if (!id) return;
          const monthly = student?.monthlySummary || { totalClasses: 0, presentDays: 0, absentDays: 0 };
          if (!aggregateByStudent.has(id)) {
            aggregateByStudent.set(id, {
              id,
              username: student?.username || '',
              name: student?.name || 'Student',
              roll: student?.roll || '',
              className: student?.className || '',
              section: student?.section || '',
              totalClasses: 0,
              presentDays: 0,
              absentDays: 0,
            });
          }
          const row = aggregateByStudent.get(id);
          row.totalClasses += Number(monthly.totalClasses || 0);
          row.presentDays += Number(monthly.presentDays || 0);
          row.absentDays += Number(monthly.absentDays || 0);
        });
      }

      const sourceRows = [...aggregateByStudent.values()];
      if (!sourceRows.length) {
        setError('No attendance data available for selected range.');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const groupedByClass = sourceRows.reduce((acc, row) => {
        const classKey = String(row.className || 'Unassigned');
        if (!acc[classKey]) acc[classKey] = [];
        acc[classKey].push(row);
        return acc;
      }, {});

      const classNames = Object.keys(groupedByClass).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      classNames.forEach((className) => {
        const sorted = groupedByClass[className]
          .sort((a, b) => String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true })
            || Number(a.roll || 0) - Number(b.roll || 0)
            || String(a.name || '').localeCompare(String(b.name || '')));

        const sheetRows = sorted.map((student, idx) => ({
          ID: idx + 1,
          Username: student.username || '-',
          Name: student.name || '-',
          'Roll No': student.roll || '-',
          Class: student.className || '-',
          Section: student.section || '-',
          'Present Days': Number(student.presentDays || 0),
          'Absent Days': Number(student.absentDays || 0),
          Attendance: student.totalClasses > 0
            ? `${Math.round((student.presentDays / student.totalClasses) * 100)}%`
            : '0%',
        }));

        const worksheet = XLSX.utils.json_to_sheet(sheetRows);
        worksheet['!cols'] = [
          { wch: 8 },
          { wch: 24 },
          { wch: 26 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 14 },
          { wch: 14 },
          { wch: 12 },
        ];
        applyCenterAlignment(worksheet);
        const safeSheetName = String(className || 'Class').slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      });

      XLSX.writeFile(workbook, `attendance-report-${exportFromMonth}-to-${exportToMonth}.xlsx`);
      setSuccess('Attendance report exported successfully.');
      setShowExportModal(false);
    } catch (err) {
      setError(err.message || 'Failed to export attendance report.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Student Attendance</h1>
            <p className="text-yellow-100">Session, class, section and student from database</p>
          </div>
          <UserCheck className="w-12 h-12 text-yellow-200" />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search students"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value);
              setSelectedClass('');
              setSelectedSection('');
              setSelectedStudent('');
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">Session</option>
            {sessionOptions.map((session) => (
              <option key={session} value={session}>{session}</option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection('');
              setSelectedStudent('');
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">Class</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setSelectedStudent('');
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">Section</option>
            {sectionOptions.map((section) => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>

          {/* <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">Student</option>
            {studentOptions.map((student) => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </select> */}

          <div className="md:col-span-2 xl:col-span-6 flex flex-wrap items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex items-center space-x-2 bg-yellow-500 text-black px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
        {success ? <p className="text-sm text-green-700 mt-3">{success}</p> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-2xl font-bold text-gray-900">{filteredRows.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Present</p>
          <p className="text-2xl font-bold text-green-600">{presentStudents}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Absent/Unmarked</p>
          <p className="text-2xl font-bold text-red-600">{filteredRows.length - presentStudents}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Student</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Session</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Class</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Section</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Check-in</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 border border-gray-200">Tick</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 border border-gray-200">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading attendance...
                    </span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 border border-gray-200">
                    No students found for selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((student) => (
                  <tr key={student.id} className="hover:bg-yellow-50">
                    <td className="px-4 py-3 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-yellow-700" />
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border text-gray-900 text-center border-gray-200">{student.session || '-'}</td>
                    <td className="px-4 py-3 border text-gray-900 text-center border-gray-200">{student.className || '-'}</td>
                    <td className="px-4 py-3 border text-gray-900 text-center border-gray-200">{student.section || '-'}</td>
                    <td className="px-4 py-3 border text-gray-900 text-center border-gray-200">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          student.status === 'present'
                            ? 'bg-green-100 text-green-700'
                            : student.status === 'absent'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {student.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 border text-gray-900 text-center border-gray-200">
                      <div className="flex items-center justify-center gap-1 text-gray-700">
                        <Clock className="w-4 h-4" />
                        <span>{student.checkInTime}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border border-gray-200 text-center">
                      <label className="inline-flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={student.status === 'present'}
                          onChange={(e) => upsertAttendance(student.id, e.target.checked ? 'present' : 'absent')}
                          disabled={savingStudentId === student.id}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-60"
                          title={student.status === 'present' ? 'Marked present' : 'Marked absent'}
                        />
                        {savingStudentId === student.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : null}
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl p-5">
            <h3 className="text-lg font-bold text-gray-900">Export Attendance Report</h3>
            <p className="text-sm text-gray-500 mt-1">Select month range to download class-wise Excel sheets.</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Month</label>
                <input
                  type="month"
                  value={exportFromMonth}
                  onChange={(e) => setExportFromMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To Month</label>
                <input
                  type="month"
                  value={exportToMonth}
                  onChange={(e) => setExportToMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportToExcel}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-600 font-semibold"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
