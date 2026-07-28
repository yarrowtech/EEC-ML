import React, { useMemo, useState, useEffect, useRef } from 'react';
import WelcomeCard from './WelcomeCard';
import CourseProgress from './CourseProgress';
import AchievementCard from './AchievementCard';
import CalendarWidget from './CalendarWidget';
import QuickStats from './QuickStats';
import TestPetButton from './TestPetButton';
import DashboardPet from './DashboardPet';
import { useStudentDashboard } from './StudentDashboardContext';

const computeStreak = (recentAttendance) => {
  if (!Array.isArray(recentAttendance) || recentAttendance.length === 0) return 0;
  const sorted = [...recentAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const record of sorted) {
    if (record.status === 'present') streak++;
    else break;
  }
  return streak;
};

const STREAK_MILESTONES = [3, 5, 7, 10];

const StreakTracker = () => {
  const { recentAttendance, stats, loading } = useStudentDashboard();
  const streak = useMemo(() => computeStreak(recentAttendance), [recentAttendance]);
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) || null;
  const attPct = stats?.attendancePercentage ?? null;

  if (loading) return null;
  if (!recentAttendance?.length) return null;

  const dots = recentAttendance
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7);

  const streakLabel = streak === 0
    ? 'Start your streak today!'
    : streak === 1
    ? '1 day streak 🔥'
    : `${streak} day streak 🔥`;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      {/* Streak badge */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200/60">
          <span className="text-2xl leading-none select-none">{streak >= 7 ? '🏆' : streak >= 3 ? '🔥' : '✨'}</span>
        </div>
        <div>
          <p className="font-black text-lg text-amber-900 leading-tight">{streakLabel}</p>
          <p className="text-xs text-amber-700/70">
            {nextMilestone
              ? `${nextMilestone - streak} more day${nextMilestone - streak !== 1 ? 's' : ''} to reach ${nextMilestone}-day milestone`
              : 'Incredible consistency! Keep it up!'}
          </p>
        </div>
      </div>

      {/* Day dots */}
      <div className="flex items-center gap-1.5 sm:ml-auto">
        {dots.map((record, i) => {
          const isPresent = record.status === 'present';
          const isLeave = record.status === 'leave';
          return (
            <div
              key={record.date || i}
              title={`${new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — ${record.status}`}
              className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                isPresent
                  ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-200'
                  : isLeave
                  ? 'bg-blue-200 border-blue-300 text-blue-700'
                  : 'bg-white border-red-200 text-red-400'
              }`}
            >
              {isPresent ? '✓' : isLeave ? 'L' : '✗'}
            </div>
          );
        })}
        {attPct !== null && (
          <span className="ml-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
            {attPct}%
          </span>
        )}
      </div>
    </div>
  );
};

const DashboardHome = () => {
  const [pets, setPets] = useState([]);
  const [containerBounds, setContainerBounds] = useState({ width: 0, height: 0 });
  const containerRef = useRef();

  // Update container bounds on resize
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    
    // Update bounds when content changes
    const observer = new ResizeObserver(updateBounds);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBounds);
      observer.disconnect();
    };
  }, []);

  // Pet names for different types
  const petNames = {
    puppy: ['Buddy', 'Max', 'Luna', 'Charlie', 'Bailey', 'Rocky', 'Bella', 'Duke'],
    cat: ['Whiskers', 'Shadow', 'Mittens', 'Luna', 'Simba', 'Chloe', 'Tiger', 'Princess']
  };

  const addPet = (petType) => {
    const names = petNames[petType];
    const randomName = names[Math.floor(Math.random() * names.length)];
    
    const newPet = {
      id: Date.now() + Math.random(),
      type: petType,
      name: randomName,
      createdAt: Date.now()
    };
    
    setPets(prevPets => {
      return [...prevPets, newPet];
    });
  };

  const removePet = (petId) => {
    setPets(prevPets => prevPets.filter(pet => pet.id !== petId));
  };

  return (
    <div
      ref={containerRef}
      className="relative space-y-4 sm:space-y-6 p-4 sm:p-6"
    >
      {/* Welcome Section */}
      <WelcomeCard />

      {/* Streak Tracker */}
      <StreakTracker />

      {/* Quick Stats */}
      <QuickStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Course Progress */}
          <CourseProgress />

          {/* Achievements */}
          <AchievementCard />
        </div>

        {/* Sidebar - Right 1 column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Calendar */}
          <CalendarWidget />
        </div>
      </div>

      {/* Dashboard Pets */}
      {pets.map(pet => (
        <DashboardPet
          key={pet.id}
          pet={pet}
          onRemove={removePet}
          containerBounds={containerBounds}
        />
      ))}

      {/* Test Pet Button */}
      <TestPetButton 
        onAddPet={addPet} 
        activePets={pets}
      />
    </div>
  );
};

export default DashboardHome;
