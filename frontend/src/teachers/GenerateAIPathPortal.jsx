import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  GraduationCap,
  Layers,
  Lightbulb,
  PencilLine,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const students = [
  {
    id: 'arjun',
    name: 'Arjun Singh',
    cls: '5-A',
    subject: 'Mathematics',
    focus: 'Fractions',
    status: 'red',
    mastery: [
      ['Concept understanding', 38],
      ['Problem solving', 45],
      ['Application', 52],
      ['Speed & accuracy', 35],
    ],
  },
  {
    id: 'priya',
    name: 'Priya Sharma',
    cls: '6-B',
    subject: 'Science',
    focus: 'Force & Motion',
    status: 'yellow',
    mastery: [
      ['Concept understanding', 58],
      ['Problem solving', 49],
      ['Application', 61],
      ['Speed & accuracy', 54],
    ],
  },
  {
    id: 'rahul',
    name: 'Rahul Verma',
    cls: '7-A',
    subject: 'English',
    focus: 'Grammar',
    status: 'yellow',
    mastery: [
      ['Concept understanding', 62],
      ['Problem solving', 55],
      ['Application', 67],
      ['Speed & accuracy', 60],
    ],
  },
  {
    id: 'sarah',
    name: 'Sarah Khan',
    cls: '5-A',
    subject: 'Mathematics',
    focus: 'Decimals',
    status: 'red',
    mastery: [
      ['Concept understanding', 31],
      ['Problem solving', 40],
      ['Application', 44],
      ['Speed & accuracy', 33],
    ],
  },
];

const blueprints = {
  Mathematics: [
    ['Introduction to fractions', 'remember', 'blue', false],
    ['Equivalent fractions', 'understand', 'blue', true],
    ['Comparing fractions', 'apply', 'orange', false],
    ['Adding & subtracting fractions', 'apply', 'orange', false],
    ['Multiplying & dividing fractions', 'analyze', 'purple', false],
    ['Mastery assessment', 'evaluate', 'green', false],
  ],
  Science: [
    ['What is a force?', 'remember', 'blue', false],
    ['Balanced & unbalanced forces', 'understand', 'blue', true],
    ['Friction in everyday life', 'apply', 'orange', false],
    ['Newton’s first law', 'apply', 'orange', false],
    ['Force & motion investigations', 'analyze', 'purple', false],
    ['Mastery assessment', 'evaluate', 'green', false],
  ],
  English: [
    ['Parts of speech', 'remember', 'blue', false],
    ['Subject–verb agreement', 'understand', 'blue', true],
    ['Tenses in context', 'apply', 'orange', false],
    ['Building complex sentences', 'apply', 'orange', false],
    ['Editing & error analysis', 'analyze', 'purple', false],
    ['Mastery assessment', 'evaluate', 'green', false],
  ],
};

const lessons = {
  Mathematics: {
    explain:
      'Two fractions are equivalent when they cover the same amount, even if the numbers look different. Multiply the top and bottom by the same number and the value stays the same - like slicing the same cake into more pieces.',
    q: 'Which fraction is equivalent to 1/2?',
    opts: [
      ['2/4', true],
      ['1/3', false],
      ['3/5', false],
    ],
    hint: 'Multiply both the top and bottom of 1/2 by 2. What do you get?',
  },
  Science: {
    explain:
      'Forces are balanced when they cancel out and the object stays still or moves steadily. They are unbalanced when one side wins - that is when speed or direction changes.',
    q: 'A book rests on a table without moving. The forces on it are:',
    opts: [
      ['Balanced', true],
      ['Unbalanced', false],
      ['Zero forces', false],
    ],
    hint: 'The book is not moving. What does that tell you about the forces pushing and pulling on it?',
  },
  English: {
    explain:
      'A verb must match its subject in number. A singular subject takes a singular verb; a plural subject takes a plural verb.',
    q: 'Choose the correct sentence:',
    opts: [
      ['The dogs run fast', true],
      ['The dogs runs fast', false],
      ['The dog run fast', false],
    ],
    hint: '“Dogs” is plural. Which verb form goes with a plural subject?',
  },
};

