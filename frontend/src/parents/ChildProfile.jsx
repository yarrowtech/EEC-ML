import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Droplet,
  Edit3,
  FileText,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Medal,
  Phone,
  School,
  Trophy,
  User,
  UserCircle,
  Users,
} from 'lucide-react';

<<<<<<< HEAD
=======
import ChildSwitcher from './ChildSwitcher';
import ParentAiConsent from '../features/ai-consent/ParentAiConsent';
>>>>>>> 2a59b9a5 (added the remaining work)
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : '—';

const fullDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '—';

const valueOrDash = (value) =>
  value !== undefined && value !== null && value !== '' ? value : '—';

const PAGE = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.25,
      staggerChildren: 0.08,
    },
  },
};

const RISE = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

/* ---
   Small reusable components
------------------------------------------------------- */

// const InfoItem = ({ icon: Icon, label, value, iconClass = 'text-blue-600' }) => (
//   <div className="flex w-full items-center gap-3">
//     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
//       <Icon size={19} className={iconClass} strokeWidth={2.1} />
//     </div>

//     <div className="min-w-0">
//       <p className="text-[11px] font-medium text-slate-400">{label}</p>
//       <p className="truncate text-[8px] font-semibold text-slate-800">
//         {valueOrDash(value)}
//       </p>
//     </div>
//   </div>
// );

const InfoItem = ({
  icon: Icon,
  label,
  value,
  iconClass = 'text-blue-600',
  nowrap = false,
}) => (
  <div className="flex min-w-0 items-center gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:h-10 sm:w-10">
      <Icon size={18} className={iconClass} strokeWidth={2.1} />
    </div>

    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-600">{label}</p>

      <p
        className={`text-sm font-semibold text-slate-800 ${nowrap
            ? 'break-all lg:whitespace-nowrap lg:break-normal'
            : 'break-words'
          }`}
      >
        {valueOrDash(value)}
      </p>
    </div>
  </div>
);
const DetailRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="max-w-[65%] text-right text-xs font-semibold text-slate-800">
      {valueOrDash(value)}
    </span>
  </div>
);

const Card = ({
  title,
  icon: Icon,
  children,
  action,
  className = '',
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
}) => (
  <motion.section
    variants={RISE}
    whileHover={{ y: -2 }}
    transition={{ duration: 0.18 }}
    className={`flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.035)] ${className}`}
  >
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon size={16} className={iconColor} />
        </div>

        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>

      {action}
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
  </motion.section>
);

const EditButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
  >
    <Edit3 size={13} />
    Edit
  </button>
);

const TabButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${active
        ? 'border-blue-600 text-slate-900'
        : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800'
      }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

const ContactCard = ({ title, person }) => {
  if (!person?.name && !person?.phone && !person?.email) return null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-800">
        {valueOrDash(person?.name)}
      </p>

      {person?.phone && (
        <a
          href={`tel:${person.phone}`}
          className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:underline"
        >
          <Phone size={12} />
          {person.phone}
        </a>
      )}

      {person?.email && (
        <p className="mt-1 truncate text-[11px] text-slate-500">
          {person.email}
        </p>
      )}
    </div>
  );
};

/* -------------------------------------------------------
   Main component
------------------------------------------------------- */

