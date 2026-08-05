// frontend/src/admin/pages/ArchivedStudents.jsx
import React, { useEffect, useState } from "react";
import { FileDown } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL;

const ArchivedStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const fetchArchived = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/nif/students/archived`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load archived students:", err);
      setError("Failed to load archived students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const downloadCSV = async () => {
    try {
      setExporting(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/nif/students/archived/export`, {
        headers: { authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('Unable to export archived students');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'archived-students.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export archived students:', err);
      setError('Failed to export archived students.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-yellow-50">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-yellow-700">
            Archived Students
          </h1>

          <button
            onClick={downloadCSV}
            disabled={exporting}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <FileDown size={16} />
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Table */}
        <table className="w-full border border-yellow-200 rounded-lg">
          <thead className="bg-yellow-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Course</th>
              <th className="p-3 text-left">Batch</th>
              <th className="p-3 text-left">Passed Out</th>
              <th className="p-3 text-left">Paid</th>
              <th className="p-3 text-left">Archived At</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500">
                  Loading archived students...
                </td>
              </tr>
            )}

            {!loading &&
              students.map((s) => (
                <tr key={s._id} className="border-t">
                  <td className="p-3">{s.studentName}</td>
                  <td className="p-3">{s.course}</td>
                  <td className="p-3">{s.batchCode}</td>
                  <td className="p-3">{s.passedOutYear}</td>
                  <td className="p-3">₹{s.feeSummary?.totalPaid}</td>
                  <td className="p-3">
                    {s.archivedAt
                      ? new Date(s.archivedAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}

            {!loading && students.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-500">
                  No archived students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedStudents;
