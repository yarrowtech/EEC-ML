import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe, Youtube, FileText, Wrench, BookOpenCheck,
  Search, ExternalLink, Eye, Sparkles, ChevronDown, Loader2,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TYPE_META = {
  video:   { label: 'Video',   icon: Youtube,        color: 'bg-red-50 text-red-700 border-red-200' },
  article: { label: 'Article', icon: BookOpenCheck,  color: 'bg-sky-50 text-sky-700 border-sky-200' },
  pdf:     { label: 'PDF',     icon: FileText,       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  website: { label: 'Website', icon: Globe,          color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  tool:    { label: 'Tool',    icon: Wrench,         color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const FILTERS = ['all', 'video', 'article', 'pdf', 'website', 'tool'];

function ResourceCard({ resource, onOpen }) {
  const meta = TYPE_META[resource.resourceType] || TYPE_META.website;
  const TypeIcon = meta.icon;

  return (
    <article className="group flex flex-col rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_16px_40px_-28px_rgba(99,102,241,0.4)]">
      {/* Thumbnail */}
      <div className="relative h-36 overflow-hidden rounded-t-[20px] bg-slate-100">
        {resource.thumbnailUrl ? (
          <img
            src={resource.thumbnailUrl}
            alt={resource.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <TypeIcon className="h-12 w-12 text-slate-300" />
          </div>
        )}
        {/* Type badge */}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${meta.color}`}>
          <TypeIcon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {resource.subject && (
          <span className="mb-2 inline-block self-start rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {resource.subject}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 group-hover:text-indigo-700 transition-colors">
          {resource.title}
        </h3>
        {resource.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {resource.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {resource.source ? (
            <span className="text-xs font-medium text-slate-400">{resource.source}</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Eye className="h-3 w-3" /> {resource.viewCount || 0} views
            </span>
          )}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(resource._id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function ExternalStudyResources({ origin = 'school' }) {
  const token = localStorage.getItem('token');
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/external-resources/student`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setResources(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const trackOpen = (id) => {
    fetch(`${API_BASE}/api/external-resources/student/${id}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const scopedResources = useMemo(() => {
    return resources.filter((resource) => {
      const resourceOrigin = String(
        resource.origin || resource.resourceOrigin || resource.sourceScope || 'school'
      ).toLowerCase();
      return origin === 'eec' ? resourceOrigin === 'eec' : resourceOrigin !== 'eec';
    });
  }, [resources, origin]);

  const filtered = useMemo(() => {
    return scopedResources.filter((r) => {
      const matchType = activeType === 'all' || r.resourceType === activeType;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.source?.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [scopedResources, activeType, search]);

  const displayed = showAll ? filtered : filtered.slice(0, 8);

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.3)]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              {origin === 'eec' ? 'EEC' : 'School'} Add Ons
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
              {origin === 'eec' ? 'EEC Learning Resources' : 'School Learning Resources'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {origin === 'eec'
                ? 'Videos, articles, PDFs and tools curated by EEC to extend your learning.'
                : 'Videos, articles, PDFs and tools selected by your school and teachers.'}
            </p>
          </div>

          {/* Search */}
          <div className="relative shrink-0 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search resources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((t) => {
            const count = t === 'all' ? scopedResources.length : scopedResources.filter((r) => r.resourceType === t).length;
            if (count === 0 && t !== 'all') return null;
            const meta = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeType === t
                    ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {meta && <meta.icon className="h-3 w-3" />}
                {t === 'all' ? 'All' : meta?.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            <Globe className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              {search || activeType !== 'all'
                ? 'No resources match your filters.'
                : `No ${origin === 'eec' ? 'EEC' : 'school'} add-ons are available yet.`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayed.map((r) => (
                <ResourceCard key={r._id} resource={r} onOpen={trackOpen} />
              ))}
            </div>

            {filtered.length > 8 && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  {showAll ? 'Show less' : `Show all ${filtered.length} resources`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
