/* eslint-disable react/prop-types */
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, RefreshCw, Smile, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const initials = (name) => String(name || 'Student')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const valueOrDash = (value, suffix = '') => (value != null ? `${value}${suffix}` : '—');

const scoreLevel = (score) => {
  if (score == null) return 'Awaiting data';
  if (score >= 85) return 'Advanced';
  if (score >= 70) return 'Proficient';
  if (score >= 50) return 'Developing';
  return 'Emerging';
};

const StatBlock = ({ tone = 'slate', label, value, sub, progress }) => {
  const tones = {
    purple: 'bg-purple-50 border-purple-100 text-purple-700 [&>div>div]:bg-purple-500',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700 [&>div>div]:bg-emerald-500',
    rose: 'bg-rose-50 border-rose-100 text-rose-600 [&>div>div]:bg-rose-500',
    slate: 'bg-slate-50 border-slate-100 text-slate-900 [&>div>div]:bg-purple-500',
  };
  return (
    <div className={`rounded-2xl border p-3 transition hover:-translate-y-0.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">◈ {label}</p>
      <p className="mt-0.5 text-2xl font-bold">{value}</p>
      {progress != null && <Progress value={progress} className="mt-1 h-1 bg-slate-200" />}
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
};

const SectionCard = ({ dot, title, badge, onClick, children }) => {
  const content = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {title}
        </p>
        {badge}
      </div>
      {children}
    </>
  );

  return (
    <motion.section
      variants={itemVariants}
      className="rounded-3xl border border-slate-100 bg-white px-5 pb-6 pt-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)]"
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full text-left">{content}</button>
      ) : content}
    </motion.section>
  );
};

const AnalyticsPureWhiteDashboard = ({
  students,
  selectedId,
  selectedStudent,
  onSelectStudent,
  academicData,
  wellbeingData,
  skillsData,
  loadingAcademic,
  loadingWellbeing,
  loadingSkills,
  errors,
  currentMonthAttendance,
  onRetry,
  onOpen,
}) => {
  const attendance = currentMonthAttendance?.attendancePercentage;
  const mood = wellbeingData?.avgMood;
  const skillScore = skillsData?.overallSkillScore;
  const overallMastery = academicData?.overallMastery;
  const holistic = skillsData?.holistic;
  const academicBreakdown = holistic?.academicGrowth?.breakdown || {};
  const subjectCount = academicData?.subjectBreakdown?.length || 0;
  const examCount = academicData?.examTrend?.length || 0;
  const observations = wellbeingData?.totalObservations || 0;
  const highConcern = (wellbeingData?.concernCounts?.high || 0) + (wellbeingData?.concernCounts?.urgent || 0);
  const domains = Array.isArray(skillsData?.domains) ? skillsData.domains : [];
  const allSkills = domains.flatMap((domain) => (domain.skills || []).map((skill) => ({ ...skill, domain: domain.name, color: domain.color })));
  const trackedSkills = allSkills.length;
  const masteredSkills = allSkills.filter((skill) => Number(skill.score) >= 70).length;
  const insightCount = [attendance, mood, skillScore, overallMastery, observations, subjectCount].filter((value) => value != null).length;
  const errorMessages = Object.values(errors || {}).filter(Boolean);

  const masteryItems = [
    { label: 'Attendance · This month', value: valueOrDash(attendance, '%'), Icon: Calendar, wrap: 'bg-purple-50 border-purple-100', color: 'text-purple-600' },
    { label: 'Avg Mood', value: valueOrDash(mood, '/5'), Icon: Smile, wrap: 'bg-emerald-50 border-emerald-100', color: 'text-emerald-600' },
    { label: 'Skill Score', value: valueOrDash(skillScore, '%'), Icon: Sparkles, wrap: 'bg-amber-50 border-amber-200', color: 'text-amber-600' },
  ];

  const estimates = [
    { label: 'Cognitive', score: academicBreakdown.cognitive?.score, bar: '[&>div]:bg-purple-500' },
    { label: 'Memory', score: academicBreakdown.memory?.score, bar: '[&>div]:bg-emerald-500' },
    { label: 'Creative', score: academicBreakdown.creative?.score, bar: '[&>div]:bg-amber-500' },
    { label: 'Language', score: academicBreakdown.language?.score, bar: '[&>div]:bg-rose-500' },
  ];

  return (
    <motion.main
      className="mx-auto w-full max-w-[1280px] space-y-6 bg-white px-3 py-5 sm:px-6 sm:py-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.header variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/[0.04] bg-white/70 px-5 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)] sm:px-8">
        <div>
          <h1 className="bg-gradient-to-br from-[#0b0e1a] from-60% to-[#6d46d9] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">Child Growth Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">Academic performance &amp; emotional wellbeing at a glance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-black/[0.04] bg-white/80 py-1 pl-1 pr-4 backdrop-blur-sm">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-400 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(139,92,246,0.2)]">{initials(selectedStudent?.name)}</div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#0b0e1a]">{selectedStudent?.name || 'Student'}</p>
              <p className="text-xs text-slate-500">
                {selectedStudent?.grade ? `Grade ${selectedStudent.grade}` : 'Grade not set'}
                {selectedStudent?.section ? ` · Section ${selectedStudent.section}` : ''}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">Current academic year</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Active</span>
        </div>
      </motion.header>

      {errorMessages.length > 0 && (
        <motion.div variants={itemVariants} role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Some analytics could not be loaded</p>
              <p className="mt-0.5 text-xs">{errorMessages.join(' ')}</p>
            </div>
          </div>
          <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-rose-100">
            <RefreshCw size={13} /> Retry
          </button>
        </motion.div>
      )}

      {students.length > 1 && (
        <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
          {students.map((student) => (
            <button key={student._id} type="button" onClick={() => onSelectStudent(student._id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${String(selectedId) === String(student._id) ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200 hover:text-purple-700'}`}>
              {student.name}
            </button>
          ))}
        </motion.div>
      )}

      <motion.div variants={containerVariants} className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {masteryItems.map(({ label, value, Icon, wrap, color }, index) => (
          <motion.div key={label} variants={itemVariants} className={`flex items-center gap-4 rounded-[20px] border px-6 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${wrap}`}>
            <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] border border-white/80 bg-white/60 ${color}`}>
              {(index === 0 && loadingAcademic) || (index === 1 && loadingWellbeing) || (index === 2 && loadingSkills) ? <span className="animate-pulse">···</span> : <Icon size={19} />}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
              <p className="text-[1.6rem] font-bold leading-tight text-[#0b0e1a]">{value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard dot="bg-purple-500" title="Holistic Development Overview" badge={<span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600">View all</span>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Academic Growth</p>
              <p className="mt-1 text-base font-semibold text-[#0b0e1a]">{valueOrDash(holistic?.academicGrowth?.score, '%')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{['Cognitive', 'Memory', 'Creative', 'Language'].map((tag) => <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">{tag}</span>)}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Emotional Wellbeing</p>
              <p className="mt-1 text-base font-semibold text-[#0b0e1a]">{valueOrDash(holistic?.emotionalWellbeing?.score, '%')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{['Social-Emotional', 'Physical'].map((tag) => <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">{tag}</span>)}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Overall Mastery</p>
              {overallMastery != null ? <p className="mt-1 text-2xl font-bold text-[#0b0e1a]">{overallMastery}%</p> : <div className="mt-1 rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">⋯<br />No data yet · awaiting assessment</div>}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Estimated from academic data</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {estimates.map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-center"><p className="text-[10px] font-medium uppercase text-slate-400">{item.label}</p><p className="text-lg font-bold text-[#0b0e1a]">{item.score ?? '—'}</p><Progress value={item.score || 0} className={`mt-1 h-1 bg-slate-200 ${item.bar}`} /></div>)}
            </div>
          </div>
        </SectionCard>

        <SectionCard dot="bg-emerald-500" title="Growth · Academic Performance" onClick={academicData ? () => onOpen('academic') : undefined} badge={<span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">This term</span>}>
          <div className="grid grid-cols-2 gap-3">
            <StatBlock tone="purple" label="Subjects Tracked" value={subjectCount} progress={Math.min(subjectCount * 10, 100)} sub={`${subjectCount} subjects with recorded evidence`} />
            <StatBlock tone="emerald" label="Exams Taken" value={examCount} progress={Math.min(examCount * 10, 100)} sub={`${examCount} assessment${examCount === 1 ? '' : 's'} available`} />
          </div>
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Cognitive &amp; Thinking</p>
          <div className="space-y-2">
            {(allSkills.length ? allSkills.slice(0, 4) : estimates).map((skill, index) => {
              const label = skill.label || skill.name || skill.domain || estimates[index]?.label;
              const score = skill.score;
              const dots = ['bg-purple-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500'];
              return <div key={`${label}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 transition hover:bg-slate-100"><span className="flex items-center gap-2 text-sm font-medium text-slate-700"><span className={`h-2 w-2 rounded-full ${dots[index]}`} />{label}</span><span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">{scoreLevel(score)}</span></div>;
            })}
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard dot="bg-amber-500" title="Growth · Emotional Wellbeing" onClick={wellbeingData ? () => onOpen('wellbeing') : undefined} badge={<span className={`rounded-full border px-3 py-1 text-xs font-medium ${!wellbeingData ? 'border-slate-200 bg-slate-50 text-slate-500' : highConcern > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{!wellbeingData ? 'Awaiting data' : highConcern > 0 ? 'Needs review' : 'On track'}</span>}>
          <div className="grid grid-cols-2 gap-3">
            <StatBlock label="Observations" value={observations} sub={`${observations} recorded observation${observations === 1 ? '' : 's'}`} />
            <StatBlock tone="rose" label="High Concern" value={highConcern} progress={observations ? (highConcern / observations) * 100 : 0} sub="flagged for review" />
            <div className="col-span-2"><StatBlock label="Mood" value={valueOrDash(mood, ' / 5')} progress={mood != null ? mood * 20 : 0} sub="Latest available wellbeing average" /></div>
          </div>
        </SectionCard>

        <SectionCard dot="bg-purple-500" title="Growth · Skill Development" onClick={skillsData ? () => onOpen('skills') : undefined} badge={<span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">{trackedSkills ? `${trackedSkills} skills` : 'No skill data'}</span>}>
          <div className="grid grid-cols-2 gap-3">
            <StatBlock tone="purple" label="Skills Tracked" value={trackedSkills || '—'} progress={trackedSkills ? skillScore || 0 : undefined} sub={trackedSkills ? `${masteredSkills} proficient · ${trackedSkills - masteredSkills} developing` : 'Awaiting skill evidence'} />
            <StatBlock tone="emerald" label="Domains" value={domains.length || '—'} progress={domains.length ? 100 : undefined} sub={domains.length ? domains.map((domain) => domain.name).join(' · ') : 'No domain evidence recorded'} />
          </div>
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <div className="flex flex-wrap gap-2">
            {domains.slice(0, 5).map((domain, index) => {
              const tones = ['border-purple-200 bg-purple-50 text-purple-700', 'border-emerald-200 bg-emerald-50 text-emerald-700', 'border-amber-200 bg-amber-50 text-amber-700', 'border-rose-200 bg-rose-50 text-rose-700', 'border-slate-200 bg-slate-50 text-slate-700'];
              return <span key={domain.name} className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[index]}`}>{domain.name}</span>;
            })}
            {!domains.length && <p className="text-xs text-slate-500">Skill domains will appear after the school records assessment evidence.</p>}
          </div>
        </SectionCard>
      </motion.div>

      <motion.footer variants={itemVariants} className="flex flex-wrap justify-end gap-4 px-1 text-[10px] tracking-wide text-slate-500/60">
        <span>● Data sync: live</span>
        <span>● {insightCount} insights available</span>
      </motion.footer>
    </motion.main>
  );
};

export default AnalyticsPureWhiteDashboard;