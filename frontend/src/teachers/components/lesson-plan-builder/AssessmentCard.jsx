import React from 'react';
import { Input } from '@/components/ui/input';

const AssessmentCard = ({ assessment, types, onChange }) => {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-2">
      <Input
        value={assessment.title}
        onChange={(event) => onChange({ ...assessment, title: event.target.value })}
        placeholder="Assessment title"
        className="rounded-xl"
      />
      <select
        value={assessment.type}
        onChange={(event) => onChange({ ...assessment, type: event.target.value })}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        {(types || []).map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <Input
        type="date"
        value={assessment.dueDate}
        onChange={(event) => onChange({ ...assessment, dueDate: event.target.value })}
        className="rounded-xl"
      />
      <Input
        type="number"
        value={assessment.marks}
        onChange={(event) => onChange({ ...assessment, marks: Number(event.target.value) || 0 })}
        placeholder="Marks"
        className="rounded-xl"
      />
    </div>
  );
};

export default AssessmentCard;
