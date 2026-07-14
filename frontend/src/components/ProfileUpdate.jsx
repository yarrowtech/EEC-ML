import React, { useEffect, useState, useRef } from 'react';
import {
  User, Mail, AtSign, Lock, Camera, Check, AlertCircle,
  Phone, MapPin, Calendar, BookOpen, Shield, CreditCard
} from 'lucide-react';
import { getPoints } from '../utils/points';

const initialProfile = {
  name: 'Student',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  phone: '',
  address: '',
  dob: '',
  education: '',
  studentId: '',
  semester: '',
  profilePic: '',
  grade: '',
  section: '',
  roll: '',
  mobile: '',
};

const normalizeDateForInput = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  if (/^\d+$/.test(raw)) {
    const ts = Number(raw);
    if (Number.isFinite(ts)) {
      const date = new Date(raw.length <= 10 ? ts * 1000 : ts);
      if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }
  }

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const resolveDobValue = (payload = {}) =>
  payload?.dob
  || payload?.dateOfBirth
  || payload?.birthDate
  || payload?.nifStudent?.dob
  || payload?.student?.dob
  || payload?.student?.dateOfBirth
  || '';

const ProfileUpdate = () => {
  const [profile, setProfile] = useState(initialProfile);
  const [preview, setPreview] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('personal');
  const fileInputRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const swipeLockRef = useRef(0);
  const [points, setPoints] = useState(0);
  const mobileTabs = ['personal', 'account', 'security'];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');

        if (!token || userType !== 'Student') {
          setDataLoading(false);
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/student/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const resolvedDob = resolveDobValue(data);

          setProfile({
            name: data.name || '',
            email: data.email || '',
            username: data.username || '',
            password: '',
            confirmPassword: '',
            phone: data.mobile || '',
            address: data.address || '',
            dob: normalizeDateForInput(resolvedDob),
            education: data.grade || '',
            studentId: data.username || '',
            semester: data.nifStudent ? `${data.nifStudent.grade} - Section ${data.nifStudent.section}` : '',
            profilePic: data.profilePic || '',
            grade: data.grade || '',
            section: data.section || '',
            roll: data.roll || '',
            mobile: data.mobile || '',
          });

          if (data.profilePic) {
            setPreview(data.profilePic);
          }
        } else {
          console.error('Failed to fetch profile:', response.status);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    setPoints(getPoints());
    const onUpdate = (e) => setPoints(e?.detail?.total ?? getPoints());
    window.addEventListener('points:update', onUpdate);
    return () => window.removeEventListener('points:update', onUpdate);
  }, []);

  const validateField = (name, value, nextProfile = profile) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'name':
        if (value.length < 2) {
          newErrors[name] = 'Name must be at least 2 characters';
        } else {
          delete newErrors[name];
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[name] = 'Please enter a valid email address';
        } else {
          delete newErrors[name];
        }
        break;
      case 'username':
        if (value.length < 3) {
          newErrors[name] = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          newErrors[name] = 'Username can only contain letters, numbers, and underscores';
        } else {
          delete newErrors[name];
        }
        break;
      case 'password':
        if (value && value.length < 6) {
          newErrors[name] = 'Password must be at least 6 characters';
        } else {
          delete newErrors[name];
        }
        if (nextProfile.confirmPassword) {
          if (nextProfile.confirmPassword !== value) {
            newErrors.confirmPassword = 'Passwords do not match';
          } else {
            delete newErrors.confirmPassword;
          }
        }
        break;
      case 'confirmPassword':
        if (!nextProfile.password && value) {
          newErrors[name] = 'Enter new password first';
        } else if (nextProfile.password && !value) {
          newErrors[name] = 'Please confirm your new password';
        } else if (nextProfile.password && value !== nextProfile.password) {
          newErrors[name] = 'Passwords do not match';
        } else {
          delete newErrors[name];
        }
        break;
      case 'phone':
        const phoneRegex = /^\+?[\d\s()-]+$/;
        if (!phoneRegex.test(value)) {
          newErrors[name] = 'Please enter a valid phone number';
        } else {
          delete newErrors[name];
        }
        break;
      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextProfile = { ...profile, [name]: value };
    setProfile(nextProfile);
    if (errors.submit) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.submit;
        return next;
      });
    }
    validateField(name, value, nextProfile);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, profilePic: 'Image size must be less than 5MB' }));
        return;
      }

      setProfile((prev) => ({ ...prev, profilePic: file }));
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);

      if (errors.submit) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.submit;
          return newErrors;
        });
      }

      if (errors.profilePic) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.profilePic;
          return newErrors;
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    Object.keys(profile).forEach(key => {
      if (key !== 'profilePic') {
        validateField(key, profile[key]);
      }
    });

    if (profile.password && !profile.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Please confirm your new password' }));
      return;
    }

    if (profile.password && profile.confirmPassword !== profile.password) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return;
    }

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);
    setSuccess(false);
    if (errors.submit) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.submit;
        return next;
      });
    }

    try {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        throw new Error('Student login required');
      }

      const formData = new FormData();
      formData.append('name', profile.name || '');
      formData.append('email', profile.email || '');
      formData.append('username', profile.username || '');
      formData.append('mobile', profile.phone || profile.mobile || '');
      formData.append('address', profile.address || '');
      if (profile.dob && String(profile.dob).trim()) {
        formData.append('dob', profile.dob);
      }
      if (profile.password) {
        formData.append('password', profile.password);
      }
      if (profile.profilePic instanceof File) {
        formData.append('profilePic', profile.profilePic);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/student/profile/update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to update profile');
      }

      const updated = result?.student || {};
      const resolvedDob = resolveDobValue(updated);

      setProfile((prev) => ({
        ...prev,
        name: updated.name || prev.name,
        email: updated.email || prev.email,
        username: updated.username || prev.username,
        phone: updated.mobile || prev.phone,
        mobile: updated.mobile || prev.mobile,
        address: updated.address || prev.address,
        dob: normalizeDateForInput(resolvedDob) || prev.dob,
        grade: updated.grade || prev.grade,
        section: updated.section || prev.section,
        roll: updated.roll || prev.roll,
        profilePic: updated.profilePic || prev.profilePic,
        password: '',
        confirmPassword: '',
      }));

      if (updated.profilePic) {
        setPreview(updated.profilePic);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: error.message || 'Unable to update profile' }));
    } finally {
      setLoading(false);
    }
  };

  const nameParts = (profile?.name || '').trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S');
  const initialsLabel = initials.toUpperCase();

  /* ── Loading skeleton ── */
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 md:bg-linear-to-br md:from-yellow-50 md:via-amber-50 md:to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  /* ── Shared save button feedback ── */
  const SaveFeedback = ({ compact = false }) => (
    <>
      {success && (
        <div className={`mt-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`bg-green-500 rounded-full flex items-center justify-center shrink-0 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}>
            <Check className={`text-white ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          </div>
          <div>
            <p className={`text-green-800 font-semibold ${compact ? 'text-sm' : ''}`}>Profile updated successfully!</p>
            {!compact && <p className="text-green-700 text-sm">Your changes have been saved.</p>}
          </div>
        </div>
      )}
      {errors.submit && (
        <div className={`mt-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 ${compact ? 'p-3' : 'p-4'}`}>
          <div className={`bg-red-500 rounded-full flex items-center justify-center shrink-0 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}>
            <AlertCircle className={`text-white ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          </div>
          <p className={`text-red-800 font-semibold ${compact ? 'text-sm' : ''}`}>{errors.submit}</p>
        </div>
      )}
    </>
  );

  /* ── Shared mobile field renderer ── */
  const MobileField = ({ label, name, type, icon: Icon, placeholder, required: req, disabled: dis = false }) => (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type={type}
          name={name}
          value={profile[name]}
          onChange={!dis ? handleChange : undefined}
          readOnly={dis}
          disabled={dis}
          className={`w-full pl-10 pr-4 py-2.5 text-sm border rounded-xl outline-none transition-all bg-white ${
            dis
              ? 'border-gray-100 text-gray-400 cursor-not-allowed bg-gray-50'
              : errors[name]
                ? 'border-red-300 focus:border-red-400'
                : 'border-gray-200 focus:border-amber-400'
          }`}
          placeholder={placeholder}
        />
      </div>
      {errors[name] && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{errors[name]}
        </p>
      )}
    </div>
  );

  /* ── Desktop field helper ── */
  const DField = ({ label, name, type = 'text', icon: Icon, placeholder, disabled: dis, required: req }) => (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
        {label}{req && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${dis ? 'text-gray-300' : 'text-amber-400'}`}>
          <Icon className="w-full h-full" />
        </div>
        <input
          type={type}
          name={!dis ? name : undefined}
          value={dis ? (profile[name] || 'Not assigned') : profile[name]}
          onChange={!dis ? handleChange : undefined}
          readOnly={dis}
          disabled={dis}
          placeholder={placeholder}
          className={`w-full pl-11 pr-4 py-3 text-sm rounded-2xl border-2 outline-none font-medium transition-all duration-200 ${
            dis
              ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
              : errors[name]
              ? 'bg-white border-red-200 text-gray-800 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'
              : 'bg-white border-gray-100 text-gray-800 hover:border-amber-200 focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.15)]'
          }`}
        />
      </div>
      {errors[name] && (
        <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors[name]}
        </p>
      )}
    </div>
  );

  const handleMobileTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMobileTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMobileTouchEnd = (e) => {
    const now = Date.now();
    if (now - swipeLockRef.current < 220) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const endX = touchMoveRef.current.x || touch.clientX;
    const endY = touchMoveRef.current.y || touch.clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < 28 || absX <= absY * 1.15) return;

    const currentIndex = mobileTabs.indexOf(activeTab);
    if (currentIndex < 0) return;

    if (deltaX > 0 && currentIndex < mobileTabs.length - 1) {
      swipeLockRef.current = now;
      setActiveTab(mobileTabs[currentIndex + 1]);
      return;
    }
    if (deltaX < 0 && currentIndex > 0) {
      swipeLockRef.current = now;
      setActiveTab(mobileTabs[currentIndex - 1]);
    }
  };

  return (
    <div
      className="lg:min-h-screen bg-gray-50 lg:bg-linear-to-br lg:from-slate-50 lg:via-amber-50/30 lg:to-orange-50/50 overflow-x-hidden"
      style={{ scrollbarGutter: 'stable' }}
    >

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />

      {/* ══════════════════════════════════════════════════════
          MOBILE  (lg:hidden)
      ══════════════════════════════════════════════════════ */}
      <div
        className="lg:hidden overflow-x-hidden"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleMobileTouchStart}
        onTouchMove={handleMobileTouchMove}
        onTouchEnd={handleMobileTouchEnd}
      >
        {/* Hero */}
        <div className="relative overflow-hidden px-5 pt-6 pb-16"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 50%, #fbbf24 100%)' }}>

          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
          <div className="absolute top-16 -right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute bottom-4 right-8 w-12 h-12 rounded-full bg-white/10" />

          <div className="relative flex flex-col items-center">
            {/* Avatar with halo rings */}
            <div className="relative mb-3">
              <div className="w-[88px] h-[88px] rounded-full bg-white/20 flex items-center justify-center">
                <div className="w-[76px] h-[76px] rounded-full overflow-hidden border-2 border-white/80 shadow-2xl bg-amber-200">
                  {preview
                    ? <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-amber-700 text-2xl font-black">{initialsLabel}</div>
                  }
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-white text-amber-500 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all border-2 border-orange-100"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <h2 className="text-white font-black text-lg tracking-tight drop-shadow-sm">{profile.name || 'Student'}</h2>
            <p className="text-white/60 text-[11px] font-semibold mt-0.5 tracking-wide uppercase">Student Account</p>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {[
                profile.grade    && `Class ${profile.grade}`,
                profile.section  && `Sec ${profile.section}`,
                profile.roll     && `Roll ${profile.roll}`,
              ].filter(Boolean).map((b) => (
                <span key={b} className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/30 tracking-wide">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Floating card */}
        <div className="px-3 pb-2 overflow-x-hidden">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5">

            {/* Pill tab switcher */}
            <div className="px-3 pt-3 pb-0">
              <div className="flex bg-gray-100 rounded-2xl p-1">
                {[
                  { id: 'personal', label: 'Personal' },
                  { id: 'account',  label: 'Account'  },
                  { id: 'security', label: 'Security'  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all duration-200 tracking-wide ${
                      activeTab === tab.id
                        ? 'bg-white text-amber-600 shadow-sm ring-1 ring-amber-100'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 min-w-0">

              {/* Personal */}
              {activeTab === 'personal' && (
                <div className="space-y-3 min-w-0">
                  {/* Color-coded stat tiles */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Class',      value: profile.grade,      accent: '#3b82f6' },
                      { label: 'Section',    value: profile.section,    accent: '#8b5cf6' },
                      { label: 'Roll No.',   value: profile.roll,       accent: '#10b981' },
                      { label: 'Student ID', value: profile.studentId,  accent: '#f59e0b' },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex">
                        <div className="w-1 shrink-0" style={{ background: accent }} />
                        <div className="px-3 py-2.5 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: accent }}>{label}</p>
                          <p className="font-bold text-gray-800 text-sm truncate">{value || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.12em] bg-white px-2 py-0.5 rounded-full border border-gray-100">
                      Editable
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  <MobileField label="Email"         name="email"   type="email"    icon={Mail}     placeholder="Email address" required />
                  <MobileField label="Phone"         name="phone"   type="tel"      icon={Phone}    placeholder="Phone number" />
                  <MobileField label="Address"       name="address" type="text"     icon={MapPin}   placeholder="Your address" />
                  <MobileField label="Date of Birth" name="dob"     type="date"     icon={Calendar} placeholder="" disabled />
                </div>
              )}

              {/* Account */}
              {activeTab === 'account' && (
                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden flex items-stretch bg-linear-to-br from-amber-50 to-yellow-50 border border-amber-100">
                    <div className="w-1 bg-linear-to-b from-amber-400 to-yellow-400 shrink-0" />
                    <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 shadow-md">
                        <AtSign className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Username</p>
                        <p className="font-bold text-gray-900 text-sm truncate">{profile.username || '—'}</p>
                      </div>
                      <span className="text-[9px] font-black text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                        FIXED
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* Security */}
              {activeTab === 'security' && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs text-amber-800 font-semibold leading-tight">Leave blank to keep your current password unchanged</p>
                  </div>
                  <MobileField label="New Password"     name="password"        type="password" icon={Lock}   placeholder="New password" />
                  <MobileField label="Confirm Password" name="confirmPassword" type="password" icon={Shield} placeholder="Confirm new password" />
                </div>
              )}

              {/* Save */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || Object.keys(errors).length > 0}
                  className="relative w-full py-3.5 rounded-2xl font-black text-sm text-white overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all shadow-lg shadow-amber-300/40"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24 50%, #f97316)' }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                      : <>
                      {/* <Check className="w-4 h-4" /> */}
                      Save Changes</>
                    }
                  </span>
                </button>
                <SaveFeedback compact />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP  (hidden lg:block)
      ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <main className="max-w-6xl mx-auto px-6 lg:px-8 py-10">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden ring-1 ring-black/5">

            {/* Cover header */}
            <div className="relative overflow-hidden px-8 py-8"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 55%, #fbbf24 100%)' }}>
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
              <div className="absolute top-6 right-16 w-20 h-20 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-white/10" />

              <div className="relative flex items-end gap-6">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/60 shadow-2xl bg-amber-200">
                    {preview
                      ? <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-amber-700 text-3xl font-black">{initialsLabel}</div>
                    }
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-9 h-9 bg-white text-amber-500 rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-all border border-amber-100"
                    title="Change photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{profile.name || 'Student'}</h2>
                  <p className="text-white/70 text-sm font-semibold mt-0.5">Student Account</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      profile.studentId && `ID: ${profile.studentId}`,
                      profile.grade     && `Class ${profile.grade}`,
                      profile.section   && `Section ${profile.section}`,
                      profile.roll      && `Roll ${profile.roll}`,
                    ].filter(Boolean).map((b) => (
                      <span key={b} className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30 backdrop-blur-sm">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-[520px]">

              {/* Sidebar nav */}
              <div className="w-56 shrink-0 border-r border-gray-100 p-5 bg-gray-50/60">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 px-3">Settings</p>
                <nav className="space-y-1">
                  {[
                    { id: 'personal', label: 'Personal Info',  icon: User     },
                    { id: 'account',  label: 'Account',        icon: AtSign   },
                    { id: 'security', label: 'Security',       icon: Shield   },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                        activeTab === id
                          ? 'bg-amber-400 text-white shadow-md shadow-amber-200'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Mini stats */}
                <div className="mt-8 space-y-2">
                  <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] px-3 mb-3">Info</p>
                  {[
                    { icon: BookOpen, label: 'Class',   value: profile.grade   },
                    { icon: User,     label: 'Section', value: profile.section },
                    { icon: CreditCard, label: 'Roll',  value: profile.roll    },
                  ].map(({ icon: Icon, label, value }) => value ? (
                    <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-black bg-white border border-gray-100">
                      <Icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-black uppercase">{label}</p>
                        <p className="text-xs font-bold text-gray-700 truncate">{value}</p>
                      </div>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* Form content */}
              <div className="flex-1 p-8 overflow-hidden">

                {/* Personal */}
                {activeTab === 'personal' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-sm">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-900">Personal Information</h3>
                        <p className="text-xs text-gray-400 font-medium">Update your personal details below</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <DField label="Full Name"    name="name"      icon={User}       disabled placeholder="Full name" />
                      <DField label="Student ID"   name="studentId" icon={CreditCard} disabled placeholder="Student ID" />
                      <DField label="Email"        name="email"     icon={Mail}       type="email" placeholder="Email address" required />
                      <DField label="Class"        name="grade"     icon={BookOpen}   disabled placeholder="Class" />
                      <DField label="Section"      name="section"   icon={BookOpen}   disabled placeholder="Section" />
                      <DField label="Roll Number"  name="roll"      icon={CreditCard} disabled placeholder="Roll" />
                      <DField label="Phone"        name="phone"     icon={Phone}      type="tel"  placeholder="Phone number" />
                      <DField label="Date of Birth" name="dob"      icon={Calendar}   type="date" placeholder="" disabled />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
                        <input
                          type="text"
                          name="address"
                          value={profile.address}
                          onChange={handleChange}
                          placeholder="Your address"
                          className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl border-2 border-gray-100 outline-none font-medium text-gray-800 hover:border-amber-200 focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.15)] transition-all duration-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Account */}
                {activeTab === 'account' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-sm">
                        <AtSign className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-900">Account Settings</h3>
                        <p className="text-xs text-gray-400 font-medium">Manage your account preferences</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <DField label="Username" name="username" icon={AtSign} disabled placeholder="Username" />
                    </div>
                  </div>
                )}

                {/* Security */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-900">Security Settings</h3>
                        <p className="text-xs text-gray-400 font-medium">Change your password below</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50 border border-amber-200/60 p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-sm text-amber-800 font-semibold">Leave blank to keep your current password unchanged</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-w-md">
                      <DField label="New Password"     name="password"        icon={Lock}   type="password" placeholder="Enter new password" />
                      <DField label="Confirm Password" name="confirmPassword" icon={Shield} type="password" placeholder="Confirm new password" />
                    </div>
                  </div>
                )}

                {/* Desktop save */}
                <div className="pt-6 mt-6 border-t border-gray-100 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || Object.keys(errors).length > 0}
                    className="px-8 py-3 rounded-2xl font-black text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-amber-200/60"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24 50%, #f97316)' }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {/* <Check className="w-4 h-4" /> */}
                        Save Changes
                      </span>
                    )}
                  </button>
                  <div className="flex-1"><SaveFeedback /></div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center py-6 text-xs text-gray-400 font-medium">
          © 2025 Student Portal — All rights reserved to EEC
        </footer>
      </div>

    </div>
  );
};

export default ProfileUpdate;
