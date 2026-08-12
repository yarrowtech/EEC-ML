import React, { useId } from 'react';
import { Images } from 'lucide-react';

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

const TutorGeneratedVisuals = ({ visuals = [] }) => {
  const supported = visuals.filter((visual) => visual?.type === 'angle_turns' && Array.isArray(visual.items));
  if (!supported.length) return null;

  return (
    <div className="mt-4 space-y-3">
      {supported.map((visual) => (
        <section key={visual.id || visual.title} className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-amber-50 p-4">
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
