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
  Sparkles,
  Pencil,
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

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserCircle, accent: 'amber' },
  { key: 'security', label: 'Security', icon: Shield, accent: 'rose' },
  { key: 'school', label: 'School', icon: Building2, accent: 'indigo' },
];

/* ─── reusable labelled input ─── */
const Field = ({ label, icon: Icon, readOnly, className, ...props }) => (
  <div className={className ?? ''}>
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {label}
      {readOnly && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 normal-case tracking-normal">
          <Lock size={8} /> Locked
        </span>
      )}
    </label>
    <div className="relative group">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <Icon size={15} className={readOnly ? 'text-gray-300' : 'text-gray-400 group-focus-within:text-amber-500 transition-colors'} />
        </div>
      )}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm placeholder:text-gray-400 transition-all duration-150 ${Icon ? 'pl-9' : ''} ${
          readOnly
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-800 shadow-xs hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-amber-400/15 focus:border-amber-400'
        }`}
      />
    </div>
  </div>
);

/* ─── password field with toggle ─── */
const PasswordField = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative group">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <Lock size={15} className="text-gray-400 group-focus-within:text-rose-500 transition-colors" />
        </div>
        <input
          type={show ? 'text' : 'password'}
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-10 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-xs transition-all duration-150 hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-rose-400/15 focus:border-rose-400"
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

/* ─── section card wrapper ─── */
const SectionCard = ({ icon: Icon, accent, title, subtitle, children }) => {
  const accents = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${accents[accent] || accents.amber}`}>
          <Icon size={17} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </motion.div>
  );
};

