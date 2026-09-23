import React, { useState } from "react";

const initialQuestions = [
  {
    question: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    answer: null,
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Earth", "Mars", "Jupiter", "Saturn"],
    answer: null,
  },
  {
    question: "Who wrote 'To Kill a Mockingbird'?",
    options: ["Harper Lee", "Mark Twain", "J.K. Rowling", "Jane Austen"],
    answer: null,
  },
];

const optionLabels = ["A", "B", "C", "D"];

function MCQ({ isTeacherMode = false }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [theme, setTheme] = useState("standard");

  const q = questions[current];

  const handleOptionClick = (idx) => {
    if (isTeacherMode) {
      setQuestions((prev) => {
        const updated = [...prev];
        updated[current] = { ...updated[current], answer: idx };
        return updated;
      });
      return;
    }
    setSelected(idx);
  };

  const handleNext = () => {
    setCurrent((prev) => prev + 1);
    setSelected(null);
  };

  const handleThemeChange = (e) => {
    setTheme(e.target.value);
    setSelected(null);
  };

  const isMarked = (idx) => (isTeacherMode ? q.answer === idx : selected === idx);

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white-100 rounded-xl shadow-lg p-8 border border-purple-500">
      {isTeacherMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Click an option to mark the correct answer.
          </p>
          <p className="text-amber-700 text-xs mt-1">
            Current correct answer:{" "}
            <span className="font-bold">
              {q.answer !== null
                ? `${optionLabels[q.answer]}. ${q.options[q.answer]}`
                : "Not set"}
            </span>
          </p>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <label className="mr-2 text-purple-700 font-medium">Theme:</label>
        <select
          value={theme}
          onChange={handleThemeChange}
          className="border border-purple-300 rounded px-2 py-1 focus:outline-none"
        >
          <option value="standard">Standard</option>
          <option value="block">Block</option>
          <option value="radio">Radio Button</option>
        </select>
      </div>

      <h2 className="text-2xl font-bold text-black mb-6 text-center">MCQ</h2>

      <div
        className={`mb-4 w-full flex ${
          theme === "radio" ? "justify-center" : "justify-start"
        } items-center`}
      >
        <span className="text-lg font-medium text-black">Q{current + 1}:</span>
        <span className="ml-2 text-lg text-black">{q.question}</span>
      </div>

      {theme === "standard" ? (
        <ul className="space-y-3 mb-6 list-disc list-inside">
          {q.options.map((option, idx) => {
            const marked = isMarked(idx);
            const isCorrect = isTeacherMode && q.answer === idx;
            return (
              <li
                key={idx}
                className={`flex items-center ${
                  isCorrect
                    ? "bg-green-100 border border-green-400"
                    : marked
                    ? "bg-yellow-100"
                    : ""
                } p-3 rounded-lg`}
              >
                <input
                  type="radio"
                  id={`option-${idx}`}
                  name="mcq-option"
                  checked={marked}
                  onChange={() => handleOptionClick(idx)}
                  className={`mr-3 w-5 h-5 ${
                    isCorrect ? "accent-green-600" : "accent-purple-500"
                  }`}
                />
                <label
                  htmlFor={`option-${idx}`}
                  className={`cursor-pointer text-lg ${
                    marked ? "font-semibold" : ""
                  } text-black`}
                >
                  {option}
                </label>
                {isCorrect && (
                  <span className="ml-auto text-green-600 text-sm font-bold">
                    ✓ Correct
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : theme === "block" ? (
        <div className="space-y-3 mb-6">
          {q.options.map((option, idx) => {
            const marked = isMarked(idx);
            const isCorrect = isTeacherMode && q.answer === idx;
            return (
              <button
                key={idx}
                onClick={() => handleOptionClick(idx)}
                className={`w-full flex items-center text-left px-5 py-3 rounded-lg border transition-all duration-200 focus:outline-none
                  ${
                    isCorrect
                      ? "bg-green-100 border-green-400 font-semibold"
                      : marked
                      ? "bg-yellow-100 border-yellow-300 font-semibold"
                      : "bg-gray-50 border-gray-200 hover:bg-purple-50 hover:border-purple-300"
                  }`}
              >
                <span className="mr-4 font-bold text-black">
                  {optionLabels[idx]}.
                </span>
                {option}
                {isCorrect && (
                  <span className="ml-auto text-green-600 text-sm font-bold">
                    ✓ Correct
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-3 mb-6 list-disc list-inside">
          {q.options.map((option, idx) => {
            const marked = isMarked(idx);
            const isCorrect = isTeacherMode && q.answer === idx;
            return (
              <li
                key={idx}
                className={`flex flex-col-reverse items-center ${
                  isCorrect
                    ? "bg-green-100 border border-green-400"
                    : marked
                    ? "bg-yellow-100"
                    : ""
                } p-3 rounded-lg`}
              >
                <input
                  type="radio"
                  id={`option-${idx}`}
                  name="mcq-option"
                  checked={marked}
                  onChange={() => handleOptionClick(idx)}
                  className={`mr-3 w-5 h-5 ${
                    isCorrect ? "accent-green-600" : "accent-purple-500"
                  }`}
                />
                <label
                  htmlFor={`option-${idx}`}
                  className={`cursor-pointer text-lg ${
                    marked ? "font-semibold" : ""
                  } text-black`}
                >
                  {option}
                </label>
                {isCorrect && (
                  <span className="text-green-600 text-sm font-bold">
                    ✓ Correct
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        {current < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600 transition-all disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          !isTeacherMode &&
          selected !== null && (
            <span className="text-xl font-semibold text-purple-700"></span>
          )
        )}
      </div>
    </div>
  );
}

export default MCQ;
