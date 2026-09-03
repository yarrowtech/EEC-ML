import React from 'react';
import { Inbox, AlertCircle } from 'lucide-react';

/*
 * One empty state and one error state for every parent screen.
 *
 *   <EmptyState title="No excuse letters yet" hint="They'll appear here once submitted." icon={FileText} />
 *   <ErrorState message="Couldn't load attendance." onRetry={reload} />
 *
 * Both answer the parent's two questions: is this normal, and can I do anything?
 */
export const EmptyState = ({ title, hint, icon: Icon = Inbox }) => (
  <div className="p-state" role="status">
    <Icon size={30} aria-hidden="true" />
    <p className="p-state__title">{title}</p>
    {hint && <p className="p-state__hint">{hint}</p>}
  </div>
);

export const ErrorState = ({ message = 'Something went wrong.', onRetry }) => (
  <div className="p-state p-state--error" role="alert">
    <AlertCircle size={26} aria-hidden="true" />
    <p className="p-state__title">{message}</p>
    {onRetry && (
      <button type="button" className="p-state__retry" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export default EmptyState;
