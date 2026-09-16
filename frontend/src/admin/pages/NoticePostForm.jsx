import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, Italic,
  Link2, List, ListOrdered, Send, Underline, X,
  CircleCheck, BookOpen, Flag, Bus, FileBadge, Megaphone, ClipboardList, BadgeCheck, IndianRupee, CircleEllipsis,
  Users, GraduationCap, UserRound, UsersRound,
} from 'lucide-react';

// "Post Notice" composer: one compact card (fits without page scroll) —
// title, formatted message, pill pickers, class/section, pin, PDF. The notice
// always posts to the active session (chosen by NoticeManagement). State and
// submit logic live in NoticeManagement and are passed in.

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General', icon: CircleCheck },
  { value: 'academic', label: 'Academic', icon: BookOpen },
  { value: 'events', label: 'Events', icon: Flag },
  { value: 'transport', label: 'Transport', icon: Bus },
];
const TYPE_OPTIONS = [
  { value: 'notice', label: 'Notice', icon: FileBadge },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'assignment', label: 'Assignment', icon: ClipboardList },
  { value: 'exam', label: 'Exam', icon: FileText },
  { value: 'result', label: 'Exam Result', icon: BadgeCheck },
  { value: 'fee', label: 'Fee', icon: IndianRupee },
  { value: 'other', label: 'Other', icon: CircleEllipsis },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', dot: 'bg-emerald-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-400' },
  { value: 'high', label: 'High', dot: 'bg-red-500' },
];
const AUDIENCE_OPTIONS = [
  { value: 'All', label: 'All', icon: UsersRound },
  { value: 'Student', label: 'Students', icon: GraduationCap },
  { value: 'Parent', label: 'Parents', icon: Users },
  { value: 'Teacher', label: 'Teachers', icon: UserRound },
];
const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-800';
const selectCls = 'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-9 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const Pill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-medium transition ${active
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
  >
    {children}
  </button>
);

// One-line, horizontally scrolling row of pills with ‹ › arrows that only
// appear when there is more to scroll in that direction.
const PillStrip = ({ children }) => {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro?.disconnect(); window.removeEventListener('resize', update); };
  }, [update]);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  const arrow = 'absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50';
  return (
    <div className="relative">
      {edges.left && (
        <button type="button" onClick={() => scroll(-1)} className={`${arrow} left-0`} aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></button>
      )}
      <div ref={ref} onScroll={update} className="flex gap-1.5 overflow-x-auto scroll-smooth px-0.5 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {edges.right && (
        <button type="button" onClick={() => scroll(1)} className={`${arrow} right-0`} aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></button>
      )}
    </div>
  );
};

// Minimal renderer for the toolbar's markers (preview only; the message is
// stored as plain text): "## " heading, **bold**, *italic*, __underline__,
// "- " / "1. " lists, [text](url) links.
const renderInline = (text) => {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('__')) parts.push(<u key={i++}>{tok.slice(2, -2)}</u>);
    else if (tok.startsWith('[')) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
      parts.push(<a key={i++} href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{label}</a>);
    } else parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};
const RichPreview = ({ text }) => (
  <div className="space-y-1.5 text-sm leading-6 text-slate-700">
    {String(text || '').split('\n').map((line, idx) => {
      const key = `l${idx}`;
      if (line.startsWith('## ')) return <p key={key} className="text-base font-bold text-slate-900">{renderInline(line.slice(3))}</p>;
      if (/^- /.test(line)) return <p key={key} className="pl-4">• {renderInline(line.slice(2))}</p>;
      if (/^\d+\. /.test(line)) return <p key={key} className="pl-4">{renderInline(line)}</p>;
      return line.trim() ? <p key={key}>{renderInline(line)}</p> : <div key={key} className="h-1" />;
    })}
  </div>
);

