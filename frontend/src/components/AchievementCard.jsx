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

/* Rank icon for top-3 achievements */
const RankBadge = ({ idx }) => {
  if (idx === 0) return <Trophy size={14} className="text-amber-500" />;
  if (idx === 1) return <Medal  size={14} className="text-slate-400" />;
  if (idx === 2) return <Star   size={14} className="text-orange-400" />;
  return <Zap size={14} className="text-slate-300" />;
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
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-400 to-yellow-500 shadow-sm shadow-amber-200">
            <Trophy size={15} className="text-white" />
          </div>
          <h2 className="text-sm font-black text-slate-800">Achievements</h2>
        </div>
        {!loading && !error && achievements.length > 0 && (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
            {achievements.length} earned
          </span>
        )}
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
              <Award size={26} className="text-slate-300" />
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
                  className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
                >
                  {/* Rank icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 shadow-sm group-hover:border-amber-200">
                    <RankBadge idx={idx} />
                  </div>

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
                    {item?.description && (
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
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
