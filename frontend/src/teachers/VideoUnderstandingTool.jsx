import React, { useState } from 'react';
import { Video, Upload, Loader2, FileText, Tag, ListChecks } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

// Teacher tool: upload a lecture video, get back a transcript, an AI summary,
// and a quiz — all derived from the video's audio track (see ai-service
// app/modules/video/service.py for the audio-only scope decision).
const VideoUnderstandingTool = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');

  const uploadVideo = (file) => new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'lecture_videos');
    formData.append('tags', 'lecture_video,video_understanding');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/uploads/cloudinary/single`);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setUploadProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data?.files?.[0]?.secure_url) {
          resolve(data.files[0].secure_url);
        } else {
          reject(new Error(data?.message || 'Upload failed'));
        }
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    setUploading(true);
    setUploadProgress(0);
    try {
      const videoUrl = await uploadVideo(file);
      setUploading(false);
      setAnalyzing(true);
      const res = await fetch(`${API_BASE}/api/video/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ videoUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Video understanding failed');
      setResult(data.data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Video className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Video Lecture Understanding</h1>
          <p className="text-sm text-slate-500">Upload a lecture recording to get a transcript, summary, and quiz — generated from the audio track.</p>
        </div>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-8 text-center transition-colors hover:bg-indigo-50">
        <Upload className="size-8 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-700">
          {fileName || 'Click to choose a video file (mp4, webm)'}
        </span>
        <span className="text-xs text-indigo-400">Best for narrated lectures — visual-only slides without speech won&apos;t be captured.</span>
        <input
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={uploading || analyzing}
        />
      </label>

      {uploading && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
            <span>Uploading…</span><span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {analyzing && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="size-4 animate-spin text-indigo-500" />
          Transcribing and analyzing the lecture — this can take a few minutes for longer videos…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
              <FileText className="size-4 text-indigo-500" /> Summary
            </h2>
            <p className="text-sm text-slate-600">{result.summary}</p>
            {result.keywords?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                    <Tag className="size-3" /> {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
              <ListChecks className="size-4 text-indigo-500" /> Quiz
            </h2>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{result.quiz}</pre>
          </div>

          <details className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-bold text-slate-800">Full transcript ({Math.round((result.duration_seconds || 0) / 60)} min)</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{result.transcript}</p>
          </details>
        </div>
      )}
    </div>
  );
};

export default VideoUnderstandingTool;
