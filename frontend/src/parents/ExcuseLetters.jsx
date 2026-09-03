import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, FileText, RefreshCw, User } from 'lucide-react';
import { parentApiJson } from './parentApi';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
    border: 'border-l-rose-500',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
};

const formatDate = (value) => (
  value
    ? new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : '—'
);

const ExcuseLetters = () => {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLetters = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await parentApiJson('/api/excuse-letters/parent', {}, navigate);
      setLetters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load excuse letters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, []);

  if (loading) {
    return <div className="p-1"><Loading label="excuse letters" rows={3} /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Excuse Letters"
        icon={FileText}
        subtitle="Leave requests submitted for your children."
        actions={(
          <button
            type="button"
            onClick={loadLetters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700"
          >
            <RefreshCw size={13} /> Reload
          </button>
        )}
      />

      {error && <ErrorState message={error} onRetry={loadLetters} />}

      {letters.length === 0 ? (
        <EmptyState icon={FileText} title="No excuse letters yet" hint="Leave requests your children submit at school will show up here." />
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => {
            const status = STATUS_CONFIG[letter.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={letter._id}
                className={`border-l-4 ${status.border} overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
                        <User size={16} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{letter.studentName || 'Student'}</p>
                        <p className="text-xs text-gray-500">
                          Class {letter.className || '—'}{letter.sectionName ? `-${letter.sectionName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} className="text-indigo-500" />
                      {formatDate(letter.dateFrom)} → {formatDate(letter.dateTo)}
                    </span>
                    {letter.createdAt && (
                      <span className="inline-flex items-center gap-1.5 text-gray-400">
                        <Clock size={12} /> Submitted {formatDate(letter.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                      {letter.reasonType || 'Other'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{letter.reason}</p>
                    {letter.additionalNotes && (
                      <p className="mt-2 text-xs text-gray-500">{letter.additionalNotes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExcuseLetters;
