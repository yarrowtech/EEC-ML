import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Accessibility wiring for a modal dialog rendered by the parent portal.
 *
 * - `Escape` closes the dialog.
 * - Focus moves into the dialog when it opens and returns to the previously
 *   focused element when it closes.
 * - `Tab` / `Shift+Tab` are trapped inside the dialog.
 *
 * @param {boolean} open      whether the dialog is mounted/visible
 * @param {() => void} onClose called on Escape
 * @returns {React.RefObject<HTMLElement>} ref for the dialog container
 */
export const useDialog = (open, onClose) => {
  const ref = useRef(null);
  const restoreRef = useRef(null);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (nodes.length === 0) {
      event.preventDefault();
      ref.current.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const node = ref.current;
    // Focus the first focusable control, or the dialog itself.
    const target = node?.querySelector(FOCUSABLE) || node;
    target?.focus?.();
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const restore = restoreRef.current;
      if (restore && typeof restore.focus === 'function') restore.focus();
    };
  }, [open, handleKeyDown]);

  return ref;
};
