import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MCQ from '../tryout/mcq';
import ChoiceMatrix from '../tryout/choice_matrix';
import ClozeDragDrop from '../tryout/cloze_drag_drop';
import ClozeDropDown from '../tryout/cloze_drop_down';
import ClozeText from '../tryout/cloze_text';
import FileUpload from '../tryout/file_upload';
import ImageHighlighter from '../tryout/image_highlighter';
import MatchList from '../tryout/match_list';
import TextEditor from '../tryout/plain_txt';
import RichText from '../tryout/rich_text';
import SortList from '../tryout/sort_list';

const TRYOUT_WIDGETS = [
  { key: 'mcq', label: 'MCQ', Component: MCQ },
  { key: 'choice-matrix', label: 'Choice Matrix', Component: ChoiceMatrix },
  { key: 'cloze-drag-drop', label: 'Cloze Drag Drop', Component: ClozeDragDrop },
  { key: 'cloze-drop-down', label: 'Cloze Drop Down', Component: ClozeDropDown },
  { key: 'cloze-text', label: 'Cloze Text', Component: ClozeText },
  { key: 'file-upload', label: 'File Upload', Component: FileUpload },
  { key: 'image-highlighter', label: 'Image Highlighter', Component: ImageHighlighter },
  { key: 'match-list', label: 'Match List', Component: MatchList },
  { key: 'plain-text', label: 'Plain Text', Component: TextEditor },
  { key: 'rich-text', label: 'Rich Text', Component: RichText },
  { key: 'sort-list', label: 'Sort List', Component: SortList },
];

const AILearningTryoutSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const topicMatch = location.pathname.match(/\/topic\/([^/]+)/);
  const subjectSlug = subjectMatch?.[1] ? decodeURIComponent(subjectMatch[1]) : 'subject';
  const topicSlug = topicMatch?.[1] ? decodeURIComponent(topicMatch[1]) : 'topic';
  const [activeTryoutKey, setActiveTryoutKey] = useState('mcq');

  const activeTryout = useMemo(
    () => TRYOUT_WIDGETS.find((item) => item.key === activeTryoutKey) || TRYOUT_WIDGETS[0],
    [activeTryoutKey]
  );

  const ActiveTryoutComponent = activeTryout.Component;

  return (
    <div className="w-full min-h-screen bg-[#f8f7f6] text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1250px]">
        <button
          type="button"
          onClick={() => navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subjectSlug)}/topic/${encodeURIComponent(topicSlug)}`)}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Back to Topic
        </button>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Tryout Section</h2>
            <div className="space-y-2">
              {TRYOUT_WIDGETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTryoutKey(item.key)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTryoutKey === item.key
                      ? 'border-[#2f7dff] bg-[#2f7dff] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
            <ActiveTryoutComponent />
          </section>
        </div>
      </div>
    </div>
  );
};

export default AILearningTryoutSection;
