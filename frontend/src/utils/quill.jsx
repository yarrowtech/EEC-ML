import { useEffect, useRef, useState } from "react";
import { BetweenHorizonalEnd } from "lucide-react";
// NOTE: Quill and its CSS are dynamically imported on the client only to avoid
// SSR/runtime errors on platforms like Vercel or Render which build server-side.


export default function QuillEditor({
  type,
  idPrefix = "editor",
  value = "",
  onChange = () => {},
  placeholder = "Type your text here...",
}) {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;

    let mounted = true;
    let quillInstance = null;

    const loadQuill = async () => {
      try {
        const QuillModule = await import('quill');
        // Some bundlers export Quill as default, some as named
        const QuillLib = QuillModule.default || QuillModule;
        // Import CSS dynamically so SSR doesn't try to process it
        await import('quill/dist/quill.snow.css');

        if (!mounted) return;

        const toolbarId = `#${idPrefix}-toolbar`;
        const editorId = `#${idPrefix}-editor`;

        // Avoid re-initializing
        if (quillRef.current) {
          quillInstance = quillRef.current;
          return;
        }

        quillInstance = new QuillLib(editorId, {
          theme: 'snow',
          placeholder,
          modules: {
            toolbar: {
              container: toolbarId,
              handlers: {
                insert: function () {
                  const range = quillInstance.getSelection();
                  if (range) {
                    quillInstance.insertText(range.index, '${{________}}');
                  }
                }
              }
            }
          }
        });

        quillRef.current = quillInstance;

        quillInstance.on('text-change', () => {
          const text = quillInstance.getText();
          const html = quillInstance.root.innerHTML;
          setWordCount(text.trim().length ? text.trim().split(/\s+/).length : 0);
          setCharCount(Math.max(0, text.length - 1));
          onChangeRef.current(html);
        });
      } catch {
        // If Quill fails to load, degrade gracefully (editor will remain a simple div)
        // No runtime exception thrown to avoid build failure on SSR platforms.
      }
    };

    loadQuill();

    return () => {
      mounted = false;
      if (quillRef.current && quillRef.current.off) {
        try { quillRef.current.off('text-change'); } catch { /* ignore */ }
      }
      quillRef.current = null;
    };
  }, [idPrefix, placeholder]);

  // Sync external value updates
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    // Avoid resetting if content didn’t actually change
    if (quill.root.innerHTML !== value) {
      const sel = quill.getSelection();
      quill.root.innerHTML = value || "";
      if (sel) quill.setSelection(sel);
    }
    const text = quill.getText();
    setWordCount(text.trim().length ? text.trim().split(/\s+/).length : 0);
    setCharCount(Math.max(0, text.length - 1));
  }, [value]);

  return (
    <div className="flex flex-col">
      <div id={`${idPrefix}-toolbar`}>
        <span className="ql-formats">
          <button className="ql-bold"></button>
          <button className="ql-italic"></button>
          <button className="ql-underline"></button>
          <button className="ql-strike"></button>
        </span>
        <span className="ql-formats">
          <button className="ql-blockquote"></button>
          <button className="ql-code-block"></button>
        </span>
        <span className="ql-formats">
          <button className="ql-link"></button>
          <button className="ql-image"></button>
          <button className="ql-video"></button>
          <button className="ql-formula"></button>
        </span>
        <span className="ql-formats">
          <button
            className="ql-list"
            value="ordered"
            aria-label="list: ordered"
          ></button>
          <button
            className="ql-list"
            value="bullet"
            aria-label="list: bullet"
          ></button>
          <button
            className="ql-list"
            value="check"
            aria-label="list: check"
          ></button>
        </span>
        <span className="ql-formats">
          <button
            className="ql-script"
            value="super"
            aria-label="script: super"
          ></button>
          <button
            className="ql-script"
            value="sub"
            aria-label="script: sub"
          ></button>
        </span>
        <span className="ql-formats">
          <button
            className="ql-indent"
            value="+1"
            aria-label="indent: +1"
          ></button>
          <button
            className="ql-indent"
            value="-1"
            aria-label="indent: -1"
          ></button>
        </span>
        <select className="ql-header" style={{ colorScheme: 'light' }}>
          <option value="1" />
          <option value="2" />
          <option value="3" />
          <option value="4" />
          <option value="5" />
          <option value="6" />
        </select>
        <span className="ql-formats">
          <select className="ql-align" style={{ colorScheme: 'light' }} />
          <select className="ql-color" style={{ colorScheme: 'light' }} />
          <select className="ql-background" style={{ colorScheme: 'light' }} />
        </span>
        {type == "question-editor" && <span className="ql-formats">
          <button className="ql-insert">
            <BetweenHorizonalEnd />
          </button>
        </span>}
      </div>
      <div id={`${idPrefix}-editor`}></div>
      <div className="text-xs self-end flex gap-3">
            <p className="">{charCount} chars</p>
            <p className="">{wordCount} words</p>
        </div>
    </div>
  );
}
