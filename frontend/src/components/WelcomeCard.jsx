import React, { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStudentDashboard } from './StudentDashboardContext';

// ── Constants ──────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "Learning never exhausts the mind. Every new thing makes you stronger!", emoji: "📚" },
  { text: "Small steps every day add up to big results over time.", emoji: "🚶" },
  { text: "Curiosity is the engine of achievement. Keep asking why.", emoji: "🔍" },
  { text: "Mistakes are proof that you are trying. Keep going!", emoji: "💪" },
  { text: "The expert in anything was once a beginner.", emoji: "🌱" },
  { text: "Knowledge is a treasure that follows its owner everywhere.", emoji: "💎" },
  { text: "Focus on progress, not perfection.", emoji: "🎯" },
  { text: "Don't watch the clock; do what it does — keep going!", emoji: "⏰" },
  { text: "Believe in yourself. You're capable of amazing things!", emoji: "✨" },
  { text: "Champions are made from desire, dream, and vision!", emoji: "🏆" },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatDate = () => {
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
};

// ── SVG Icons ──────────────────────────────────────────────────────────────
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#6b7280" strokeWidth="2"/>
    <path d="M3 9h18M8 2v4M16 2v4" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const HandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M8 11V6a1.5 1.5 0 013 0v4M11 10V4.5a1.5 1.5 0 013 0V10M14 10V6.5a1.5 1.5 0 013 0V13a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 14a1.5 1.5 0 012.5-1.6L8 14"
      stroke="#4f46e5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"
      stroke="#4f46e5" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M12 6.5v13" stroke="#4f46e5" strokeWidth="1.8"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#6b7280"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M15 6l-6 6 6 6" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="7" y="5" width="3.5" height="14" rx="1" fill="#6b7280"/>
    <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="#6b7280"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M8 5v14l11-7z" fill="#6b7280"/>
  </svg>
);

