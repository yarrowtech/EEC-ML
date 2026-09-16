import React, { useState } from "react";

const initialQuestions = [
  "The sky is blue.",
  "Cats can fly.",
  "Water boils at 100°C.",
  "The earth is flat.",
  "West Bengal is a country.",
  "The sun rises in the east.",
  "Fish can breathe underwater.",
  "Mount Everest is the tallest mountain.",
];

function ChoiceMatrix({ isTeacherMode = false }) {
  const [questions, setQuestions] = useState(
    initialQuestions.map((q) => ({ text: q, answer: null }))
  );
  const [answers, setAnswers] = useState(
    Array(initialQuestions.length).fill(null)
  );

  const handleSelect = (idx, value) => {
    if (isTeacherMode) {
      setQuestions((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], answer: value };
        return updated;
      });
      return;
    }
    setAnswers((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white-100 rounded-xl shadow-lg p-8 border border-purple-500">
      {isTeacherMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Select True/False for each statement to set the
            answer key.
          </p>
        </div>
      )}

      <h2 className="text-2xl font-bold text-black mb-6 text-center">
        Choice Matrix
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2 px-4 text-black text-lg">Statement</th>
              <th className="py-2 px-4 text-black text-lg text-center">True</th>
              <th className="py-2 px-4 text-black text-lg text-center">False</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, idx) => {
              const isTrueCorrect = isTeacherMode && q.answer === true;
              const isFalseCorrect = isTeacherMode && q.answer === false;
              return (
                <tr key={idx} className="border-b border-purple-100">
                  <td className="py-3 px-4 text-black">{q.text}</td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="radio"
                      id={`true-${idx}`}
                      name={`choice-${idx}`}
                      checked={
                        isTeacherMode
                          ? q.answer === true
                          : answers[idx] === true
                      }
                      onChange={() => handleSelect(idx, true)}
                      className={`w-5 h-5 ${
                        isTrueCorrect ? "accent-green-600" : "accent-purple-500"
                      }`}
                    />
                    {isTrueCorrect && (
                      <span className="ml-1 text-green-600 text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="radio"
                      id={`false-${idx}`}
                      name={`choice-${idx}`}
                      checked={
                        isTeacherMode
                          ? q.answer === false
                          : answers[idx] === false
                      }
                      onChange={() => handleSelect(idx, false)}
                      className={`w-5 h-5 ${
                        isFalseCorrect
                          ? "accent-green-600"
                          : "accent-purple-500"
                      }`}
                    />
                    {isFalseCorrect && (
                      <span className="ml-1 text-green-600 text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChoiceMatrix;
