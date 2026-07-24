import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Phone, Mail, User, Globe,
  Upload, FileText, Check, ChevronLeft, ChevronRight,
  AlertCircle, Loader2, X, GraduationCap, Plus, Trash2,
  School, ClipboardList, Info, FolderOpen, Sparkles,
  ShieldCheck, Rocket, Users2
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL;

// Validation helpers
const isValidPhone = (phone) => {
  const cleaned = String(phone || '').replace(/\D/g, '');
  return /^\d{10}$/.test(cleaned);
};

const normalizeIndianPhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

const isValidEmail = (email) => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
};

const isValidURL = (url) => {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.includes('.');
  } catch {
    return false;
  }
};

const STEPS = [
  { id: 1, label: 'School Name',    shortLabel: 'Name',    icon: School },
  { id: 2, label: 'Campus Details', shortLabel: 'Campus',  icon: Building2 },
  { id: 3, label: 'School Type',    shortLabel: 'Type',    icon: ClipboardList },
  { id: 4, label: 'Contact',        shortLabel: 'Contact', icon: User },
  { id: 5, label: 'Details',        shortLabel: 'Details', icon: Info },
  { id: 6, label: 'Files',          shortLabel: 'Files',   icon: FolderOpen },
];

const FEATURE_HIGHLIGHTS = [
  { icon: Building2, title: 'Multi-campus ready', desc: 'Manage every branch from a single dashboard.' },
  { icon: ShieldCheck, title: 'Secure & compliant', desc: 'Your data is encrypted and access-controlled.' },
  { icon: Rocket, title: 'Fast approval', desc: 'Most registrations are reviewed within 24-48 hours.' },
  { icon: Users2, title: 'Built for everyone', desc: 'Students, teachers, parents and admins, one platform.' },
];

