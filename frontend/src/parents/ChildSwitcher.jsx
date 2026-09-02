import React, { useCallback, useEffect, useState } from 'react';

/*
 * One child-switcher for every parent screen.
 *
 * - `options`: [{ id, name, meta? }] normalised by the screen. `id` may be ''
 *   for a child that is linked by name only.
 * - The selection is shared across screens via localStorage, so switching child
 *   on one page carries to the next.
 * - 1 child  → a static "Viewing" label (no control).
 * - 2–3      → segmented pills.
 * - 4+       → a labelled dropdown.
 */

const STORE_KEY = 'parent.selectedChild';
const SYNC_EVENT = 'parent:child-selection';

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStore = (value) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    /* private mode / storage disabled — selection just won't persist */
  }
  try {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: value }));
  } catch {
    /* no-op */
  }
};

const sameChild = (option, stored) => {
  if (!option || !stored) return false;
  if (stored.id && option.id) return String(stored.id) === String(option.id);
  return Boolean(stored.name) && stored.name === option.name;
};

const optionKey = (option) => `${option.id || ''}::${option.name || ''}`;

/**
 * Shared selection state for a screen's child list.
 * @param {{id?: string, name?: string}[]} options
 * @returns {[string, (key: string) => void, object|null]} [selectedKey, setSelectedKey, selectedOption]
 */
export const useSharedChildSelection = (options = []) => {
  const [selectedKey, setSelectedKeyState] = useState('');

  // Pick the stored child if the screen has it, otherwise the first one.
  useEffect(() => {
    if (!options.length) {
      setSelectedKeyState('');
      return;
    }
    const stored = readStore();
    const match = stored ? options.find((o) => sameChild(o, stored)) : null;
    const next = match || options[0];
    setSelectedKeyState((current) => {
      if (current && options.some((o) => optionKey(o) === current)) return current;
      return optionKey(next);
    });
  }, [options]);

  // Follow selection changes made on other screens / tabs.
  useEffect(() => {
    const apply = () => {
      const stored = readStore();
      const match = stored ? options.find((o) => sameChild(o, stored)) : null;
      if (match) setSelectedKeyState(optionKey(match));
    };
    window.addEventListener(SYNC_EVENT, apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener(SYNC_EVENT, apply);
      window.removeEventListener('storage', apply);
    };
  }, [options]);

  const setSelectedKey = useCallback((key) => {
    setSelectedKeyState(key);
    const picked = options.find((o) => optionKey(o) === key);
    if (picked) writeStore({ id: picked.id || '', name: picked.name || '' });
  }, [options]);

  const selectedOption = options.find((o) => optionKey(o) === selectedKey) || null;
  return [selectedKey, setSelectedKey, selectedOption];
};

export { optionKey as childOptionKey };

const ChildSwitcher = ({ options = [], value, onChange, label = 'Child', className = '' }) => {
  if (!options.length) return null;

  if (options.length === 1) {
    return (
      <p className={`text-sm text-slate-500 ${className}`}>
        Viewing <span className="font-semibold text-slate-800">{options[0].name}</span>
      </p>
    );
  }

  if (options.length <= 3) {
    return (
      <div className={className}>
        <span id="child-switcher-label" className="sr-only">{label}</span>
        <div role="radiogroup" aria-labelledby="child-switcher-label" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {options.map((opt) => {
            const key = optionKey(opt);
            const active = key === value;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <label className={`inline-flex items-center gap-2 text-sm text-slate-500 ${className}`}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      >
        {options.map((opt) => (
          <option key={optionKey(opt)} value={optionKey(opt)}>{opt.name}</option>
        ))}
      </select>
    </label>
  );
};

export default ChildSwitcher;
