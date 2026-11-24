import React, { lazy, Suspense } from 'react';
import useParentChildren from './useParentChildren';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

// Same results screen the student sees (exam + assignment results, report-card
// download), scoped to the child picked in the parent nav switcher.
const ResultsView = lazy(() => import('../components/ResultsView'));

const ParentResults = () => {
  const { selected, loading, error, children } = useParentChildren();

  let body;
  if (loading && !selected) body = <Loading />;
  else if (error && !selected) body = <ErrorState message={String(error)} />;
  else if (!children?.length || !selected?.id) body = <EmptyState title="No linked child" hint="No student is linked to this parent account yet." />;
  else {
    body = (
      <Suspense fallback={<Loading />}>
        <ResultsView key={selected.id} portal="parent" studentId={String(selected.id)} />
      </Suspense>
    );
  }

  return <div className="w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{body}</div>;
};

export default ParentResults;
