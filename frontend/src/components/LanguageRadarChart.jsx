import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const LanguageRadarChart = ({ data, color = '#6366f1', title }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full">
      {title && <p className="text-sm font-semibold text-center text-gray-600 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid gridType="polygon" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(v) => [`${v}/100`, 'Score']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LanguageRadarChart;
