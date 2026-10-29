import React, { useState } from "react";

export default function ClozeText({ isTeacherMode = false }) {
  const [questionSet, setQuestionSet] = useState([
    {
      question:
        "We the ${{input}} of the United States, in order to form a more ${{input}}, establish justice, insure domestic tranquility, provide for the common defense, promote the ${{input}}, and secure the blessings of liberty to ourselves and our posterity, do ordain and establish ${{input}} for the United States of America.",
      correctAnswers: [],
    },
  ]);

  return (
    <section className="m-auto flex flex-col items-center gap-3 pt-10">
      {questionSet.map((question, index) => (
        <QuestionCard
          key={index}
          question={question}
          questionIndex={index}
          setQuestionSet={setQuestionSet}
          isTeacherMode={isTeacherMode}
        />
      ))}
    </section>
  );
}

function QuestionCard({
  question,
  questionIndex,
  setQuestionSet,
  isTeacherMode,
}) {
  const parts = question.question.split("${{input}}");
  const [studentAnswers, setStudentAnswers] = useState(
    parts.slice(0, -1).map(() => "")
  );

  const handleTeacherChange = (i, value) => {
    setQuestionSet((prev) => {
      const updated = [...prev];
      const newAnswers = [...(updated[questionIndex].correctAnswers || [])];
      newAnswers[i] = value;
      updated[questionIndex] = {
        ...updated[questionIndex],
        correctAnswers: newAnswers,
      };
      return updated;
    });
  };

  const handleStudentChange = (i, value) => {
    setStudentAnswers((prev) => {
      const updated = [...prev];
      updated[i] = value;
      return updated;
    });
  };

  return (
    <div className="w-3/4 border flex flex-col items-center justify-center gap-5 border-purple-500 p-8 rounded-xl shadow-lg">
      {isTeacherMode && (
        <div className="w-full p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Type the correct answer for each blank.
          </p>
        </div>
      )}

      <h2 className="text-xl font-bold text-black self-start">
        Fill in the blanks to complete the passage:
      </h2>

      <div>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span className="select-none text-black">{part}</span>
            {i < parts.length - 1 && (
              <input
                type="text"
                value={
                  isTeacherMode
                    ? question.correctAnswers?.[i] || ""
                    : studentAnswers[i] || ""
                }
                onChange={(e) =>
                  isTeacherMode
                    ? handleTeacherChange(i, e.target.value)
                    : handleStudentChange(i, e.target.value)
                }
                placeholder={isTeacherMode ? "answer" : ""}
                className={`border-2 pl-2 focus:outline-none w-24 text-black ${
                  isTeacherMode
                    ? "border-green-500 bg-green-50"
                    : "border-purple-500"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
