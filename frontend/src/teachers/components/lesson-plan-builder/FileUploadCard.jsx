import React from 'react';
import { FileText, FileImage, FileType2, Link as LinkIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconByType = {
  pdf: FileText,
  docx: FileType2,
  ppt: FileType2,
  image: FileImage,
  video: LinkIcon,
};

const FileUploadCard = ({ file, onRemove }) => {
  const Icon = iconByType[file.type] || FileText;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
            {file.isUploading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          </span>
          <p className="truncate text-sm text-slate-700">{file.name}</p>
        </div>
        {file.isUploading ? (
          <span className="shrink-0 text-xs font-semibold text-blue-600">{Math.round(file.progress || 0)}%</span>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => onRemove(file.id)} className="text-rose-500 hover:text-rose-600">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {file.isUploading ? (
        <div className="mt-2 h-1 rounded-full bg-slate-200">
          <div className="h-1 rounded-full bg-blue-500 transition-all duration-200" style={{ width: `${file.progress || 1}%` }} />
        </div>
      ) : null}
    </div>
  );
};

export default FileUploadCard;
