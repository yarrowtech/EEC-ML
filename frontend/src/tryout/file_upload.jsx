import React, { useState } from "react";

function FileUpload({ isTeacherMode = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rubric, setRubric] = useState("");

  const handleChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);

    if (selected && selected.type.startsWith("image")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a file first!");
      return;
    }
    alert(`Selected file: ${file.name}`);
  };

  return (
    <div className="max-w-lg mx-auto mt-12 bg-white p-8 rounded-xl shadow-md border border-purple-300">
      <h2 className="text-2xl font-bold text-center text-black mb-6">
        Upload a File
      </h2>

      {isTeacherMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <label className="block text-amber-800 text-sm font-medium mb-1">
            👩‍🏫 Teacher Mode — Grading Notes / Rubric (not shown to students)
          </label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={3}
            className="w-full border border-amber-300 rounded p-2 text-sm text-black"
            placeholder="e.g., Accept only PDF. Check for 3 sections..."
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-2 border-dashed border-purple-400 rounded-lg p-6 text-center hover:bg-purple-50 transition cursor-pointer">
          <label htmlFor="fileInput" className="block cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 mx-auto text-purple-500 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4a2 2 0 012-2h6a2 2 0 012 2v12m-5 4h.01M12 20v-4"
              />
            </svg>
            <span className="text-sm text-black">
              Click to browse or drag & drop a file
            </span>
          </label>
          <input
            id="fileInput"
            type="file"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {file && (
          <div className="flex items-center justify-between bg-gray-100 p-3 rounded-md text-sm text-black">
            <span className="font-medium">{file.name}</span>
            <span className="text-black text-xs">
              {(file.size / 1024).toFixed(2)} KB
            </span>
          </div>
        )}

        {preview && (
          <div className="mt-4">
            <p className="text-sm text-black mb-1">Preview:</p>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg border"
            />
          </div>
        )}

        <div>
          <h3 className="text-sm text-black text-center mt-2">
            JPG, GIF, PNG, and PDF files are supported.
          </h3>
        </div>

        <div className="text-center">
          <button
            type="submit"
            className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition"
          >
            Upload File
          </button>
        </div>
      </form>
    </div>
  );
}

export default FileUpload;
