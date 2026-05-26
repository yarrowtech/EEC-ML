import React from 'react';

const ProgressBar = ({ value }) => {
  const safeValue = Math.max(0, Math.min(100, value || 0));

  return (
    <div className="w-full max-w-xs">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>Completion</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
