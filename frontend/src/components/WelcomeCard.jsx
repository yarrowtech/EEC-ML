import React, { useState, useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Sun, Moon, Cloud, Lightbulb, Target, Star, Zap, Heart, Trophy,
  BookOpen, Rocket, Play, Pause, ChevronLeft, ChevronRight,
  Hash, MapPin, GraduationCap, Sparkles, Brain,
} from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';

const quickTips = [
  { text: "Success is the sum of small efforts repeated day in and day out.", emoji: "🚀", icon: Rocket },
  { text: "The future belongs to those who believe in the beauty of their dreams.", emoji: "✨", icon: Star },
  { text: "Learning never exhausts the mind. Every new thing makes you stronger!", emoji: "📚", icon: BookOpen },
  { text: "Your potential is endless. Go do what you were created to do!", emoji: "⚡", icon: Zap },
  { text: "Believe in yourself and all that you are. You're capable of amazing things!", emoji: "💪", icon: Heart },
  { text: "Champions are made from desire, dream, and vision!", emoji: "🏆", icon: Trophy },
  { text: "Every expert was once a beginner. Keep learning every day!", emoji: "🌟", icon: Target },
  { text: "Innovation distinguishes between a leader and a follower. Think differently!", emoji: "💡", icon: Lightbulb },
  { text: "Don't watch the clock; do what it does — keep going!", emoji: "⏰", icon: Zap },
  { text: "The beautiful thing about learning is nobody can take it away from you!", emoji: "🧠", icon: BookOpen },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', icon: Sun };
  if (h < 18) return { text: 'Good Afternoon', icon: Cloud };
  return { text: 'Good Evening', icon: Moon };
};

