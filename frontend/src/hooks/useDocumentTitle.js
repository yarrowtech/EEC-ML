import { useEffect } from 'react';
import { setTitlePage } from '../utils/documentTitle';

/**
 * Sets the current page's tab title. The tenant/school name is appended
 * automatically (see utils/documentTitle). Pass a falsy value to fall back to
 * just the school name. The page title is cleared when the component unmounts.
 *
 *   useDocumentTitle('Attendance');  // tab reads "Attendance · St. Xavier's School"
 */
export default function useDocumentTitle(pageTitle) {
  useEffect(() => {
    setTitlePage(pageTitle);
    return () => setTitlePage('');
  }, [pageTitle]);
}
