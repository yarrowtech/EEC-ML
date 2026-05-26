import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UploadDropzone = ({ title, files = [], accept, onAddFile, onRemoveFile }) => {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  const handlePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onAddFile(file, title);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    onAddFile(file, title);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <motion.div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        animate={{ scale: isOver ? 1.01 : 1 }}
        className={`rounded-xl border-2 border-dashed p-4 text-center ${
          isOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
        }`}
      >
        <UploadCloud className="mx-auto mb-2 size-5 text-blue-500" />
        <p className="mb-2 text-xs text-slate-500">Drag & drop file here or upload</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handlePick} />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Upload
        </Button>
      </motion.div>

      <div className="mt-3 space-y-2">
        {files.map((file) => (
          <div key={file.id} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-slate-700 dark:text-slate-200">{file.name}</p>
              <button type="button" onClick={() => onRemoveFile(file.id, title)} className="text-xs text-rose-500">
                Remove
              </button>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${file.progress || 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadDropzone;
