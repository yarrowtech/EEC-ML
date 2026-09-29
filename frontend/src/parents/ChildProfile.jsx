import React from 'react';
import { Droplet, Phone, User, UserCircle } from 'lucide-react';
import ChildSwitcher from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

// Read-only student profile. Sensitive admin data (IDs, documents, caste,
// religion) is never sent by the API; changes go through the school office.
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-2.5 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="text-right text-sm font-semibold text-slate-800">{value || '—'}</span>
  </div>
);

const Contact = ({ title, person }) => (
  person?.name || person?.phone ? (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}{person.relation ? ` · ${person.relation}` : ''}</p>
      <p className="mt-1 font-semibold text-slate-800">{person.name || '—'}</p>
      {person.phone ? (
        <a href={`tel:${person.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-violet-700 hover:underline"><Phone size={13} /> {person.phone}</a>
      ) : null}
    </div>
  ) : null
);

const ChildProfile = () => {
  const { parent, options, childKey, setChildKey, selected: c, loading, error, reload } = useParentChildren();

  if (loading && !c) return <Loading />;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <PageHeader title="Child Profile" icon={UserCircle} subtitle="Your child's school record. Contact the school office to correct any detail.">
        <ChildSwitcher options={options} value={childKey} onChange={setChildKey} />
      </PageHeader>

      {error ? <ErrorState message={error} onRetry={reload} /> : !c ? (
        <EmptyState title="No child linked" hint="Ask the school to link your child to this account." icon={User} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            {c.photo ? (
              <img src={c.photo} alt={c.name} className="h-28 w-28 rounded-full object-cover ring-4 ring-violet-100" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-violet-100 text-3xl font-bold text-violet-700">
                {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </div>
            )}
            <h2 className="mt-3 text-xl font-bold text-slate-900">{c.name}</h2>
            <p className="text-sm text-slate-500">Class {c.grade || '—'}{c.section ? ` - ${c.section}` : ''}{c.roll !== '' ? ` · Roll ${c.roll}` : ''}</p>
            <span className={`mt-2 rounded-full px-3 py-0.5 text-xs font-semibold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
            {c.bloodGroup ? <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-rose-600"><Droplet size={14} /> Blood group {c.bloodGroup}</p> : null}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="mb-2 text-base font-bold text-slate-900">Student details</h3>
            <div className="grid gap-x-8 md:grid-cols-2">
              <div>
                <Row label="Student ID" value={c.studentCode} />
                <Row label="Admission No." value={c.admissionNumber} />
                <Row label="Admission date" value={c.admissionDate ? fmt(c.admissionDate) : ''} />
                <Row label="Academic session" value={c.academicYear} />
              </div>
              <div>
                <Row label="Class" value={c.grade} />
                <Row label="Section" value={c.section} />
                <Row label="Roll No." value={String(c.roll ?? '')} />
                <Row label="Date of birth" value={c.dob ? fmt(c.dob) : ''} />
                <Row label="Gender" value={c.gender} />
                {c.campusName ? <Row label="Campus" value={c.campusName} /> : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-3">
            <h3 className="mb-3 text-base font-bold text-slate-900">Parent &amp; emergency contacts</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Contact title="Father" person={c.father} />
              <Contact title="Mother" person={c.mother} />
              <Contact title="Guardian" person={c.guardian} />
              {parent ? <Contact title="Portal account" person={{ name: parent.name || parent.username, phone: parent.phone }} /> : null}
            </div>
            {c.address ? <p className="mt-3 text-sm text-slate-500"><span className="font-semibold text-slate-700">Address:</span> {c.address}</p> : null}
          </section>
        </div>
      )}
    </div>
  );
};

export default ChildProfile;
