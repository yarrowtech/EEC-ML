import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Download, FileText, Image as ImageIcon, X } from 'lucide-react';

// Shared file preview pieces for parent screens (Documents, Achievements).

export const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export const fileKind = (doc) => {
  const src = `${doc.fileName || ''} ${doc.url || ''}`.toLowerCase().split('?')[0];
  if (/\.(png|jpe?g|gif|webp|bmp|svg)\b/.test(src) || /\/image\/upload\//.test(src) && !/\.pdf\b/.test(src)) return 'image';
  if (/\.pdf\b/.test(src)) return 'pdf';
  const ext = src.match(/\.([a-z0-9]{2,5})\b(?!.*\.[a-z0-9]{2,5}\b)/);
  return ext ? ext[1] : 'file';
};
export const kindLabel = (k) => (k === 'image' ? 'Image' : k === 'file' ? 'File' : k.toUpperCase());

// PDF bytes already fetched for preview, so reopening a file is instant.
const pdfBlobCache = new Map(); // url -> object URL (kept for the session)

export const FileBadge = ({ kind }) => (kind === 'image' ? (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white">
    <ImageIcon size={22} />
  </span>
) : (
  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-red-500 text-white">
    <FileText size={17} />
    <span className="mt-0.5 text-[8px] font-bold leading-none">{kind === 'pdf' ? 'PDF' : kindLabel(kind).slice(0, 4)}</span>
  </span>
));


// Cloudinary often serves PDFs as attachments / octet-stream, which makes an
// iframe download them. Fetch the bytes and show them as an application/pdf
// blob so the browser's PDF viewer renders inline.
const PdfFrame = ({ url, title }) => {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const hit = pdfBlobCache.get(url);
    if (hit) { setSrc(hit); return undefined; }
    setSrc('');
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((buf) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
        pdfBlobCache.set(url, objectUrl);
        setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);
  if (failed) {
    return <iframe src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`} title={title} className="h-full w-full border-0" />;
  }
  if (!src) return <p className="text-sm text-slate-500">Loading preview…</p>;
  return <iframe src={src} title={title} className="h-full w-full border-0" />;
};

export const PreviewModal = ({ doc, onClose }) => {
  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [doc, onClose]);
  if (!doc) return null;
  const kind = fileKind(doc);
  // Portal to <body> so no transformed/scrolling ancestor can trap the overlay.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <FileBadge kind={kind} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{doc.name}</p>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              {kindLabel(kind)}{doc.date ? ` • Uploaded: ${fmt(doc.date)}` : ''}
              {doc.verified && <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600"><CheckCircle2 size={11} /> Verified</span>}
            </p>
          </div>
          <a href={doc.url} target="_blank" rel="noreferrer" download className="hidden items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 sm:inline-flex">
            <Download size={14} /> Download
          </a>
          <button type="button" onClick={onClose} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
          {kind === 'image' ? (
            <img src={doc.url} alt={doc.name} className="max-h-full max-w-full object-contain p-4" />
          ) : kind === 'pdf' ? (
            <PdfFrame url={doc.url} title={doc.name} />
          ) : (
            <div className="p-6 text-center">
              <FileText size={40} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-600">Preview isn&apos;t available for this file type.</p>
              <a href={doc.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                <Download size={15} /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

