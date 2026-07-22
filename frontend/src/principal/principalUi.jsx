import React from 'react';
import { motion as framerMotion, useReducedMotion } from 'framer-motion';

export const MotionSection = framerMotion.section;
export const MotionDiv = framerMotion.div;

export const cx = (...classes) => classes.filter(Boolean).join(' ');

const TONES = {
  neutral: 'border-slate-200 bg-white text-slate-600',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  slate: 'border-slate-700 bg-slate-800 text-slate-200',
};

export const Badge = ({ children, tone = 'neutral', className = '' }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
      TONES[tone] || TONES.neutral,
      className
    )}
  >
    {children}
  </span>
);

export const CardShell = ({ children, className = '', delay = 0 }) => {
  const reduceMotion = useReducedMotion();
  return (
    <MotionSection
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
      className={cx(
        'rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/70',
        className
      )}
    >
      {children}
    </MotionSection>
  );
};

export const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700">
          {React.createElement(Icon, { size: 18 })}
        </div>
      )}
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
    {Icon && <Icon className="h-8 w-8 text-slate-300" />}
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {description && <p className="text-xs text-slate-500">{description}</p>}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, tone = 'slate', delay = 0 }) => (
  <CardShell delay={delay} className="p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      {Icon && (
        <div className={cx('rounded-xl p-2.5', TONES[tone] || TONES.neutral)}>
          <Icon size={20} />
        </div>
      )}
    </div>
  </CardShell>
);

export const pageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};
