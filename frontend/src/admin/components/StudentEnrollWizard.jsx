import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  GraduationCap,
  X,
  User,
  MapPin,
  Users,
  BookOpen,
  ImagePlus,
  ArrowRight,
  ArrowLeft,
  Save,
  Check,
  Info,
  Loader2,
  Phone,
  Lock,
  Search,
  Mail,
  UserCheck,
  History,
  Heart,
  Paperclip,
  Upload,
  FileText,
  Eye,
  Building2,
  ClipboardCheck,
  Pencil,
} from "lucide-react";

/* ─────────────────────────────  config  ───────────────────────────── */

const STEPS = [
  { key: "personal", label: "Student Personal Information", hint: "Basic personal details", icon: User },
  { key: "address", label: "Address Information", hint: "Present & permanent address", icon: MapPin },
  { key: "guardian", label: "Parent / Guardian Information", hint: "Family and guardian details", icon: Users },
  { key: "previous", label: "Previous Academic History", hint: "Earlier school & transfer details", icon: History },
  { key: "medical", label: "Medical Information", hint: "Health, allergies & immunization", icon: Heart },
  { key: "academic", label: "Admission & Academic Details", hint: "Class, admission & records", icon: BookOpen },
  { key: "documents", label: "Documents", hint: "Birth certificate, TC, Aadhaar & more", icon: Paperclip },
  { key: "office", label: "Office / Administration", hint: "Application record & approval", icon: Building2 },
  { key: "review", label: "Review & Submit", hint: "Verify everything before enrolling", icon: ClipboardCheck },
];

const NATIONALITY_OPTIONS = ["Indian", "Nepali", "Bhutanese", "Bangladeshi", "Sri Lankan", "Other"];
const RELIGION_OPTIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Parsi", "Other"];
const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS", "Other"];
const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/* ─────────────────────────────  small field primitives  ───────────────────────────── */

const inputBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function Label({ children, required }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-gray-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function TextField({ label, name, value, onChange, placeholder, required, type = "text", icon: Icon, error, ...rest }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}
        <input
          type={type}
          name={name}
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputBase} ${Icon ? "pl-9" : ""} ${error ? "border-red-400 ring-2 ring-red-100" : ""}`}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SelectField({ label, name, value, onChange, required, placeholder, options, error }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select
        name={name}
        value={value || ""}
        onChange={onChange}
        className={`${inputBase} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${
          error ? "border-red-400 ring-2 ring-red-100" : ""
        }`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((opt) => {
          const o = typeof opt === "string" ? { value: opt, label: opt } : opt;
          return (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          );
        })}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// A read-only field for values the backend fills in on save.
function AutoField({ label, hint }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          disabled
          value=""
          placeholder="Auto generated after save"
          className={`${inputBase} cursor-not-allowed bg-gray-50 pr-9 text-gray-500`}
        />
        <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/* ─────────────────────────────  photo upload box  ───────────────────────────── */

function PhotoUpload({ value, onFile, error }) {
  const inputRef = useRef(null);
  const isImage = typeof value === "string" && value.startsWith("data:");

  return (
    <div className="flex flex-col">
      <Label required>Student Photograph</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative flex flex-1 min-h-[190px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          error ? "border-red-300 bg-red-50/40" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        {isImage ? (
          <>
            <img src={value} alt="Student" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
              Change photo
            </span>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-gray-600">Upload Passport Size Photo</span>
            <span className="text-xs text-gray-400">JPG/PNG, Max 2MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─────────────────────────────  right rail  ───────────────────────────── */

function StepRail({ step, maxVisited, onJump }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold text-gray-900">Enrollment Steps</h3>
      <ol className="relative space-y-1">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          const reachable = i <= maxVisited;
          return (
            <li key={s.key} className="relative">
              {i < STEPS.length - 1 && (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px ${
                    i < step ? "bg-blue-300" : "bg-gray-200"
                  }`}
                />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onJump(i)}
                className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                  state === "active" ? "bg-blue-50" : reachable ? "hover:bg-gray-50" : "cursor-default"
                }`}
              >
                <span
                  className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    state === "done"
                      ? "bg-blue-600 text-white"
                      : state === "active"
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "border border-gray-300 bg-white text-gray-400"
                  }`}
                >
                  {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block text-sm font-semibold leading-tight ${
                      state === "active" ? "text-blue-700" : state === "done" ? "text-gray-800" : "text-gray-500"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className={`mt-0.5 block text-xs ${state === "done" ? "text-emerald-500" : "text-gray-400"}`}>
                    {state === "done" ? "Completed" : s.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HelpCard() {
  return (
    // <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
    //   <div className="flex items-start gap-3">
    //     <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
    //       <Headset className="h-4 w-4" />
    //     </span>
    //     <div>
    //       <p className="text-sm font-bold text-gray-900">Need Help?</p>
    //       <p className="mt-0.5 text-xs text-gray-500">Contact school support for assistance.</p>
    //       <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
    //         Contact Support <ArrowRight className="h-3.5 w-3.5" />
    //       </button>
    //     </div>
    //   </div>
    // </div>
    <></>
  );
}

/* ─────────────────────────────  step bodies  ───────────────────────────── */

function StepHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function PersonalStep({ data, onChange, onPhoto, errors }) {
  const handleMobile = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange({ target: { name: "mobile", value: digits } });
  };
  return (
    <>
      <StepHeader icon={User} title="Student Personal Information" subtitle="Provide basic personal details of the student." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <TextField label="Full Name" name="name" value={data.name} onChange={onChange} required placeholder="Enter full name of the student" icon={User} error={errors.name} />
        </div>
        <TextField label="Date of Birth" name="dob" type="date" value={data.dob} onChange={onChange} required error={errors.dob} />
        <SelectField label="Gender" name="gender" value={data.gender} onChange={onChange} required placeholder="Select Gender" options={GENDER_OPTIONS} error={errors.gender} />

        {/* Photo spans the two rows on the right */}
        <div className="row-span-2 sm:col-span-2 lg:col-span-1 lg:col-start-4 lg:row-start-1">
          <PhotoUpload value={data.photograph} onFile={onPhoto} error={errors.photograph} />
        </div>

        <TextField label="Mobile Number" name="mobile" type="tel" value={data.mobile} onChange={handleMobile} required placeholder="Enter 10-digit mobile number" icon={Phone} inputMode="numeric" maxLength={10} error={errors.mobile} />
        <div className="lg:col-span-2">
          <TextField label="Email Address" name="email" type="email" value={data.email} onChange={onChange} placeholder="Enter email address" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Birth Place" name="birthPlace" value={data.birthPlace} onChange={onChange} placeholder="Enter birth place" />
        <SelectField label="Nationality" name="nationality" value={data.nationality} onChange={onChange} placeholder="Select Nationality" options={NATIONALITY_OPTIONS} />
        <SelectField label="Religion" name="religion" value={data.religion} onChange={onChange} placeholder="Select Religion" options={RELIGION_OPTIONS} />
        {/* <TextField label="Caste" name="caste" value={data.caste} onChange={onChange} placeholder="Enter caste" /> */}      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Category" name="category" value={data.category} onChange={onChange} required placeholder="Select Category" options={CATEGORY_OPTIONS} error={errors.category} />
        <div className="lg:col-span-2">
          <TextField label="Aadhar Number" name="aadharNumber" value={data.aadharNumber} onChange={onChange} placeholder="Enter 12 digit Aadhar number" inputMode="numeric" maxLength={12} />
        </div>
      </div>
    </>
  );
}

function AddressStep({ data, onChange, errors = {} }) {
  const sameAsPresent = data.permanentAddress && data.permanentAddress === data.address;
  return (
    <>
      <StepHeader icon={MapPin} title="Address Information" subtitle="Where the student currently lives and their permanent home address." />

      <div className="space-y-5">
        <div>
          <Label required>Present Address</Label>
          <textarea
            name="address"
            rows={3}
            value={data.address || ""}
            onChange={onChange}
            placeholder="House / street, area, city, state"
            className={`${inputBase} resize-none ${errors.address ? "border-red-400 ring-2 ring-red-100" : ""}`}
          />
          {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={!!sameAsPresent}
            onChange={(e) =>
              onChange({ target: { name: "permanentAddress", value: e.target.checked ? data.address || "" : "" } })
            }
            className="h-4 w-4 rounded border-gray-300 accent-blue-600"
          />
          Permanent address is the same as present address
        </label>

        <div>
          <Label>Permanent Address</Label>
          <textarea
            name="permanentAddress"
            rows={3}
            value={data.permanentAddress || ""}
            onChange={onChange}
            placeholder="House / street, area, city, state"
            className={`${inputBase} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <TextField label="Pincode" name="pincode" value={data.pincode} onChange={onChange} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────  step 3 — parent / guardian  ───────────────────────────── */

const RELATION_OPTIONS = [
  "Father", "Mother", "Grandfather", "Grandmother", "Uncle", "Aunt",
  "Brother", "Sister", "Legal Guardian", "Other",
];
const digits10 = (v) => String(v || "").replace(/\D/g, "").slice(0, 10);

function SubHeading({ icon: Icon, children, note }) {
  return (
    <div className="mb-4 mt-2">
      <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <Icon className="h-4 w-4 text-blue-500" />
        {children}
      </p>
      {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    </div>
  );
}

function GuardianCard({ active, disabled, title, subtitle, badge, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        active
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
          : disabled
          ? "cursor-not-allowed border-dashed border-gray-200 opacity-50"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
        }`}
      >
        {active ? <Check className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-gray-800">{title}</span>
        <span className="block truncate text-xs text-gray-400">{subtitle}</span>
        {badge && (
          <span className="mt-1 inline-block rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

function GuardianStep({ data, onChange, errors = {}, parent }) {
  const setField = (name, value) => onChange({ target: { name, value } });
  const setMany = (obj) => Object.entries(obj).forEach(([k, v]) => setField(k, v));

  // Keep the guardian login in sync when Father/Mother is the chosen guardian
  // and their name/phone is edited afterwards.
  useEffect(() => {
    const src =
      data.guardianType === "father" ? { name: data.fatherName, phone: data.fatherPhone } :
      data.guardianType === "mother" ? { name: data.motherName, phone: data.motherPhone } : null;
    if (!src) return;
    const wantName = src.name || "";
    const wantPhone = digits10(src.phone);
    if ((data.guardianName || "") !== wantName) setField("guardianName", wantName);
    if ((data.guardianPhone || "") !== wantPhone) setField("guardianPhone", wantPhone);
  }, [data.guardianType, data.fatherName, data.fatherPhone, data.motherName, data.motherPhone, data.guardianName, data.guardianPhone]);

  const choices = [
    data.fatherName?.trim() && {
      key: "father", title: data.fatherName, subtitle: data.fatherPhone || "No phone added",
      relation: "Father", name: data.fatherName, phone: data.fatherPhone, email: "",
    },
    data.motherName?.trim() && {
      key: "mother", title: data.motherName, subtitle: data.motherPhone || "No phone added",
      relation: "Mother", name: data.motherName, phone: data.motherPhone, email: "",
    },
    parent.selected && {
      key: "existing", title: parent.selected.name || parent.selected.username || "Linked parent",
      subtitle: `${parent.selected.username || ""}${parent.selected.mobile ? ` · ${parent.selected.mobile}` : ""}`,
      badge: "Existing login", relation: data.guardianRelation || "",
      name: parent.selected.name || "", phone: parent.selected.mobile || "", email: parent.selected.email || "",
    },
  ].filter(Boolean);

  const pickGuardian = (choice) => {
    if (choice.key === "other") {
      setMany({ guardianType: "other", guardianName: "", guardianPhone: "", guardianEmail: "" });
      return;
    }
    setMany({
      guardianType: choice.key,
      guardianName: choice.name,
      guardianPhone: digits10(choice.phone),
      guardianEmail: choice.email || "",
      guardianRelation: choice.relation || data.guardianRelation || "",
    });
  };

  const isOther = data.guardianType === "other";

  return (
    <>
      <StepHeader icon={Users} title="Parent / Guardian Information" subtitle="Provide family and guardian details of the student." />

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <p className="text-xs text-blue-700">Search and link an existing parent / guardian if they are already registered in the system.</p>
      </div>

      {/* ── Existing parent search ── */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-800">Existing Parent / Guardian <span className="font-normal text-gray-400">(Optional)</span></p>
        <p className="mt-0.5 text-xs text-gray-400">Search and link an existing parent / guardian record to autofill details.</p>

        <div className="relative mt-3 flex flex-wrap items-start gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={parent.searchTerm}
              onChange={(e) => {
                parent.setSearchTerm(e.target.value);
                if (parent.selected && e.target.value !== (parent.selected.name || parent.selected.username)) parent.onClear();
              }}
              placeholder="Search existing parent by name, mobile number or email"
              className={`${inputBase} pl-9`}
            />
            {!parent.selected && parent.searchTerm.trim() && parent.matches.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {parent.matches.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => parent.onSelect(p)}
                    className="flex w-full flex-col border-b border-gray-100 px-4 py-2 text-left last:border-0 hover:bg-blue-50"
                  >
                    <span className="text-sm font-medium text-gray-800">{p.name || "Unnamed parent"}</span>
                    <span className="text-xs text-gray-400">{p.username || "-"}{p.mobile ? ` · ${p.mobile}` : ""}{p.email ? ` · ${p.email}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { parent.setSearchTerm(""); parent.onClear(); }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <X className="h-4 w-4" /> Clear Search
          </button>
        </div>

        {parent.selected && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <UserCheck className="h-4 w-4" />
            Linked: {parent.selected.name || "-"} ({parent.selected.username || "-"})
          </div>
        )}
      </div>

      {/* ── Guardian login details ── */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <SubHeading icon={Lock} note="These details will be used for guardian login to access student information.">Guardian / Login Details</SubHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Guardian Login Name</Label>
            <div className="relative">
              <input
                disabled
                value={data.guardianName || ""}
                placeholder="Auto generated after save"
                className={`${inputBase} cursor-not-allowed bg-gray-50 pr-9 text-gray-500`}
              />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
            </div>
          </div>
          <TextField
            label="Guardian Login Phone" required icon={Phone} inputMode="numeric" maxLength={10}
            name="guardianPhone" value={data.guardianPhone}
            onChange={(e) => setField("guardianPhone", digits10(e.target.value))}
            placeholder="Enter guardian mobile number" error={errors.guardianPhone}
          />
          <TextField
            label="Guardian Login Email" type="email" icon={Mail}
            name="guardianEmail" value={data.guardianEmail} onChange={onChange}
            placeholder="Enter guardian email address (optional)"
          />
        </div>
      </div>

      {/* ── Father ── */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <SubHeading icon={User}>Father&apos;s Details</SubHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Father's Name" required icon={User} name="fatherName" value={data.fatherName} onChange={onChange} placeholder="Enter father's full name" error={errors.fatherName} />
          <TextField label="Father's Phone" required icon={Phone} inputMode="numeric" maxLength={10} name="fatherPhone" value={data.fatherPhone} onChange={(e) => setField("fatherPhone", digits10(e.target.value))} placeholder="Enter father's mobile number" error={errors.fatherPhone} />
          <TextField label="Father's Occupation" name="fatherOccupation" value={data.fatherOccupation} onChange={onChange} placeholder="Enter father's occupation" />
        </div>
      </div>

      {/* ── Mother ── */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <SubHeading icon={User}>Mother&apos;s Details</SubHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Mother's Name" required icon={User} name="motherName" value={data.motherName} onChange={onChange} placeholder="Enter mother's full name" error={errors.motherName} />
          <TextField label="Mother's Phone" required icon={Phone} inputMode="numeric" maxLength={10} name="motherPhone" value={data.motherPhone} onChange={(e) => setField("motherPhone", digits10(e.target.value))} placeholder="Enter mother's mobile number" error={errors.motherPhone} />
          <TextField label="Mother's Occupation" name="motherOccupation" value={data.motherOccupation} onChange={onChange} placeholder="Enter mother's occupation" />
        </div>
      </div>

      {/* ── Guardian selection ── */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <SubHeading icon={UserCheck} note="Pick the contact who is the student's guardian — their details drive the parent login above.">
          Guardian Details
        </SubHeading>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {choices.map((c) => (
            <GuardianCard
              key={c.key}
              active={data.guardianType === c.key}
              title={c.title}
              subtitle={c.subtitle}
              badge={c.badge}
              onClick={() => pickGuardian(c)}
            />
          ))}
          <GuardianCard
            title="Someone else"
            subtitle="Enter guardian details manually"
            active={isOther}
            onClick={() => pickGuardian({ key: "other" })}
          />
        </div>
        {choices.length === 0 && !isOther && (
          <p className="mt-2 text-xs text-gray-400">Add a father or mother above, or choose “Someone else”.</p>
        )}
        {errors.guardianType && <p className="mt-2 text-xs text-red-500">{errors.guardianType}</p>}

        {isOther && (
          <div className="mt-4 grid grid-cols-1 gap-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:grid-cols-3">
            <TextField label="Guardian Name" required icon={User} name="guardianName" value={data.guardianName} onChange={onChange} placeholder="Enter guardian's full name" error={errors.guardianName} />
            <TextField label="Guardian Phone" required icon={Phone} inputMode="numeric" maxLength={10} name="guardianPhone" value={data.guardianPhone} onChange={(e) => setField("guardianPhone", digits10(e.target.value))} placeholder="Enter guardian's mobile number" />
            <TextField label="Guardian Email" type="email" icon={Mail} name="guardianEmail" value={data.guardianEmail} onChange={onChange} placeholder="Enter guardian's email (optional)" />
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Relationship with Student" required name="guardianRelation"
            value={data.guardianRelation} onChange={onChange}
            placeholder="Select Relationship" options={RELATION_OPTIONS} error={errors.guardianRelation}
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────  step 4 — previous academic history  ───────────────────────────── */

function PreviousSchoolStep({ data, onChange, errors = {} }) {
  const attended = data.hasPreviousSchool; // "" | "yes" | "no"
  const set = (name, value) => onChange({ target: { name, value } });

  const chooseAttended = (val) => {
    set("hasPreviousSchool", val);
    if (val === "no") {
      // clear anything already entered so nothing stale is saved
      ["previousSchoolName", "previousClass", "transferCertificateNo", "transferCertificateDate", "previousPercentage", "reasonForLeaving"]
        .forEach((k) => set(k, ""));
    }
  };

  return (
    <>
      <StepHeader icon={History} title="Previous Academic History" subtitle="Details of the school the student attended before joining." />

      <div className="mb-6">
        <Label required>Has the student attended a previous school?</Label>
        <div className="mt-1 flex gap-2.5">
          {[{ v: "yes", t: "Yes" }, { v: "no", t: "No, this is the first school" }].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => chooseAttended(o.v)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                attended === o.v
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
        {errors.hasPreviousSchool && <p className="mt-1 text-xs text-red-500">{errors.hasPreviousSchool}</p>}
      </div>

      {attended === "yes" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField label="Previous School Name" required name="previousSchoolName" value={data.previousSchoolName} onChange={onChange} placeholder="Name of the previous school" error={errors.previousSchoolName} />
            <TextField label="Class Last Attended" required name="previousClass" value={data.previousClass} onChange={onChange} placeholder="e.g. Class 5" error={errors.previousClass} />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField label="Transfer Certificate No." name="transferCertificateNo" value={data.transferCertificateNo} onChange={onChange} placeholder="TC number" />
            <TextField label="TC Date" type="date" name="transferCertificateDate" value={data.transferCertificateDate} onChange={onChange} />
            <TextField label="Percentage / Grade Obtained" name="previousPercentage" value={data.previousPercentage} onChange={onChange} placeholder="e.g. 82% or A" />
          </div>
          <div>
            <Label>Reason for Leaving</Label>
            <textarea
              name="reasonForLeaving"
              rows={2}
              value={data.reasonForLeaving || ""}
              onChange={onChange}
              placeholder="Why the student left the previous school (optional)"
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>
      )}

      {attended === "no" && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          <Info className="h-4 w-4 shrink-0 text-gray-400" />
          No previous-school details needed. Continue to the next step.
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────  step 5 — medical information  ───────────────────────────── */

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
const IMMUNIZATION_OPTIONS = ["Up to date", "Partially immunized", "Not immunized", "Not sure"];

function MedicalStep({ data, onChange, errors = {} }) {
  return (
    <>
      <StepHeader icon={Heart} title="Medical Information" subtitle="Health details the school should be aware of." />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Blood Group" name="bloodGroup" value={data.bloodGroup} onChange={onChange} placeholder="Select Blood Group" options={BLOOD_GROUP_OPTIONS} />
          <SelectField label="Immunization Status" name="immunizationStatus" value={data.immunizationStatus} onChange={onChange} placeholder="Select Status" options={IMMUNIZATION_OPTIONS} />
        </div>

        <div>
          <Label required>Allergies</Label>
          <textarea
            name="allergies"
            rows={2}
            value={data.allergies || ""}
            onChange={onChange}
            placeholder="List any allergies (food, medicine, etc.). Type “None” if not applicable."
            className={`${inputBase} resize-none ${errors.allergies ? "border-red-400 ring-2 ring-red-100" : ""}`}
          />
          {errors.allergies && <p className="mt-1 text-xs text-red-500">{errors.allergies}</p>}
        </div>

        <div>
          <Label>Known Health Issues</Label>
          <textarea
            name="knownHealthIssues"
            rows={2}
            value={data.knownHealthIssues || ""}
            onChange={onChange}
            placeholder="Any chronic conditions, medication or care the school should know about"
            className={`${inputBase} resize-none`}
          />
        </div>

        <div>
          <Label>Learning Disabilities</Label>
          <textarea
            name="learningDisabilities"
            rows={2}
            value={data.learningDisabilities || ""}
            onChange={onChange}
            placeholder="Any learning difficulties or special support needs (if applicable)"
            className={`${inputBase} resize-none`}
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────  step 6 — admission & academic  ───────────────────────────── */

const ADMISSION_TYPE_OPTIONS = ["New Admission", "Transfer", "Re-Admission"];
const STUDENT_STATUS_OPTIONS = ["Active", "Inactive", "Alumni", "Dropped"];

function AdmissionStep({ data, onChange, errors = {}, academic, onJumpToStep }) {
  const set = (name, value) => onChange({ target: { name, value } });

  // Sessions: only the active academic year(s).
  const activeYears = academic.years.filter((y) => y.isActive);
  // Classes: only those that belong to the selected (active) session.
  const classesForYear = academic.classes.filter(
    (c) => !academic.yearId || String(c.academicYearId || "") === String(academic.yearId)
  );
  const classOpts = classesForYear.map((c) => ({ value: String(c._id), label: c.name }));
  const sectionOpts = academic.sections
    .filter((s) => String(s.classId) === String(academic.classId))
    .map((s) => ({ value: String(s._id), label: s.name }));

  // Auto-pick the active session when there's exactly one and none chosen yet.
  useEffect(() => {
    if (!data.academicYear && activeYears.length === 1) {
      set("academicYear", activeYears[0].name);
      academic.setYearId(activeYears[0]._id || "");
    }
  }, [activeYears.length, data.academicYear]); // eslint-disable-line

  const onYear = (e) => {
    const name = e.target.value;
    const y = activeYears.find((it) => it.name === name);
    set("academicYear", name);
    academic.setYearId(y?._id || "");
    // reset class/section — they are scoped to the session
    academic.setClassId("");
    academic.setSectionId("");
    set("class", "");
    set("section", "");
  };
  const onClassChange = (e) => {
    const id = e.target.value;
    const c = classesForYear.find((it) => String(it._id) === id);
    academic.setClassId(id);
    academic.setSectionId("");
    set("class", c?.name || "");
    set("section", "");
  };
  const onSectionChange = (e) => {
    const id = e.target.value;
    const s = academic.sections.find((it) => String(it._id) === id);
    academic.setSectionId(id);
    set("section", s?.name || "");
  };

  const recommendedType = data.hasPreviousSchool === "yes" ? "Transfer" : "New Admission";
  const isTransfer = data.admissionType === "Transfer";
  const hasTransferInfo = data.hasPreviousSchool === "yes" && (data.previousSchoolName || "").trim();

  return (
    <>
      <StepHeader icon={BookOpen} title="Admission & Academic Details" subtitle="Where the student is being admitted and their record numbers." />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Date of Admission" type="date" required name="admissionDate" value={data.admissionDate} onChange={onChange} error={errors.admissionDate} />
          <SelectField label="Academic Session" required name="academicYear" value={data.academicYear} onChange={onYear}
            placeholder={activeYears.length ? "Select Session" : "No active session"}
            options={activeYears.map((y) => ({ value: y.name, label: y.name }))} error={errors.academicYear} />
          <SelectField label="Class" required name="class" value={academic.classId} onChange={onClassChange}
            placeholder={academic.yearId ? "Select Class" : "Select a session first"} options={classOpts} error={errors.class} />
          <SelectField label="Section" required name="section" value={academic.sectionId} onChange={onSectionChange}
            placeholder={academic.classId ? "Select Section" : "Select a class first"} options={sectionOpts} error={errors.section} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AutoField label="Admission Number" />
          <AutoField label="Roll Number" hint="Continues the class roll sequence across sections" />
          <TextField label="Serial Number" name="serialNo" inputMode="numeric" value={data.serialNo} onChange={onChange} placeholder="Register serial no. (optional)" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <SelectField label="Admission Type" name="admissionType" value={data.admissionType} onChange={onChange} placeholder="Select Admission Type" options={ADMISSION_TYPE_OPTIONS} />
            {data.admissionType !== recommendedType && (
              <button type="button" onClick={() => set("admissionType", recommendedType)} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                Recommended: {recommendedType} — apply
              </button>
            )}
          </div>
          <SelectField label="Status" name="status" value={data.status || "Active"} onChange={onChange} options={STUDENT_STATUS_OPTIONS} />
        </div>

        {isTransfer && (hasTransferInfo ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-800">
              <History className="h-4 w-4" /> Transferred from
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
              <div><dt className="inline text-gray-400">School: </dt><dd className="inline font-medium text-gray-700">{data.previousSchoolName}</dd></div>
              <div><dt className="inline text-gray-400">Class last attended: </dt><dd className="inline font-medium text-gray-700">{data.previousClass || "—"}</dd></div>
              <div><dt className="inline text-gray-400">TC No.: </dt><dd className="inline font-medium text-gray-700">{data.transferCertificateNo || "—"}</dd></div>
              <div><dt className="inline text-gray-400">TC Date: </dt><dd className="inline font-medium text-gray-700">{data.transferCertificateDate || "—"}</dd></div>
            </dl>
            <button type="button" onClick={() => onJumpToStep(3)} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">Edit transfer details</button>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Marked as a <strong>Transfer</strong> but no previous-school details were entered.{" "}
              <button type="button" onClick={() => onJumpToStep(3)} className="font-semibold underline">Add them in “Previous Academic History”.</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────────  step 7 — documents  ───────────────────────────── */

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

const isImageSrc = (src = "") =>
  /^data:image\//i.test(src) || /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(src) || /\/image\/upload\//i.test(src);

const isPdfSrc = (src = "") =>
  /^data:application\/pdf/i.test(src) || /\.pdf(\?|$)/i.test(src) || /\/raw\/upload\//i.test(src);

export function DocPreviewModal({ open, src, label, onClose }) {
  const image = isImageSrc(src || "");
  const pdf = !image && isPdfSrc(src || "");
  const [state, setState] = useState({ status: "idle", url: "" }); // idle | loading | ready | error

  useEffect(() => {
    if (!open) {
      setState({ status: "idle", url: "" });
      return undefined;
    }
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // For PDFs, fetch the file and show it via a blob URL — a blob URL has no
  // Content-Disposition, so the browser's native viewer renders it inline every
  // time (fixes "downloads on the 2nd open").
  useEffect(() => {
    if (!open || !src || !pdf) return undefined;
    let revoked = false;
    let objectUrl = "";
    setState({ status: "loading", url: "" });
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
        setState({ status: "ready", url: objectUrl });
      })
      .catch(() => !revoked && setState({ status: "error", url: "" }));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, src, pdf]);

  if (!open || !src) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="truncate text-sm font-semibold text-gray-800">{label || "Preview"}</p>
          <div className="flex items-center gap-1">
            <a href={src} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
              Open in new tab
            </a>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100 p-3">
          {image ? (
            <img src={src} alt={label || "document"} className="mx-auto max-h-[78vh] w-auto rounded-lg bg-white" />
          ) : pdf && state.status === "ready" ? (
            <iframe title={label || "document"} src={`${state.url}#toolbar=0&navpanes=0`} className="h-[78vh] w-full rounded-lg border border-gray-200 bg-white" />
          ) : pdf && state.status === "loading" ? (
            <div className="flex h-[78vh] items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
            </div>
          ) : (
            <div className="flex h-[78vh] flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <FileText className="h-8 w-8 text-gray-300" />
              {pdf ? "Could not load the preview." : "This file type can’t be previewed here."}
              <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-blue-600">Open in a new tab</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({ label, required, hint, status, uploading, progress, error, fileName, previewSrc, onPick, onRemove, onPreview }) {
  const inputRef = useRef(null);
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {label}{required && <span className="ml-0.5 text-red-500">*</span>}
            </p>
            <p className="truncate text-xs text-gray-400">{fileName || hint || "PDF / JPG / PNG · max 5 MB"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "done" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Uploaded
            </span>
          ) : uploading ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading {progress != null ? `${progress}%` : "…"}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Not uploaded</span>
          )}

          {previewSrc && onPreview && (
            <button type="button" onClick={onPreview} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Preview">
              <Eye className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {status === "done" ? "Replace" : "Upload"}
          </button>
          {status === "done" && onRemove && (
            <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {uploading && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
            style={{ width: `${progress ?? 8}%` }}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function DocumentsStep({ data, onChange, errors = {}, onUploadFile, onPhoto }) {
  const [busy, setBusy] = useState({});
  const [progress, setProgress] = useState({});
  const [rowError, setRowError] = useState({});
  const [preview, setPreview] = useState(null); // { src, label }
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const byType = (t) => docs.find((d) => d.type === t);
  const setDocs = (next) => onChange({ target: { name: "documents", value: next } });

  const isTransfer = data.admissionType === "Transfer" || data.hasPreviousSchool === "yes";

  const upload = async (key, label, file, { type, append = false } = {}) => {
    setRowError((p) => ({ ...p, [key]: "" }));
    if (file.size > MAX_DOC_BYTES) {
      toast.error(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`);
      return;
    }
    setBusy((p) => ({ ...p, [key]: true }));
    setProgress((p) => ({ ...p, [key]: 0 }));
    try {
      const url = await onUploadFile(file, (pct) => setProgress((p) => ({ ...p, [key]: pct })));
      const entry = { type: type || key, label: label || file.name, url, fileName: file.name };
      setDocs(append ? [...docs, entry] : [...docs.filter((d) => d.type !== entry.type), entry]);
      toast.success(`${label || file.name} uploaded.`);
    } catch (e) {
      setRowError((p) => ({ ...p, [key]: e?.message || "Upload failed. Try again." }));
      toast.error(e?.message || "Upload failed. Try again.");
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
      setProgress((p) => ({ ...p, [key]: undefined }));
    }
  };

  const removeType = (type) => setDocs(docs.filter((d) => d.type !== type));
  const removeAt = (idx) => setDocs(docs.filter((_, i) => i !== idx));

  const otherDocs = docs.filter((d) => d.type === "other");

  const slots = [
    { type: "birth_certificate", label: "Birth Certificate", required: true },
    ...(isTransfer
      ? [{ type: "transfer_certificate", label: "Transfer Certificate", required: true, hint: "Required — this is a transfer admission" }]
      : []),
    { type: "aadhar_card", label: "Aadhar Card", required: true },
  ];

  const photoSrc = typeof data.photograph === "string" && data.photograph ? data.photograph : null;

  return (
    <>
      <StepHeader icon={Paperclip} title="Documents" subtitle="Upload the student's enrolment documents." />

      <div className="space-y-3">
        {slots.map((s) => {
          const doc = byType(s.type);
          return (
            <DocRow
              key={s.type}
              label={s.label}
              required={s.required}
              hint={s.hint}
              status={doc ? "done" : "todo"}
              uploading={!!busy[s.type]}
              progress={progress[s.type]}
              error={rowError[s.type] || errors[s.type]}
              fileName={doc?.fileName}
              previewSrc={doc?.url}
              onPick={(f) => upload(s.type, s.label, f)}
              onRemove={() => removeType(s.type)}
              onPreview={() => setPreview({ src: doc.url, label: s.label })}
            />
          );
        })}

        {/* Student Photograph — captured in Step 1 */}
        <DocRow
          label="Student Photograph"
          required
          hint="Captured in Step 1 — Student Personal Information"
          status={photoSrc ? "done" : "todo"}
          uploading={!!busy.photograph}
          error={errors.photograph}
          previewSrc={photoSrc}
          onPick={(f) => {
            if (f.size > MAX_DOC_BYTES) {
              toast.error(`Image is over the 5 MB limit.`);
              return;
            }
            setBusy((p) => ({ ...p, photograph: true }));
            Promise.resolve(onPhoto?.(f)).finally(() => setBusy((p) => ({ ...p, photograph: false })));
          }}
          onPreview={() => setPreview({ src: photoSrc, label: "Student Photograph" })}
        />

        {/* Other documents */}
        {otherDocs.map((d) => {
          const idx = docs.indexOf(d);
          return (
            <DocRow
              key={`other-${idx}`}
              label={d.label || "Other Document"}
              status="done"
              fileName={d.fileName}
              previewSrc={d.url}
              onPick={(f) => upload(`other-${idx}`, f.name, f, { type: "other" })}
              onRemove={() => removeAt(idx)}
              onPreview={() => setPreview({ src: d.url, label: d.label || "Other Document" })}
            />
          );
        })}

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 transition hover:border-blue-400 hover:bg-blue-50/40">
          {busy.other_new ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Add another document
          <input
            type="file"
            accept={DOC_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload("other_new", f.name, f, { type: "other", append: true });
            }}
          />
        </label>
        {rowError.other_new && <p className="text-xs text-red-500">{rowError.other_new}</p>}
      </div>

      <DocPreviewModal open={!!preview} src={preview?.src} label={preview?.label} onClose={() => setPreview(null)} />
    </>
  );
}

/* ─────────────────────────────  step 8 — office / administration  ───────────────────────────── */

const APPROVAL_STATUS_OPTIONS = ["Pending", "Under Review", "Approved", "Rejected"];

function OfficeStep({ data, onChange }) {
  return (
    <>
      <StepHeader icon={Building2} title="Office / Administration Information" subtitle="Internal application record and approval status." />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AutoField label="Application ID" />
          <AutoField label="Application Date" />
          <SelectField
            label="Approval Status"
            name="approvalStatus"
            value={data.approvalStatus || "Approved"}
            onChange={onChange}
            options={APPROVAL_STATUS_OPTIONS}
          />
        </div>

        <div>
          <Label>Remarks</Label>
          <textarea
            name="remarks"
            rows={3}
            value={data.remarks || ""}
            onChange={onChange}
            placeholder="Any internal notes about this enrolment (optional)"
            className={`${inputBase} resize-none`}
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────  step 9 — review & submit  ───────────────────────────── */

const RV_DASH = "—";
const rv = (v) => {
  if (v === 0) return "0";
  const s = String(v ?? "").trim();
  return s || RV_DASH;
};
const rvGender = (g) => ({ male: "Male", female: "Female", other: "Other" }[String(g || "").toLowerCase()] || RV_DASH);

function RVSection({ icon: Icon, title, onEdit, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function RVField({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 break-words text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

const RVGrid = ({ children, cols = 3 }) => (
  <div className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>{children}</div>
);

const StatusPill = ({ ok, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
    {ok && <Check className="h-3 w-3" />} {children}
  </span>
);

function ReviewStep({ data, onJumpToStep }) {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const doc = (t) => docs.find((d) => d.type === t);
  const isTransfer = data.admissionType === "Transfer" || data.hasPreviousSchool === "yes";

  const docRows = [
    { label: "Birth Certificate", no: data.birthCertificateNo, d: doc("birth_certificate") },
    { label: "Aadhar Card", no: data.aadharNumber, d: doc("aadhar_card") },
    ...(isTransfer ? [{ label: "Transfer Certificate", no: data.transferCertificateNo, d: doc("transfer_certificate") }] : []),
    { label: "Student Photograph", no: "", d: data.photograph ? { fileName: "student photo", url: data.photograph } : null },
    ...docs.filter((d) => d.type === "other").map((d) => ({ label: d.label || "Other Document", no: "", d })),
  ];

  return (
    <>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Review Student Information</h2>
        <p className="mt-0.5 text-sm text-gray-500">Please verify all the details carefully before submitting.</p>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <p className="text-xs text-blue-700">If you need to change anything, use the “Edit” button on that section.</p>
      </div>

      <div className="space-y-4">
        {/* Personal */}
        <RVSection icon={User} title="Student Personal Information" onEdit={() => onJumpToStep(0)}>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="shrink-0">
              {data.photograph ? (
                <img src={data.photograph} alt="Student" className="h-24 w-24 rounded-full border border-gray-200 object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <RVGrid>
                <RVField label="Full Name" value={rv(data.name)} />
                <RVField label="Date of Birth" value={rv(data.dob)} />
                <RVField label="Birth Place" value={rv(data.birthPlace)} />
                <RVField label="Mobile Number" value={rv(data.mobile)} />
                <RVField label="Email Address" value={rv(data.email)} />
                <RVField label="Gender" value={rvGender(data.gender)} />
                <RVField label="Nationality" value={rv(data.nationality)} />
                <RVField label="Religion" value={rv(data.religion)} />
                <RVField label="Category" value={rv(data.category)} />
                {/* <RVField label="Caste" value={rv(data.caste)} /> */}
                <RVField label="Aadhar Number" value={rv(data.aadharNumber)} />
                <RVField label="Student Photograph" value={<StatusPill ok={!!data.photograph}>{data.photograph ? "Uploaded" : "Missing"}</StatusPill>} />
              </RVGrid>
            </div>
          </div>
        </RVSection>

        {/* Address */}
        <RVSection icon={MapPin} title="Address Information" onEdit={() => onJumpToStep(1)}>
          <RVGrid>
            <RVField label="Present Address" value={rv(data.address)} />
            <RVField label="Permanent Address" value={rv(data.permanentAddress)} />
            <RVField label="Pincode" value={rv(data.pincode)} />
          </RVGrid>
        </RVSection>

        {/* Guardian */}
        <RVSection icon={Users} title="Parent / Guardian Information" onEdit={() => onJumpToStep(2)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Father</p>
              <div className="space-y-3">
                <RVField label="Name" value={rv(data.fatherName)} />
                <RVField label="Phone" value={rv(data.fatherPhone)} />
                <RVField label="Occupation" value={rv(data.fatherOccupation)} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Mother</p>
              <div className="space-y-3">
                <RVField label="Name" value={rv(data.motherName)} />
                <RVField label="Phone" value={rv(data.motherPhone)} />
                <RVField label="Occupation" value={rv(data.motherOccupation)} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Guardian (login)</p>
              <div className="space-y-3">
                <RVField label="Name" value={rv(data.guardianName)} />
                <RVField label="Phone" value={rv(data.guardianPhone)} />
                <RVField label="Email" value={rv(data.guardianEmail)} />
                <RVField label="Relationship with Student" value={rv(data.guardianRelation)} />
              </div>
            </div>
          </div>
        </RVSection>

        {/* Previous academic */}
        <RVSection icon={History} title="Previous Academic Information" onEdit={() => onJumpToStep(3)}>
          {data.hasPreviousSchool === "yes" ? (
            <RVGrid>
              <RVField label="Previous School Name" value={rv(data.previousSchoolName)} />
              <RVField label="Class Last Attended" value={rv(data.previousClass)} />
              <RVField label="Percentage / Grade Obtained" value={rv(data.previousPercentage)} />
              <RVField label="Transfer Certificate No." value={rv(data.transferCertificateNo)} />
              <RVField label="TC Date" value={rv(data.transferCertificateDate)} />
              <RVField label="Reason for Leaving" value={rv(data.reasonForLeaving)} />
            </RVGrid>
          ) : (
            <p className="text-sm text-gray-500">No previous school — this is the student’s first school.</p>
          )}
        </RVSection>

        {/* Medical */}
        <RVSection icon={Heart} title="Medical Information" onEdit={() => onJumpToStep(4)}>
          <RVGrid>
            <RVField label="Blood Group" value={rv(data.bloodGroup)} />
            <RVField label="Immunization Status" value={rv(data.immunizationStatus)} />
            <RVField label="Allergies" value={rv(data.allergies)} />
            <RVField label="Known Health Issues" value={rv(data.knownHealthIssues)} />
            <RVField label="Learning Disabilities" value={rv(data.learningDisabilities)} />
          </RVGrid>
        </RVSection>

        {/* Documents */}
        <RVSection icon={Paperclip} title="Documents Information" onEdit={() => onJumpToStep(6)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Document Name</th>
                  <th className="pb-2 pr-4 font-medium">Document No.</th>
                  <th className="pb-2 pr-4 font-medium">File Name</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docRows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{r.label}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{rv(r.no)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{r.d?.fileName || RV_DASH}</td>
                    <td className="py-2.5"><StatusPill ok={!!r.d?.url}>{r.d?.url ? "Uploaded" : "Not uploaded"}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RVSection>

        {/* Admission */}
        <RVSection icon={BookOpen} title="Admission & Academic Details" onEdit={() => onJumpToStep(5)}>
          <RVGrid>
            <RVField label="Date of Admission" value={rv(data.admissionDate)} />
            <RVField label="Academic Session" value={rv(data.academicYear)} />
            <RVField label="Class" value={rv(data.class)} />
            <RVField label="Section" value={rv(data.section)} />
            <RVField label="Admission Number" value={<span className="text-gray-400">Auto-generated on submit</span>} />
            <RVField label="Roll Number" value={<span className="text-gray-400">Auto-generated on submit</span>} />
            <RVField label="Serial Number" value={rv(data.serialNo)} />
            <RVField label="Admission Type" value={rv(data.admissionType)} />
            <RVField label="Status" value={<StatusPill ok={(data.status || "Active") === "Active"}>{data.status || "Active"}</StatusPill>} />
          </RVGrid>
        </RVSection>

        {/* Office */}
        <RVSection icon={Building2} title="Office / Administration" onEdit={() => onJumpToStep(7)}>
          <RVGrid>
            <RVField label="Application ID" value={<span className="text-gray-400">Auto-generated on submit</span>} />
            <RVField label="Application Date" value={<span className="text-gray-400">Auto-generated on submit</span>} />
            <RVField label="Approval Status" value={<StatusPill ok={(data.approvalStatus || "Approved") === "Approved"}>{data.approvalStatus || "Approved"}</StatusPill>} />
            <RVField label="Remarks" value={rv(data.remarks)} />
          </RVGrid>
        </RVSection>

      </div>
    </>
  );
}

/* ─────────────────────────────  main wizard  ───────────────────────────── */

export default function StudentEnrollWizard({
  newStudent,
  handleAddStudentChange,
  enrollContext,
  onClose,
  onSubmit,
  isSubmitting,
  parentSearchTerm,
  setParentSearchTerm,
  matchedParents,
  handleSelectExistingParent,
  selectedExistingParent,
  academicYears,
  academicClasses,
  academicSections,
  selectedAcademicYearId,
  setSelectedAcademicYearId,
  selectedClassId,
  setSelectedClassId,
  selectedSectionId,
  setSelectedSectionId,
  initialStep = 0,
  onSaveDraft,
  onUploadFile,
}) {
  const [step, setStep] = useState(initialStep);
  const [maxVisited, setMaxVisited] = useState(initialStep);
  const [errors, setErrors] = useState({});
  const [photoError, setPhotoError] = useState("");
  const [draftState, setDraftState] = useState("idle"); // idle | saving | saved | error
  const [autoSavedAt, setAutoSavedAt] = useState(null);
  const scrollRef = useRef(null);
  const autoTimer = useRef(null);
  const lastSnapshot = useRef("");

  // Lock the page behind the wizard so only the form panel scrolls.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const isLast = step === STEPS.length - 1;

  const goTo = (i) => {
    setStep(i);
    setMaxVisited((m) => Math.max(m, i));
    setErrors({});
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePhoto = (file) => {
    setPhotoError("");
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Image must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleAddStudentChange({ target: { name: "photograph", value: String(reader.result) } });
    reader.readAsDataURL(file);
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!newStudent.name?.trim()) e.name = "Full name is required.";
      if (!newStudent.dob) e.dob = "Date of birth is required.";
      if (!newStudent.gender) e.gender = "Select a gender.";
      if (!newStudent.mobile?.trim()) e.mobile = "Mobile number is required.";
      else if (!/^\d{10}$/.test(newStudent.mobile.trim())) e.mobile = "Enter a valid 10-digit mobile number.";
      if (!newStudent.category) e.category = "Select a category.";
      if (!newStudent.photograph) e.photograph = "Upload a passport-size photo.";
    }
    if (step === 1) {
      if (!newStudent.address?.trim()) e.address = "Present address is required.";
    }
    if (step === 2) {
      const phone10 = (v) => /^\d{10}$/.test(String(v || "").trim());
      if (!newStudent.fatherName?.trim()) e.fatherName = "Father's name is required.";
      if (!newStudent.fatherPhone?.trim()) e.fatherPhone = "Father's phone is required.";
      else if (!phone10(newStudent.fatherPhone)) e.fatherPhone = "Enter a valid 10-digit number.";
      if (!newStudent.motherName?.trim()) e.motherName = "Mother's name is required.";
      if (!newStudent.motherPhone?.trim()) e.motherPhone = "Mother's phone is required.";
      else if (!phone10(newStudent.motherPhone)) e.motherPhone = "Enter a valid 10-digit number.";
      if (!newStudent.guardianType) e.guardianType = "Select who the guardian is.";
      if (newStudent.guardianType === "other" && !newStudent.guardianName?.trim()) e.guardianName = "Guardian name is required.";
      if (!newStudent.guardianPhone?.trim()) e.guardianPhone = "Guardian phone is required.";
      else if (!phone10(newStudent.guardianPhone)) e.guardianPhone = "Enter a valid 10-digit number.";
      if (!newStudent.guardianRelation) e.guardianRelation = "Select the relationship.";
    }
    if (step === 3) {
      if (!newStudent.hasPreviousSchool) e.hasPreviousSchool = "Please choose an option.";
      else if (newStudent.hasPreviousSchool === "yes") {
        if (!newStudent.previousSchoolName?.trim()) e.previousSchoolName = "Previous school name is required.";
        if (!newStudent.previousClass?.trim()) e.previousClass = "Class last attended is required.";
      }
    }
    if (step === 4) {
      if (!newStudent.allergies?.trim()) e.allergies = "Enter allergies, or type “None”.";
    }
    if (step === 5) {
      if (!newStudent.admissionDate) e.admissionDate = "Date of admission is required.";
      if (!newStudent.academicYear) e.academicYear = "Select an academic session.";
      if (!newStudent.class?.trim()) e.class = "Select a class.";
      if (!newStudent.section?.trim()) e.section = "Select a section.";
    }
    if (step === 6) {
      const docs = Array.isArray(newStudent.documents) ? newStudent.documents : [];
      const has = (t) => docs.some((d) => d.type === t && d.url);
      if (!has("birth_certificate")) e.birth_certificate = "Upload the birth certificate.";
      if (!has("aadhar_card")) e.aadhar_card = "Aadhaar card is required.";
      const isTransfer = newStudent.admissionType === "Transfer" || newStudent.hasPreviousSchool === "yes";
      if (isTransfer && !has("transfer_certificate")) e.transfer_certificate = "Transfer Certificate is required for a transfer admission.";
      if (!newStudent.photograph) e.photograph = "Student photograph is missing — add it in Step 1.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep()) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (isLast) {
      onSubmit({ preventDefault: () => {} });
      return;
    }
    goTo(step + 1);
  };

  const persistDraft = async ({ silent }) => {
    if (!onSaveDraft) return;
    if (silent) {
      try {
        await onSaveDraft({ step, silent: true });
        setAutoSavedAt(Date.now());
      } catch {
        /* keep trying on next change */
      }
      return;
    }
    if (draftState === "saving") return;
    setDraftState("saving");
    try {
      await onSaveDraft({ step });
      setAutoSavedAt(Date.now());
      setDraftState("saved");
      setTimeout(() => setDraftState("idle"), 2500);
    } catch {
      setDraftState("error");
      setTimeout(() => setDraftState("idle"), 3000);
    }
  };

  const saveDraft = () => persistDraft({ silent: false });

  // Always-current view of the form + handler, for the unmount flush below.
  const latest = useRef({ newStudent, step, onSaveDraft });
  latest.current = { newStudent, step, onSaveDraft };

  // Auto-save: debounce edits, once there's something worth keeping.
  useEffect(() => {
    const hasContent = (newStudent.name || "").trim().length > 1;
    const snapshot = JSON.stringify({ newStudent, step });
    if (!hasContent || snapshot === lastSnapshot.current) return undefined;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      lastSnapshot.current = snapshot;
      persistDraft({ silent: true });
    }, 2500);
    return () => autoTimer.current && clearTimeout(autoTimer.current);
  }, [newStudent, step]);

  // Flush a pending auto-save when the wizard unmounts (Close / navigate away).
  useEffect(() => () => {
    const { newStudent: ns, step: st, onSaveDraft: save } = latest.current;
    const hasContent = (ns.name || "").trim().length > 1;
    if (hasContent && JSON.stringify({ newStudent: ns, step: st }) !== lastSnapshot.current) {
      save?.({ step: st, silent: true });
    }
  }, []);


  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Enroll New Student</h1>
            <p className="text-xs text-gray-500">
              {enrollContext?.schoolName
                ? `${enrollContext.schoolName}${enrollContext.campusType ? ` · ${enrollContext.campusType}` : ""} — complete all steps to register`
                : "Complete all steps to register a new student"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <X className="h-4 w-4" /> Close
        </button>
      </header>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-5 p-5 lg:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* form card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
            {step === 0 && (
              <PersonalStep data={newStudent} onChange={handleAddStudentChange} onPhoto={handlePhoto} errors={{ ...errors, photograph: errors.photograph || photoError }} />
            )}
            {step === 1 && <AddressStep data={newStudent} onChange={handleAddStudentChange} errors={errors} />}
            {step === 2 && (
              <GuardianStep
                data={newStudent}
                onChange={handleAddStudentChange}
                errors={errors}
                parent={{
                  searchTerm: parentSearchTerm,
                  setSearchTerm: setParentSearchTerm,
                  matches: matchedParents,
                  selected: selectedExistingParent,
                  onSelect: handleSelectExistingParent,
                  onClear: () => handleSelectExistingParent(null),
                }}
              />
            )}
            {step === 3 && <PreviousSchoolStep data={newStudent} onChange={handleAddStudentChange} errors={errors} />}
            {step === 4 && <MedicalStep data={newStudent} onChange={handleAddStudentChange} errors={errors} />}
            {step === 5 && (
              <AdmissionStep
                data={newStudent}
                onChange={handleAddStudentChange}
                errors={errors}
                onJumpToStep={goTo}
                academic={{
                  years: academicYears,
                  classes: academicClasses,
                  sections: academicSections,
                  yearId: selectedAcademicYearId,
                  setYearId: setSelectedAcademicYearId,
                  classId: selectedClassId,
                  setClassId: setSelectedClassId,
                  sectionId: selectedSectionId,
                  setSectionId: setSelectedSectionId,
                }}
              />
            )}
            {step === 6 && (
              <DocumentsStep
                data={newStudent}
                onChange={handleAddStudentChange}
                errors={errors}
                onUploadFile={onUploadFile}
                onPhoto={handlePhoto}
              />
            )}
            {step === 7 && <OfficeStep data={newStudent} onChange={handleAddStudentChange} />}
            {step === 8 && <ReviewStep data={newStudent} onJumpToStep={goTo} />}

            {!isLast && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <Info className="h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-xs text-blue-700">
                  Fields marked with <span className="font-semibold text-red-500">*</span> are mandatory.
                </p>
              </div>
            )}
          </div>

          {/* right rail */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <StepRail step={step} maxVisited={maxVisited} onJump={goTo} />
            {isLast && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="mb-3 text-sm font-bold text-gray-900">Summary</p>
                <dl className="space-y-2.5 text-sm">
                  <div><dt className="text-xs text-gray-400">Student Name</dt><dd className="font-medium text-gray-800">{newStudent.name || "—"}</dd></div>
                  <div><dt className="text-xs text-gray-400">Class</dt><dd className="font-medium text-gray-800">{[newStudent.class, newStudent.section].filter(Boolean).join(" - ") || "—"}</dd></div>
                  <div><dt className="text-xs text-gray-400">Academic Session</dt><dd className="font-medium text-gray-800">{newStudent.academicYear || "—"}</dd></div>
                  <div><dt className="text-xs text-gray-400">Admission Type</dt><dd className="font-medium text-gray-800">{newStudent.admissionType || "—"}</dd></div>
                </dl>
              </div>
            )}
            <HelpCard />
          </aside>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3.5">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {autoSavedAt && draftState === "idle" && (
            <span className="hidden items-center gap-1.5 text-xs text-gray-400 sm:flex">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Auto-saved {new Date(autoSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={saveDraft}
            disabled={draftState === "saving"}
            className={`flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-70 ${
              draftState === "saved"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : draftState === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {draftState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : draftState === "saved" ? (
              <>
                <Check className="h-4 w-4" /> Draft saved
              </>
            ) : draftState === "error" ? (
              <>
                <Info className="h-4 w-4" /> Save failed
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Draft
              </>
            )}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enrolling…
              </>
            ) : isLast ? (
              <>
                <Check className="h-4 w-4" /> Submit Enrollment
              </>
            ) : (
              <>
                Save &amp; Next <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
