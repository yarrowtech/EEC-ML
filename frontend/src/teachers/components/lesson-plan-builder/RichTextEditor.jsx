import React, { useEffect, useMemo, useRef } from 'react';
import JoditEditor from 'jodit-react';
import { API_BASE } from '@/config/api';

// Word-style toolbar: text formatting, colours, lists, alignment, tables,
// images, links. (No "source" button — teachers never need raw HTML.)
const FULL_TOOLBAR = [
  'bold', 'italic', 'underline', 'strikethrough', '|',
  'superscript', 'subscript', '|',
  'font', 'fontsize', 'paragraph', 'brush', '|',
  'ul', 'ol', 'outdent', 'indent', '|',
  'align', 'lineHeight', '|',
  'image', 'table', 'link', 'hr', 'symbols', '|',
  'eraser', 'undo', 'redo',
];

const RichTextEditor = ({ value, onChange, placeholder, height = 260 }) => {
  const editorRef = useRef(null);

  // Jodit only reports content on blur (recommended by jodit-react itself —
  // wiring every keystroke into this page's chapter state causes visible
  // typing lag). Track live content in a ref via onChange instead, and flush
  // it if the editor is torn down (wizard step change, drawer close, tab
  // close) before a blur ever fires, so an in-progress edit isn't silently
  // dropped.
  const liveValueRef = useRef(value || '');
  const committedValueRef = useRef(value || '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  committedValueRef.current = value || '';

  useEffect(() => {
    const flushPendingContent = () => {
      if (liveValueRef.current !== committedValueRef.current) {
        onChangeRef.current?.(liveValueRef.current);
      }
    };
    window.addEventListener('beforeunload', flushPendingContent);
    return () => {
      window.removeEventListener('beforeunload', flushPendingContent);
      flushPendingContent();
    };
  }, []);

  // Config must be memoized — Jodit re-mounts the editor if the config object changes reference
  const config = useMemo(() => ({
    readonly: false,
    placeholder: placeholder || 'Start typing…',
    height,
    minHeight: 180,
    toolbarSticky: false,
    toolbarAdaptive: true,
    statusbar: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_clear_html',
    removeButtons: ['about', 'source', 'fullsize', 'copyformat', 'print', 'file', 'video'],
    buttons: FULL_TOOLBAR,
    buttonsMD: FULL_TOOLBAR,
    buttonsSM: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'image', 'link', '|', 'brush', 'paragraph', 'dots'],
    buttonsXS: ['bold', 'italic', '|', 'ul', '|', 'image', 'dots'],
    // Images: uploaded to Cloudinary so they get a permanent public link that
    // students can load (inserted at a sensible width, resizable afterwards).
    uploader: {
      url: `${API_BASE}/api/uploads/cloudinary/single`,
      format: 'json',
      method: 'POST',
      filesVariableName: () => 'file',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      prepareData(formData) {
        formData.append('folder', 'class_materials');
        formData.append('tags', 'lesson-plan,inline-image');
        return formData;
      },
      isSuccess: (resp) => Boolean(resp?.files?.[0]?.secure_url),
      getMessage: (resp) => resp?.message || 'Image upload failed',
      process: (resp) => ({
        files: resp?.files?.[0]?.secure_url ? [resp.files[0].secure_url] : [],
        path: '',
        baseurl: '',
        error: resp?.files?.[0]?.secure_url ? 0 : 1,
        msg: resp?.message || '',
      }),
      defaultHandlerSuccess(data) {
        (data?.files || []).forEach((url) => this.s.insertImage(url, null, 420));
      },
    },
    image: { editSrc: true, useImageEditor: false },
    imageDefaultWidth: 420,
    style: {
      fontSize: '14px',
      color: '#0f172a',
      background: '#ffffff',
      fontFamily: 'inherit',
    },
    editorCssClass: 'jodit-lesson-editor',
    theme: 'default',
  }), [placeholder, height]);

  return (
    <JoditEditor
      ref={editorRef}
      value={value || ''}
      config={config}
      onBlur={onChange}
      onChange={(newContent) => { liveValueRef.current = newContent; }}
    />
  );
};

export default RichTextEditor;
