
import React, { useEffect, useMemo, useState } from 'react';
import { Award, AlertCircle, Calendar, Loader2, Trophy, Star, Medal, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchCachedJson } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const formatDate = (value) => {
  if (!value) return 'N/A';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const CATEGORY_STYLES = {
  Academic:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-400'    },
  Sports:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  Arts:        { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-400'    },
  Leadership:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-400'  },
  Community:   { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-400'  },
  Other:       { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400'   },
};

const categoryStyle = (cat) => CATEGORY_STYLES[cat] || CATEGORY_STYLES.Other;

/* Rank badge for top-3 achievements — gold / silver / bronze medal styling */
const RANK_STYLES = [
  { gradient: 'from-amber-400 to-yellow-500', ring: 'ring-amber-200', shadow: 'shadow-amber-200/70', icon: Trophy, iconColor: 'text-white' },
  { gradient: 'from-slate-300 to-slate-400',  ring: 'ring-slate-200', shadow: 'shadow-slate-200/70',  icon: Medal,  iconColor: 'text-white' },
  { gradient: 'from-orange-400 to-amber-600', ring: 'ring-orange-200', shadow: 'shadow-orange-200/70', icon: Star,   iconColor: 'text-white' },
];

const RankBadge = ({ idx }) => {
  const rank = RANK_STYLES[idx];
  if (rank) {
    const Icon = rank.icon;
    return (
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${rank.gradient} shadow-md ${rank.shadow} ring-2 ${rank.ring}`}>
        <Icon size={15} className={rank.iconColor} />
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-100">
      <Zap size={14} className="text-slate-400" />
    </div>
  );
};

const AchievementCard = () => {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    const fetchAchievements = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) { setAchievements([]); return; }
        const { data } = await fetchCachedJson(`${API_BASE}/api/student/auth/achievements`, {
          ttlMs: 5 * 60 * 1000,
          fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
        });
        setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
      } catch (err) {
        setError(err.message || 'Unable to load achievements');
        setAchievements([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  const recent = useMemo(() => achievements.slice(0, 5), [achievements]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 px-5 py-4">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-10 h-20 w-20 rounded-full bg-white/8" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 border border-white/40 shadow-sm">
              <Trophy size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-black text-white">Achievements</h2>
          </div>
          {!loading && !error && achievements.length > 0 && (
            <span className="rounded-full bg-white/25 border border-white/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              {achievements.length} earned
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5">

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <Loader2 size={18} className="animate-spin text-amber-500" />
            </div>
            <p className="text-xs font-medium text-slate-400">Loading achievements…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && recent.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-50 to-yellow-50 border border-amber-100">
              <Award size={28} className="text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">No achievements yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Keep working hard — your first badge is on its way!</p>
            </div>
          </div>
        )}

        {!loading && !error && recent.length > 0 && (
          <div className="space-y-3">
            {recent.map((item, idx) => {
              const cat   = item?.category || 'Other';
              const style = categoryStyle(cat);
              const achievementId = String(item?._id || item?.id || idx);
              return (
                <button
                  type="button"
                  key={item?._id || `${item?.title}-${idx}`}
                  onClick={() => navigate(`/student/achievements?achievementId=${encodeURIComponent(achievementId)}`)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-md"
                >
                  {/* Rank badge */}
                  <RankBadge idx={idx} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-left text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 group-hover:underline underline-offset-2">
                      {item?.title || 'Achievement'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {/* Category badge */}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {cat}
                      </span>
                      {/* Date */}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar size={10} />
                        {formatDate(item?.date)}
                      </span>
                    </div>
                    {/* {item?.description && (
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )} */}
                  </div>
                </button>
              );
            })}

            {achievements.length > 5 && (
              <p className="text-center text-[11px] font-semibold text-slate-400 pt-1">
                +{achievements.length - 5} more achievements
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementCard;
