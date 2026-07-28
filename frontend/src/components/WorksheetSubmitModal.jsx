import React, { useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const WorksheetSubmitModal = ({ assignment, onClose, onSubmitted }) => {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!assignment) return null;

  const format = assignment.submissionFormat || 'text';

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    setError('');
    if (format === 'text' && !submissionText.trim()) {
      setError('Please write a response before submitting.');
      return;
    }
    if (format === 'pdf' && !file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      let attachmentUrl = '';

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'worksheets');
        formData.append('tags', 'worksheet,student_submission');
        const uploadRes = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error('File upload failed');
        const uploadData = await uploadRes.json();
        attachmentUrl = uploadData.files?.[0]?.secure_url || '';
      }

      const submitRes = await fetch(`${API_BASE}/api/assignment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assignmentId: assignment._id,
          submissionText: submissionText || '',
          attachmentUrl,
        }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData?.error || 'Submission failed');

      setSuccess(true);
      setTimeout(() => { onSubmitted?.(); onClose?.(); }, 1800);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Upload className="size-5 text-indigo-500" />
            <p className="font-bold text-slate-800">Submit Worksheet</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-14 text-emerald-500" />
              <p className="text-lg font-black text-emerald-700">Submitted!</p>
              <p className="text-sm text-slate-500 mt-1">Your worksheet has been submitted successfully.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Assignment</p>
                <p className="text-sm font-bold text-slate-800 line-clamp-2">{assignment.title || 'Worksheet'}</p>
                {assignment.dueDate && (
                  <p className="text-xs text-slate-400 mt-1">Due: {new Date(assignment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                )}
              </div>

              {(format === 'text' || format === 'both') && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Your Answer / Response</label>
                  <textarea
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    rows={4}
                    placeholder="Write your answer here…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 resize-none focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              )}

              {(format === 'pdf' || format === 'both') && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Upload Completed Worksheet</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
                  >
                    <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={handleFileChange} />
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="size-5 text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-700 truncate max-w-[200px]">{file.name}</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto mb-2 size-8 text-slate-300" />
                        <p className="text-sm text-slate-500">Click to choose a file</p>
                        <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG or DOCX · Max 20MB</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60 transition-colors"
              >
                {uploading ? <><Loader2 className="size-4 animate-spin" /> Submitting…</> : <><Upload className="size-4" /> Submit Worksheet</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorksheetSubmitModal;
