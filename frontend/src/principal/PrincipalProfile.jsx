import React, { useRef, useState } from 'react';
import { Camera, Loader2, Mail, School, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const getInitials = (value = '') => {
  if (!value.trim()) return 'PR';
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'P';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const PrincipalProfile = ({ principalDetails, onProfileUpdated }) => {
  const [name, setName] = useState(principalDetails?.name || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(principalDetails?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const hasAvatar = typeof avatarPreview === 'string' && avatarPreview.trim() !== '';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image must be smaller than 3MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      if (name.trim()) formData.append('name', name.trim());
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await fetch(`${API_BASE}/api/principal/auth/profile/update`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to update profile');
      }

      onProfileUpdated?.(data);
      setAvatarFile(null);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Unable to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Edit Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Update your photo and display name.</p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative">
            {hasAvatar ? (
              <img
                src={avatarPreview}
                alt="Profile"
                className="h-20 w-20 rounded-full border-2 border-slate-100 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-500 text-xl font-bold text-white shadow-sm">
                {getInitials(name || principalDetails?.name)}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm transition-colors hover:bg-slate-700"
              aria-label="Change profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{name || principalDetails?.name || 'Principal'}</p>
            <p className="truncate text-sm text-slate-500">Principal of <strong> {principalDetails?.schoolName || principalDetails?.title} </strong></p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Change photo
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="principal-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <User className="h-3.5 w-3.5" />
              Full Name
            </label>
            <input
              id="principal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              Email
            </label>
            <input
              type="email"
              value={principalDetails?.email || ''}
              disabled
              className="w-full cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <School className="h-3.5 w-3.5" />
              School
            </label>
            <input
              type="text"
              value={principalDetails?.schoolName || ''}
              disabled
              className="w-full cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PrincipalProfile;
