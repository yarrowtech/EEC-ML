import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  Shield,
  Building2,
  UserCircle,
  X,
  Loader2,
  Camera,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  ChevronDown,
  Crown,
  Info,
  Layers,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL;

const EMPTY_ADMIN = {
  id: '',
  username: '',
  name: '',
  email: '',
  campusName: '',
  campusType: '',
  avatar: '',
  coverImage: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const EMPTY_SCHOOL = {
  id: '',
  name: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  websiteURL: '',
  officialEmail: '',
  contactPersonName: '',
  campusName: '',
  schoolType: '',
  board: '',
  boardOther: '',
  academicYearStructure: '',
  estimatedUsers: '',
  logo: '',
};

// Same option lists as the school registration form (SchoolRegistrationForm.jsx),
// so admins editing these fields later see the same fixed choices instead of a
// free-text box that can drift from what the rest of the app expects.
const SCHOOL_TYPES = ['Public', 'Private', 'Charter', 'International'];
const BOARDS = ['CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'NIOS', 'Other'];
const ACADEMIC_STRUCTURES = ['Semester', 'Trimester', 'Quarter'];
const USER_RANGES = [
  { label: 'Less than 100', value: '<100' },
  { label: '100 - 500', value: '100-500' },
  { label: '500 - 1,000', value: '500-1000' },
  { label: 'More than 1,000', value: '1000+' },
];

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserCircle, accent: 'amber' },
  { key: 'security', label: 'Security', icon: Shield, accent: 'rose' },
  { key: 'school', label: 'School', icon: Building2, accent: 'indigo' },
];

/* ─── reusable labelled input ─── */
const labelCls = 'flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5';
const inputBase = 'w-full rounded-lg border px-3.5 py-2.5 text-sm placeholder:text-gray-400 transition-all duration-150';
const inputEditable = 'bg-white border-gray-200 text-gray-800 hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500';

const LockedChip = () => (
  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
    <Lock size={10} /> Locked
  </span>
);

const Field = ({ label, icon: Icon, readOnly, className, ...props }) => (
  <div className={className ?? ''}>
    <label className={labelCls}>
      {label}
      {readOnly && <LockedChip />}
    </label>
    <div className="relative group">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Icon size={16} className={readOnly ? 'text-gray-400' : 'text-gray-500 group-focus-within:text-blue-600 transition-colors'} />
        </div>
      )}
      <input
        {...props}
        readOnly={readOnly}
        className={`${inputBase} ${Icon ? 'pl-11' : ''} ${
          readOnly ? 'bg-gray-50 border-gray-200 text-gray-800 cursor-not-allowed' : inputEditable
        }`}
      />
    </div>
  </div>
);

/* ─── reusable labelled select (same option lists as the school registration form) ─── */
const SelectField = ({ label, icon: Icon, className, options, placeholder, ...props }) => (
  <div className={className ?? ''}>
    <label className={labelCls}>{label}</label>
    <div className="relative group">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Icon size={16} className="text-gray-500 group-focus-within:text-blue-600 transition-colors" />
        </div>
      )}
      <select
        {...props}
        className={`${inputBase} ${inputEditable} pr-9 appearance-none ${Icon ? 'pl-11' : ''}`}
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
        <ChevronDown size={15} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
      </div>
    </div>
  </div>
);

/* ─── password field with toggle ─── */
const PasswordField = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative group">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Lock size={16} className="text-gray-500 group-focus-within:text-blue-600 transition-colors" />
        </div>
        <input
          type={show ? 'text' : 'password'}
          // Stop the browser auto-filling the saved login password here —
          // a Save would then silently change the account password.
          autoComplete="new-password"
          className={`${inputBase} ${inputEditable} pl-11 pr-10`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 transition-colors">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
};

/* ─── section card wrapper (icon tile + title, 2-col field grid, optional footer) ─── */
const SectionCard = ({ icon: Icon, title, subtitle, children, footer }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
  >
    <div className="flex items-center gap-4 px-5 sm:px-8 py-4 border-b border-gray-100">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
    <div className="px-5 sm:px-8 pt-4 pb-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">{children}</div>
    {footer}
  </motion.div>
);