const ChildProfile = () => {
  const {
    parent,
    selected: c,
    school,
    loading,
    error,
    reload,
  } = useParentChildren();

  const [activeTab, setActiveTab] = React.useState('Overview');

  if (loading && !c) {
    return <Loading />;
  }

  if (!c) {
    return (
      <div className="p-4 md:p-6">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <EmptyState
            title="No child linked"
            hint="Ask the school to link your child to this account."
            icon={User}
          />
        )}
      </div>
    );
  }

  const coverImage =
    school?.coverImage || c.schoolCoverPhoto || c.coverPhoto || '';

  /*
   * These values use API data when available.
   * If your API doesn't provide them yet, the UI simply shows
   * the compact default values below.
   */
  const attendance = c.attendance || {};
  const present = Number(attendance.present ?? c.presentDays ?? 17);
  const absent = Number(attendance.absent ?? c.absentDays ?? 2);
  const late = Number(attendance.late ?? c.lateDays ?? 1);

  const attendanceTotal = present + absent + late;
  const attendancePercent =
    attendance.percent ??
    (attendanceTotal
      ? Math.round((present / attendanceTotal) * 100)
      : 0);

  const father = c.father || {};
  const mother = c.mother || {};
  const guardian = c.guardian || {};

  const handleTab = (tab) => {
    setActiveTab(tab);

    if (tab !== 'Overview') {
      const element = document.getElementById(
        `profile-${tab.toLowerCase().replace(/\s+/g, '-')}`
      );

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }
  };

  return (
    <motion.div
      variants={PAGE}
      initial="hidden"
      animate="show"
      className="min-h-full bg-[#f7faff] p-3 sm:p-4 lg:h-full lg:overflow-hidden lg:p-4"
    >
      <div className="mx-auto max-w-[1500px] space-y-3 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:gap-3">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <motion.div variants={RISE} className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button> */}

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#10145c] sm:text-2xl">
                Child Profile
              </h1>

              <p className="text-xs text-slate-500 sm:text-sm">
                View your child's complete information, academic details and
                school activities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {error && (
              <button
                type="button"
                onClick={reload}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Retry
              </button>
            )}
          </div>
        </motion.div>

        {/* =====================================================
            PROFILE HERO
        ====================================================== */}

        <motion.section variants={RISE} className="relative shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_3px_18px_rgba(15,23,42,0.04)]">
          {/* =====================================================
      SCHOOL COVER IMAGE - RIGHT SIDE
  ====================================================== */}

          {coverImage && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0 scale-110 bg-cover bg-center blur-[3px]"
                style={{ backgroundImage: `url("${coverImage}")` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/40" />
            </div>
          )}

          {/* =====================================================
      CONTENT
  ====================================================== */}

          <div className="relative z-10 p-4 sm:p-5 lg:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
                className="relative shrink-0"
              >
                {c.photo ? (
                  <img
                    src={c.photo}
                    alt={c.name}
                    className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-sm sm:h-20 sm:w-20 lg:h-24 lg:w-24"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-xl font-bold sm:text-2xl text-blue-600 ring-4 ring-white shadow-sm sm:h-20 sm:w-20 lg:h-24 lg:w-24">
                    {c.name
                      ?.split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </motion.div>


              <div className="min-w-0 flex-1">
                {/* Name + Status */}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-lg font-extrabold tracking-tight text-[#10145c] sm:text-xl lg:text-2xl">
                    {c.name}
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${c.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {c.status || 'Active'}
                  </span>
                </div>

                {/* Class / Section / Roll */}
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Class {valueOrDash(c.grade)}
                  {c.section ? ` • Section ${c.section}` : ''}
                  {c.roll !== '' && c.roll !== undefined
                    ? ` • Roll ${c.roll}`
                    : ''}
                </p>


                {/* Info items beside the photo on desktop */}
                <div className="mt-3 hidden grid-cols-2 gap-x-6 gap-y-3 lg:grid xl:grid-cols-4">
                  {/* Student ID */}
                  <div className="min-w-0">
                    <InfoItem
                      icon={Users}
                      label="Student ID"
                      value={c.studentCode}
                      nowrap
                    />
                  </div>

                  {/* Date of Birth */}
                  <InfoItem
                    icon={CalendarDays}
                    label="Date of Birth"
                    value={c.dob ? fullDate(c.dob) : '—'}
                  />

                  {/* Gender */}
                  <InfoItem
                    icon={User}
                    label="Gender"
                    value={
                      c.gender
                        ? c.gender.charAt(0).toUpperCase() + c.gender.slice(1)
                        : '—'
                    }
                  />

                  {/* Blood Group */}
                  <InfoItem
                    icon={Droplet}
                    label="Blood Group"
                    value={c.bloodGroup}
                    iconClass="text-purple-600"
                  />
                </div>
              </div>
            </div>

            {/* Info items full-width below the photo on mobile / tablet */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 min-[420px]:grid-cols-2 md:grid-cols-4 lg:hidden">
                  {/* Student ID */}
                  <div className="min-w-0">
                    <InfoItem
                      icon={Users}
                      label="Student ID"
                      value={c.studentCode}
                      nowrap
                    />
                  </div>

                  {/* Date of Birth */}
                  <InfoItem
                    icon={CalendarDays}
                    label="Date of Birth"
                    value={c.dob ? fullDate(c.dob) : '—'}
                  />

                  {/* Gender */}
                  <InfoItem
                    icon={User}
                    label="Gender"
                    value={
                      c.gender
                        ? c.gender.charAt(0).toUpperCase() + c.gender.slice(1)
                        : '—'
                    }
                  />

                  {/* Blood Group */}
                  <InfoItem
                    icon={Droplet}
                    label="Blood Group"
                    value={c.bloodGroup}
                    iconClass="text-purple-600"
                  />
            </div>
          </div>
        </motion.section>

        {/* =====================================================
            TABS
        ====================================================== */}

        {/* <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="flex min-w-max px-1">
            <TabButton
              icon={Home}
              label="Overview"
              active={activeTab === 'Overview'}
              onClick={() => handleTab('Overview')}
            />

            <TabButton
              icon={User}
              label="Personal Information"
              active={activeTab === 'Personal Information'}
              onClick={() => handleTab('Personal Information')}
            />

            <TabButton
              icon={GraduationCap}
              label="Academic Information"
              active={activeTab === 'Academic Information'}
              onClick={() => handleTab('Academic Information')}
            />

            <TabButton
              icon={Users}
              label="Parent / Guardian"
              active={activeTab === 'Parent / Guardian'}
              onClick={() => handleTab('Parent / Guardian')}
            />

            <TabButton
              icon={FileText}
              label="Documents"
              active={activeTab === 'Documents'}
              onClick={() => handleTab('Documents')}
            />

            <TabButton
              icon={Trophy}
              label="Achievements"
              active={activeTab === 'Achievements'}
              onClick={() => handleTab('Achievements')}
            />

            <TabButton
              icon={Heart}
              label="Medical Information"
              active={activeTab === 'Medical Information'}
              onClick={() => handleTab('Medical Information')}
            />
          </div>
        </div> */}

        {/* =====================================================
            INFORMATION GRID
        ====================================================== */}

<<<<<<< HEAD
        <motion.div variants={PAGE} className="grid items-stretch gap-3 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-4">
=======
        <div className="min-h-0 space-y-3 lg:flex-1 lg:overflow-y-auto">
        <ParentAiConsent key={c.id} studentId={c.id} childName={c.name} />
        <div className="grid items-stretch gap-3 md:grid-cols-2 lg:grid-cols-4">
>>>>>>> 2a59b9a5 (added the remaining work)
          {/* Quick Info */}
          <Card
            title="Quick Info"
            icon={ClipboardList}
            className="h-full"
            iconBg="bg-rose-50"
            iconColor="text-rose-500"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <BookOpen size={16} className="text-blue-600" />
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">Class</p>
                    <p className="text-sm font-bold text-slate-800">
                      {valueOrDash(c.grade)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                    <Users size={16} className="text-purple-600" />
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">Section</p>
                    <p className="text-sm font-bold text-slate-800">
                      {valueOrDash(c.section)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                    <span className="text-sm font-bold text-violet-600">
                      #
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">Roll No.</p>
                    <p className="text-sm font-bold text-slate-800">
                      {valueOrDash(c.roll)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                    <CalendarDays size={16} className="text-indigo-600" />
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400">
                      Academic Year
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {valueOrDash(c.academicYear)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card
            title="Personal Information"
            className="h-full"
            icon={User}
            // action={<EditButton />}
          >
            <div id="profile-personal-information">
              <DetailRow label="Full Name" value={c.name} />
              <DetailRow
                label="Date of Birth"
                value={c.dob ? fullDate(c.dob) : ''}
              />
              {/* <DetailRow label="Gender" value={c.gender.charAt(0).toUpperCase() + c.gender.slice(1)} /> */}
              <DetailRow label="Blood Group" value={c.bloodGroup} />
              <DetailRow label="Nationality" value={c.nationality || 'Indian'} />
              <DetailRow label="Address" value={c.address} />
            </div>
          </Card>

          {/* Academic Information */}
          <Card
            title="Academic Information"
            className="h-full"
            icon={GraduationCap}
            // action={<EditButton />}
          >
            <div id="profile-academic-information">
              <DetailRow label="Academic Year" value={c.academicYear} />
              <DetailRow label="Class" value={`${c.grade} - ${c.section}`} />
              {/* <DetailRow label="Section" value={c.section} /> */}
              <DetailRow label="Roll No." value={c.roll} />
              <DetailRow
                label="Admission No."
                value={c.admissionNumber}
              />
              <DetailRow
                label="Date of Admission"
                value={c.admissionDate ? fmt(c.admissionDate) : ''}
              />

              {c.classTeacher && (
                <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5">
                  {c.classTeacher.photo ? (
                    <img
                      src={c.classTeacher.photo}
                      alt={c.classTeacher.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <User size={14} />
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] text-slate-400">
                      Class Teacher
                    </p>
                    <p className="text-xs font-bold text-slate-800">
                      {c.classTeacher.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Parent / Guardian */}
          <Card
            title="Parent / Guardian Information"
            className="h-full"
            icon={Users}
            // action={<EditButton />}
          >
            <div
              id="profile-parent-/-guardian"
              className="space-y-2"
            >
              <ContactCard title="Father" person={father} />
              <ContactCard title="Mother" person={mother} />
              {/* <ContactCard title="Guardian" person={guardian} /> */}

              {/* {parent && (
                <ContactCard
                  title="Portal Account"
                  person={{
                    name: parent.name || parent.username,
                    phone: parent.phone,
                    email: parent.email,
                  }}
                />
              )} */}

              {/* {c.address && (
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                  <MapPin
                    size={14}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />
                  <p className="text-[11px] leading-5 text-slate-600">
                    {c.address}
                  </p>
                </div>
              )} */}
            </div>
          </Card>
        </motion.div>

        {/* =====================================================
            SMALL FOOTER / SCHOOL RECORD NOTE
        ====================================================== */}

        <motion.div variants={RISE} className="flex items-center justify-center gap-2 py-2 text-[10px] text-slate-400 lg:shrink-0 lg:py-0">
          <School size={12} />
          <span>
            Student profile information is maintained by the school.
          </span>
<<<<<<< HEAD
        </motion.div>
=======
        </div>
        </div>
>>>>>>> 2a59b9a5 (added the remaining work)
      </div>
    </motion.div>
  );
};

export default ChildProfile;