const WelcomeCard = () => {
  const { profile, loading } = useStudentDashboard();

  const studentData = profile || {
    name: 'Student', username: '', grade: '', section: '', roll: '',
    className: '', sectionName: '', rollNumber: '', campusName: '',
    campusType: '', schoolName: '', schoolLogo: null, profilePic: null,
  };

  const displayClass   = studentData.className  || studentData.grade;
  const displaySection = studentData.sectionName || studentData.section;
  const displayRoll    = studentData.rollNumber  || studentData.roll;
  const displayCampus  = studentData.campusName
    ? studentData.campusType
      ? `${studentData.campusName} (${studentData.campusType})`
      : studentData.campusName
    : '';

  const profileImage   = studentData.profilePic || studentData.avatar || '';
  const hasProfileImage = typeof profileImage === 'string' && profileImage.trim() !== '';
  const nameParts  = (studentData.name || '').trim().split(/\s+/).filter(Boolean);
  const initials   = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S');

  const greeting    = getGreeting();
  const GreetingIcon = greeting.icon;

  const [currentTip, setCurrentTip] = useState(0);
  const [isPaused, setIsPaused]     = useState(false);
  const [animOut, setAnimOut]       = useState(false);

  const changeTip = (dir) => {
    setAnimOut(true);
    setTimeout(() => {
      setCurrentTip(p => (p + dir + quickTips.length) % quickTips.length);
      setAnimOut(false);
    }, 180);
  };

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => changeTip(1), 9000);
    return () => clearInterval(id);
  }, [isPaused]);

  const tip    = quickTips[currentTip];
  const TipIcon = tip.icon;

  if (loading) {
    return (
      <div className="animate-pulse rounded-3xl bg-linear-to-br from-amber-300 via-yellow-400 to-orange-400 p-6 shadow-lg shadow-amber-200/60">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-16 w-16 rounded-2xl bg-white/30" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-white/30 rounded-full" />
            <div className="h-6 w-40 bg-white/40 rounded-full" />
            <div className="h-3 w-32 bg-white/20 rounded-full" />
          </div>
        </div>
        <div className="h-20 rounded-xl bg-white/20" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 shadow-lg shadow-amber-300/50">

      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-6 right-24 h-20 w-20 rounded-full bg-white/[0.07]" />
      <div className="pointer-events-none absolute top-1/2 right-10 h-32 w-px -translate-y-1/2 bg-white/20" />

      {/* Floating brain watermarks — smart-learning motif */}
      <Motion.div
        className="pointer-events-none absolute -right-8 -top-6 text-white/10"
        animate={{ y: [0, -14, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Brain size={168} strokeWidth={1} />
      </Motion.div>
      <Motion.div
        className="pointer-events-none absolute right-20 bottom-2 hidden text-white/10 sm:block"
        animate={{ y: [0, 10, 0], rotate: [3, -3, 3] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      >
        <Brain size={64} strokeWidth={1} />
      </Motion.div>
      <Motion.div
        className="pointer-events-none absolute left-8 bottom-6 hidden text-white/8 md:block"
        animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      >
        <Brain size={44} strokeWidth={1} />
      </Motion.div>

      <div className="relative z-10 p-5 sm:p-6">

        {/* ── Top row ── */}
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="relative shrink-0">
            {hasProfileImage ? (
              <img
                src={profileImage} alt="Profile"
                className="h-16 w-16 rounded-2xl border-4 border-white/30 object-cover shadow-xl"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl border-4 border-white/30 bg-white/25 shadow-xl flex items-center justify-center">
                <span className="text-2xl font-black text-white">{initials.toUpperCase()}</span>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-400 shadow" />
            </span>
          </div>

          {/* Greeting + name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <GreetingIcon size={15} className="text-white/75 shrink-0" />
              <span className="text-sm text-white/80 font-medium">{greeting.text}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">
              {studentData.name}!
            </h1>
            {studentData.username && (
              <p className="text-xs text-white/60 mt-0.5">ID: {studentData.username}</p>
            )}
          </div>

          {/* Date block */}
          <div className="shrink-0 rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Today</p>
            <p className="text-2xl font-black text-white leading-none mt-0.5">
              {new Date().toLocaleDateString('en-US', { day: 'numeric' })}
            </p>
            <p className="text-[11px] font-semibold text-white/80">
              {new Date().toLocaleDateString('en-US', { month: 'short' })}
            </p>
            <p className="text-[10px] text-white/60 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
          </div>
        </div>

        {/* ── Info chips ── */}
        {(displayClass || displaySection || displayRoll || displayCampus) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {displayClass && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <GraduationCap size={11} />
                Class {displayClass}{displaySection ? ` · ${displaySection}` : ''}
              </span>
            )}
            {displayRoll && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Hash size={11} />
                Roll {displayRoll}
              </span>
            )}
            {displayCampus && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <MapPin size={11} />
                {displayCampus}
              </span>
            )}
          </div>
        )}

        {/* ── Quote / Tip ── */}
        <div className="group mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
                <Sparkles size={12} className="text-white" />
              </div>
              <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Daily Boost</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white/70">
                {currentTip + 1}/{quickTips.length}
              </span>
            </div>
            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button onClick={() => changeTip(-1)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
                <ChevronLeft size={13} className="text-white" />
              </button>
              <button onClick={() => setIsPaused(p => !p)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
                {isPaused ? <Play size={13} className="text-white" /> : <Pause size={13} className="text-white" />}
              </button>
              <button onClick={() => changeTip(1)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
                <ChevronRight size={13} className="text-white" />
              </button>
            </div>
          </div>

          <div className={`flex items-start gap-2.5 transition-all duration-200 ${animOut ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}>
            <span className="text-lg leading-none mt-0.5">{tip.emoji}</span>
            <p className="text-sm font-medium text-white/95 leading-relaxed">{tip.text}</p>
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex items-center gap-1">
            {quickTips.map((_, i) => (
              <button
                key={i}
                onClick={() => { setAnimOut(true); setTimeout(() => { setCurrentTip(i); setAnimOut(false); }, 180); }}
                className={`rounded-full transition-all duration-300 ${i === currentTip ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/60'}`}
              />
            ))}
            <span className="ml-auto text-[10px] text-white/50">
              {isPaused ? 'Paused' : 'Auto'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
