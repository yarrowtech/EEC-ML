import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Shield,
  Building2,
  UserCircle,
  Upload,
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
  ImageIcon,
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
  { key: 'profile', label: 'Profile', icon: UserCircle },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'school', label: 'School', icon: Building2 },
];

/* ─── reusable labelled input ─── */
const Field = ({ label, icon: Icon, readOnly, ...props }) => (
  <div className={props.className ?? ''}>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon size={15} className="text-gray-400" />
        </div>
      )}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm placeholder:text-gray-400 transition-all ${Icon ? 'pl-9' : ''} ${readOnly ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default' : 'bg-white border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400'}`}
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
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Lock size={15} className="text-gray-400" />
        </div>
        <input
          type={show ? 'text' : 'password'}
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-10 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
};

const AdminSettings = ({ setShowAdminHeader, onSettingsUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const avatarInputRef = useRef(null);
  const logoInputRef = useRef(null);

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
      <div className="min-h-full p-4 lg:p-8 bg-gray-50/60">
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
    <div className="min-h-full p-4 lg:p-8 bg-gray-50/60">
      <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">

        {/* ─── hero profile card ─── */}
        <div className="relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* gradient banner */}
          <div className="h-32 bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400" />

          <div className="px-6 pb-5">
            {/* avatar overlapping the banner */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-8">
              <div className="relative group shrink-0">
                {heroAvatarUrl ? (
                  <img
                    src={heroAvatarUrl}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center">
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
                  className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
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
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex-1 pb-1 mt-36 sm:mt-0">
                <h1 className="text-xl font-bold text-gray-900">{adminForm.name || 'Admin'}</h1>
                <p className="text-sm text-gray-500">{adminForm.email || 'No email set'}</p>
              </div>

              <div className="sm:pb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                  <Shield size={12} />
                  {isSuperAdmin ? 'Super Admin' : 'School Admin'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── tab navigation ─── */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {visibleTabs.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-yellow-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TabIcon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ─── profile tab ─── */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage your account details and public profile</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* <Field label="Admin ID" value={adminForm.id} readOnly /> */}
              <Field label="Username" value={adminForm.username} readOnly placeholder="Enter username" icon={UserCircle} />
              <Field label="Full Name" value={adminForm.name} onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter full name" />
              <Field label="Email Address" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} placeholder="Enter email" icon={Mail} />
              <Field label="Campus Name" value={adminForm.campusName} onChange={(e) => setAdminForm((p) => ({ ...p, campusName: e.target.value }))} placeholder="Enter campus name" icon={Building2} />
              <Field label="Campus Type" value={adminForm.campusType} readOnly placeholder="e.g. Main, Branch" icon={GraduationCap} />
            </div>
          </div>
        )}

        {/* ─── security tab ─── */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ensure your account stays secure by using a strong password</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* <PasswordField label="Current Password" value={adminForm.currentPassword} onChange={(e) => setAdminForm((p) => ({ ...p, currentPassword: e.target.value }))} placeholder="Enter current password" /> */}
              <PasswordField label="New Password" value={adminForm.newPassword} onChange={(e) => setAdminForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="Enter new password" />
              <PasswordField label="Confirm Password" value={adminForm.confirmPassword} onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm new password" />
            </div>
            {passwordError && (
              <div className="mx-6 mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                <Shield size={14} />
                {passwordError}
              </div>
            )}
          </div>
        )}

        {/* ─── school tab ─── */}
        {activeTab === 'school' && !isSuperAdmin && (
          <div className="space-y-6">
            {/* school logo card */}
            {/* <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">School Branding</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload your school logo for reports and portal display</p>
              </div>
              <div className="p-6">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleImageUpload(e.target.files?.[0], {
                      folder: 'school-logos',
                      setUploading: setUploadingLogo,
                      onSuccess: (url) => {
                        setSchoolForm((p) => ({ ...p, logo: url }));
                        onSettingsUpdated?.({ school: { logo: { secure_url: url } } });
                      },
                    });
                    e.target.value = '';
                  }}
                />

                {schoolForm.logo ? (
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      <img src={schoolForm.logo} alt="School Logo" className="w-28 h-28 rounded-2xl object-contain border border-gray-200 bg-gray-50 p-2" />
                      <button
                        type="button"
                        onClick={() => {
                          setSchoolForm((p) => ({ ...p, logo: '' }));
                          onSettingsUpdated?.({ school: { logo: '' } });
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Logo uploaded</p>
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-yellow-600 hover:text-yellow-700 font-medium"
                      >
                        {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploadingLogo ? 'Replacing...' : 'Replace logo'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-yellow-300 transition-all cursor-pointer group"
                  >
                    {uploadingLogo ? (
                      <Loader2 size={32} className="text-yellow-500 animate-spin" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <ImageIcon size={24} className="text-yellow-500" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">{uploadingLogo ? 'Uploading...' : 'Click to upload school logo'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WebP — Max 5 MB</p>
                    </div>
                  </button>
                )}
              </div>
            </div> */}

            {/* school details card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">School Information</h2>
                <p className="text-xs text-gray-400 mt-0.5">Core details about your school used across the platform</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* <Field label="School ID" value={schoolForm.id} readOnly /> */}
                <Field label="School Name" value={schoolForm.name} onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter school name" icon={Building2} className='md:col-span-2' />
                <Field label="Address" value={schoolForm.address} onChange={(e) => setSchoolForm((p) => ({ ...p, address: e.target.value }))} placeholder="Enter address" icon={MapPin} className="md:col-span-2" />
                <Field label="Contact Email" value={schoolForm.contactEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, contactEmail: e.target.value }))} placeholder="Enter contact email" icon={Mail} />
                <Field label="Contact Phone" value={schoolForm.contactPhone} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPhone: e.target.value }))} placeholder="Enter contact phone" icon={Phone} />
                <Field label="Website URL" value={schoolForm.websiteURL} onChange={(e) => setSchoolForm((p) => ({ ...p, websiteURL: e.target.value }))} placeholder="https://..." icon={Globe} />
                <Field label="Official Email" value={schoolForm.officialEmail} onChange={(e) => setSchoolForm((p) => ({ ...p, officialEmail: e.target.value }))} placeholder="Enter official email" icon={Mail} />
                <Field label="Contact Person" value={schoolForm.contactPersonName} onChange={(e) => setSchoolForm((p) => ({ ...p, contactPersonName: e.target.value }))} placeholder="Enter contact person name" icon={UserCircle} />
                <Field label="Primary Campus" value={schoolForm.campusName} onChange={(e) => setSchoolForm((p) => ({ ...p, campusName: e.target.value }))} placeholder="Enter campus name" icon={Building2} />
              </div>
            </div>

            {/* academic details card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Academic Configuration</h2>
                <p className="text-xs text-gray-400 mt-0.5">Board affiliation, structure, and capacity</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="School Type" value={schoolForm.schoolType} onChange={(e) => setSchoolForm((p) => ({ ...p, schoolType: e.target.value }))} placeholder="Public / Private / ..." icon={GraduationCap} />
                <Field label="Board" value={schoolForm.board} onChange={(e) => setSchoolForm((p) => ({ ...p, board: e.target.value }))} placeholder="CBSE / ICSE / ..." icon={GraduationCap} />
                <Field label="Board (Other)" value={schoolForm.boardOther} onChange={(e) => setSchoolForm((p) => ({ ...p, boardOther: e.target.value }))} placeholder="If not listed above" />
                <Field label="Academic Year Structure" value={schoolForm.academicYearStructure} onChange={(e) => setSchoolForm((p) => ({ ...p, academicYearStructure: e.target.value }))} placeholder="Semester / Trimester / ..." />
                <Field label="Estimated Users" value={schoolForm.estimatedUsers} onChange={(e) => setSchoolForm((p) => ({ ...p, estimatedUsers: e.target.value }))} placeholder="Approx. number" icon={Users} />
              </div>
            </div>
          </div>
        )}

        {/* ─── sticky save bar ─── */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400 hidden sm:block">Changes are saved to your profile and school settings</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-yellow-500 text-white text-sm font-semibold rounded-xl hover:bg-yellow-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-yellow-500/20"
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
