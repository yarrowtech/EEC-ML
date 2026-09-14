import React, { useEffect, useMemo, useRef } from 'react';
import JoditEditor from 'jodit-react';

const RichTextEditor = ({ value, onChange, placeholder }) => {
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
    height: 220,
    toolbarSticky: false,
    statusbar: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    removeButtons: ['about', 'source', 'fullsize', 'copyformat', 'print'],
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'ul', 'ol', '|',
      'paragraph', 'fontsize', '|',
      'align', '|',
      'link', '|',
      'undo', 'redo',
    ],
    style: {
      fontSize: '14px',
      color: '#0f172a',
      background: '#ffffff',
      fontFamily: 'inherit',
    },
    editorCssClass: 'jodit-lesson-editor',
    theme: 'default',
  }), [placeholder]);

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
