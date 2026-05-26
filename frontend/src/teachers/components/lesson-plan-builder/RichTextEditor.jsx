import React, { useEffect, useRef } from 'react';

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <button type="button" onClick={() => document.execCommand('bold')} className="rounded-md bg-slate-100 px-2 py-1">
          Bold
        </button>
        <button type="button" onClick={() => document.execCommand('italic')} className="rounded-md bg-slate-100 px-2 py-1">
          Italic
        </button>
        <button type="button" onClick={() => document.execCommand('insertUnorderedList')} className="rounded-md bg-slate-100 px-2 py-1">
          Bullet
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-28 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 outline-none"
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      {!value && <p className="mt-2 text-xs text-slate-400">{placeholder}</p>}
    </div>
  );
};

export default RichTextEditor;
