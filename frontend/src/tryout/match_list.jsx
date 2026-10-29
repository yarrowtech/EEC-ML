import React, { useState } from "react";

export default function MatchList({ isTeacherMode = false }) {
  const [questionSet, setQuestionSet] = React.useState([
    {
      items: ["Car", "Plane", "Lake"],
      pairs: ["Drive", "Fly", "Swim"],
      correctMatches: {}, // { itemIndex: pair }
    },
  ]);

  return (
    <section className="w-[60vw] flex flex-col m-auto mt-10">
      {questionSet.map((question, index) => (
        <QuestionCard
          key={index}
          items={question.items}
          pairs={question.pairs}
          correctMatches={question.correctMatches}
          questionIndex={index}
          setQuestionSet={setQuestionSet}
          isTeacherMode={isTeacherMode}
        />
      ))}
    </section>
  );
}

function QuestionCard({
  items,
  pairs,
  correctMatches,
  questionIndex,
  setQuestionSet,
  isTeacherMode,
}) {
  const [allPairs, setAllPairs] = useState(pairs);
  const [showMatch, setShowMatch] = useState(
    items.map((_, i) => ({
      show: !!correctMatches?.[i],
      value: correctMatches?.[i] || "",
    }))
  );

  const handleDrop = (i, data) => {
    if (isTeacherMode) {
      setQuestionSet((prev) => {
        const updated = [...prev];
        updated[questionIndex] = {
          ...updated[questionIndex],
          correctMatches: {
            ...updated[questionIndex].correctMatches,
            [i]: data,
          },
        };
        return updated;
      });
    }
    const temp = [...showMatch];
    temp[i].show = true;
    temp[i].value = data;
    setShowMatch(temp);
    setAllPairs(allPairs.filter((pair) => pair !== data));
  };

  const handleRemove = (i) => {
    const temp = [...showMatch];
    const removedValue = temp[i].value;
    temp[i].show = false;
    temp[i].value = "";
    setShowMatch(temp);
    setAllPairs([...allPairs, removedValue]);

    if (isTeacherMode) {
      setQuestionSet((prev) => {
        const updated = [...prev];
        const newMatches = { ...updated[questionIndex].correctMatches };
        delete newMatches[i];
        updated[questionIndex] = {
          ...updated[questionIndex],
          correctMatches: newMatches,
        };
        return updated;
      });
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <h2 className="font-bold text-2xl text-black">Match Items</h2>

      {isTeacherMode && (
        <div className="w-3/4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            👩‍🏫 Teacher Mode — Drag each pair onto the correct item to set the
            answer key.
          </p>
          {Object.keys(correctMatches || {}).length > 0 && (
            <p className="text-xs text-green-700 mt-1">
              Matches set:{" "}
              {Object.entries(correctMatches)
                .map(([i, v]) => `${items[i]} → ${v}`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="w-3/4 grid grid-cols-3 gap-y-3">
        {items.map((item, i) => {
          const isCorrect = isTeacherMode && correctMatches?.[i] === showMatch[i].value;
          return (
            <div key={i} className="contents">
              <p className="min-h-10 p-2 min-w-10 rounded-lg border box-border border-purple-500 text-black">
                {item}
              </p>
              <hr className="self-center" />
              <p
                className={`min-h-10 p-2 min-w-10 rounded-lg border box-border ${
                  isCorrect
                    ? "bg-green-100 border-green-400"
                    : showMatch[i].show
                    ? "bg-yellow-100 border-purple-500 flex justify-between"
                    : "border-gray-300"
                } text-black`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const data = e.dataTransfer.getData("text");
                  handleDrop(i, data);
                }}
              >
                {showMatch[i].show ? (
                  <>
                    <span className="text-black">{showMatch[i].value}</span>
                    <button
                      onClick={() => handleRemove(i)}
                      className="bg-gray-200 px-2 rounded-md cursor-pointer"
                    >
                      x
                    </button>
                  </>
                ) : (
                  ""
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="w-full relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[30px] border-b-yellow-100 border-t-0 w-5 h-5"></div>
        <div className="bg-yellow-100 w-full flex items-center justify-center gap-2 p-5 rounded-xl">
          {allPairs.map((pair, index) => (
            <div
              draggable={true}
              onDragStart={(e) =>
                e.dataTransfer.setData("text", e.currentTarget.innerText)
              }
              className="bg-gray-200 px-5 py-2 rounded-lg cursor-grab border border-purple-300 hover:border-purple-500 text-black"
              key={index}
            >
              {pair}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
