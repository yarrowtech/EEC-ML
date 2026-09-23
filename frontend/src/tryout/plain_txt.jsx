import React, { useState, useRef } from "react";

const MAX_WORDS = 10000;

const TextEditor = ({ isTeacherMode = false }) => {
  const [text, setText] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const getWordCount = (inputText) => {
    return inputText.trim().length === 0
      ? 0
      : inputText.trim().split(/\s+/).length;
  };

  const handleChange = (e) => {
    const newText = e.target.value;
    if (getWordCount(newText) <= MAX_WORDS) {
      setText(newText);
    }
  };

  const handleCopy = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      navigator.clipboard.writeText(textareaRef.current.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCut = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      navigator.clipboard.writeText(textareaRef.current.value);
      setText("");
    }
  };

  const handlePaste = async () => {
    const pastedText = await navigator.clipboard.readText();
    const newText = text + " " + pastedText;
    if (getWordCount(newText) <= MAX_WORDS) {
      setText(newText);
    } else {
      alert("Pasting this text will exceed the 10,000 word limit.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4 text-black">Text Editor</h2>

      {isTeacherMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <label className="block text-amber-800 text-sm font-medium mb-1">
            👩‍🏫 Teacher Mode — Model Answer / Rubric (not shown to students)
          </label>
          <textarea
            value={modelAnswer}
            onChange={(e) => setModelAnswer(e.target.value)}
            rows={4}
            className="w-full border border-amber-300 rounded p-2 text-sm text-black"
            placeholder="Enter model answer or grading rubric..."
          />
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleCopy}
          className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
        >
          Copy
        </button>
        <button
          onClick={handleCut}
          className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
        >
          Cut
        </button>
        <button
          onClick={handlePaste}
          className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
        >
          Paste
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        rows={12}
        className="w-full border rounded p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 text-black"
        placeholder="Type something..."
      />

      <div className="mt-3 text-sm text-gray-700">
        <div>
          Word Count: {getWordCount(text)} / {MAX_WORDS}
        </div>
        <div>Character Count: {text.length}</div>
      </div>

      {copied && (
        <div className="mt-2 text-green-600 text-sm">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
};

export default TextEditor;
