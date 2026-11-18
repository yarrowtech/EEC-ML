import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download, ExternalLink, Eye, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Paperclip, Presentation, X,
} from 'lucide-react';
import { API_BASE } from '@/config/api';

const extOf = (file) => String(file?.name || file?.originalName || file?.url || '').split('?')[0].split('.').pop().toLowerCase();

const kindOf = (file) => {
  const ext = extOf(file);
  const type = String(file?.type || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(ext) || type.startsWith('image') || type === 'image') return 'image';
  if (ext === 'pdf' || type.includes('pdf')) return 'pdf';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext) || type.startsWith('video') || type === 'video') return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext) || type.startsWith('audio')) return 'audio';
  if (['ppt', 'pptx'].includes(ext) || type.includes('presentation') || type === 'ppt') return 'slides';
  if (['doc', 'docx'].includes(ext) || type.includes('word') || type === 'docx') return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext) || type.includes('sheet')) return 'sheet';
  return 'file';
};

const KIND_META = {
  pdf: { label: 'PDF', Icon: FileText, tile: 'bg-rose-50 text-rose-600' },
  image: { label: 'Image', Icon: FileImage, tile: 'bg-emerald-50 text-emerald-600' },
  video: { label: 'Video', Icon: FileVideo, tile: 'bg-violet-50 text-violet-600' },
  audio: { label: 'Audio', Icon: FileVideo, tile: 'bg-fuchsia-50 text-fuchsia-600' },
  slides: { label: 'Slides', Icon: Presentation, tile: 'bg-orange-50 text-orange-600' },
  doc: { label: 'Document', Icon: FileText, tile: 'bg-blue-50 text-blue-600' },
  sheet: { label: 'Spreadsheet', Icon: FileSpreadsheet, tile: 'bg-green-50 text-green-600' },
  file: { label: 'File', Icon: Paperclip, tile: 'bg-slate-100 text-slate-600' },
};

const formatSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (!n) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Saved study-material links expire, so ask the server for a fresh one.
const freshUrl = async (file) => {
  const saved = file?.secure_url || file?.url || '';
  if (!file?.s3Key) return /^https?:\/\//i.test(saved) ? saved : '';
  try {
    const res = await fetch(`${API_BASE}/api/uploads/s3/study-material/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ files: [{ s3Key: file.s3Key, s3Bucket: file.s3Bucket, s3Region: file.s3Region }] }),
    });
    const data = await res.json().catch(() => ({}));
    return data?.urls?.[0] || (/^https?:\/\//i.test(saved) ? saved : '');
  } catch {
    return /^https?:\/\//i.test(saved) ? saved : '';
  }
};

const Viewer = ({ file, onClose }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const kind = kindOf(file);
  const meta = KIND_META[kind];

  useEffect(() => {
    let alive = true;
    freshUrl(file).then((u) => { if (alive) { setUrl(u); setLoading(false); } });
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { alive = false; window.removeEventListener('keydown', onKey); };
  }, [file, onClose]);

  const officeKinds = ['slides', 'doc', 'sheet'];
  let body = null;
  if (loading) body = <div className="flex h-full items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 size-5 animate-spin" /> Opening preview…</div>;
  else if (!url) body = <div className="flex h-full items-center justify-center text-sm text-slate-500">This file can’t be previewed. Try re-uploading it.</div>;
  else if (kind === 'image') body = <div className="flex h-full items-center justify-center overflow-auto bg-slate-100 p-4"><img src={url} alt={file.name || 'Attachment'} className="max-h-full max-w-full rounded-lg object-contain shadow" /></div>;
  else if (kind === 'pdf') body = <iframe title={file.name || 'PDF'} src={url} className="h-full w-full border-0 bg-white" />;
  else if (kind === 'video') body = <div className="flex h-full items-center justify-center bg-black"><video src={url} controls className="max-h-full max-w-full" /></div>;
  else if (kind === 'audio') body = <div className="flex h-full items-center justify-center p-6"><audio src={url} controls className="w-full max-w-md" /></div>;
  else if (officeKinds.includes(kind)) body = <iframe title={file.name || 'Document'} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} className="h-full w-full border-0 bg-white" />;
  else body = <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">No built-in preview for this file type.<a href={url} target="_blank" rel="noreferrer" className="rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white">Open file</a></div>;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-2 sm:p-6" onClick={onClose}>
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}><meta.Icon className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{file.name || 'Attachment'}</p>
            <p className="text-[11px] text-slate-500">{meta.label}{formatSize(file.size || file.bytes) ? ` · ${formatSize(file.size || file.bytes)}` : ''}</p>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="hidden items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">
              <ExternalLink className="size-3.5" /> Open in new tab
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1">{body}</div>
      </div>
    </div>,
    document.body,
  );
};

/**
 * Every file attached to the chapter (materials by section + worksheets), each
 * previewable in place — what students will be able to open.
 */
const AttachmentPreviewList = ({ chapter }) => {
  const [active, setActive] = useState(null);
  const [busyId, setBusyId] = useState('');
  const closeViewer = useCallback(() => setActive(null), []);

  const groups = [
    ...Object.entries(chapter?.contentUploads || {}).map(([bucket, list]) => ({ label: bucket, files: Array.isArray(list) ? list : [] })),
    { label: 'Worksheets', files: Array.isArray(chapter?.worksheetFiles) ? chapter.worksheetFiles : [] },
  ].map((g) => ({ ...g, files: g.files.filter((f) => f && !f.isUploading) })).filter((g) => g.files.length);

  const total = groups.reduce((n, g) => n + g.files.length, 0);

  const openInTab = async (file) => {
    setBusyId(file.id || file.name);
    const u = await freshUrl(file);
    setBusyId('');
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Paperclip className="size-4 text-indigo-500" /> Attachments
        </h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">{total}</span>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">No files attached yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.files.map((file, i) => {
                  const meta = KIND_META[kindOf(file)];
                  const id = file.id || `${group.label}-${i}`;
                  return (
                    <div key={id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5 transition hover:border-indigo-200 hover:shadow-sm">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}><meta.Icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800" title={file.name}>{file.name || 'Attachment'}</p>
                        <p className="text-[11px] text-slate-400">{meta.label}{formatSize(file.size || file.bytes) ? ` · ${formatSize(file.size || file.bytes)}` : ''}</p>
                      </div>
                      <button type="button" onClick={() => setActive(file)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700">
                        <Eye className="size-3.5" /> Preview
                      </button>
                      <button type="button" onClick={() => openInTab(file)} aria-label={`Open ${file.name || 'file'} in a new tab`} title="Open in new tab" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                        {busyId === (file.id || file.name) ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {active && <Viewer file={active} onClose={closeViewer} />}
    </div>
  );
};

export default AttachmentPreviewList;
