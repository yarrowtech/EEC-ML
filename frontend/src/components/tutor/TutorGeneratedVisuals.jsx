import React, { useId } from 'react';
import { Images } from 'lucide-react';
import { cn } from '@/lib/utils';

const endpointFor = (degrees, radius = 52, cx = 70, cy = 72) => {
  const radians = (-degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
};

const fullTurnFraction = (degrees) => ({ 90: '1/4', 180: '1/2', 270: '3/4', 360: '1 whole' }[degrees] || `${degrees}/360`);

const AngleTurn = ({ item }) => {
  const markerId = `turn-arrow-${useId().replace(/:/g, '')}`;
  const degrees = Number(item?.degrees) || 0;
  const end = endpointFor(degrees);
  const arcEnd = endpointFor(degrees, 27);
  const largeArc = degrees > 180 ? 1 : 0;
  const isFullTurn = degrees === 360;

  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-3 text-center shadow-sm">
      <svg viewBox="0 0 140 125" role="img" aria-label={`${item.label}: ${degrees} degrees`} className="mx-auto h-32 w-full max-w-[180px]">
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
          </marker>
        </defs>
        <circle cx="70" cy="72" r="4" fill="#f59e0b" />
        <line x1="70" y1="72" x2="122" y2="72" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
        {!isFullTurn && (
          <line x1="70" y1="72" x2={end.x} y2={end.y} stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        )}
        {isFullTurn ? (
          <path d="M 97 72 A 27 27 0 1 0 96.5 66" fill="none" stroke="#7c3aed" strokeWidth="4" markerEnd={`url(#${markerId})`} />
        ) : (
          <path
            d={`M 97 72 A 27 27 0 ${largeArc} 0 ${arcEnd.x} ${arcEnd.y}`}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="4"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        )}
        <text x="70" y="116" textAnchor="middle" className="fill-indigo-700 text-[16px] font-bold">{degrees}°</text>
      </svg>
      <p className="text-sm font-bold text-slate-800">{item.label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{item.angle_name}</p>
    </div>
  );
};

const ChocolateGrid = ({ item }) => {
  const rows = Number(item.rows) || 1;
  const columns = Number(item.columns) || 1;
  const highlighted = Number(item.highlighted_blocks) || 0;
  const width = columns * 56;
  const height = rows * 42;
  const cells = Array.from({ length: rows * columns }, (_, index) => ({
    index,
    row: Math.floor(index / columns),
    column: index % columns,
  }));
  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 text-center shadow-sm">
      <p className="text-sm font-bold text-slate-800">{item.label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{item.numerator}/{item.denominator} of the whole</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${item.label}: ${highlighted} of ${rows * columns} equal blocks highlighted`}
        className="mx-auto mt-3 h-36 w-full max-w-[280px]"
      >
        {cells.map((cell) => {
          const isHighlighted = cell.index < highlighted;
          return (
            <g key={cell.index}>
              <rect
                x={cell.column * 56 + 2}
                y={cell.row * 42 + 2}
                width="52"
                height="38"
                rx="6"
                fill={isHighlighted ? item.color : '#f8e1bd'}
                stroke="#92400e"
                strokeWidth="2"
              />
              <rect
                x={cell.column * 56 + 8}
                y={cell.row * 42 + 8}
                width="40"
                height="26"
                rx="4"
                fill="none"
                stroke={isHighlighted ? '#fff7ed' : '#d6a76b'}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-sm font-extrabold" style={{ color: item.color }}>
        {highlighted} highlighted blocks
      </p>
      <p className="text-xs text-slate-500">out of {rows * columns} equal blocks</p>
    </div>
  );
};

const FractionWholesVisual = ({ visual }) => (
  <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-violet-50 p-4">
    <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
      <Images className="size-4" /> {visual.title}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{visual.caption}</p>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      {visual.items.map((item) => <ChocolateGrid key={item.label} item={item} />)}
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="rounded-xl bg-slate-900 px-4 py-3 text-center text-lg font-black text-white">
        {visual.items[0]?.highlighted_blocks} blocks{' '}
        <span className="px-2 text-amber-300">&lt;</span>{' '}
        {visual.items[1]?.highlighted_blocks} blocks
      </div>
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-relaxed text-emerald-900">
        {visual.comparison}
      </p>
    </div>
    <div className="mt-2 rounded-xl border border-violet-100 bg-white p-3 text-xs leading-relaxed text-slate-700">
      <span className="font-bold text-violet-800">Rule:</span> {visual.rule}
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{visual.source_activity_note}</p>
  </section>
);

const NumberGroup = ({ title, numbers, total, tone }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-center">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
      {numbers.map((number, index) => (
        <span
          key={`${number}-${index}`}
          className={cn(
            'inline-flex min-w-9 items-center justify-center rounded-lg border px-2 py-1.5 text-sm font-bold',
            tone === 'left' ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900' : 'border-amber-200 bg-amber-50 text-amber-900'
          )}
        >
          {number}
        </span>
      ))}
    </div>
    <div className="mx-auto mt-2 w-24 border-t-2 border-slate-400 pt-1 text-base font-black text-slate-900">
      = {total}
    </div>
    <p className="text-[10px] font-semibold text-slate-400">printed total</p>
  </div>
);

const BalanceSwapsVisual = ({ visual }) => (
  <section className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-fuchsia-50 p-4">
    <div className="flex items-center gap-2 text-sm font-bold text-cyan-950">
      <Images className="size-4" /> {visual.title}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{visual.caption}</p>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      {visual.problems.map((problem) => (
        <article key={problem.label} className="rounded-2xl border border-white bg-white/70 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900">Problem ({problem.label})</h4>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <NumberGroup title="Left group" numbers={problem.left} total={problem.left_total} tone="left" />
            <div className="text-center">
              <p className="text-lg font-black text-slate-500">↔</p>
              <p className="text-[10px] font-bold text-slate-400">swap</p>
            </div>
            <NumberGroup title="Right group" numbers={problem.right} total={problem.right_total} tone="right" />
          </div>
          <p className="mt-2 text-[11px] text-slate-400 text-center">Find the swap that makes both totals equal.</p>
        </article>
      ))}
    </div>
    <div className="mt-3 rounded-xl border border-cyan-100 bg-white p-3 text-xs leading-relaxed text-slate-700">
      <span className="font-bold text-cyan-900">Swap rule:</span> {visual.rule}
    </div>
  </section>
);

const TutorGeneratedVisuals = ({ visuals = [] }) => {
  const supported = visuals.filter((visual) => (
    (
      ['angle_turns', 'fraction_wholes'].includes(visual?.type) && Array.isArray(visual.items)
    ) || (visual?.type === 'balance_swaps' && Array.isArray(visual.problems))
  ));
  if (!supported.length) return null;

  return (
    <div className="mt-4 space-y-3">
      {supported.map((visual) => (
        visual.type === 'balance_swaps'
          ? <BalanceSwapsVisual key={visual.id || visual.title} visual={visual} />
          : visual.type === 'fraction_wholes'
          ? <FractionWholesVisual key={visual.id || visual.title} visual={visual} />
          : <section key={visual.id || visual.title} className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-violet-900">
            <Images className="size-4" /> {visual.title}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{visual.caption}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visual.items.map((item) => <AngleTurn key={`${item.label}-${item.degrees}`} item={item} />)}
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-violet-100 bg-white">
            <table className="w-full min-w-[440px] text-left text-xs">
              <thead className="bg-violet-50 text-violet-900">
                <tr>
                  <th className="px-3 py-2 font-bold">Turn</th>
                  <th className="px-3 py-2 font-bold">Degrees</th>
                  <th className="px-3 py-2 font-bold">Angle type</th>
                  <th className="px-3 py-2 font-bold">Part of a full turn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visual.items.map((item) => (
                  <tr key={`row-${item.label}-${item.degrees}`}>
                    <td className="px-3 py-2 font-semibold">{item.label}</td>
                    <td className="px-3 py-2">{item.degrees}°</td>
                    <td className="px-3 py-2">{item.angle_name}</td>
                    <td className="px-3 py-2">{fullTurnFraction(item.degrees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>
      ))}
    </div>
  );
};

export default TutorGeneratedVisuals;