const AdminSettings = ({ setShowAdminHeader, onSettingsUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const avatarInputRef = useRef(null);

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

  /* ─── loading skeleton ─── */
  if (loading) {
    return (
      <div className="min-h-full p-4 lg:p-8 bg-linear-to-b from-gray-50 to-gray-50/40">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
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

  return (
    <div className="min-h-full p-4 lg:p-8 bg-linear-to-b from-gray-50 to-gray-50/40">
      <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">

        {/* ─── hero profile card ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
        >
          {/* gradient banner */}
          <div className="relative h-32 bg-linear-to-br from-amber-400 via-orange-400 to-rose-400 overflow-hidden">
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 15% 30%, rgba(255,255,255,0.55) 0, transparent 45%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.35) 0, transparent 40%)',
              }}
            />
            {/* <Sparkles size={18} className="absolute top-4 right-5 text-white/50" /> */}
          </div>

          <div className="px-6 pb-5">
            {/* avatar overlapping the banner */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-8">
              <div className="relative group shrink-0">
                {heroAvatarUrl ? (
                  <img
                    src={heroAvatarUrl}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg ring-1 ring-black/5"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center ring-1 ring-black/5">
                    <UserCircle size={40} className="text-gray-400" />
                  </div>
                )}

                {/* camera overlay */}
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
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={22} className="text-white animate-spin" />
                  ) : (
                    <Camera size={22} className="text-white drop-shadow" />
                  )}
                </button>

                {/* remove button */}
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
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex-1 pb-1 mt-36 sm:mt-0">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">{adminForm.name || 'Admin'}</h1>
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <Mail size={12} className="text-gray-400" />
                  {adminForm.email || 'No email set'}
                </p>
              </div>

              <div className="sm:pb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 shadow-xs">
                  <Shield size={12} />
                  {isSuperAdmin ? 'Super Admin' : 'School Admin'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── tab navigation ─── */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-xs">
          {visibleTabs.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key ? 'text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {activeTab === key && (
                <motion.span
                  layoutId="admin-settings-tab-pill"
                  className="absolute inset-0 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <TabIcon size={16} />
                {label}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── profile tab ─── */}
          {activeTab === 'profile' && (
            <SectionCard key="profile" icon={UserCircle} accent="amber" title="Personal Information" subtitle="Manage your account details and public profile">
              <Field label="Username" value={adminForm.username} readOnly placeholder="Enter username" icon={UserCircle} />
              <Field label="Full Name" value={adminForm.name} onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter full name" icon={Pencil} />
              <Field label="Email Address" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} placeholder="Enter email" icon={Mail} />
              <Field label="Campus Name" value={adminForm.campusName} onChange={(e) => setAdminForm((p) => ({ ...p, campusName: e.target.value }))} placeholder="Enter campus name" icon={Building2} />
              <Field label="Campus Type" value={adminForm.campusType} readOnly placeholder="e.g. Main, Branch" icon={GraduationCap} />
            </SectionCard>
          )}

          {/* ─── security tab ─── */}
          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden"
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-rose-50 text-rose-600 border-rose-100">
                  <Shield size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Change Password</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Ensure your account stays secure by using a strong password</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <PasswordField label="New Password" value={adminForm.newPassword} onChange={(e) => setAdminForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="Enter new password" />
                <PasswordField label="Confirm Password" value={adminForm.confirmPassword} onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm new password" />
              </div>
              {passwordError && (
                <div className="mx-6 mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-600">
                  <Shield size={14} />
                  {passwordError}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── school tab ─── */}
          {activeTab === 'school' && !isSuperAdmin && (
            <motion.div
              key="school"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* school details card */}
              <SectionCard icon={Building2} accent="indigo" title="School Information" subtitle="Core details about your school used across the platform">
                <Field label="School Name" value={schoolForm.name} onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter school name" icon={Building2} className="md:col-span-2" />
                <Field label="Address" value={schoolForm.address} onChange={(e) => setSchoolForm((p) => ({ ...p, address: e.target.value }))} placeholder="Enter address" icon={MapPin} className="md:col-span-2" />
                <Field label="Contact Email" value={schoolForm.contactEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, contactEmail: e.target.value }))} placeholder="Enter contact email" icon={Mail} />
                <Field label="Contact Phone" value={schoolForm.contactPhone} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPhone: e.target.value }))} placeholder="Enter contact phone" icon={Phone} />
                <Field label="Website URL" value={schoolForm.websiteURL} onChange={(e) => setSchoolForm((p) => ({ ...p, websiteURL: e.target.value }))} placeholder="https://..." icon={Globe} />
                <Field label="Official Email" value={schoolForm.officialEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, officialEmail: e.target.value }))} placeholder="Enter official email" icon={Mail} />
                <Field label="Contact Person" value={schoolForm.contactPersonName} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPersonName: e.target.value }))} placeholder="Enter contact person name" icon={UserCircle} />
                <Field label="Primary Campus" value={schoolForm.campusName} onChange={(e) => setSchoolForm((p) => ({ ...p, campusName: e.target.value }))} placeholder="Enter campus name" icon={Building2} />
              </SectionCard>

              {/* academic details card */}
              <SectionCard icon={GraduationCap} accent="indigo" title="Academic Configuration" subtitle="Board affiliation, structure, and capacity">
                <Field label="School Type" value={schoolForm.schoolType} onChange={(e) => setSchoolForm((p) => ({ ...p, schoolType: e.target.value }))} placeholder="Public / Private / ..." icon={GraduationCap} />
                <Field label="Board" value={schoolForm.board} onChange={(e) => setSchoolForm((p) => ({ ...p, board: e.target.value }))} placeholder="CBSE / ICSE / ..." icon={GraduationCap} />
                <Field label="Board (Other)" value={schoolForm.boardOther} onChange={(e) => setSchoolForm((p) => ({ ...p, boardOther: e.target.value }))} placeholder="If not listed above" />
                <Field label="Academic Year Structure" value={schoolForm.academicYearStructure} onChange={(e) => setSchoolForm((p) => ({ ...p, academicYearStructure: e.target.value }))} placeholder="Semester / Trimester / ..." />
                <Field label="Estimated Users" value={schoolForm.estimatedUsers} onChange={(e) => setSchoolForm((p) => ({ ...p, estimatedUsers: e.target.value }))} placeholder="Approx. number" icon={Users} />
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── sticky save bar ─── */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400 hidden sm:block">Changes are saved to your profile and school settings</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-500/25"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default AdminSettings;
