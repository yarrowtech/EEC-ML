import React, { useEffect } from 'react';
import AttendanceFormatSettings from '../components/AttendanceFormatSettings';

// Settings → Attendance Settings: how teachers take student attendance.
const AttendanceSettingsPage = ({ setShowAdminHeader }) => {
  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Attendance Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Decide how student attendance is taken across your school.</p>
      </div>
      <AttendanceFormatSettings />
    </div>
  );
};

export default AttendanceSettingsPage;
