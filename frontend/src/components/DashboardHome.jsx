import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import WelcomeCard from './WelcomeCard';
import CourseProgress from './CourseProgress';
import AchievementCard from './AchievementCard';
import CalendarWidget from './CalendarWidget';
import QuickStats from './QuickStats';
import TestPetButton from './TestPetButton';
import DashboardPet from './DashboardPet';
import RecommendationWidget from './RecommendationWidget';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const authHdrs = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const ProgressTrendChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCachedJson(`${API_BASE}/api/exam/results/me`, { ttlMs: 5 * 60 * 1000 })
      .then((r) => {
        const results = r?.data?.data || [];
        const sorted = [...results]
          .filter((r) => r.marks != null && r.examId?.date)
          .sort((a, b) => new Date(a.examId.date) - new Date(b.examId.date))
          .slice(-10)
          .map((r) => ({
            name: r.examId?.title
              ? r.examId.title.slice(0, 12)
              : new Date(r.examId.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            marks: Number(r.marks),
            subject: r.examId?.subject || '',
          }));
        setChartData(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || chartData.length < 2) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
      <p className="mb-3 text-sm font-black text-indigo-900">Score Trend</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6366f1' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6366f1' }} domain={[0, 100]} />
          <ReTooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e0e7ff' }}
            formatter={(v) => [`${v} marks`, 'Score']}
          />
          <Line
            type="monotone"
            dataKey="marks"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
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
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
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

const tierColor = (score) => score >= 80 ? 'bg-emerald-200' : score >= 60 ? 'bg-amber-200' : 'bg-red-200';
const tierText = (score) => score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-600';

const MasteryTopicsCard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCachedJson(`${API_BASE}/api/student-dashboard/mastery-topics`, { ttlMs: 5 * 60 * 1000 })
      .then((r) => setData(r?.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading || !data.length) return null;
  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-black text-gray-800">Topic Mastery</p>
      <div className="space-y-2">
        {data.slice(0, 6).map((t) => (
          <div key={t.topicId}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="truncate max-w-[65%] font-medium">{t.topicTitle}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{t.subject}</span>
                <span className={`font-bold ${tierText(t.score)}`}>{t.score}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${tierColor(t.score)}`} style={{ width: `${t.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LearningStreakCard = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchCachedJson(`${API_BASE}/api/student-dashboard/learning-streak`, { ttlMs: 5 * 60 * 1000 })
      .then((r) => setData(r?.data?.data || null))
      .catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 px-4 py-3 shadow-sm flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200">
        <span className="text-lg leading-none">{data.streak >= 7 ? '🏆' : data.streak >= 3 ? '⚡' : '📖'}</span>
      </div>
      <div>
        <p className="text-sm font-black text-violet-900">{data.streak} day learning streak</p>
        <p className="text-xs text-violet-600">{data.totalActiveDays} active days total</p>
      </div>
    </div>
  );
};

const TimeBySubjectCard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCachedJson(`${API_BASE}/api/student-dashboard/time-by-subject`, { ttlMs: 5 * 60 * 1000 })
      .then((r) => setData(r?.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading || !data.length) return null;
  const max = Math.max(...data.map((d) => d.totalMinutes), 1);
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-black text-gray-800">Time Spent by Subject</p>
      <div className="space-y-2">
        {data.slice(0, 5).map((d) => (
          <div key={d.subject}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="font-medium">{d.subject}</span>
              <span className="text-gray-400">{d.totalMinutes}m</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-200" style={{ width: `${(d.totalMinutes / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FlashcardStatsCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCachedJson(`${API_BASE}/api/student-dashboard/flashcard-stats`, { ttlMs: 5 * 60 * 1000 })
      .then((r) => setData(r?.data?.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading || !data || data.totalAttempts === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-gray-800">Flashcard Recall</p>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{data.overallRate}% recall</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-amber-200" style={{ width: `${data.overallRate}%` }} />
      </div>
      <div className="space-y-1.5">
        {data.byTopic.slice(0, 3).map((t) => (
          <div key={t.topicId} className="flex items-center justify-between text-xs">
            <span className="text-gray-600 truncate max-w-[65%]">{t.topicTitle}</span>
            <span className={`font-semibold ${t.recallRate >= 70 ? 'text-emerald-600' : t.recallRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{t.recallRate}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-gray-400">{data.totalAttempts} total flashcard attempts</p>
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

      {/* Learning Streak (learning-event based) */}
      <LearningStreakCard />

      {/* Progress Trend */}
      <ProgressTrendChart />

      {/* Quick Stats */}
      <QuickStats />

      {/* New tracking cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MasteryTopicsCard />
        <TimeBySubjectCard />
        <FlashcardStatsCard />
      </div>

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
          {/* Personalised Recommendations */}
          <RecommendationWidget />
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
