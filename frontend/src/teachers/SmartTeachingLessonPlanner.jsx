import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';
import LessonPlanDashboard from './LessonPlanDashboard';

const SmartTeachingLessonPlanner = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 md:p-6">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-4 md:px-6 md:py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/teacher/smart-teaching')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="h-9 w-9 rounded-lg bg-blue-500/30 flex items-center justify-center border border-blue-300/40">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">• Lesson Planner Studio</p>
                <p className="text-xs text-blue-100">
                  Full-screen planning workspace for chapters, topics, sub-topics, learning path, study material, question papers, mind maps and worksheets.
                </p>
              </div>
            </div>
          </div>
        </div>

        <LessonPlanDashboard variant="smart-teaching" />
      </div>
    </div>
  );
};

export default SmartTeachingLessonPlanner;
