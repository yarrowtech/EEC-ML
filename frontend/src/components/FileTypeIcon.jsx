import React from 'react';

// File-type icon like the ones people know from their computer: a page with a
// folded corner and a coloured label band (PDF red, Word blue, Excel green,
// PowerPoint orange, …). Pure SVG — no icon package needed.

const TYPES = {
  pdf: { label: 'PDF', color: '#dc2626' },
  word: { label: 'DOC', color: '#2563eb' },
  excel: { label: 'XLS', color: '#16a34a' },
  ppt: { label: 'PPT', color: '#ea580c' },
  image: { label: 'IMG', color: '#9333ea' },
  video: { label: 'VID', color: '#db2777' },
  audio: { label: 'MP3', color: '#0d9488' },
  text: { label: 'TXT', color: '#475569' },
  zip: { label: 'ZIP', color: '#a16207' },
  file: { label: 'FILE', color: '#64748b' },
};

/** Works out the file kind from a MIME type, file name and/or URL. */
export const fileKindOf = ({ type = '', name = '', url = '' } = {}) => {
  const hint = `${type} ${name} ${String(url).split(/[?#]/)[0]}`.toLowerCase();
  if (/pdf/.test(hint)) return 'pdf';
  if (/msword|wordprocessingml|\.docx?\b|\.odt\b|\.rtf\b/.test(hint)) return 'word';
  if (/spreadsheet|ms-excel|\.xlsx?\b|\.csv\b|\.ods\b/.test(hint)) return 'excel';
  if (/presentation|powerpoint|\.pptx?\b|\.odp\b/.test(hint)) return 'ppt';
  if (/image\/|\.(jpe?g|jfif|png|webp|gif|svg|bmp|heic)\b/.test(hint)) return 'image';
  if (/video\/|\.(mp4|webm|mov|mkv|avi)\b/.test(hint)) return 'video';
  if (/audio\/|\.(mp3|wav|m4a|ogg)\b/.test(hint)) return 'audio';
  if (/zip|compressed|\.(zip|rar|7z)\b/.test(hint)) return 'zip';
  if (/text\/plain|\.txt\b/.test(hint)) return 'text';
  return 'file';
};

/** Friendly name for a kind, e.g. 'word' -> 'Word document'. */
export const fileKindName = (kind) => ({
  pdf: 'PDF', word: 'Word document', excel: 'Excel sheet', ppt: 'Slides', image: 'Image',
  video: 'Video', audio: 'Audio', text: 'Text file', zip: 'Zip file', file: 'File',
}[kind] || 'File');

const FileTypeIcon = ({ kind = 'file', size = 40, className = '' }) => {
  const { label, color } = TYPES[kind] || TYPES.file;
  const fontSize = label.length > 3 ? 6.2 : 7.4;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${label} file`} className={`shrink-0 ${className}`}>
      {/* page */}
      <path d="M8 2h11l7 7v19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#cbd5e1" strokeWidth="1.2" />
      {/* folded corner */}
      <path d="M19 2v5a2 2 0 0 0 2 2h5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.2" strokeLinejoin="round" />
      {/* a few text lines */}
      <path d="M10 13h9M10 16h12" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round" />
      {/* coloured label band */}
      <rect x="2.5" y="18.5" width="21" height="9" rx="2" fill={color} />
      <text x="13" y="25.3" textAnchor="middle" fontSize={fontSize} fontWeight="800" fontFamily="system-ui, -apple-system, Segoe UI, sans-serif" fill="#fff" letterSpacing="0.2">{label}</text>
    </svg>
  );
};

export default FileTypeIcon;
