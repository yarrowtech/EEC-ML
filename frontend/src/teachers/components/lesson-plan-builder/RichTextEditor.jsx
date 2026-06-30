import React, { useMemo, useRef } from 'react';
import JoditEditor from 'jodit-react';

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);

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
    />
  );
};

export default RichTextEditor;