const AdminSettings = ({ setShowAdminHeader, onSettingsUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  /* ─── image upload helper ─── */
  const handleImageUpload = async (file, { folder, onSuccess, setUploading }) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5 MB');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication token missing');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || 'Upload failed');

      const uploadedUrl =
        data?.files?.[0]?.secure_url ||
        data?.files?.[0]?.url ||
        data?.secure_url ||
        data?.url ||
        '';

      if (!uploadedUrl) {
        throw new Error('Upload failed: URL missing in server response');
      }

      onSuccess(uploadedUrl);
      toast.success('Image uploaded successfully');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  useEffect(() => {
    const loadSettings = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/admin/auth/settings`, {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Unable to load settings');
        const admin = data?.admin || {};
        const school = data?.school || {};
        setIsSuperAdmin(admin?.role === 'super_admin');
        setAdminForm((prev) => ({
          ...prev,
          id: admin?._id || '',
          username: admin?.username || '',
          name: admin?.name || '',
          email: admin?.email || '',
          campusName: admin?.campusName || '',
          campusType: admin?.campusType || '',
          avatar: admin?.avatar || '',
          coverImage: admin?.coverImage || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        setSchoolForm((prev) => ({
          ...prev,
          id: school?._id || '',
          name: school?.name || '',
          address: school?.address || '',
          contactEmail: school?.contactEmail || '',
          contactPhone: school?.contactPhone || '',
          websiteURL: school?.websiteURL || '',
          officialEmail: school?.officialEmail || '',
          contactPersonName: school?.contactPersonName || '',
          campusName: school?.campusName || '',
          schoolType: school?.schoolType || '',
          board: school?.board || '',
          boardOther: school?.boardOther || '',
          academicYearStructure: school?.academicYearStructure || '',
          estimatedUsers: school?.estimatedUsers || '',
          logo: school?.logo?.secure_url || school?.logo?.url || '',
        }));
      } catch (err) {
        toast.error(err.message || 'Unable to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const passwordError = useMemo(() => {
    if (!adminForm.newPassword && !adminForm.confirmPassword) return '';
    if (adminForm.newPassword !== adminForm.confirmPassword) return 'New password and confirm password do not match';
    return '';
  }, [adminForm.newPassword, adminForm.confirmPassword]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication token missing');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        admin: {
          username: adminForm.username,
          name: adminForm.name,
          email: adminForm.email,
          campusName: adminForm.campusName,
          campusType: adminForm.campusType,
          avatar: adminForm.avatar,
          currentPassword: adminForm.currentPassword,
          newPassword: adminForm.newPassword,
        },
        school: isSuperAdmin
          ? {}
          : {
              name: schoolForm.name,
              address: schoolForm.address,
              contactEmail: schoolForm.contactEmail,
              contactPhone: schoolForm.contactPhone,
              websiteURL: schoolForm.websiteURL,
              officialEmail: schoolForm.officialEmail,
              contactPersonName: schoolForm.contactPersonName,
              campusName: schoolForm.campusName,
              schoolType: schoolForm.schoolType,
              board: schoolForm.board,
              boardOther: schoolForm.boardOther,
              academicYearStructure: schoolForm.academicYearStructure,
              estimatedUsers: schoolForm.estimatedUsers,
              logo: schoolForm.logo,
            },
      };
      const res = await fetch(`${API_BASE}/api/admin/auth/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to update settings');
      setAdminForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      onSettingsUpdated?.({ admin: data?.admin, school: data?.school });
      toast.success('Settings updated successfully');
    } catch (err) {
      toast.error(err.message || 'Unable to update settings');
    } finally {
      setSaving(false);
    }
  };

  /* ─── filter tabs for super admin ─── */
  const visibleTabs = isSuperAdmin ? TABS.filter((t) => t.key !== 'school') : TABS;

  // School admins' hero avatar doubles as the school logo — fall back to
  // schoolForm.logo when admin.avatar was never set directly (e.g. the logo
  // was uploaded before the two fields were kept in sync on upload).
  const heroAvatarUrl = adminForm.avatar || (!isSuperAdmin ? schoolForm.logo : '');

  // Cover photo is saved straight away (it isn't part of the form fields).
  const saveCoverImage = async (url) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin: { coverImage: url }, school: {} }),
      });
      if (!res.ok) throw new Error('Unable to save cover photo');
    } catch (err) {
      toast.error(err.message || 'Unable to save cover photo');
    }
  };

  /* ─── loading skeleton ─── */
  if (loading) {
    return (
      <div className="min-h-full p-3 sm:p-4 md:p-6 bg-slate-50">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="h-44 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          <div className="mx-auto h-11 max-w-4xl bg-white rounded-xl border border-gray-100 animate-pulse" />
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 animate-pulse">
            <div className="h-5 w-40 bg-gray-100 rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const saveFooter = (
    <div className="mx-5 sm:mx-8 border-t border-gray-100 py-4 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-6">
      <p className="flex flex-1 items-center gap-2.5 rounded-lg bg-blue-50/70 px-4 py-2.5 text-xs text-blue-700">
        <Info size={16} className="shrink-0" />
        Changes are saved to your profile and school settings.
      </p>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-56 px-6 py-2.5 bg-blue-600 text-white text-[15px] font-semibold rounded-lg hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-600/25"
      >
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );

  return (
    <div className="min-h-full p-3 sm:p-4 md:p-6 pb-20 lg:pb-6 bg-slate-50">
      <form onSubmit={handleSave} className="max-w-6xl mx-auto space-y-4 sm:space-y-5">

        {/* ─── hero profile card ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl shadow-sm bg-linear-to-r from-sky-50 via-indigo-50 to-violet-100"
        >
          {/* cover photo fades in from the right */}
          {adminForm.coverImage ? (
            <img
              src={adminForm.coverImage}
              alt=""
              className="cover-fade absolute inset-y-0 right-0 h-full w-full lg:w-3/5 object-cover opacity-90"
              style={{
              }}
            />
          ) : (
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.9) 0, transparent 35%), radial-gradient(circle at 95% 90%, rgba(167,139,250,0.35) 0, transparent 40%)',
              }}
            />
          )}

          <div className="relative flex flex-col items-center gap-4 px-5 pt-6 pb-16 text-center sm:flex-row sm:items-center sm:gap-7 sm:px-8 sm:py-8 sm:pr-48 sm:text-left">
            {/* logo */}
            <div className="relative group shrink-0">
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                {heroAvatarUrl ? (
                  <img src={heroAvatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100">
                    <UserCircle size={44} className="text-gray-400" />
                  </div>
                )}
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleImageUpload(e.target.files?.[0], {
                    folder: isSuperAdmin ? 'admin-avatars' : 'school-logos',
                    setUploading: setUploadingAvatar,
                    onSuccess: (url) => {
                      setAdminForm((p) => ({ ...p, avatar: url }));
                      if (!isSuperAdmin) {
                        setSchoolForm((p) => ({ ...p, logo: url }));
                        onSettingsUpdated?.({ school: { logo: { secure_url: url } } });
                      }
                    },
                  });
                  e.target.value = '';
                }}
              />
              {/* camera badge — always visible so it works on touch devices */}
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Change photo"
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white shadow-md hover:bg-black active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              >
                {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>

              {heroAvatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAdminForm((p) => ({ ...p, avatar: '' }));
                    if (!isSuperAdmin) {
                      setSchoolForm((p) => ({ ...p, logo: '' }));
                      onSettingsUpdated?.({ school: { logo: '' } });
                    }
                  }}
                  className="absolute top-0 right-0 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Remove photo"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* name / email / role */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-snug tracking-tight text-slate-900 break-words">{adminForm.name || 'Admin'}</h1>
              <p className="mt-2 flex items-center justify-center gap-2.5 text-sm sm:text-base text-gray-600 sm:justify-start break-all">
                <Mail size={17} className="shrink-0 text-gray-500" />
                {adminForm.email || 'No email set'}
              </p>
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-100/90 px-2.5 py-1 text-sm font-medium text-amber-700">
                <Crown size={14} />
                {isSuperAdmin ? 'Super Admin' : 'School Admin'}
              </span>
            </div>

            {/* change cover */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleImageUpload(e.target.files?.[0], {
                  folder: 'admin-covers',
                  setUploading: setUploadingCover,
                  onSuccess: (url) => {
                    setAdminForm((p) => ({ ...p, coverImage: url }));
                    saveCoverImage(url);
                  },
                });
                e.target.value = '';
              }}
            />
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex items-center gap-2">
              {adminForm.coverImage && (
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => {
                    setAdminForm((p) => ({ ...p, coverImage: '' }));
                    saveCoverImage('');
                  }}
                  aria-label="Remove cover photo"
                  title="Remove cover photo"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="button"
                disabled={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
                aria-label="Change cover photo"
                title="Change cover photo"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-md hover:bg-gray-900 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ─── tab navigation ─── */}
        <div className="mx-auto flex max-w-4xl gap-1 rounded-xl p-1">
          {visibleTabs.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex-1 inline-flex items-center justify-center gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-sm sm:text-[15px] font-medium transition-colors whitespace-nowrap ${
                activeTab === key ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {activeTab === key && (
                <motion.span
                  layoutId="admin-settings-tab-pill"
                  className="absolute inset-0 rounded-full bg-blue-600 shadow-sm shadow-blue-600/30"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                >
                  <span className="absolute -bottom-2.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-blue-600" />
                </motion.span>
              )}
              <span className="relative flex items-center gap-2">
                <TabIcon size={18} />
                {label}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── profile tab ─── */}
          {activeTab === 'profile' && (
            <SectionCard key="profile" icon={UserRound} title="Personal Information" subtitle="Update your account details and public profile information." footer={saveFooter}>
              <Field label="Username" value={adminForm.username} readOnly placeholder="Enter username" icon={UserRound} />
              <Field label="Full Name" value={adminForm.name} onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter full name" icon={Pencil} />
              <Field label="Email Address" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} placeholder="Enter email" icon={Mail} />
              <Field label="Campus Name" value={adminForm.campusName} onChange={(e) => setAdminForm((p) => ({ ...p, campusName: e.target.value }))} placeholder="Enter campus name" icon={Building2} />
              <Field label="Campus Type" value={adminForm.campusType} readOnly placeholder="e.g. Main, Branch" icon={Layers} />
            </SectionCard>
          )}

          {/* ─── security tab ─── */}
          {activeTab === 'security' && (
            <SectionCard key="security" icon={Shield} title="Change Password" subtitle="Keep your account secure by using a strong password." footer={saveFooter}>
              <PasswordField label="New Password" value={adminForm.newPassword} onChange={(e) => setAdminForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="Enter new password" />
              <PasswordField label="Confirm Password" value={adminForm.confirmPassword} onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm new password" />
              {passwordError && (
                <div className="md:col-span-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-600">
                  <Shield size={14} />
                  {passwordError}
                </div>
              )}
            </SectionCard>
          )}

          {/* ─── school tab ─── */}
          {activeTab === 'school' && !isSuperAdmin && (
            <motion.div
              key="school"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="space-y-5"
            >
              <SectionCard icon={Building2} title="School Information" subtitle="Core details about your school used across the platform.">
                <Field label="School Name" value={schoolForm.name} onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter school name" icon={Building2} className="md:col-span-2" />
                <Field label="Address" value={schoolForm.address} onChange={(e) => setSchoolForm((p) => ({ ...p, address: e.target.value }))} placeholder="Enter address" icon={MapPin} className="md:col-span-2" />
                <Field label="Contact Email" value={schoolForm.contactEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, contactEmail: e.target.value }))} placeholder="Enter contact email" icon={Mail} />
                <Field label="Contact Phone" value={schoolForm.contactPhone} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPhone: e.target.value }))} placeholder="Enter contact phone" icon={Phone} />
                <Field label="Website URL" value={schoolForm.websiteURL} onChange={(e) => setSchoolForm((p) => ({ ...p, websiteURL: e.target.value }))} placeholder="https://..." icon={Globe} />
                <Field label="Official Email" value={schoolForm.officialEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, officialEmail: e.target.value }))} placeholder="Enter official email" icon={Mail} />
                <Field label="Contact Person" value={schoolForm.contactPersonName} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPersonName: e.target.value }))} placeholder="Enter contact person name" icon={UserRound} />
              </SectionCard>

              <SectionCard icon={GraduationCap} title="Academic Configuration" subtitle="Board affiliation, structure, and capacity." footer={saveFooter}>
                <SelectField
                  label="School Type" icon={GraduationCap} placeholder="Select type" options={SCHOOL_TYPES}
                  value={schoolForm.schoolType} onChange={(e) => setSchoolForm((p) => ({ ...p, schoolType: e.target.value }))}
                />
                <SelectField
                  label="Board / Affiliation" icon={GraduationCap} placeholder="Select board" options={BOARDS}
                  value={schoolForm.board} onChange={(e) => setSchoolForm((p) => ({ ...p, board: e.target.value }))}
                />
                {schoolForm.board === 'Other' && (
                  <Field
                    label="Specify Board Name" value={schoolForm.boardOther} placeholder="Enter board / affiliation name"
                    onChange={(e) => setSchoolForm((p) => ({ ...p, boardOther: e.target.value }))}
                  />
                )}
                <SelectField
                  label="Academic Year Structure" placeholder="Select structure" options={ACADEMIC_STRUCTURES}
                  value={schoolForm.academicYearStructure} onChange={(e) => setSchoolForm((p) => ({ ...p, academicYearStructure: e.target.value }))}
                />
                <SelectField
                  label="Estimated Users" icon={Users} placeholder="Select a range" options={USER_RANGES}
                  value={schoolForm.estimatedUsers} onChange={(e) => setSchoolForm((p) => ({ ...p, estimatedUsers: e.target.value }))}
                />
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};

export default AdminSettings;
