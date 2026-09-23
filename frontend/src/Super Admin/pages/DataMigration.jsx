import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Database,
  Loader2,
  Lock,
  RefreshCw,
  School as SchoolIcon,
  XCircle,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const authHeaders = () => ({
  "Content-Type": "application/json",
  authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

/* ------------------------------------------------------------------ */
/*  Entity registry — mirrors backend/services/migration/index.js.     */
/*  Each field's `aliases` are matched against a normalized (lowercase,*/
/*  non-alphanumeric stripped) column header for auto-mapping; the     */
/*  admin can always override the mapping by hand.                     */
/* ------------------------------------------------------------------ */

const ENTITIES = [
  {
    key: "academicYear",
    label: "Academic Year",
    description: "The school years this data belongs to (e.g. 2025-26).",
    dependsOn: [],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "academicyear", "year", "session"] },
      { key: "startDate", label: "Start Date", aliases: ["startdate", "start"] },
      { key: "endDate", label: "End Date", aliases: ["enddate", "end"] },
      { key: "isActive", label: "Is Active", aliases: ["isactive", "active", "current"] },
    ],
  },
  {
    key: "class",
    label: "Class",
    description: "Grades / classes, e.g. Class 5, Class 10.",
    dependsOn: ["academicYear"],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "class", "classname", "grade"] },
      { key: "academicYear", label: "Academic Year", aliases: ["academicyear", "year", "session"] },
      { key: "order", label: "Sort Order", aliases: ["order", "sortorder"] },
    ],
  },
  {
    key: "section",
    label: "Section",
    description: "Sections within a class, e.g. A, B.",
    dependsOn: ["class"],
    fields: [
      { key: "class", label: "Class", required: true, aliases: ["class", "classname"] },
      { key: "name", label: "Section Name", required: true, aliases: ["name", "section"] },
    ],
  },
  {
    key: "subject",
    label: "Subject",
    description: "Subjects, optionally tied to a class.",
    dependsOn: ["class"],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "subject", "subjectname"] },
      { key: "class", label: "Class", aliases: ["class", "classname"] },
      { key: "code", label: "Code", aliases: ["code", "subjectcode"] },
    ],
  },
  {
    key: "teacher",
    label: "Teacher",
    description: "Teacher accounts — employeeCode/username are auto-generated.",
    dependsOn: [],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "teachername", "fullname"] },
      { key: "email", label: "Email", aliases: ["email", "emailid"] },
      { key: "mobile", label: "Mobile", aliases: ["mobile", "phone", "contact"] },
      { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
      { key: "password", label: "Password (optional)", aliases: ["password"] },
    ],
  },
  {
    key: "student",
    label: "Student",
    description: "Students — a parent account is auto-created/linked from guardian columns.",
    dependsOn: ["class"],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "studentname", "fullname"] },
      { key: "class", label: "Class", required: true, aliases: ["class", "grade", "course"] },
      { key: "section", label: "Section", aliases: ["section", "sec", "division"] },
      { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
      { key: "mobile", label: "Mobile", aliases: ["mobile", "phone", "contact"] },
      { key: "email", label: "Email", aliases: ["email"] },
      { key: "dob", label: "Date of Birth", aliases: ["dob", "dateofbirth", "birthdate"] },
      { key: "admissionDate", label: "Admission Date", aliases: ["admissiondate", "dateofadmission", "doa"] },
      { key: "admissionNumber", label: "Admission Number", aliases: ["admissionnumber", "admno"] },
      { key: "roll", label: "Roll No.", aliases: ["roll", "rollno", "rollnumber"] },
      { key: "batchCode", label: "Session / Batch", aliases: ["batchcode", "batch", "session", "academicyear"] },
      { key: "address", label: "Address", aliases: ["address"] },
      { key: "pincode", label: "Pincode", aliases: ["pincode", "pin", "zipcode"] },
      { key: "guardianName", label: "Guardian Name", aliases: ["guardianname", "parentname", "guardian"] },
      { key: "guardianPhone", label: "Guardian Phone", aliases: ["guardianphone", "parentphone", "guardiancontact"] },
      { key: "guardianEmail", label: "Guardian Email", aliases: ["guardianemail", "parentemail"] },
      { key: "guardianRelation", label: "Guardian Relation", aliases: ["guardianrelation", "relationship"] },
      { key: "fatherName", label: "Father Name", aliases: ["fathername", "father"] },
      { key: "fatherPhone", label: "Father Phone", aliases: ["fatherphone"] },
      { key: "motherName", label: "Mother Name", aliases: ["mothername", "mother"] },
      { key: "motherPhone", label: "Mother Phone", aliases: ["motherphone"] },
      { key: "bloodGroup", label: "Blood Group", aliases: ["bloodgroup", "blood"] },
      { key: "category", label: "Category", aliases: ["category"] },
      { key: "religion", label: "Religion", aliases: ["religion"] },
      { key: "nationality", label: "Nationality", aliases: ["nationality"] },
      { key: "status", label: "Status", aliases: ["status"] },
    ],
  },
  {
    key: "feeStructure",
    label: "Fee Structure",
    description: "Fee plans per class/year, e.g. \"Tuition 2025-26\".",
    dependsOn: ["class"],
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "feestructurename", "structurename"] },
      { key: "totalAmount", label: "Total Amount", required: true, aliases: ["totalamount", "amount", "total"] },
      { key: "academicYear", label: "Academic Year", aliases: ["academicyear", "year", "session"] },
      { key: "class", label: "Class", aliases: ["class", "classname"] },
      { key: "lateFeeAmount", label: "Late Fee Amount", aliases: ["latefeeamount", "latefee"] },
      { key: "feeHeadLabel", label: "Fee Head Label", aliases: ["feeheadlabel", "feehead", "head"] },
    ],
  },
  {
    key: "feeInvoice",
    label: "Fee Invoice (outstanding balance)",
    description: "One invoice per student showing what's currently owed.",
    dependsOn: ["feeStructure", "student"],
    fields: [
      { key: "student", label: "Student (admission no. / code)", required: true, aliases: ["student", "admissionnumber", "studentcode", "studentid"] },
      { key: "feeStructure", label: "Fee Structure Name", required: true, aliases: ["feestructure", "structure"] },
      { key: "totalAmount", label: "Total Amount", aliases: ["totalamount", "amount"] },
      { key: "paidAmount", label: "Paid Amount", aliases: ["paidamount", "paid"] },
      { key: "dueDate", label: "Due Date", aliases: ["duedate"] },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Historical daily attendance records.",
    dependsOn: ["student"],
    fields: [
      { key: "student", label: "Student (admission no. / code)", required: true, aliases: ["student", "admissionnumber", "studentcode"] },
      { key: "date", label: "Date", required: true, aliases: ["date"] },
      { key: "status", label: "Status (present/absent)", required: true, aliases: ["status", "attendance"] },
      { key: "subject", label: "Subject (optional)", aliases: ["subject"] },
    ],
  },
];

