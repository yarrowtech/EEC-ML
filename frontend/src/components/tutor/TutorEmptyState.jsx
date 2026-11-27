/* eslint-disable react/prop-types */
import React from 'react';
import { BookOpen, Bot, ChevronRight, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

const ChoiceButton = ({ icon: Icon, eyebrow, title, onClick }) => (
  <Motion.button
    type="button"
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#E7E3D9] bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-[#F3DFAE] hover:bg-[#FFFCF5]"
  >
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B] transition-transform group-hover:scale-105">
      <Icon className="size-4.5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-[#B45309]">{eyebrow}</span>
      <span className="block truncate text-sm font-bold text-[#26332E]">{title}</span>
    </span>
    <ChevronRight className="size-4 shrink-0 text-[#C9C2B4] transition-transform group-hover:translate-x-0.5 group-hover:text-[#F59E0B]" />
  </Motion.button>
);

export default function TutorEmptyState({
  studentName,
  subjects,
  curriculumStatus = 'ready',
  selectedSubject,
  topics,
  selectedTopic,
  starters,
  onChooseSubject,
  onChooseTopic,
  onChooseStarter,
  typingExample = '',
}) {
  const needsSubject = !selectedSubject;
  const needsTopic = selectedSubject && !selectedTopic && topics.length > 0;
  const loadingSubjects = needsSubject && curriculumStatus === 'loading';
  const curriculumUnavailable = needsSubject && ['empty', 'error'].includes(curriculumStatus);

  let title = `What would you like to learn, ${studentName}?`;
  let description = 'Choose a subject first so every answer can use the right teacher material.';
  if (loadingSubjects) {
    title = 'Preparing your learning space…';
    description = 'Loading your subjects and teacher-published chapters.';
  } else if (curriculumUnavailable) {
    title = `Ask me a general question, ${studentName}`;
    description = 'Your subject list is unavailable right now, but the tutor can still help with a question you type below.';
  } else if (needsTopic) {
    title = `Choose a chapter in ${selectedSubject.title}`;
    description = 'This keeps diagrams, examples, and explanations inside the correct lesson.';
  } else if (selectedSubject) {
    title = `Ready for ${selectedTopic || selectedSubject.title}`;
    description = 'Tap an idea below to start, or type your own question in the box at the bottom.';
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center py-3"
    >
      <div className="text-center">
        <p className="font-[Nunito] text-lg font-extrabold text-[#26332E]">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#78827B]">{description}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {loadingSubjects && [1, 2, 3, 4].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-2xl border border-[#EEEAE1] bg-[#FBF9F4]" />
        ))}

        {needsSubject && !loadingSubjects && subjects.slice(0, 8).map((subject) => (
          <ChoiceButton
            key={subject.key}
            icon={BookOpen}
            eyebrow="Subject"
            title={subject.title}
            onClick={() => onChooseSubject(subject.key)}
          />
        ))}

        {needsTopic && topics.slice(0, 8).map((topic) => (
          <ChoiceButton
            key={`${topic.type}-${topic.title}`}
            icon={MessageCircleQuestion}
            eyebrow={topic.type}
            title={topic.title}
            onClick={() => onChooseTopic(topic.title)}
          />
        ))}

        {((!needsSubject && !needsTopic) || curriculumUnavailable) && starters.map((starter) => (
          <ChoiceButton
            key={starter.text}
            icon={starter.icon || Sparkles}
            eyebrow={starter.mode}
            title={starter.text}
            onClick={() => onChooseStarter(starter)}
          />
        ))}
      </div>

      {/* Moving example questions (typewriter) — ideas for what to ask */}
      {!loadingSubjects && typingExample && (
        <p className="mt-4 min-h-5 text-center text-xs text-[#8D968F]" aria-hidden="true">
          Try asking: <span className="font-semibold text-[#B45309]">{typingExample}</span>
        </p>
      )}
    </Motion.div>
  );
}