const schoolTypes        = ['Public', 'Private', 'Charter', 'International'];
const boards             = ['CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'NIOS', 'Other'];
const academicStructures = ['Semester', 'Trimester', 'Quarter'];
const userRanges = [
  { label: 'Less than 100', value: '<100' },
  { label: '100 - 500', value: '100-500' },
  { label: '500 - 1,000', value: '500-1000' },
  { label: 'More than 1,000', value: '1000+' },
];
const campusTypes        = ['Main', 'Branch'];

/* ─── Reusable field error ─── */
const FieldError = ({ msg }) =>
  msg ? (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle size={12} className="shrink-0" />
      {msg}
    </p>
  ) : null;

/* ─── Reusable label ─── */
const Label = ({ children, required, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
    {optional && <span className="text-gray-400 text-xs font-normal ml-1">(optional)</span>}
  </label>
);

/* ─── Input wrapper with icon ─── */
const InputWithIcon = ({ icon, error, children }) => (
  <div className="relative">
    {React.createElement(icon, {
      className: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none',
      size: 17,
    })}
    {React.cloneElement(children, {
      className: `${children.props.className || ''} w-full pl-10 pr-4 py-2.5 sm:py-3 border rounded-full text-sm transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${
        error
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-white hover:border-amber-300'
      }`.trim(),
    })}
  </div>
);

/* ─── Textarea wrapper with icon ─── */
const TextareaWithIcon = ({ icon, error, children }) => (
  <div className="relative">
    {React.createElement(icon, {
      className: 'absolute left-3 top-3 text-gray-400 pointer-events-none',
      size: 17,
    })}
    {React.cloneElement(children, {
      className: `${children.props.className || ''} w-full pl-10 pr-4 py-2.5 sm:py-3 border rounded-xl text-sm transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${
        error
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-white hover:border-amber-300'
      }`.trim(),
    })}
  </div>
);

const SchoolRegistrationForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  const [formData, setFormData] = useState({
    name: '',
    campuses: [
      { name: '', address: '', campusType: 'Main', contactPerson: '', contactPhone: '' }
    ],
    schoolType: '',
    board: '',
    boardOther: '',
    academicYearStructure: '',
    contactPersonName: '',
    contactPhone: '',
    officialEmail: '',
    address: '',
    websiteURL: '',
    estimatedUsers: '',
    logo: null,
    verificationDocs: [],
  });

  const [errors, setErrors]             = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo]   = useState(false);
  const [isUploadingDocs, setIsUploadingDocs]   = useState(false);
  const [logoPreview, setLogoPreview]   = useState(null);
  const [docsPreview, setDocsPreview]   = useState([]);

  const normalizeServerErrors = (serverErrors = {}) => {
    const next = { ...serverErrors };
    Object.keys(serverErrors).forEach((key) => {
      // Backend uses campus_{idx}_phone while UI expects campus_{idx}_contactPhone
      const phoneKeyMatch = key.match(/^campus_(\d+)_phone$/);
      if (phoneKeyMatch) {
        const aliasKey = `campus_${phoneKeyMatch[1]}_contactPhone`;
        next[aliasKey] = serverErrors[key];
      }
    });
    return next;
  };

  const getStepForErrors = (serverErrors = {}) => {
    const keys = Object.keys(serverErrors || {});
    const step6Fields = new Set(['logo', 'verificationDocs']);
    const step5Fields = new Set(['websiteURL', 'estimatedUsers']);
    const step4Fields = new Set(['contactPersonName', 'contactPhone', 'officialEmail', 'address']);
    const step3Fields = new Set(['schoolType', 'board', 'boardOther', 'academicYearStructure']);
    const step2Fields = new Set(['campuses']);
    const step1Fields = new Set(['name']);

    if (keys.some((key) => step6Fields.has(key))) return 6;
    if (keys.some((key) => step5Fields.has(key))) return 5;
    if (keys.some((key) => step4Fields.has(key))) return 4;
    if (keys.some((key) => step3Fields.has(key))) return 3;
    if (keys.some((key) => step2Fields.has(key) || key.startsWith('campus_'))) return 2;
    if (keys.some((key) => step1Fields.has(key))) return 1;
    return 1;
  };

  /* ── campus helpers ── */
  const addCampus = () =>
    setFormData(p => ({
      ...p,
      campuses: [...p.campuses, { name: '', address: '', campusType: 'Branch', contactPerson: '', contactPhone: '' }],
    }));

  const removeCampus = (idx) => {
    if (formData.campuses.length === 1) { toast.error('At least one campus is required'); return; }
    setFormData(p => ({ ...p, campuses: p.campuses.filter((_, i) => i !== idx) }));
    setErrors(p => {
      const next = { ...p };
      Object.keys(next).filter(k => k.startsWith(`campus_${idx}_`)).forEach(k => delete next[k]);
      return next;
    });
  };

  const handleCampusChange = (idx, field, value) => {
    const nextValue = field === 'contactPhone' ? normalizeIndianPhone(value) : value;
    setFormData(p => ({
      ...p,
      campuses: p.campuses.map((c, i) => i === idx ? { ...c, [field]: nextValue } : c),
    }));
    const key = `campus_${idx}_${field}`;
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  /* ── input helper ── */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'contactPhone' ? normalizeIndianPhone(value) : value;
    setFormData(p => ({ ...p, [name]: nextValue }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  /* ── validation ── */
  const validateStep1 = () => {
    const e = {};
    if (!formData.name.trim())                 e.name = 'School name is required';
    else if (formData.name.trim().length < 3)  e.name = 'School name must be at least 3 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!formData.campuses?.length) {
      e.campuses = 'At least one campus is required';
    } else {
      formData.campuses.forEach((c, i) => {
        if (!c.name.trim())
          e[`campus_${i}_name`] = 'Campus name is required';
        if (!c.address.trim())
          e[`campus_${i}_address`] = 'Campus address is required';
        else if (c.address.trim().length < 10)
          e[`campus_${i}_address`] = 'Please provide a complete address (min 10 characters)';
        if (c.contactPhone && !isValidPhone(c.contactPhone))
          e[`campus_${i}_contactPhone`] = 'Please enter a valid 10-digit Indian phone number';
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    if (!formData.schoolType)
      e.schoolType = 'Please select a school type';

    if (!formData.board)
      e.board = 'Please select a board/affiliation';
    else if (formData.board === 'Other' && !formData.boardOther.trim())
      e.boardOther = 'Please specify the board name';

    if (!formData.academicYearStructure)
      e.academicYearStructure = 'Please select an academic year structure';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep4 = () => {
    const e = {};
    if (!formData.contactPersonName.trim())
      e.contactPersonName = 'Contact person name is required';
    else if (formData.contactPersonName.trim().length < 2)
      e.contactPersonName = 'Name must be at least 2 characters';
    else if (!/^[a-zA-Z\s.'-]{2,}$/.test(formData.contactPersonName.trim()))
      e.contactPersonName = 'Name should contain only letters and spaces';

    if (!formData.contactPhone.trim())
      e.contactPhone = 'Contact phone is required';
    else if (!isValidPhone(formData.contactPhone))
      e.contactPhone = 'Please enter a valid 10-digit Indian phone number';

    if (!formData.officialEmail.trim())
      e.officialEmail = 'Official email is required';
    else if (!isValidEmail(formData.officialEmail))
      e.officialEmail = 'Please enter a valid email address';

    if (!formData.address.trim())
      e.address = 'School address is required';
    else if (formData.address.trim().length < 15)
      e.address = 'Please provide a complete address (min 15 characters)';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep5 = () => {
    const e = {};
    if (formData.websiteURL?.trim() && !isValidURL(formData.websiteURL.trim()))
      e.websiteURL = 'Please enter a valid URL (e.g. https://example.com)';
    if (!formData.estimatedUsers)
      e.estimatedUsers = 'Please select the estimated number of users';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep6 = () => {
    const e = {};
    if (!formData.logo)
      e.logo = 'School logo is required';
    if (!formData.verificationDocs?.length)
      e.verificationDocs = 'Please upload at least one verification document';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── uploads ── */
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrors(p => ({ ...p, logo: 'Only JPG, PNG, or WebP images are accepted' })); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(p => ({ ...p, logo: 'Logo must be smaller than 5 MB' })); return;
    }
    setIsUploadingLogo(true);
    setErrors(p => ({ ...p, logo: '' }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'school_logos');
      const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      const f = result.files[0];
      setFormData(p => ({ ...p, logo: { public_id: f.public_id, secure_url: f.secure_url, originalName: f.originalName } }));
      setLogoPreview(f.secure_url);
      toast.success('Logo uploaded successfully');
    } catch {
      setErrors(p => ({ ...p, logo: 'Upload failed. Please try again.' }));
      toast.error('Logo upload failed');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDocsUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (files.length + formData.verificationDocs.length > 5) {
      setErrors(p => ({ ...p, verificationDocs: 'Maximum 5 documents allowed' })); return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    for (const f of files) {
      if (!allowed.includes(f.type)) { setErrors(p => ({ ...p, verificationDocs: 'Only PDF and image files are allowed' })); return; }
      if (f.size > 10 * 1024 * 1024) { setErrors(p => ({ ...p, verificationDocs: 'Each file must be under 10 MB' })); return; }
    }
    setIsUploadingDocs(true);
    setErrors(p => ({ ...p, verificationDocs: '' }));
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      fd.append('folder', 'school_verification_docs');
      const res = await fetch(`${API_BASE}/api/uploads/cloudinary/bulk`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      const uploaded = result.files.map(f => ({ public_id: f.public_id, secure_url: f.secure_url, originalName: f.originalName }));
      setFormData(p => ({ ...p, verificationDocs: [...p.verificationDocs, ...uploaded] }));
      setDocsPreview(p => [...p, ...uploaded.map(f => ({ name: f.originalName, url: f.secure_url }))]);
      toast.success(`${uploaded.length} document${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch {
      setErrors(p => ({ ...p, verificationDocs: 'Upload failed. Please try again.' }));
      toast.error('Document upload failed');
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const removeDocument = (idx) => {
    setFormData(p => ({ ...p, verificationDocs: p.verificationDocs.filter((_, i) => i !== idx) }));
    setDocsPreview(p => p.filter((_, i) => i !== idx));
  };

  /* ── navigation ── */
  const validators = {
    1: validateStep1,
    2: validateStep2,
    3: validateStep3,
    4: validateStep4,
    5: validateStep5,
    6: validateStep6,
  };

  const handleNext = () => {
    if (validators[currentStep]() && currentStep < totalSteps) {
      setCurrentStep(p => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(p => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep6()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/school-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfterSeconds = Number(res.headers.get('retry-after'));
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
            toast.error(`You've hit the submission limit. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} and try again.`);
          } else {
            toast.error(data.error || 'Too many requests. Please try again later.');
          }
          return;
        }
        if (data.errors) {
          const normalizedErrors = normalizeServerErrors(data.errors);
          setErrors(normalizedErrors);
          setCurrentStep(getStepForErrors(normalizedErrors));
          toast.error('Please fix the highlighted fields and try again');
        }
        else throw new Error(data.error || 'Registration failed');
        return;
      }
      toast.success('Registration submitted successfully!');
      window.dispatchEvent(new Event('super-admin-refresh-requests'));
      navigate('/school-registration/success', { state: { schoolData: data.school } });
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── select class helper ── */
  const selectCls = (field) =>
    `w-full px-4 py-2.5 sm:py-3 border rounded-full text-sm transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${
      errors[field]
        ? 'border-red-400 bg-red-50'
        : 'border-gray-200 bg-white hover:border-amber-300'
    }`;

  /* ════════════════════════════════
     STEP CONTENT
  ════════════════════════════════ */
  const renderStep = () => {
    switch (currentStep) {
      /* ─── STEP 1 ─── */
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <Label required>School Name</Label>
              <InputWithIcon icon={GraduationCap} error={errors.name}>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Harrow Hall School"
                />
              </InputWithIcon>
              <FieldError msg={errors.name} />
            </div>
          </div>
        );

      /* ─── STEP 2 ─── */
      case 2:
        return (
          <div className="space-y-5">
            {/* Campuses */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label required>
                  Campus Details
                  <span className="text-gray-400 font-normal text-xs ml-1">
                    ({formData.campuses.length} campus{formData.campuses.length !== 1 ? 'es' : ''})
                  </span>
                </Label>
                <button
                  type="button"
                  onClick={addCampus}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold hover:bg-amber-100 hover:border-amber-300 active:scale-95 transition-all"
                >
                  <Plus size={13} /> Add Campus
                </button>
              </div>

              <div className="space-y-4">
                {formData.campuses.map((campus, idx) => (
                  <div key={idx} className="relative overflow-hidden p-4 bg-gradient-to-br from-amber-50/60 to-white border border-amber-100 rounded-xl space-y-3 shadow-sm">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-400" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold shrink-0">
                          {idx + 1}
                        </span>
                        Campus {idx + 1}
                        {idx === 0 && <span className="ml-0.5 text-xs text-amber-600 font-normal">(Main)</span>}
                      </span>
                      {formData.campuses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCampus(idx)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          aria-label="Remove campus"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label required>Campus Name</Label>
                        <div className="relative">
                          <input
                            type="text"
                            value={campus.name}
                            onChange={(e) => handleCampusChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Main Campus"
                            className={`w-full px-3 py-2.5 border rounded-full text-sm transition-all focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${
                              errors[`campus_${idx}_name`] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                            }`}
                          />
                        </div>
                        <FieldError msg={errors[`campus_${idx}_name`]} />
                      </div>

                      <div>
                        <Label>Campus Type</Label>
                        <select
                          value={campus.campusType}
                          onChange={(e) => handleCampusChange(idx, 'campusType', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-full text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 transition-all"
                        >
                          {campusTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label required>Campus Address</Label>
                      <textarea
                        value={campus.address}
                        onChange={(e) => handleCampusChange(idx, 'address', e.target.value)}
                        rows={2}
                        placeholder="Enter full campus address"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm resize-none ${
                          errors[`campus_${idx}_address`] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                        }`}
                      />
                      <FieldError msg={errors[`campus_${idx}_address`]} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label optional>Contact Person</Label>
                        <input
                          type="text"
                          value={campus.contactPerson}
                          onChange={(e) => handleCampusChange(idx, 'contactPerson', e.target.value)}
                          placeholder="Campus coordinator"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-full text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 transition-all"
                        />
                      </div>
                      <div>
                        <Label optional>Contact Phone</Label>
                        <input
                          type="tel"
                          value={campus.contactPhone}
                          onChange={(e) => handleCampusChange(idx, 'contactPhone', e.target.value)}
                          inputMode="numeric"
                          maxLength={10}
                          pattern="[0-9]{10}"
                          placeholder="9876543210"
                          className={`w-full px-3 py-2.5 border rounded-full text-sm transition-all focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${
                            errors[`campus_${idx}_contactPhone`] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                          }`}
                        />
                        <FieldError msg={errors[`campus_${idx}_contactPhone`]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <FieldError msg={errors.campuses} />
            </div>
          </div>
        );

      /* ─── STEP 3 ─── */
      case 3:
        return (
          <div className="space-y-5">
            {/* School Type + Board */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>School Type</Label>
                <select name="schoolType" value={formData.schoolType} onChange={handleInputChange} className={selectCls('schoolType')}>
                  <option value="">Select type</option>
                  {schoolTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <FieldError msg={errors.schoolType} />
              </div>
              <div>
                <Label required>Board / Affiliation</Label>
                <select name="board" value={formData.board} onChange={handleInputChange} className={selectCls('board')}>
                  <option value="">Select board</option>
                  {boards.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <FieldError msg={errors.board} />
              </div>
            </div>

            {formData.board === 'Other' && (
              <div>
                <Label required>Specify Board Name</Label>
                <input
                  type="text"
                  name="boardOther"
                  value={formData.boardOther}
                  onChange={handleInputChange}
                  placeholder="Enter board / affiliation name"
                  className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 shadow-sm ${errors.boardOther ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-amber-300'}`}
                />
                <FieldError msg={errors.boardOther} />
              </div>
            )}

            <div>
              <Label required>Academic Year Structure</Label>
              <select name="academicYearStructure" value={formData.academicYearStructure} onChange={handleInputChange} className={selectCls('academicYearStructure')}>
                <option value="">Select structure</option>
                {academicStructures.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <FieldError msg={errors.academicYearStructure} />
            </div>
          </div>
        );

      /* ─── STEP 4 ─── */
      case 4:
        return (
          <div className="space-y-5">
            <div>
              <Label required>Contact Person's Name</Label>
              <InputWithIcon icon={User} error={errors.contactPersonName}>
                <input
                  type="text"
                  name="contactPersonName"
                  value={formData.contactPersonName}
                  onChange={handleInputChange}
                  placeholder="Full name of the primary contact"
                />
              </InputWithIcon>
              <FieldError msg={errors.contactPersonName} />
            </div>

            <div>
              <Label required>Contact Phone Number</Label>
              <InputWithIcon icon={Phone} error={errors.contactPhone}>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleInputChange}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="9876543210"
                />
              </InputWithIcon>
              <FieldError msg={errors.contactPhone} />
            </div>

            <div>
              <Label required>Official School Email</Label>
              <InputWithIcon icon={Mail} error={errors.officialEmail}>
                <input
                  type="email"
                  name="officialEmail"
                  value={formData.officialEmail}
                  onChange={handleInputChange}
                  placeholder="admin@yourschool.com"
                />
              </InputWithIcon>
              <FieldError msg={errors.officialEmail} />
            </div>

            <div>
              <Label required>School Address</Label>
              <TextareaWithIcon icon={MapPin} error={errors.address}>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Enter the complete registered address of your school"
                  style={{ resize: 'none' }}
                />
              </TextareaWithIcon>
              <FieldError msg={errors.address} />
            </div>
          </div>
        );

      /* ─── STEP 5 ─── */
      case 5:
        return (
          <div className="space-y-5">
            <div>
              <Label optional>Website URL</Label>
              <InputWithIcon icon={Globe} error={errors.websiteURL}>
                <input
                  type="url"
                  name="websiteURL"
                  value={formData.websiteURL}
                  onChange={handleInputChange}
                  placeholder="https://www.yourschool.com"
                />
              </InputWithIcon>
              <FieldError msg={errors.websiteURL} />
            </div>

            <div>
              <Label required>Estimated Number of Users</Label>
              <select name="estimatedUsers" value={formData.estimatedUsers} onChange={handleInputChange} className={selectCls('estimatedUsers')}>
                <option value="">Select a range</option>
                {userRanges.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <FieldError msg={errors.estimatedUsers} />
            </div>

            {/* Info card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-amber-200/70" />
              <p className="relative font-semibold mb-1">Almost there!</p>
              <p className="relative text-amber-700 text-xs leading-relaxed">
                In the next step you'll upload your school logo and verification documents. Make sure they are ready before proceeding.
              </p>
            </div>
          </div>
        );

      /* ─── STEP 6 ─── */
      case 6:
        return (
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <Label required>
                School Logo
                <span className="text-gray-400 font-normal text-xs ml-1">— JPG / PNG / WebP, max 5 MB</span>
              </Label>

              {logoPreview ? (
                <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-cover rounded-lg shrink-0 border border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{formData.logo?.originalName}</p>
                    <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1"><Check size={12} /> Uploaded successfully</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFormData(p => ({ ...p, logo: null })); setLogoPreview(null); }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                    aria-label="Remove logo"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp" onChange={handleLogoUpload} disabled={isUploadingLogo} className="hidden" id="logo-upload" />
                  <label
                    htmlFor="logo-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      errors.logo ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50/50 hover:border-amber-400 hover:bg-amber-50'
                    } ${isUploadingLogo ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    {isUploadingLogo ? (
                      <><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /><p className="text-xs text-gray-500 mt-2">Uploading…</p></>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                          <Upload className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">Click to upload logo</p>
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP up to 5 MB</p>
                      </>
                    )}
                  </label>
                </>
              )}
              <FieldError msg={errors.logo} />
            </div>

            {/* Verification Docs */}
            <div>
              <Label required>
                Verification Documents
                <span className="text-gray-400 font-normal text-xs ml-1">— PDF / JPG / PNG, max 10 MB </span>
              </Label>

              {formData.verificationDocs.length < 5 && (
                <>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/jpg"
                    onChange={handleDocsUpload}
                    disabled={isUploadingDocs}
                    multiple
                    className="hidden"
                    id="docs-upload"
                  />
                  <label
                    htmlFor="docs-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      errors.verificationDocs ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50/50 hover:border-amber-400 hover:bg-amber-50'
                    } ${isUploadingDocs ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    {isUploadingDocs ? (
                      <><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /><p className="text-xs text-gray-500 mt-2">Uploading…</p></>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">Click to upload documents</p>
                      </>
                    )}
                  </label>
                </>
              )}

              {docsPreview.length > 0 && (
                <div className="mt-3 space-y-2">
                  {docsPreview.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <FileText className="text-gray-400 shrink-0" size={16} />
                      <p className="flex-1 text-sm text-gray-700 truncate min-w-0">{doc.name}</p>
                      <button
                        type="button"
                        onClick={() => removeDocument(idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition shrink-0"
                        aria-label="Remove document"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FieldError msg={errors.verificationDocs} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /* ════════════════════════════════
     MAIN RENDER
  ════════════════════════════════ */
  return (
    <div className="min-h-screen relative overflow-hidden eec-reg-bg">
      <style>{`
        @keyframes eecGradientPan {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes eecWaveDrift {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes eecBlobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(24px, -18px) scale(1.06); }
        }
        .eec-reg-bg {
          background: linear-gradient(120deg, #fffbeb, #fff7ed, #fefce8, #fff7ed, #fffbeb);
          background-size: 300% 300%;
          animation: eecGradientPan 16s ease-in-out infinite;
        }
        .eec-blob-float { animation: eecBlobFloat 10s ease-in-out infinite; }
        .eec-blob-float-slow { animation: eecBlobFloat 14s ease-in-out infinite; }
        .eec-wave-track { animation: eecWaveDrift 22s linear infinite; }
        .eec-wave-track-slow { animation: eecWaveDrift 34s linear infinite reverse; }
        @media (prefers-reduced-motion: reduce) {
          .eec-reg-bg, .eec-blob-float, .eec-blob-float-slow, .eec-wave-track, .eec-wave-track-slow { animation: none; }
        }
      `}</style>

      {/* shared SVG wave gradients */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="eecWaveA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="eecWaveA2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="eecWaveB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fdba74" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="eecWaveB2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fdba74" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>

      {/* decorative floating gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-72 h-72 sm:w-96 sm:h-96 bg-amber-300/30 rounded-full blur-3xl eec-blob-float" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-80 h-80 sm:w-[28rem] sm:h-[28rem] bg-orange-300/25 rounded-full blur-3xl eec-blob-float-slow" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-64 h-64 sm:w-80 sm:h-80 bg-yellow-200/40 rounded-full blur-3xl eec-blob-float" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(180,120,20,0.08) 1px, transparent 0)', backgroundSize: '28px 28px' }}
      />

      {/* animated wavy gradient bands */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 sm:h-48 overflow-hidden opacity-70">
        <div className="eec-wave-track flex w-[200%] h-full">
          <svg className="w-1/2 h-full shrink-0" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,110 C240,180 480,20 720,90 C960,160 1200,40 1440,110 L1440,220 L0,220 Z" fill="url(#eecWaveA)" />
          </svg>
          <svg className="w-1/2 h-full shrink-0" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,110 C240,180 480,20 720,90 C960,160 1200,40 1440,110 L1440,220 L0,220 Z" fill="url(#eecWaveA2)" />
          </svg>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:h-36 overflow-hidden opacity-50">
        <div className="eec-wave-track-slow flex w-[200%] h-full">
          <svg className="w-1/2 h-full shrink-0" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,140 C300,60 600,180 900,110 C1140,55 1300,140 1440,120 L1440,220 L0,220 Z" fill="url(#eecWaveB)" />
          </svg>
          <svg className="w-1/2 h-full shrink-0" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,140 C300,60 600,180 900,110 C1140,55 1300,140 1440,120 L1440,220 L0,220 Z" fill="url(#eecWaveB2)" />
          </svg>
        </div>
      </div>

      <div className="relative xl:h-screen xl:overflow-hidden">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 py-8 sm:py-12 lg:py-16 xl:px-0 xl:py-0 xl:h-full xl:grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-0">

          {/* ── Left brand panel (xl and up only) ── */}
          <div className="hidden xl:flex xl:flex-col xl:h-full relative overflow-hidden px-10 2xl:px-14 pt-6 2xl:pt-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 shrink-0"
            >
              <div className='flex flex-wrap items-center gap-3 mb-3'>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg shadow-orange-200 border border-amber-100 p-2.5">
                <img src="/logo_new.png" alt="EEC" className="w-full h-full object-contain" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                New School Registration
              </div>
              </div>
              <h1 className="text-3xl 2xl:text-4xl font-bold text-gray-800 leading-tight">
                Bring your school<br />online with <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">EEC</span>
              </h1>
              <p className="text-base text-gray-500 mt-3 leading-relaxed max-w-md">
                Join hundreds of schools managing academics, attendance, fees and communication in one secure platform.
              </p>
            </motion.div>

            {/* Feature list sits in its own lane, left of the illustration —
                a real flex row (not absolute positioning) so the two can
                never overlap, and the image gets the rest of the panel's
                height/width to grow as large as its own aspect ratio allows.
                Negative margins let the image bleed past the panel's own
                padding so it reaches the true edges of the column. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative z-10 mt-0.5 flex-1 min-h-0 flex items-end gap-4 -mx-10 2xl:-mx-14"
            >
              {/* <div className="flex flex-col gap-3 w-[150px] shrink-0 pb-2 pl-10 2xl:pl-14">
                {FEATURE_HIGHLIGHTS.map((f) => (
                  <div key={f.title} className="flex items-start gap-2.5 bg-white/70 backdrop-blur-sm rounded-xl p-2.5 shadow-sm border border-amber-100/70">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 shadow-sm border border-amber-100 flex items-center justify-center shrink-0">
                      <f.icon className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{f.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div> */}

              <div className="flex-1 min-w-0 h-full">
                {/* object-cover (not contain) so height is driven by the
                    lane's full height, not capped by the image's landscape
                    aspect ratio — this crops the sides instead of shrinking. */}
                <img
                  src="/register-left.png"
                  alt="School Registration"
                  className="pointer-events-none select-none w-full h-full object-cover object-[center_bottom]"
                />
              </div>
            </motion.div>
          </div>

          {/* ── Right: header + stepper + form (scrolls independently on xl+, so the
                left illustration panel stays fully visible while the form scrolls) ── */}
          <div className="max-w-2xl mx-auto w-full xl:max-w-none xl:mx-0 xl:h-full xl:overflow-y-auto xl:px-10 2xl:px-14 xl:py-6 2xl:py-8">

            {/* ── Header (hidden on xl, shown via left panel instead) ── */}
            <div className="text-center xl:hidden mb-8">
              <div className="inline-flex items-center justify-center w-full h-full bg-white rounded-2xl shadow-lg shadow-orange-200 border border-amber-100 mb-4 p-2">
                <img src="/logo_new.png" alt="EEC" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Electronic Educare</h1>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">School Registration</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1.5">
                Register your school to get started with our platform
              </p>
            </div>

            {/* ── Step Indicator ── */}
            <div className="mb-6 sm:mb-8 xl:mb-5">
              {/* Progress bar */}
              <div className="relative flex items-start mb-3">
                {/* background track — vertically centered through the step circles (h-9/h-10) */}
                <div className="absolute left-0 right-0 top-[18px] sm:top-5 -translate-y-1/2 h-1 bg-gray-200/80 rounded-full z-0 ml-8 mr-8" />
                {/* filled track */}
                <motion.div
                  className="absolute left-0 top-[18px] sm:top-5 -translate-y-1/2 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full z-0 ml-8"
                  initial={false}
                  animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                />
                {STEPS.map((step) => {
                  const done    = step.id < currentStep;
                  const active  = step.id === currentStep;
                  return (
                    <div key={step.id} className="relative z-10 flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <motion.div
                        animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors duration-200 ${
                          done
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 border-amber-500 text-white shadow-md shadow-amber-200'
                            : active
                            ? 'bg-white border-amber-500 text-amber-600 shadow-md shadow-amber-200'
                            : 'bg-white border-gray-300 text-gray-400'
                        }`}
                      >
                        {done ? <Check size={16} /> : <step.icon size={16} />}
                      </motion.div>
                      <span
                        className={`text-[11px] sm:text-xs font-medium text-center whitespace-nowrap transition-colors ${
                          active ? 'text-amber-600' : 'text-gray-400'
                        }`}
                      >
                        <span className="hidden sm:inline">{step.label}</span>
                        <span className="sm:hidden">{step.shortLabel}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Step counter */}
              <p className="text-center text-xs text-gray-400 mt-2">
                Step {currentStep} of {totalSteps}
              </p>
            </div>

            {/* ── Form Card ── */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-amber-100/60 border border-white/60 overflow-hidden">
              {/* Card header strip */}
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3.5 flex items-center gap-2">
                {(() => { const S = STEPS[currentStep - 1]; return <S.icon className="w-4 h-4 text-white" />; })()}
                <span className="text-white text-sm font-semibold">{STEPS[currentStep - 1].label}</span>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="p-5 sm:p-7 xl:p-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      {renderStep()}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ── Navigation ── */}
                <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 bg-gray-50/80 border-t border-gray-100">
                  {currentStep > 1 ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handlePrevious}
                      className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 transition shadow-sm"
                    >
                      <ChevronLeft size={16} />
                      <span className="hidden sm:inline">Previous</span>
                    </motion.button>
                  ) : (
                    <div />
                  )}

                  {currentStep < totalSteps ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-md shadow-amber-200 ml-auto"
                    >
                      Next
                      <ChevronRight size={16} />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                      whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-md shadow-amber-200 disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="animate-spin" size={16} /> Submitting…</>
                      ) : (
                        <><Check size={16} /> Submit Registration</>
                      )}
                    </motion.button>
                  )}
                </div>
              </form>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6 xl:hidden">
              Your information is encrypted and reviewed securely by our team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolRegistrationForm;