const ENTITY_BY_KEY = Object.fromEntries(ENTITIES.map((e) => [e.key, e]));

/* ------------------------------------------------------------------ */
/*  File parsing — same shape as the existing Students.jsx bulk import */
/*  (a 2D array of raw cell rows, header row first).                   */
/* ------------------------------------------------------------------ */

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvText = (text) => {
  const lines = String(text).split(/\r?\n/).filter((line) => line.length > 0);
  return lines.map((line) => {
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    out.push(current.trim());
    return out;
  });
};

const parseFileToRows = async (file) => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsvText(await file.text());
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
};

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

const STATUS_META = {
  pending: { label: "Not started", className: "bg-slate-100 text-slate-500" },
  importing: { label: "Importing…", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meta.className}`}>
      {meta.label}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Entity import panel — upload -> map -> preview -> import -> result */
/* ------------------------------------------------------------------ */

const EntityImportPanel = ({ entity, schoolId, campusId, entityStatus, unlocked, onImported }) => {
  const fileInputRef = useRef(null);
  const [rawRows, setRawRows] = useState(null); // 2D array, header row first
  const [headerMap, setHeaderMap] = useState({}); // fieldKey -> column index
  const [fileName, setFileName] = useState("");
  const [job, setJob] = useState(null); // { jobId, jobSystem, total, processed, succeeded, failed, errors, status }
  const [isStarting, setIsStarting] = useState(false);
  const pollTimerRef = useRef(null);

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const headers = rawRows?.[0] || [];
  const dataRows = useMemo(() => (rawRows ? rawRows.slice(1).filter((r) => r.some((c) => String(c || "").trim())) : []), [rawRows]);

  const handleFile = async (file) => {
    setFileName(file.name);
    const rows = await parseFileToRows(file);
    if (!rows.length) return;
    setRawRows(rows);

    const autoMap = {};
    const rawHeaders = rows[0].map((h) => normalizeHeader(h));
    entity.fields.forEach((field) => {
      const idx = rawHeaders.findIndex((h) => field.aliases.includes(h));
      if (idx !== -1) autoMap[field.key] = idx;
    });
    setHeaderMap(autoMap);
  };

  const missingRequired = entity.fields.filter((f) => f.required && headerMap[f.key] === undefined);

  const previewRows = useMemo(() => {
    return dataRows.slice(0, 10).map((row) => {
      const mapped = {};
      entity.fields.forEach((field) => {
        const idx = headerMap[field.key];
        if (idx !== undefined) mapped[field.key] = String(row[idx] ?? "").trim();
      });
      return mapped;
    });
  }, [dataRows, headerMap, entity.fields]);

  const buildPayloadRows = () =>
    dataRows.map((row) => {
      const mapped = {};
      entity.fields.forEach((field) => {
        const idx = headerMap[field.key];
        if (idx !== undefined) {
          const value = String(row[idx] ?? "").trim();
          if (value) mapped[field.key] = value;
        }
      });
      return mapped;
    });

  const pollJob = useCallback((jobId, jobSystem) => {
    const tick = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/super-admin/migration/jobs/${jobId}/status?system=${encodeURIComponent(jobSystem)}`,
          { headers: authHeaders() }
        );
        const data = await res.json().catch(() => null);
        if (res.ok && data) {
          setJob((prev) => ({ ...(prev || {}), ...data, jobId, jobSystem }));
          if (data.status === "completed" || data.status === "failed") {
            onImported?.();
            return;
          }
        }
      } catch {
        // transient network hiccup — keep polling
      }
      pollTimerRef.current = setTimeout(tick, 2000);
    };
    tick();
  }, [onImported]);

  const startImport = async () => {
    const payloadRows = buildPayloadRows();
    if (!payloadRows.length) return;
    setIsStarting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/super-admin/migration/schools/${schoolId}/entities/${entity.key}/import`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ campusId: campusId || null, rows: payloadRows }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJob({ status: "failed", error: data.error || "Unable to start import", total: payloadRows.length, processed: 0, succeeded: 0, failed: 0, errors: [] });
        return;
      }
      setJob({ jobId: data.jobId, jobSystem: data.jobSystem, status: "processing", total: data.total, processed: 0, succeeded: 0, failed: 0, errors: [] });
      pollJob(data.jobId, data.jobSystem);
    } finally {
      setIsStarting(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <Lock className="text-slate-400" size={28} />
        <p className="text-sm font-semibold text-slate-600">
          Import {entity.dependsOn.map((dep) => ENTITY_BY_KEY[dep]?.label).join(" and ")} before {entity.label}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{entity.label}</h3>
        <p className="text-sm text-slate-500">{entity.description}</p>
      </div>

      {!rawRows && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center hover:border-violet-400 hover:bg-violet-50/50">
          <CloudUpload className="text-slate-400" size={28} />
          <span className="text-sm font-semibold text-slate-700">Click to upload a CSV or Excel file</span>
          <span className="text-xs text-slate-400">First row must be column headers</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {rawRows && !job && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
            <span className="font-semibold text-slate-700">{fileName}</span>
            <span className="text-slate-500">{dataRows.length} data row{dataRows.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={() => { setRawRows(null); setHeaderMap({}); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="text-xs font-bold text-violet-600 hover:underline"
            >
              Change file
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Column mapping</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Source column</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entity.fields.map((field) => (
                    <tr key={field.key}>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={headerMap[field.key] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setHeaderMap((prev) => {
                              const next = { ...prev };
                              if (value === "") delete next[field.key];
                              else next[field.key] = Number(value);
                              return next;
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">— Not mapped —</option>
                          {headers.map((h, idx) => (
                            <option key={idx} value={idx}>{String(h || `Column ${idx + 1}`)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>Map required field{missingRequired.length > 1 ? "s" : ""}: {missingRequired.map((f) => f.label).join(", ")}</span>
            </div>
          )}

          {previewRows.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Preview (first {previewRows.length} rows)</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      {entity.fields.filter((f) => headerMap[f.key] !== undefined).map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-3 py-2">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {entity.fields.filter((f) => headerMap[f.key] !== undefined).map((f) => (
                          <td key={f.key} className="whitespace-nowrap px-3 py-2 text-slate-600">{row[f.key] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={missingRequired.length > 0 || isStarting || dataRows.length === 0}
            onClick={startImport}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isStarting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            Import {dataRows.length} row{dataRows.length === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {job && (
        <div className="space-y-4">
          {(job.status === "processing" || !job.status) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Loader2 size={16} className="animate-spin text-violet-600" /> Importing…
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${job.total ? Math.min(100, Math.round(((job.processed || 0) / job.total) * 100)) : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{job.processed || 0} / {job.total || 0} processed</p>
            </div>
          )}

          {(job.status === "completed" || job.status === "failed") && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                {job.status === "completed" ? (
                  <CheckCircle2 className="text-emerald-500" size={20} />
                ) : (
                  <XCircle className="text-red-500" size={20} />
                )}
                <p className="text-sm font-bold text-slate-800">
                  {job.status === "completed" ? "Import finished" : "Import failed"}
                </p>
              </div>
              {job.error && <p className="text-sm text-red-600">{job.error}</p>}
              <div className="flex gap-4 text-sm">
                <span className="font-semibold text-emerald-600">{job.succeeded || 0} succeeded</span>
                <span className="font-semibold text-red-600">{job.failed || 0} failed</span>
              </div>
              {job.warnings?.length > 0 && (
                <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-amber-700">
                  {job.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {job.errors?.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {job.errors.slice(0, 20).map((e, i) => (
                    <div key={i}>Row {(e.index ?? e.row ?? 0) + 1}: {e.message}</div>
                  ))}
                  {job.errors.length > 20 && <div>…and {job.errors.length - 20} more</div>}
                </div>
              )}
              <button
                type="button"
                onClick={() => { setRawRows(null); setHeaderMap({}); setJob(null); setFileName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-600 hover:underline"
              >
                <RefreshCw size={14} /> Import another file for {entity.label}
              </button>
            </div>
          )}
        </div>
      )}

      {entityStatus?.lastRunAt && !rawRows && !job && (
        <p className="text-xs text-slate-400">
          Last run: {new Date(entityStatus.lastRunAt).toLocaleString()} — {entityStatus.imported || 0} imported, {entityStatus.failed || 0} failed
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const DataMigration = () => {
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [batchStatus, setBatchStatus] = useState(null); // { entities: [...] }
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeEntityKey, setActiveEntityKey] = useState(ENTITIES[0].key);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/super-admin/schools`, { headers: authHeaders() });
        const data = await res.json().catch(() => []);
        setSchools(Array.isArray(data) ? data : []);
      } finally {
        setSchoolsLoading(false);
      }
    })();
  }, []);

  const entityStatusByKey = useMemo(() => {
    const map = {};
    (batchStatus?.entities || []).forEach((e) => { map[e.type] = e; });
    return map;
  }, [batchStatus]);

  const isUnlocked = useCallback((entity) => {
    return entity.dependsOn.every((dep) => entityStatusByKey[dep]?.status === "completed");
  }, [entityStatusByKey]);

  const refreshStatus = useCallback(async () => {
    if (!selectedSchoolId) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/super-admin/migration/schools/${selectedSchoolId}/status`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setBatchStatus(data);
    } finally {
      setStatusLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setBatchStatus(null);
      return;
    }
    setActiveEntityKey(ENTITIES[0].key);
    refreshStatus();
  }, [selectedSchoolId, refreshStatus]);

  const activeEntity = ENTITY_BY_KEY[activeEntityKey];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Data Migration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import a school&apos;s legacy data from CSV/Excel exports — academic structure, roster, fees, and attendance.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">School</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              disabled={schoolsLoading}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">{schoolsLoading ? "Loading schools…" : "Select a school"}</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.name} {school.code ? `(${school.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Campus ID (optional)</label>
            <input
              type="text"
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              placeholder="Leave blank for single-campus"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        {!selectedSchoolId && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <SchoolIcon size={14} /> Pick a school to start migrating its data.
          </p>
        )}
      </div>

      {selectedSchoolId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {ENTITIES.map((entity) => {
              const status = entityStatusByKey[entity.key]?.status || "pending";
              const unlocked = isUnlocked(entity);
              const isActive = entity.key === activeEntityKey;
              return (
                <button
                  key={entity.key}
                  type="button"
                  onClick={() => setActiveEntityKey(entity.key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    {unlocked ? <ChevronRight size={14} className="text-slate-400" /> : <Lock size={14} className="text-slate-300" />}
                    {entity.label}
                  </span>
                  <StatusBadge status={status} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={refreshStatus}
              disabled={statusLoading}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-violet-600"
            >
              <RefreshCw size={12} className={statusLoading ? "animate-spin" : ""} /> Refresh status
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {activeEntity && (
              <EntityImportPanel
                key={activeEntity.key}
                entity={activeEntity}
                schoolId={selectedSchoolId}
                campusId={campusId}
                entityStatus={entityStatusByKey[activeEntity.key]}
                unlocked={isUnlocked(activeEntity)}
                onImported={refreshStatus}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataMigration;
