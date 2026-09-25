import React from 'react';

// Letterhead-style rendering of a system-generated notice
// (Notification.document, template 'formal_notice'). Shared by the student
// Notice Board and the parent Notices page.

const formatLongDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const isFormalNotice = (notice) => notice?.document?.template === 'formal_notice';

const FormalNotice = ({ document: doc, className = '' }) => {
  if (!doc) return null;
  const school = doc.school || {};
  const contact = [school.email && `Email: ${school.email}`, school.phone && `Phone: ${school.phone}`].filter(Boolean).join(' | ');
  const status = doc.details?.find((d) => d.label === 'Status')?.value;

  return (
    <article className={`mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm ${className}`}>
      {/* Letterhead */}
      <header className="flex flex-col items-center gap-2 px-5 pt-6 text-center sm:px-8">
        {school.logoUrl && <img src={school.logoUrl} alt="" className="h-14 w-14 rounded-full object-contain" />}
        <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 sm:text-lg">{school.name}</h2>
        {school.address && <p className="text-xs text-slate-500">{school.address}</p>}
        {school.board && <p className="text-xs text-slate-500">Affiliated to {school.board}</p>}
        {contact && <p className="text-[11px] text-slate-400">{contact}</p>}
      </header>
      <hr className="mx-5 mt-4 border-t-2 border-slate-800 sm:mx-8" />

      <div className="space-y-4 px-5 py-5 text-sm leading-6 sm:px-8">
        <div className="flex flex-wrap justify-between gap-2 text-xs font-medium text-slate-600">
          <span>Notice ID: <span className="font-semibold text-slate-800">{doc.noticeNo}</span></span>
          <span>Date: <span className="font-semibold text-slate-800">{formatLongDate(doc.date)}</span></span>
        </div>

        <div className="text-center">
          <p className="text-base font-bold tracking-[0.3em] text-slate-900">{doc.heading}</p>
          <p className="mt-1 text-sm font-semibold uppercase text-slate-800 underline underline-offset-4">{doc.subject}</p>
        </div>

        <p className="font-semibold">{doc.salutation}</p>
        {(doc.paragraphs || []).map((p) => <p key={p}>{p}</p>)}

        {Array.isArray(doc.details) && doc.details.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-center text-xs font-bold tracking-wider text-slate-700">{doc.detailsTitle}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {doc.details.map((d) => (
                <React.Fragment key={d.label}>
                  <dt className="text-slate-500">{d.label}</dt>
                  <dd className="font-semibold text-slate-800">
                    :{' '}
                    {d.label === 'Status' ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d.value}</span>
                    ) : d.value}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        )}

        {(doc.sections || []).map((s) => (
          <div key={s.title}>
            <p className="font-semibold">{s.title}</p>
            <p>{s.text}</p>
          </div>
        ))}

        {(doc.closing || []).map((p) => <p key={p}>{p}</p>)}

        <div className="pt-2 text-right text-sm">
          {(doc.signature || []).filter(Boolean).map((line, i) => (
            <p key={line} className={i === 0 ? '' : 'font-semibold'}>{line}</p>
          ))}
        </div>
      </div>

      {doc.footer && (
        <footer className="border-t border-slate-200 px-5 py-3 text-center text-[11px] italic text-slate-400 sm:px-8">{doc.footer}</footer>
      )}
    </article>
  );
};

export default FormalNotice;
