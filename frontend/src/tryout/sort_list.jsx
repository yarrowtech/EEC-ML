import { useState, useRef } from "react";

export default function SortList({ isTeacherMode = false }) {
  const [questionSet, setQuestionSet] = useState([
    {
      question:
        "Sort the countries in ascending order based on their population:",
      list: ["USA", "India", "China", "Brazil", "Russia"],
      correctOrder: null,
    },
  ]);

  return (
    <section className="w-[60vw] flex flex-col items-center m-auto mt-10">
      <h2 className="font-bold text-2xl text-black">Sort List</h2>
      {questionSet.map((question, index) => (
        <QuestionCard
          key={index}
          questionIndex={index}
          setQuestionSet={setQuestionSet}
          questionSet={questionSet}
          isTeacherMode={isTeacherMode}
        />
      ))}
    </section>
  );
}

function QuestionCard({
  questionIndex,
  questionSet,
  setQuestionSet,
  isTeacherMode,
}) {
  const draggedItem = useRef(null);
  const draggedOverItem = useRef(null);
  const { question, list, correctOrder } = questionSet[questionIndex];
  const [itemList, setItemList] = useState(list.map(() => false));

  function handleSort(e, index) {
    const temp = list[draggedItem.current];
    list[draggedItem.current] = list[draggedOverItem.current];
    list[draggedOverItem.current] = temp;
    const tempQuestionSet = [...questionSet];
    tempQuestionSet[questionIndex] = { ...tempQuestionSet[questionIndex], list };
    setQuestionSet([...tempQuestionSet]);
    setItemList((prev) => {
      const newList = [...prev];
      newList[index] = false;
      return newList;
    });
  }

  const saveCorrectOrder = () => {
    setQuestionSet((prev) => {
      const updated = [...prev];
      updated[questionIndex] = {
        ...updated[questionIndex],
        correctOrder: [...updated[questionIndex].list],
      };
      return updated;
    });
  };

  return (
    <div className="w-3/4 flex flex-col gap-5 items-center border border-purple-500 rounded-lg shadow-lg p-5">
      {isTeacherMode && (
        <div className="w-full p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Drag items into the correct order, then click
            "Save Correct Order".
          </p>
          <button
            onClick={saveCorrectOrder}
            className="mt-2 px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Save Correct Order
          </button>
          {correctOrder && (
            <p className="text-xs text-green-700 mt-1">
              Saved: {correctOrder.join(" → ")}
            </p>
          )}
        </div>
      )}

      <h2 className="text-black">{question}</h2>

      <div className="w-1/2 flex flex-col items-center justify-center">
        {list.map((item, index) => {
          const isCorrectPosition =
            isTeacherMode && correctOrder && correctOrder[index] === item;
          return (
            <p
              key={index}
              className={`w-full p-3 text-center border rounded-md cursor-pointer ${
                isCorrectPosition
                  ? "bg-green-100 border-green-400"
                  : itemList[index]
                  ? "bg-yellow-100 border-gray-300"
                  : "bg-purple-500 border-gray-300"
              } text-black`}
              draggable
              onDragStart={() => (draggedItem.current = index)}
              onDragEnter={() => {
                draggedOverItem.current = index;
                setItemList((prev) => {
                  const newList = [...prev];
                  newList[index] = true;
                  return newList;
                });
              }}
              onDragLeave={() => {
                setItemList((prev) => {
                  const newList = [...prev];
                  newList[index] = false;
                  return newList;
                });
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleSort(e, index)}
            >
              {item}
            </p>
          );
        })}
      </div>
    </div>
  );
}