const NoticePostForm = ({
  form, setForm, selectedAcademicYearId, selectedAcademicYear,
  classOptions, sectionOptions, attachments, setAttachments, isUploading, uploadAttachment,
  loading, onSubmit, onReset,
}) => {
  const messageRef = useRef(null);
  const [showEditorPreview, setShowEditorPreview] = useState(false);
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  // Wrap the selection (or insert at the caret) with the given markers.
  const applyFormat = (before, after = before, placeholder = 'text') => {
    const el = messageRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = `${value.slice(0, s)}${before}${selected}${after}${value.slice(e)}`;
    set({ message: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  // Prefix each selected line (lists / heading).
  const prefixLines = (makePrefix) => {
    const el = messageRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e) || '';
    const lines = (block || 'List item').split('\n').map((l, i) => `${makePrefix(i)}${l.replace(/^(- |\d+\. |## )/, '')}`);
    set({ message: `${value.slice(0, lineStart)}${lines.join('\n')}${value.slice(e)}` });
    requestAnimationFrame(() => el.focus());
  };
  const onStyleChange = (style) => {
    if (style === 'heading') prefixLines(() => '## ');
    else prefixLines(() => '');
  };
  const insertLink = () => {
    const href = window.prompt('Link URL', 'https://');
    if (href && href !== 'https://') applyFormat('[', `](${href})`, 'link text');
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      {/* Header — posts to the active session automatically */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Post Notice</h2>
          <p className="text-xs text-slate-500">
            Fill in the information below to create a new notice
            {selectedAcademicYear ? <> for <span className="font-semibold text-slate-700">{selectedAcademicYear.name}</span></> : null}.
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="mt-4">
        <label htmlFor="notice-title" className={labelCls}>Title <span className="text-red-500">*</span></label>
        <input
          id="notice-title"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Enter notice title (e.g. Annual Day Celebration)"
          required
        />
      </div>

      {/* Message with toolbar */}
      <div className="mt-3">
        <label htmlFor="notice-message" className={labelCls}>Message <span className="text-red-500">*</span></label>
        <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1">
            <div className="relative">
              <select
                aria-label="Text style"
                defaultValue="normal"
                onChange={(e) => { onStyleChange(e.target.value); e.target.value = 'normal'; }}
                className="appearance-none rounded-lg bg-transparent py-1 pl-2.5 pr-7 text-sm text-slate-700 outline-none hover:bg-white"
              >
                <option value="normal">Normal</option>
                <option value="heading">Heading</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {[
              { title: 'Bold', icon: Bold, run: () => applyFormat('**') },
              { title: 'Italic', icon: Italic, run: () => applyFormat('*') },
              { title: 'Underline', icon: Underline, run: () => applyFormat('__') },
              { title: 'Numbered list', icon: ListOrdered, run: () => prefixLines((i) => `${i + 1}. `) },
              { title: 'Bullet list', icon: List, run: () => prefixLines(() => '- ') },
              { title: 'Insert link', icon: Link2, run: insertLink },
            ].map(({ title, icon: Icon, run }) => (
              <button key={title} type="button" title={title} onClick={run} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900">
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowEditorPreview((v) => !v)}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition ${showEditorPreview ? 'bg-white font-semibold text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              <Eye className="h-4 w-4" /> Preview
            </button>
          </div>
          {showEditorPreview ? (
            <div className="h-20 overflow-y-auto bg-white px-3.5 py-2">
              {form.message.trim() ? <RichPreview text={form.message} /> : <p className="text-sm text-slate-400">Nothing to preview yet.</p>}
            </div>
          ) : (
            <textarea
              id="notice-message"
              ref={messageRef}
              rows={3}
              className="block h-20 w-full resize-none bg-white px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
              placeholder="Write your notice message here..."
              required
            />
          )}
        </div>
      </div>

      {/* Row 1 — Category | Type: one-line pill strips with ‹ › arrows */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0">
          <p className={labelCls}>Category</p>
          <PillStrip>
            {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Pill key={value} active={form.category === value} onClick={() => set({ category: value })}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </Pill>
            ))}
          </PillStrip>
        </div>
        <div className="min-w-0">
          <p className={labelCls}>Type</p>
          <PillStrip>
            {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Pill key={value} active={form.type === value} onClick={() => set({ type: value })}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </Pill>
            ))}
          </PillStrip>
          {form.type === 'other' && (
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              value={form.typeLabel}
              onChange={(e) => set({ typeLabel: e.target.value })}
              placeholder="Custom label, e.g. Holiday"
            />
          )}
        </div>
      </div>

      {/* Row 2 — Class | Section | Priority | Audience | Pin (one row) */}
      <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,1.35fr)_minmax(0,1.6fr)_auto]">
        <div>
          <label htmlFor="notice-class" className={labelCls}>Class</label>
          <div className="relative">
            <select
              id="notice-class"
              className={selectCls}
              value={form.classId}
              onChange={(e) => set({ classId: e.target.value, sectionId: '' })}
              disabled={!selectedAcademicYearId}
            >
              <option value="">{selectedAcademicYearId ? 'All classes' : 'No active session'}</option>
              {classOptions.map((cls) => <option key={cls._id} value={cls._id}>{cls.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
        <div>
          <label htmlFor="notice-section" className={labelCls}>Section</label>
          <div className="relative">
            <select
              id="notice-section"
              className={selectCls}
              value={form.sectionId}
              onChange={(e) => set({ sectionId: e.target.value })}
              disabled={!form.classId}
            >
              <option value="">{form.classId ? 'All sections' : 'Select class first'}</option>
              {sectionOptions.map((sec) => <option key={sec._id} value={sec._id}>{sec.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
        <div className="min-w-0">
          <p className={labelCls}>Priority</p>
          <PillStrip>
            {PRIORITY_OPTIONS.map(({ value, label, dot }) => (
              <Pill key={value} active={form.priority === value} onClick={() => set({ priority: value })}>
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {label}
              </Pill>
            ))}
          </PillStrip>
        </div>
        <div className="min-w-0">
          <p className={labelCls}>Audience</p>
          <PillStrip>
            {AUDIENCE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Pill key={value} active={form.audience === value} onClick={() => set({ audience: value })}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </Pill>
            ))}
          </PillStrip>
        </div>
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap pb-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={form.isPinned}
            aria-label="Pin this notice"
            onClick={() => set({ isPinned: !form.isPinned })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.isPinned ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.isPinned ? 'left-5.5' : 'left-0.5'}`} />
          </button>
          <span className="text-sm font-semibold text-slate-800">Pin this notice</span>
        </label>
      </div>

      {/* Row 3 — PDF upload (full width) */}
      <div className="mt-3">
        <label className={`flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition ${isUploading ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50/60'}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <FileText className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-indigo-700">{isUploading ? 'Uploading…' : 'Click to upload PDF'}</span>
            <span className="block text-xs text-slate-500">PDF attachment (optional) · PDF files only</span>
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = ''; }}
            disabled={isUploading}
          />
        </label>
        {attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {attachments.map((att, idx) => (
              <span key={`${att.url}-${idx}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs text-slate-700">
                <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span className="truncate">{att.name || `Attachment ${idx + 1}`}</span>
                <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))} className="shrink-0 text-slate-400 hover:text-red-500" aria-label="Remove attachment">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={onReset} className="rounded-xl border border-slate-200 bg-white px-8 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Clear
        </button>
        <button
          type="submit"
          disabled={loading || isUploading || !selectedAcademicYearId}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-10 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {loading ? 'Publishing…' : 'Publish Notice'}
        </button>
      </div>
    </form>
  );
};

export default NoticePostForm;