const tierBadge = {
  blue: 'Foundation',
  orange: 'Intermediate',
  purple: 'Advanced',
  green: 'Final',
};

const roleStyles = {
  teacher: {
    header: 'Teacher',
    body: 'Generate and publish AI paths from a class command center.',
  },
  student: {
    header: 'Student',
    body: 'Track the published journey and continue the next unlocked stop.',
  },
};

const ringPath = 'M18 2.5a15.5 15.5 0 110 31 15.5 15.5 0 010-31';

const overallMastery = (student) => Math.round(student.mastery.reduce((sum, [, value]) => sum + value, 0) / student.mastery.length);

const masteryClass = (value) => {
  if (value >= 60) return 'high';
  if (value >= 45) return 'medium';
  return 'low';
};

const GenerateAIPathPortal = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('teacher');
  const [selectedId, setSelectedId] = useState('arjun');
  const [subject, setSubject] = useState('Mathematics');
  const [focus, setFocus] = useState('Fractions');
  const [pace, setPace] = useState('1 week');
  const [notes, setNotes] = useState('Struggles with fraction operations');
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lessonState, setLessonState] = useState({ open: false, index: null });
  const [studentProgress, setStudentProgress] = useState(null);
  const selectedStudent = useMemo(() => students.find((item) => item.id === selectedId) || students[0], [selectedId]);

  const teacherCount = students.filter((item) => item.status === 'red' || item.status === 'yellow').length;
  const subjectLessons = lessons[subject] || lessons.Mathematics;
  const activePath = role === 'student' ? studentProgress : draft;

  const syncStudent = (nextId) => {
    const next = students.find((item) => item.id === nextId) || students[0];
    setSelectedId(next.id);
    setSubject(next.subject);
    setFocus(next.focus);
  };

  const buildDraft = () => {
    const bp = blueprints[subject] || blueprints.Mathematics;
    const mastery = overallMastery(selectedStudent);
    return {
      student: selectedStudent.id,
      studentName: selectedStudent.name,
      cls: selectedStudent.cls,
      subject,
      focus,
      pace,
      notes,
      mastery,
      nodes: bp.map(([title, bloom, tier, hasLesson], index) => ({
        idx: index,
        title,
        bloom,
        tier,
        hasLesson,
        status: index === 0 ? 'active' : 'locked',
      })),
    };
  };

  const generate = () => {
    setLoading(true);
    window.setTimeout(() => {
      setDraft(buildDraft());
      setLoading(false);
      requestAnimationFrame(() => {
        document.getElementById('path-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, 1400);
  };

  const regenerate = () => {
    setDraft(buildDraft());
  };

  const resetProgress = () => {
    setDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        nodes: previous.nodes.map((node, index) => ({ ...node, status: index === 0 ? 'active' : 'locked' })),
      };
    });
  };

  const publish = () => {
    if (!draft) return;
    const next = JSON.parse(JSON.stringify(draft));
    setPublished(next);
    setStudentProgress(next);
  };

  const completeTeacherStep = (index) => {
    setDraft((previous) => {
      if (!previous) return previous;
      const nextNodes = previous.nodes.map((node, nodeIndex) => {
        if (nodeIndex === index) {
          return { ...node, status: node.status === 'done' ? 'active' : 'done' };
        }
        if (nodeIndex === index + 1 && previous.nodes[index].status !== 'done') {
          return { ...node, status: 'locked' };
        }
        if (nodeIndex === index + 1 && previous.nodes[index].status === 'done') {
          return node.status === 'locked' ? { ...node, status: 'active' } : node;
        }
        return node;
      });
      return { ...previous, nodes: nextNodes };
    });
  };

  const openLesson = (index) => setLessonState({ open: true, index });
  const closeLesson = () => setLessonState({ open: false, index: null });

  const lesson = lessonState.index != null ? subjectLessons : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#f3f6fc_0%,#e9eff7_100%)] p-4 text-[#14273e] sm:p-6">
      <Motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[1100px] rounded-[2.75rem] border border-white/60 bg-white/80 px-4 py-5 shadow-[0_24px_52px_-14px_rgba(0,20,40,.10)] backdrop-blur-xl sm:px-8 sm:py-7"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <Motion.div
              initial={{ scale: 0.85, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="flex size-10 items-center justify-center rounded-2xl bg-[#2d7aff] text-white shadow-sm"
            >
              <Brain className="size-5" />
            </Motion.div>
            <div>
              
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#0b1c2f] sm:text-2xl">Generate AI Path</h1>
              
            </div>
          </div>
        </div>

        <div className="space-y-5">

          {role === 'teacher' ? (
            <>
                <Motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.05 }}
                  className="rounded-[1.6rem] border border-[#eef2f9] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.01)]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-[#2d7aff]" />
                      <h3 className="text-base font-semibold text-[#0b1c2f]">Select student</h3>
                    </div>
                    <span className="rounded-full bg-[#eef4fe] px-3 py-1 text-xs font-semibold text-[#1f4b8a]">
                      {teacherCount} need attention
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {students.map((item, index) => (
                      <Motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -3 }}
                        onClick={() => syncStudent(item.id)}
                        className={`rounded-[1.4rem] border p-4 text-left transition ${
                          selectedId === item.id
                            ? 'border-[#2d7aff] bg-[#f0f6fe] shadow-[0_10px_26px_rgba(45,122,255,.10)]'
                            : 'border-[#eef2f9] bg-[#f8fbfe] hover:border-[#cddaf0] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#0b1c2f]">{item.name}</p>
                            <p className="text-xs text-[#65758b]">Class {item.cls}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${item.status === 'red' ? 'bg-[#fde8e8] text-[#a53e3e]' : 'bg-[#fef6e0] text-[#8a6d0b]'}`}>
                            {item.status === 'red' ? 'Critical' : 'Needs support'}
                          </span>
                        </div>
                        <div className="mt-3 inline-flex rounded-full bg-[#f0f4f8] px-2.5 py-1 text-[11px] text-[#4a5e78]">
                          {item.subject} · {item.focus}
                        </div>
                      </Motion.button>
                    ))}
                  </div>
                </Motion.section>

                <Motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.1 }}
                  className="rounded-[1.6rem] border border-[#eef2f9] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.01)]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0b1c2f]">Configure path</h3>
                      <p className="text-sm text-[#65758b]">Set the focus and let the AI sequence the journey.</p>
                    </div>
                    <span className="rounded-full bg-[#eef4fe] px-3 py-1 text-xs font-semibold text-[#1f4b8a]">
                      Draft mode
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Student">
                      <select value={selectedId} onChange={(event) => syncStudent(event.target.value)}>
                        {students.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.cls}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Subject">
                      <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                        <option>Mathematics</option>
                        <option>Science</option>
                        <option>English</option>
                      </select>
                    </Field>
                    <Field label="Focus area">
                      <input value={focus} onChange={(event) => setFocus(event.target.value)} />
                    </Field>
                    <Field label="Pace · Dalton">
                      <select value={pace} onChange={(event) => setPace(event.target.value)}>
                        <option>1 week</option>
                        <option>2 weeks</option>
                        <option>4 weeks</option>
                      </select>
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                    <Field label="Pedagogy model">
                      <select disabled value="Auto-blend (Bloom · Heuristic · Dalton)">
                        <option>Auto-blend (Bloom · Heuristic · Dalton)</option>
                      </select>
                    </Field>
                    <Field label="Notes for the AI">
                      <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </Field>
                  </div>

                  <div className="mt-5 flex justify-center">
                    <Motion.button
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.04, boxShadow: '0 0 0 3px rgba(45,122,255,0.18), 0 8px 28px rgba(45,122,255,0.10)' }}
                      whileTap={{ scale: 0.97 }}
                      onClick={generate}
                      disabled={loading}
                      className="relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-[#2d7aff] bg-transparent px-8 py-3 text-sm font-semibold text-[#2d7aff] transition-all duration-300 hover:border-[#1a5fd9] hover:text-[#1a5fd9] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Motion.span
                        className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-[rgba(45,122,255,0.07)]"
                        animate={loading ? {} : { translateX: ['−100%', '200%'] }}
                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                      />
                      {loading ? <RefreshCw className="size-4 animate-spin" /> : <Zap className="size-4" />}
                      {loading ? 'Analyzing knowledge gaps...' : 'Generate AI Path'}
                    </Motion.button>
                  </div>

                  <AnimatePresence>
                    {loading && (
                      <Motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-4 rounded-2xl border border-[#dbe7fe] bg-[#f0f7ff] px-4 py-3 text-sm text-[#1f4b8a]"
                      >
                        Sequencing prerequisite nodes and drafting the path...
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </Motion.section>

                <AnimatePresence>
                  {draft && (
                    <Motion.section
                      id="path-card"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.28 }}
                      className="rounded-[1.6rem] border border-[#eef2f9] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.01)]"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="size-4 text-[#2d7aff]" />
                          <h3 className="text-base font-semibold text-[#0b1c2f]">Learning path</h3>
                          <span className="rounded-full bg-[#eef4fe] px-3 py-1 text-xs font-semibold text-[#1f4b8a]">Draft</span>
                        </div>
                        <p className="text-xs text-[#65758b]">Published paths unlock the student view.</p>
                      </div>

                      <div className="mb-5 grid gap-3 rounded-[1.4rem] border border-[#eef2f9] bg-[#f8fbfe] p-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat label="Student" value={draft.studentName} />
                        <Stat label="Subject" value={`${draft.subject} · ${draft.focus}`} />
                        <Stat label="Overall mastery" value={`${draft.mastery}%`} accent="text-[#a53e3e]" />
                        <Stat label="Est. sessions" value={`${draft.nodes.length + 3}`} />
                      </div>

                      <div className="mb-5">
                        <p className="mb-3 text-sm font-medium text-[#0b1c2f]">
                          Mastery estimate - live from BKT/IRT, not editable
                        </p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {selectedStudent.mastery.map(([name, value], index) => (
                            <Motion.div
                              key={name}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.06 }}
                              className="rounded-[1.2rem] border border-[#eef2f9] bg-white p-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] uppercase tracking-[0.08em] text-[#65758b]">{name}</span>
                                <span className="text-sm font-semibold text-[#0b1c2f]">{value}%</span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef2f7]">
                                <Motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${value}%` }}
                                  transition={{ duration: 0.8, delay: 0.12 + index * 0.08 }}
                                  className={`h-full rounded-full ${masteryClass(value) === 'high' ? 'bg-[#1e7e34]' : masteryClass(value) === 'medium' ? 'bg-[#b8860b]' : 'bg-[#a53e3e]'}`}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-[#8a9bb0]">±{4 + index}% confidence</p>
                            </Motion.div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-5 flex items-center gap-4 rounded-[1.4rem] border border-[#eef2f9] bg-[#f8fbfe] p-4">
                        <Ring value={Math.min(100, draft.nodes.filter((node) => node.status === 'done').length * 100 / draft.nodes.length)} />
                        <div className="flex flex-1 flex-wrap gap-4">
                          <TinyStat label="Progress" value={`${Math.round((draft.nodes.filter((node) => node.status === 'done').length * 100) / draft.nodes.length)}%`} />
                          <TinyStat label="Completed" value={`${draft.nodes.filter((node) => node.status === 'done').length} / ${draft.nodes.length}`} />
                          <TinyStat label="Unlocked" value={`${draft.nodes.filter((node) => node.status !== 'locked').length} / ${draft.nodes.length}`} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {draft.nodes.map((node, index) => (
                          <Motion.div
                            key={node.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-[1.4rem] border p-4 transition ${
                              node.status === 'done'
                                ? 'border-[#b8d9b8] bg-[#f0f7f0]'
                                : node.status === 'active'
                                  ? 'border-[#cddaf0] bg-[#f8fbfe]'
                                  : 'border-[#eef2f9] bg-white opacity-70'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <NodeMarker node={node} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#0b1c2f]">{node.title}</h4>
                                  <Badge tone={node.tier}>{tierBadge[node.tier]}</Badge>
                                  <Badge tone="bloom">Bloom: {node.bloom}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-[#4a5e78]">{nodeDescription(node)}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <ActionButton
                                    onClick={() => completeTeacherStep(index)}
                                    label={node.status === 'done' ? 'Completed ✓' : 'Mark complete'}
                                    tone={node.status === 'done' ? 'success' : 'primary'}
                                    icon={CheckCircle}
                                  />
                                  {node.hasLesson && <ActionButton onClick={() => openLesson(index)} label="Preview content" tone="ghost" icon={Play} />}
                                </div>
                                {node.status === 'locked' && (
                                  <p className="mt-2 text-xs text-[#8a9bb0]">Unlocks when step {index} reaches 70% mastery</p>
                                )}
                              </div>
                            </div>
                          </Motion.div>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3 border-t border-[#eef2f9] pt-5">
                        <ActionButton onClick={publish} label={published?.student === draft.student ? 'Re-publish' : 'Publish to student'} tone="primary" icon={ArrowRight} />
                        <ActionButton onClick={regenerate} label="Regenerate" tone="ghost" icon={RefreshCw} />
                        <ActionButton onClick={resetProgress} label="Reset progress" tone="ghost" icon={RefreshCw} />
                      </div>
                    </Motion.section>
                  )}
                </AnimatePresence>

                <Motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.14 }}
                  className="rounded-[1.6rem] border border-[#eef2f9] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.01)]"
                >
                  <h3 className="mb-4 text-base font-semibold text-[#0b1c2f]">Recent activity</h3>
                  <div className="space-y-3">
                    {['Path generated for Arjun Singh', 'Equivalent fractions preview opened', 'Teacher switched to Science draft'].map((item, index) => (
                      <Activity key={item} index={index} text={item} />
                    ))}
                  </div>
                </Motion.section>
              </>
          ) : (
            <Motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.05 }}
              className="rounded-[1.6rem] border border-[#eef2f9] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.01)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2d7aff]">Your journey</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#0b1c2f]">
                    {activePath ? `${activePath.focus} journey` : 'No path yet'}
                  </h2>
                  <p className="text-sm text-[#65758b]">
                    {activePath ? `${activePath.nodes.filter((node) => node.status === 'done').length} of ${activePath.nodes.length} stops complete` : 'Your teacher has not published a learning path yet.'}
                  </p>
                </div>
                {activePath && <Ring value={Math.min(100, activePath.nodes.filter((node) => node.status === 'done').length * 100 / activePath.nodes.length)} compact />}
              </div>

              {!activePath ? (
                <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#dbe7fe] bg-[#f8fbfe] px-6 py-10 text-center">
                  <p className="text-lg font-semibold text-[#0b1c2f]">No path yet</p>
                  <p className="mt-1 text-sm text-[#65758b]">Your teacher hasn't published a learning path. Check back soon.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {activePath.nodes.map((node, index) => (
                    <Motion.div
                      key={node.title}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4"
                    >
                      <div className="flex flex-col items-center">
                        <Motion.div
                          animate={node.status === 'active' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                          transition={{ duration: 2, repeat: node.status === 'active' ? Infinity : 0 }}
                          className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                            node.status === 'done'
                              ? 'bg-[#1e7e34] text-white'
                              : node.status === 'active'
                                ? 'bg-[#2d7aff] text-white'
                                : 'border border-[#e3ebf6] bg-[#f0f3f8] text-[#a0acbd]'
                          }`}
                        >
                          {node.status === 'done' ? '✓' : node.idx + 1}
                        </Motion.div>
                        {index !== activePath.nodes.length - 1 && <div className={`h-8 w-[2px] ${node.status === 'done' ? 'bg-[#b8d9b8]' : 'bg-[#e3ebf6]'}`} />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm font-semibold text-[#0b1c2f]">{node.title}</p>
                        <p className="mt-1 text-sm text-[#65758b]">
                          {node.status === 'done'
                            ? `Mastered · Bloom: ${node.bloom}`
                            : node.status === 'active'
                              ? `In progress · Bloom: ${node.bloom}`
                              : 'Locked · opens as you master earlier stops'}
                        </p>
                        {node.status === 'active' && (
                          <Motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 rounded-[1.2rem] border border-[#eef2f9] bg-[#f8fbfe] p-4"
                          >
                            <p className="text-sm text-[#4a5e78]">
                              A short explainer, practice, and hints - written for exactly where you are now.
                            </p>
                            <div className="mt-3">
                              <ActionButton
                                onClick={() => (node.hasLesson ? openLesson(index) : null)}
                                label={node.hasLesson ? 'Continue' : 'Start'}
                                tone="primary"
                                icon={Play}
                              />
                            </div>
                          </Motion.div>
                        )}
                      </div>
                    </Motion.div>
                  ))}
                </div>
              )}
            </Motion.section>
          )}
        </div>
      </Motion.div>

      <AnimatePresence>
        {lessonState.open && lesson && (
          <Motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLesson}
          >
            <Motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-xl rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-[0_24px_52px_-14px_rgba(0,20,40,.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b3d8a]">
                    Bloom: {draft?.nodes?.[lessonState.index]?.bloom || 'apply'}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#0b1c2f]">
                    {draft?.nodes?.[lessonState.index]?.title || 'Lesson preview'}
                  </h3>
                </div>
                <button type="button" onClick={closeLesson} className="rounded-full bg-[#f0f3f8] p-2 text-[#65758b] transition hover:bg-[#e8eef7]">
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <LessonBlock title="Explainer - drafted by Claude for this student" text={lesson.explain} />
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#65758b]">Practice - IRT-banded</p>
                  <div className="rounded-[1.4rem] border border-[#eef2f9] bg-[#f8fbfe] p-4">
                    <p className="text-sm font-semibold text-[#0b1c2f]">{lesson.q}</p>
                    <div className="mt-3 space-y-2">
                      {lesson.opts.map(([option, correct]) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toastMessage(correct ? 'Correct' : 'Try again')}
                          className="w-full rounded-xl border border-[#e3ebf6] bg-white px-4 py-3 text-left text-sm text-[#0b1c2f] transition hover:border-[#2d7aff]"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-[#2d7aff]">Hint - {lesson.hint}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <ActionButton onClick={() => toastMessage('Hint revealed')} label="Show hint" tone="ghost" icon={Lightbulb} />
                <ActionButton onClick={() => { completeTeacherStep(lessonState.index); closeLesson(); }} label="Mark complete" tone="primary" icon={CheckCircle} />
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#65758b]">{label}</span>
    {children}
  </label>
);

const Stat = ({ label, value, accent = '' }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.08em] text-[#65758b]">{label}</p>
    <p className={`text-lg font-semibold text-[#0b1c2f] ${accent}`}>{value}</p>
  </div>
);

const TinyStat = ({ label, value }) => (
  <div className="min-w-[120px]">
    <p className="text-[11px] uppercase tracking-[0.08em] text-[#65758b]">{label}</p>
    <p className="text-lg font-semibold text-[#0b1c2f]">{value}</p>
  </div>
);

const Ring = ({ value, compact = false }) => (
  <svg className={compact ? 'size-16' : 'size-20'} viewBox="0 0 36 36" aria-hidden="true">
    <path d={ringPath} fill="none" stroke="#eef2f7" strokeWidth="3" />
    <Motion.path
      d={ringPath}
      fill="none"
      stroke="#2d7aff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="0 100"
      pathLength="100"
      animate={{ strokeDasharray: `${Math.max(0, Math.min(100, value))} 100` }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      transform="rotate(-90 18 18)"
    />
    <text x="18" y="21" textAnchor="middle" fontSize="9" fontWeight="600" fill="#1f4b8a" fontFamily="Inter">
      {Math.round(value)}%
    </text>
  </svg>
);

const NodeMarker = ({ node }) => {
  const isDone = node.status === 'done';
  const isActive = node.status === 'active';
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
        isDone
          ? 'border-[#1e7e34] bg-[#1e7e34] text-white'
          : isActive
            ? 'border-[#2d7aff] bg-[#2d7aff] text-white'
            : 'border-[#e3ebf6] bg-[#f0f3f8] text-[#a0acbd]'
      }`}
    >
      {isDone ? '✓' : node.idx + 1}
    </div>
  );
};

const Badge = ({ tone, children }) => {
  const toneClass =
    tone === 'blue'
      ? 'bg-[#e2eaf9] text-[#1d3c6b]'
      : tone === 'orange'
        ? 'bg-[#fde8d0] text-[#a8670b]'
        : tone === 'purple'
          ? 'bg-[#e8e0f5] text-[#5b3d8a]'
          : tone === 'green'
            ? 'bg-[#e6f4ea] text-[#1e6f3f]'
            : 'bg-[#eae5f4] text-[#4a2f7a]';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${toneClass}`}>{children}</span>;
};

const ActionButton = ({ onClick, label, tone, icon: Icon }) => {
  const base = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition';
  const toneClass =
    tone === 'primary'
      ? 'bg-[#2d7aff] text-white shadow-sm hover:bg-[#1a5fd9]'
      : tone === 'success'
        ? 'bg-[#1e7e34] text-white hover:bg-[#166b2b]'
        : 'border border-[#e3ebf6] bg-transparent text-[#1f3a5f] hover:bg-[#f0f6fe]';
  return (
    <button type="button" onClick={onClick} className={`${base} ${toneClass}`}>
      {Icon && <Icon className="size-4" />}
      {label}
    </button>
  );
};

const Activity = ({ index, text }) => (
  <Motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="rounded-[1.2rem] border-l-4 border-[#2d7aff] bg-[#f0f7ff] px-4 py-3"
  >
    <strong className="block text-sm text-[#0b1c2f]">{text}</strong>
    <div className="mt-1 text-[11px] font-medium text-[#2d6bb8]">Notified student</div>
  </Motion.div>
);

const LessonBlock = ({ title, text }) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#65758b]">{title}</p>
    <p className="rounded-[1.4rem] border border-[#eef2f9] bg-[#f8fbfe] p-4 text-sm leading-6 text-[#4a5e78]">{text}</p>
  </div>
);

const nodeDescription = (node) => {
  if (node.tier === 'green') return '8 mixed IRT-calibrated items. Feeds BKT to confirm mastery and close the Dalton contract.';
  if (node.idx === 0) return 'Warm-up anchored on what the student already knows before new material.';
  return `Explainer + IRT-banded practice, drafted at Bloom "${node.bloom}" level for this student.`;
};

const toastMessage = (message) => {
  const existing = document.getElementById('ai-path-toast');
  if (existing) {
    existing.textContent = message;
    existing.classList.add('on');
    window.clearTimeout(existing._timeout);
    existing._timeout = window.setTimeout(() => existing.classList.remove('on'), 2000);
    return;
  }

  const toast = document.createElement('div');
  toast.id = 'ai-path-toast';
  toast.className = 'fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#1a2b4a] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,.2)]';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2000);
};

export default GenerateAIPathPortal;
