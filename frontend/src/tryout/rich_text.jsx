import { useEffect, useState } from "react";
import Quill from "quill";

export default function RichText({ isTeacherMode = false }) {
  const [questionSet, setQuestionSet] = useState([
    {
      question:
        "Describe the difference between physical activity and exercise.",
      modelAnswer: "",
    },
  ]);

  return (
    <section className="w-[60vw] flex flex-col m-auto mt-10">
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
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const toolbarOptions = [
      ["bold", "italic", "underline", "strike"],
      ["blockquote", "code-block"],
      ["link", "image", "video", "formula"],
      [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
      [{ script: "sub" }, { script: "super" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ direction: "rtl" }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ["clean"],
    ];

    const editorId = isTeacherMode
      ? `teacher-editor-${questionIndex}`
      : `student-editor-${questionIndex}`;

    const quill = new Quill(`#${editorId}`, {
      theme: "snow",
      placeholder: isTeacherMode
        ? "Type the model answer / rubric here..."
        : "Type your answer here...",
      modules: {
        toolbar: toolbarOptions,
      },
    });

    if (isTeacherMode && question.modelAnswer) {
      quill.root.innerHTML = question.modelAnswer;
    }

    quill.on("text-change", () => {
      const text = quill.getText();
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
      setCharCount(text.length - 1);

      if (isTeacherMode) {
        setQuestionSet((prev) => {
          const updated = [...prev];
          updated[questionIndex] = {
            ...updated[questionIndex],
            modelAnswer: quill.root.innerHTML,
          };
          return updated;
        });
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-black">{question.question}</p>

      {isTeacherMode && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Write the model answer / rubric. Not shown to
            students.
          </p>
        </div>
      )}

      <div className="flex flex-col">
        <div id={isTeacherMode ? `teacher-editor-${questionIndex}` : `student-editor-${questionIndex}`}></div>
        <div className="text-xs self-end flex gap-3">
          <p className="">{charCount} chars</p>
          <p className="">{wordCount} words</p>
        </div>
      </div>
    </div>
  );
}
