import React, { useEffect, useState } from 'react';
import { ExternalLink, Images } from 'lucide-react';
import { API_BASE } from '@/config/api';

export const safeSourcePageUrl = (sourceUrl, pageNumber) => {
  try {
    const url = new URL(String(sourceUrl || ''));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = `page=${Number(pageNumber) || 1}`;
    return url.toString();
  } catch {
    return '';
  }
};

const ProtectedVisualPage = ({ materialId, pageNumber, sourceName }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const params = new URLSearchParams({ materialId, page: String(pageNumber) });
    fetch(`${API_BASE}/api/ai-tutor/source-page?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Page preview unavailable');
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Page preview unavailable');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [materialId, pageNumber]);

  if (error) return <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{error}</p>;
  if (!imageUrl) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" aria-label="Loading visual source" />;
  return (
    <img
      src={imageUrl}
      alt={`${sourceName}, page ${pageNumber}`}
      className="max-h-[560px] w-full rounded-lg border border-slate-200 bg-white object-contain"
    />
  );
};

const VisualSourceCard = ({ source }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details
      className="overflow-hidden rounded-xl border border-indigo-100 bg-white"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700">
        <span>{source.sourceName} · page {source.pageNumber}</span>
        <ExternalLink className="size-3.5 text-indigo-500" />
      </summary>
      <div className="border-t border-indigo-100 p-2">
        {isOpen && (
          <ProtectedVisualPage
            materialId={source.materialId}
            pageNumber={source.pageNumber}
            sourceName={source.sourceName}
          />
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
        >
          Download original material <ExternalLink className="size-3" />
        </a>
      </div>
    </details>
  );
};

const TutorVisualSources = ({ citations = [] }) => {
  const visualSources = citations.flatMap((citation) => (
    (citation?.visual_pages || []).map((page) => ({
      materialId: citation.material_id,
      sourceName: citation.source_name || 'Teacher material',
      pageNumber: page.page_number,
      url: safeSourcePageUrl(citation.source_url, page.page_number),
    }))
  )).filter((source) => source.url).slice(0, 3);

  if (visualSources.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-800">
        <Images className="size-4" /> Visual evidence from teacher material
      </div>
      {visualSources.map((source) => (
        <VisualSourceCard key={`${source.materialId}-${source.pageNumber}`} source={source} />
      ))}
    </div>
  );
};

export default TutorVisualSources;
