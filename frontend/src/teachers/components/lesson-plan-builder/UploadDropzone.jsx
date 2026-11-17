import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileImage, FileText, FileVideo, Presentation, Trash2, UploadCloud } from 'lucide-react';

const formatSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Icon + colour per file kind, so a PDF reads as a PDF at a glance.
const kindOf = (name = '') => {
  const ext = String(name).split('.').pop().toLowerCase();
  if (ext === 'pdf') return { label: 'PDF', Icon: FileText, tile: 'bg-rose-50 text-rose-600', bar: 'from-rose-500 to-orange-400' };
  if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', Icon: Presentation, tile: 'bg-orange-50 text-orange-600', bar: 'from-orange-500 to-amber-400' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', Icon: FileText, tile: 'bg-blue-50 text-blue-600', bar: 'from-blue-500 to-indigo-400' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) return { label: 'IMG', Icon: FileImage, tile: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-500 to-teal-400' };
  if (['mp4', 'webm', 'mov'].includes(ext)) return { label: 'VID', Icon: FileVideo, tile: 'bg-violet-50 text-violet-600', bar: 'from-violet-500 to-purple-400' };
  return { label: ext.slice(0, 4).toUpperCase() || 'FILE', Icon: FileText, tile: 'bg-slate-100 text-slate-600', bar: 'from-blue-500 to-indigo-400' };
};

const FileRow = ({ file, onRemove }) => {
  const kind = kindOf(file.name);
  const progress = Math.max(2, Math.min(100, Math.round(file.progress || 0)));
  const uploading = Boolean(file.isUploading);
  const href = !uploading ? (file.url || file.secure_url || '') : '';
  const openable = /^https?:\/\//i.test(href);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2.5">
        {/* File icon — bobs and shows an arrow while uploading */}
        <div className={`relative flex size-10 shrink-0 flex-col items-center justify-center rounded-lg ${kind.tile}`}>
          <motion.span
            animate={uploading ? { y: [0, -3, 0] } : { y: 0 }}
            transition={uploading ? { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } : { duration: 0.2 }}
            className="flex"
          >
            <kind.Icon className="size-4" />
          </motion.span>
          <span className="mt-0.5 text-[8px] font-extrabold leading-none tracking-wide">{kind.label}</span>
          <AnimatePresence>
            {!uploading && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute -bottom-1 -right-1 rounded-full bg-white dark:bg-slate-900"
              >
                <CheckCircle2 className="size-4 text-emerald-500" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="min-w-0 flex-1">
          {openable ? (
            <a href={href} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-semibold text-slate-800 hover:text-blue-600 hover:underline dark:text-slate-100" title={file.name}>
              {file.name}
            </a>
          ) : (
            <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100" title={file.name}>{file.name}</p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {uploading ? (
              <span className="font-medium text-blue-600">Uploading… {progress}%</span>
            ) : (
              <span className="font-medium text-emerald-600">Uploaded</span>
            )}
            {formatSize(file.size || file.bytes) && <span> · {formatSize(file.size || file.bytes)}</span>}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(file.id)}
          disabled={uploading}
          aria-label={`Delete ${file.name}`}
          title={uploading ? 'Wait for the upload to finish' : 'Delete file'}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-950/40"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Progress bar with a moving shine while uploading */}
      <AnimatePresence initial={false}>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 6 }}
            exit={{ opacity: 0, height: 0 }}
            className="relative mt-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <motion.div
              className={`relative h-full overflow-hidden rounded-full bg-gradient-to-r ${kind.bar}`}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            >
              <motion.span
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                animate={{ x: ['-100%', '250%'] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const UploadDropzone = ({ title, files = [], accept, onAddFile, onRemoveFile }) => {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);
  const anyUploading = files.some((f) => f.isUploading);

  const addFiles = (list) => {
    Array.from(list || []).forEach((file) => onAddFile(file, title));
  };

  const handlePick = (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsOver(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all duration-150 ${
          isOver
            ? 'scale-[1.01] border-blue-400 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/40'
        }`}
      >
        <motion.span
          className="mx-auto mb-1.5 flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40"
          animate={isOver || anyUploading ? { y: [0, -4, 0] } : { y: 0 }}
          transition={isOver || anyUploading ? { repeat: Infinity, duration: 0.9 } : { duration: 0.2 }}
        >
          <UploadCloud className="size-4" />
        </motion.span>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-blue-600">Click to upload</span> or drag &amp; drop
        </p>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handlePick} />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {files.map((file) => (
              <FileRow key={file.id} file={file} onRemove={(id) => onRemoveFile(id, title)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default UploadDropzone;