// ── WelcomeCard ─────────────────────────────────────────────────────────────
const WelcomeCard = () => {
  const { profile, loading } = useStudentDashboard();

  const studentData = profile || {
    name: 'Student', username: '', grade: '', section: '',
    className: '', sectionName: '', rollNumber: '', roll: '',
    campusName: '', campusType: '', profilePic: null,
  };

  const displayClass   = studentData.className  || studentData.grade   || '';
  const displaySection = studentData.sectionName || studentData.section || '';
  const displayRoll    = studentData.rollNumber  || studentData.roll    || '';
  const displayCampus  = studentData.campusName
    ? studentData.campusType
      ? `${studentData.campusName} (${studentData.campusType})`
      : studentData.campusName
    : '';

  const profileImage    = studentData.profilePic || studentData.avatar || '';
  const hasProfileImage = typeof profileImage === 'string' && profileImage.trim() !== '';
  const nameParts  = (studentData.name || '').trim().split(/\s+/).filter(Boolean);
  const initials   = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S');

  // Daily Boost state
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [direction, setDirection] = useState(1);

  const go = useCallback((step) => {
    setDirection(step);
    setCurrent(p => (p + step + QUOTES.length) % QUOTES.length);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => go(1), 5000);
    return () => clearInterval(id);
  }, [playing, go]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full rounded-[32px] bg-white p-10 shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-[130px] h-[130px] rounded-full bg-gray-200" />
          <div className="h-8 w-40 rounded-full bg-gray-200" />
          <div className="h-5 w-48 rounded-full bg-gray-100" />
          <div className="h-5 w-32 rounded-full bg-gray-100" />
          <div className="h-12 w-72 rounded-full bg-gray-100 mt-2" />
          <div className="h-16 w-full rounded-full bg-gray-100 mt-2" />
        </div>
      </div>
    );
  }

  const tags = [
    displayClass && displaySection ? `Class ${displayClass} : ${displaySection}` : displayClass ? `Class ${displayClass}` : null,
    displayRoll ? `Roll ${displayRoll}` : null,
    displayCampus || null,
  ].filter(Boolean);

  const quoteVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full rounded-[32px] bg-white px-3 py-3 shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)] flex flex-col items-center"
    >

      {/* ── Avatar ── */}
      <Motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative mb-2"
      >
        {hasProfileImage ? (
          <img
            src={profileImage}
            alt="Profile"
            className="w-[130px] h-[130px] rounded-full border-[3px] border-gray-200 object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-[130px] h-[130px] rounded-full border-[2px] border-gray-200 bg-[#eef2ff] flex items-center justify-center">
            <span className="text-4xl font-black text-[#4f46e5] select-none">{initials.toUpperCase()}</span>
          </div>
        )}
        {/* Online dot */}
        <span className="absolute bottom-1 right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />
        </span>
      </Motion.div>

      {/* ── Date pill ── */}
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35 }}
        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-5 py-2 mb-1"
      >
        <CalendarIcon />
        <span className="text-[17px] font-semibold text-[#4f46e5]">{formatDate()}</span>
      </Motion.div>

      {/* ── Name + ID + Greeting ── */}
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.35 }}
        className="flex flex-col items-center gap-1"
      >
        <h1 className="text-[36px] font-bold text-[#111827] leading-tight tracking-[-0.5px]">
          {studentData.name || 'Student'}
        </h1>
        {studentData.username && (
          <p className="text-[16px] text-[#9ca3af] font-normal mb-1">
            ID: {studentData.username}
          </p>
        )}
        <div className="inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-5 py-2">
          <HandIcon />
          <span className="text-[18px] font-medium text-[#4f46e5]">{getGreeting()}</span>
        </div>
      </Motion.div>

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
          className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-7 py-3 mt-2 flex-wrap justify-center"
        >
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <span className="w-[9px] h-[9px] rounded-full bg-[#6366f1] shrink-0" />
              <span className="text-[17px] font-medium text-[#4338ca]">{tag}</span>
            </span>
          ))}
        </Motion.div>
      )}

      {/* ── Daily Boost ── */}
      <Motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full mt-3 rounded-[32px] bg-gray-100 px-7 py-5 flex flex-col items-center gap-6 flex-wrap"
      >
        {/* Left: label + counter */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <BoltIcon />
            <span className="text-[16px] font-semibold text-[#4b5563] tracking-[0.4px] whitespace-nowrap uppercase">
              Daily Boost
            </span>
          </div>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[14px] font-semibold text-[#4f46e5] whitespace-nowrap">
            {current + 1}/{QUOTES.length}
          </span>
        </div>

        {/* Middle: quote */}
        <div className="flex-1 min-w-0 flex items-center gap-3.5">
          <div className="shrink-0"><BookIcon /></div>
          <div className="relative overflow-hidden min-h-[28px] flex-1">
            <AnimatePresence custom={direction} mode="wait">
              <Motion.p
                key={current}
                custom={direction}
                variants={quoteVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="text-[18px] text-[#374151] leading-snug"
              >
                {QUOTES[current].text}
              </Motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          {/* Nav buttons */}
          <div className="flex items-center gap-2.5">
            <Motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => go(-1)}
              className="w-[38px] h-[38px] rounded-full bg-white border border-gray-200 flex items-center justify-center cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft />
            </Motion.button>
            <Motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setPlaying(p => !p)}
              className="w-[38px] h-[38px] rounded-full bg-white border border-gray-200 flex items-center justify-center cursor-pointer"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Motion.button>
            <Motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => go(1)}
              className="w-[38px] h-[38px] rounded-full bg-white border border-gray-200 flex items-center justify-center cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight />
            </Motion.button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-[7px]">
            {QUOTES.map((_, i) => (
              <Motion.button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                animate={{
                  width: i === current ? 20 : 7,
                  backgroundColor: i === current ? '#4f46e5' : '#d1d5db',
                }}
                transition={{ duration: 0.3 }}
                className="h-[7px] rounded-full cursor-pointer border-none p-0 outline-none"
                aria-label={`Quote ${i + 1}`}
              />
            ))}
          </div>

          <span className="text-[13px] text-[#9ca3af] whitespace-nowrap">
            {playing ? 'Auto' : 'Paused'}
          </span>
        </div>
      </Motion.div>

    </Motion.div>
  );
};

export default WelcomeCard;
