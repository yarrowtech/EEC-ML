import React from 'react';

/*
 * One page header for every parent screen.
 *   <PageHeader title="Attendance" icon={Calendar} subtitle="…" actions={<button/>}>
 *     <ChildSwitcher … />
 *   </PageHeader>
 */
const PageHeader = ({ title, icon: Icon, subtitle, actions, children }) => (
  <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    {children && <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>}
  </header>
);

export default PageHeader;
