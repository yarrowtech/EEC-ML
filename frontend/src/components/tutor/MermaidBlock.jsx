/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

let _initialised = false;
export function ensureMermaid() {
  if (_initialised) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'antiscript',
    fontFamily: 'Nunito, sans-serif',
  });
  _initialised = true;
}

let _seq = 0;

/**
 * Renders a single Mermaid diagram inline inside a tutor message. Self-contained
 * so any renderer (chat, visual explain, diagram mode) can drop in a diagram.
 * Fails soft: if the syntax will not render, the student still sees the raw
 * diagram text rather than an empty space.
 */
export default function MermaidBlock({ code }) {
  const source = String(code || '').trim();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setFailed(false);

    if (!source) { setFailed(true); return undefined; }

    ensureMermaid();
    const id = `tutor-mermaid-${Date.now()}-${_seq++}`;

    mermaid
      .render(id, source)
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err) => {
        if (typeof console !== 'undefined') {
          console.warn('[MermaidBlock] render failed:', err?.message || err, '\n---\n', source);
        }
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [source]);

  if (failed) {
    return (
      <pre className="my-2 max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        {source}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
        <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
        Drawing diagram…
      </div>
    );
  }

  return (
    <div
      className="my-2 max-w-full overflow-x-auto rounded-xl border border-violet-100 bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
