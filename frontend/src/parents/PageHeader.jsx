import React from 'react';

/*
 * One page header for every parent screen.
 *   <PageHeader title="Attendance" icon={Calendar} subtitle="…" actions={<button/>}>
 *     <ChildSwitcher … />
 *   </PageHeader>
 */
const PageHeader = ({ title, icon: Icon, subtitle, actions, children }) => (
  <header className="p-page-header bg-white rounded-2xl">
    <div className="p-page-header__title">
      {Icon && (
        <span className="p-page-header__icon">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <p className="p-page-header__sub">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    {children && <div className="p-page-header__extra">{children}</div>}
  </header>
);

export default PageHeader;
