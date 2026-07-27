import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  ArrowRight, BarChart3, BookOpen, Calendar, ChevronDown, Eye, EyeOff,
  Globe, GraduationCap, Headphones, Lock, MessagesSquare, ShieldCheck, User, Users, Wallet,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AUTH_NOTICE, consumeAuthNotice } from '../utils/authSession';
import { useTenant } from '../context/TenantContext';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const REMEMBER_ME_KEY   = 'eec_remember_me';
const REMEMBER_ME_DAYS  = 30;

// Password strength scorer
const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[!@#$%^&*()_\-+=[\]{};:'"\\|,.<>/?`~]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-400'   };
  if (score <= 3) return { score, label: 'Fair',   color: 'bg-amber-400' };
  if (score === 4) return { score, label: 'Good',   color: 'bg-blue-400'  };
  return              { score, label: 'Strong', color: 'bg-emerald-500' };
};

// Floating glass icon badge used around the hero illustration
const FloatingIcon = ({ icon, className, delay = 0 }) => (
  <Motion.div
    className={`absolute flex items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-lg text-white ${className}`}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: [0, -8, 0] }}
    transition={{
      opacity: { duration: 0.6, delay },
      y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay },
    }}
  >
    {icon}
  </Motion.div>
);

const LoginForm = () => {
  const { name: organizationName, logo, colors, refreshBranding } = useTenant();
  const [showPass, setShowPass] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetUserType, setResetUserType] = useState('');
  const [resetTenantToken, setResetTenantToken] = useState('');
  const [rememberMeDaysLeft, setRememberMeDaysLeft] = useState(REMEMBER_ME_DAYS);
  const [formData, setFormData] = useState(() => {
    // Restore saved username if Remember Me was set
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_ME_KEY) || 'null');
      if (saved?.expiry && saved.expiry > Date.now()) {
        return { username: saved.username || '', password: '', newPassword: '', confirmPassword: '', rememberMe: true };
      }
    } catch { /* ignore */ }
    return { username: '', password: '', newPassword: '', confirmPassword: '', rememberMe: false };
  });
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const noticeFromState = location.state?.authNotice;
    const storedNotice = consumeAuthNotice();
    const notice = noticeFromState || storedNotice;
    if (!notice) return;

    if (notice === AUTH_NOTICE.EXPIRED) {
      toast.error('Session time expired. Login again.');
      return;
    }
    if (notice === AUTH_NOTICE.LOGGED_OUT) {
      toast.success('Logged out successfully');
    }
  }, [location.state]);

  // Auto-focus username field on mount (Fix #11)
  useEffect(() => {
    const el = document.getElementById('login-username');
    if (el) el.focus();
  }, []);

  // Calculate remaining Remember Me days (Fix #12)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_ME_KEY) || 'null');
      if (saved?.expiry && saved.expiry > Date.now()) {
        const daysLeft = Math.ceil((saved.expiry - Date.now()) / (1000 * 60 * 60 * 24));
        setRememberMeDaysLeft(Math.min(daysLeft, REMEMBER_ME_DAYS));
      }
    } catch { /* ignore */ }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear field error as user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (loginError) setLoginError('');
    if (resetNotice) setResetNotice('');
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    // Validate on blur — works in both login and reset mode (Fix #8)
    if (name === 'username' && !value.trim()) {
      setErrors(prev => ({ ...prev, username: 'User ID is required' }));
    }
    if (name === 'password') {
      if (!value) {
        setErrors(prev => ({ ...prev, password: 'Password is required' }));
      } else if (!resetMode && value.length < 6) {
        setErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
      }
    }
    if (name === 'newPassword') {
      if (!value) {
        setErrors(prev => ({ ...prev, newPassword: 'New password is required' }));
      } else if (value.length < 6) {
        setErrors(prev => ({ ...prev, newPassword: 'Password must be at least 6 characters' }));
      }
    }
    if (name === 'confirmPassword') {
      if (!value) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
      } else if (value !== formData.newPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'User ID is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateReset = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[a-z]/.test(formData.newPassword)
      || !/[A-Z]/.test(formData.newPassword)
      || !/[0-9]/.test(formData.newPassword)
      || !/[!@#$%^&*()_\-+=[\]{};:'"\\|,.<>/?`~]/.test(formData.newPassword)) {
      newErrors.newPassword = 'Include uppercase, lowercase, a number, and a special character';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sanitizedUsername = formData.username.trim();
    if (resetMode) {
      if (!validateReset()) return;
    } else if (!validateForm()) {
      return;
    }
    setIsLoading(true);
    setLoginError('');
    setResetNotice('');
    try {
      if (resetMode) {

        const resetConfigByType = {
          Admin: {
            resetEndpoint: '/api/admin/auth/reset-first-password',
            loginEndpoint: '/api/admin/auth/login',
            redirect: '/admin/dashboard',
          },
          Teacher: {
            resetEndpoint: '/api/teacher/auth/reset-first-password',
            loginEndpoint: '/api/teacher/auth/login',
            redirect: '/teacher/dashboard',
          },
          Student: {
            resetEndpoint: '/api/student/auth/reset-first-password',
            loginEndpoint: '/api/student/auth/login',
            redirect: '/dashboard',
          },
          Parent: {
            resetEndpoint: '/api/parent/auth/reset-first-password',
            loginEndpoint: '/api/parent/auth/login',
            redirect: '/parents',
          },
          Principal: {
            resetEndpoint: '/api/principal/auth/reset-first-password',
            loginEndpoint: '/api/principal/auth/login',
            redirect: '/principal',
          },
        };
        const resetConfig = resetConfigByType[resetUserType];
        if (!resetConfig) {
          throw new Error('Unsupported password reset flow');
        }

        const resetRes = await fetch(`${API_BASE}${resetConfig.resetEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resetTenantToken ? { Authorization: `Bearer ${resetTenantToken}` } : {}),
          },
          body: JSON.stringify({
            username: sanitizedUsername,
            newPassword: formData.newPassword
          })
        });

        if (!resetRes.ok) {
          const data = await resetRes.json().catch(() => ({}));
          throw new Error(data?.error || 'Unable to reset password');
        }

        const loginRes = await fetch(`${API_BASE}${resetConfig.loginEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resetTenantToken ? { Authorization: `Bearer ${resetTenantToken}` } : {}),
          },
          body: JSON.stringify({
            username: sanitizedUsername,
            password: formData.newPassword
          })
        });

        if (!loginRes.ok) {
          throw new Error('Login failed after reset. Please sign in again.');
        }

        const loginData = await loginRes.json();
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('userType', resetUserType);
        await refreshBranding();
        toast.success('Login successful');
        navigate(resetConfig.redirect);
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: sanitizedUsername,
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Invalid credentials. Please check your User ID and password.');
      }

      if (data?.requiresPasswordReset) {
        setResetMode(true);
        setResetUserType(data.userType);
        setResetTenantToken(data.resetTenantToken || '');
        setFormData((prev) => ({
          ...prev,
          username: data.username || prev.username,
          password: '',
          newPassword: '',
          confirmPassword: ''
        }));
        setResetNotice('First login detected. Please reset your password.');
        setIsLoading(false); // Fix #1 — must unblock the form for reset
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userType', data.userType);
      await refreshBranding();

      // Persist Remember Me — store username + expiry
      if (formData.rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({
          username: sanitizedUsername,
          expiry: Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000,
        }));
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      const redirectByUserType = {
        Student: '/student',
        Teacher: '/teacher/dashboard',
        Parent: '/parent',
        Principal: '/principal',
        Admin: '/admin/dashboard',
        SuperAdmin: '/super-admin/overview',
      };

      const targetPath = redirectByUserType[data.userType];
      if (!targetPath) {
        // Fix #3 — unknown userType: show error, reset spinner
        setLoginError('Login succeeded but your account type is not recognised. Please contact support.');
      } else {
        // Fix #7 — toast fires after navigate so it's visible on the destination page
        navigate(targetPath);
        toast.success('Login successful');
        return; // keep spinner alive during navigation
      }
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
    setIsLoading(false);
  };

  const features = [
    { icon: <Users size={18} />, label: 'Smart Attendance', desc: 'Real-time attendance tracking made easy', bg: 'bg-blue-500' },
    { icon: <BookOpen size={18} />, label: 'Homework', desc: 'Create, assign and manage homework', bg: 'bg-orange-500' },
    { icon: <Wallet size={18} />, label: 'Fee Management', desc: 'Secure and hassle-free fee collection', bg: 'bg-emerald-500' },
    { icon: <BarChart3 size={18} />, label: 'Analytics', desc: 'Powerful reports for better decisions', bg: 'bg-purple-500' },
  ];

  return (
    <div className="min-h-svh lg:h-svh flex flex-col lg:flex-row bg-[#fffaf2] overflow-x-hidden lg:overflow-hidden">

      {/* ══════════════════════════ LEFT / HERO PANEL ══════════════════════════ */}
      <div
        className="hidden lg:flex relative w-full lg:w-[55%] flex-col overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:px-10 lg:py-6 xl:px-14 xl:py-8 lg:h-full"
        style={{
          backgroundImage: 'url(/login-blue.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: `linear-gradient(160deg, ${colors.secondary || '#1E3A8A'} 0%, ${colors.primary || '#2563EB'} 55%, #3B82F6 100%), url(/login-blue.png)`,
          backgroundBlendMode: 'screen',
        }}
      >
        {/* Fine grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.15]"
          // style={{
          //   backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)',
          //   backgroundSize: '36px 36px',
          // }}
        />
        {/* Soft glowing blobs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 border border-white/10 pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-black/10 pointer-events-none" />
        <div className="absolute top-1/3 right-6 w-28 h-28 rounded-full bg-blue-400/10 border border-blue-300/20 blur-sm pointer-events-none" />

        {/* Logo */}
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center overflow-hidden shrink-0">
            <img src={logo || '/logo_new.png'} loading='lazy' alt="" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-lg font-black text-white leading-none">EEC</div>
            <div className="text-xs text-white/60 font-medium leading-none mt-1">{organizationName}</div>
          </div>
        </Motion.div>

        {/* Badge pill */}
        <Motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 mt-6 lg:mt-4 w-fit"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
          <span className="text-xs font-semibold text-white/85 tracking-wide">School Management ERP Platform</span>
        </Motion.div>

        {/* Heading + description */}
        <Motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative z-10 mt-6 lg:mt-4"
        >
          {/* <h1 className="text-4xl sm:text-5xl lg:text-3xl xl:text-4xl 2xl:text-[3.25rem] font-black text-white leading-[1.08] tracking-tight">
            Empowering<br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-clip-text text-transparent">
              Education,
            </span><br />
            Every Day
          </h1> */}
          <p className="mt-4 lg:mt-2 text-sm sm:text-base lg:text-sm text-blue-100/70 leading-relaxed max-w-[420px]">
            A unified platform connecting students, teachers, parents and schools for smarter and better education.
          </p>
        </Motion.div>

        {/* Hero illustration + floating icons */}
        <div className="relative z-10 flex-1 flex items-end justify-center min-h-[240px] sm:min-h-[340px] lg:min-h-0 mt-6 lg:mt-2">
          <FloatingIcon
            icon={<GraduationCap size={20} />}
            className="w-11 h-11 sm:w-14 sm:h-14 top-[3%] left-[18%] sm:left-[22%]"
            delay={0.1}
          />
          <FloatingIcon
            icon={<BarChart3 size={20} />}
            className="w-11 h-11 sm:w-14 sm:h-14 -top-[6%] right-[12%] sm:right-[16%] text-amber-200"
            delay={0.4}
          />
          <FloatingIcon
            icon={<Wallet size={18} />}
            className="w-10 h-10 sm:w-12 sm:h-12 top-[32%] left-[4%] sm:left-[8%] text-emerald-200"
            delay={0.7}
          />
          <FloatingIcon
            icon={<MessagesSquare size={18} />}
            className="w-10 h-10 sm:w-12 sm:h-12 top-[28%] right-[2%] sm:right-[6%] text-blue-200"
            delay={1.0}
          />
          <FloatingIcon
            icon={<Calendar size={18} />}
            className="w-10 h-10 sm:w-12 sm:h-12 bottom-[8%] right-[16%] sm:right-[20%] text-purple-200"
            delay={1.3}
          />

          <Motion.img
            src="/login-left-image.png"
            alt="Students, teachers and parents using Electronic Educare"
            className="relative w-[72%] sm:w-[62%] lg:w-auto lg:h-[26vh] lg:max-h-[100vh] xl:h-[100vh] xl:max-h-[50vh] max-w-full object-contain select-none pointer-events-none top-12"
            animate={{ y: [0, -12, 0] }}
            loading='lazy'
            // transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Feature card */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 mt-6 lg:mt-4 rounded-[24px] bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl px-4 py-5 sm:px-6 sm:py-6 lg:px-5 lg:py-4 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-0 shrink-0 lg:divide-x lg:divide-white/15"
        >
          {features.map(({ icon, label, desc, bg }) => (
            <div key={label} className="flex flex-col items-center gap-2 lg:gap-1.5 lg:px-3">
              <div className={`w-9 h-9 lg:w-8 lg:h-8 rounded-xl ${bg} flex items-center justify-center text-white shadow-md`}>
                {icon}
              </div>
              <div className="text-sm lg:text-xs font-bold text-white leading-tight">{label}</div>
              <div className="text-center text-[11px] lg:text-[10px] text-blue-100/60 leading-snug">{desc}</div>
            </div>
          ))}
        </Motion.div>
      </div>

      {/* ══════════════════════════ RIGHT / FORM PANEL ══════════════════════════ */}
      <div className="relative flex-1 flex flex-col items-center justify-start lg:justify-center px-5 py-10 sm:px-10 sm:py-12 lg:px-10 lg:py-6 xl:px-16 bg-gradient-to-b from-[#fffaf3] via-[#fffaf3] to-[#fff3e2] lg:h-full lg:overflow-hidden lg:-ml-8 lg:rounded-tl-[40px] lg:rounded-bl-[40px] lg:z-10">

        {/* Background accent glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-orange-50/60 blur-2xl pointer-events-none" />

        {/* Language selector */}
        {/* <div className="absolute top-5 right-5 sm:top-8 sm:right-8 z-10 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-3.5 pr-3 py-2 shadow-sm text-xs font-semibold text-gray-600 select-none">
          <Globe size={14} className="text-gray-400" />
          <span>English</span>
          <ChevronDown size={13} className="text-gray-400" />
        </div> */}

        <div className="relative z-10 w-full max-w-[440px] mx-auto">

          {/* Heading */}
          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 lg:mb-4 mt-10 sm:mt-0 text-center lg:text-left"
          >
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-3 lg:mb-2">
              <div className="h-0.5 w-5 bg-amber-400 rounded-full" />
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-[0.14em]">
                {resetMode ? 'Password Reset' : 'Portal Access'}
              </span>
            </div>
            <h2 className="text-3xl sm:text-[2.25rem] lg:text-3xl font-black text-gray-900 leading-tight">
              {resetMode ? 'Reset your password' : 'Welcome back!'}
            </h2>
            <p className="mt-2 lg:mt-1 text-sm text-gray-400">
              {resetMode
                ? 'Create a new secure password for your account'
                : `Sign in to continue to ${organizationName || 'Electronic Educare'}.`}
            </p>
          </Motion.div>

          {/* Login card */}
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 sm:p-10 lg:p-7"
          >
            {/* Notices */}
            {resetNotice && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <svg className="mt-0.5 w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z"/>
                </svg>
                <span>{resetNotice}</span>
              </div>
            )}
            {loginError && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                <svg className="mt-0.5 w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z"/>
                </svg>
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-3">

              {/* User ID */}
              <div className="space-y-1.5">
                <label htmlFor="login-username" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">User ID</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    name="username"
                    aria-label="User ID"
                    value={formData.username}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Enter your User ID"
                    className={`bg-gray-50 w-full h-14 lg:h-12 pl-14 pr-4 rounded-full border text-gray-900 placeholder-gray-400 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:bg-white ${
                      errors.username
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-gray-200 hover:border-amber-200'
                    }`}
                  />
                </div>
                {errors.username && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.username}</p>}
              </div>

              {/* Password (login mode) */}
              {!resetMode && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      aria-label="Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      placeholder="Enter your password"
                      className={`bg-gray-50 w-full h-14 lg:h-12 pl-14 pr-12 rounded-full border text-gray-900 placeholder-gray-400 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:bg-white ${
                        errors.password
                          ? 'border-red-300 bg-red-50/30'
                          : 'border-gray-200 hover:border-amber-200'
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.password}</p>}
                </div>
              )}

              {/* Reset fields */}
              {resetMode && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <input
                        type={showPass ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Create a strong password"
                        className={`bg-gray-50 w-full h-14 lg:h-12 pl-14 pr-12 rounded-full border text-gray-900 placeholder-gray-400 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:bg-white ${
                          errors.newPassword
                            ? 'border-red-300 bg-red-50/30'
                            : 'border-gray-200 hover:border-amber-200'
                        }`}
                      />
                      <button
                        type="button"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Password strength meter */}
                    {formData.newPassword && (() => {
                      const { score, label, color } = getPasswordStrength(formData.newPassword);
                      return (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((i) => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-gray-100'}`}
                              />
                            ))}
                          </div>
                          <p className={`text-[11px] font-semibold pl-0.5 ${
                            score <= 1 ? 'text-red-500' : score <= 3 ? 'text-amber-500' : score === 4 ? 'text-blue-500' : 'text-emerald-600'
                          }`}>{label} password</p>
                        </div>
                      );
                    })()}
                    {errors.newPassword && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.newPassword}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <input
                        type={showPass ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Re-enter your password"
                        className={`bg-gray-50 w-full h-14 lg:h-12 pl-14 pr-4 rounded-full border text-gray-900 placeholder-gray-400 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:bg-white ${
                          errors.confirmPassword
                            ? 'border-red-300 bg-red-50/30'
                            : 'border-gray-200 hover:border-amber-200'
                        }`}
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.confirmPassword}</p>}
                  </div>
                </>
              )}

              {/* Remember me + Forgot password */}
              {!resetMode && (
                <div className="flex items-center justify-between pt-0.5">
                  <label htmlFor="remember" className="flex items-center gap-3 cursor-pointer select-none group">
                    <input type="checkbox" id="remember" name="rememberMe" aria-label="Remember me for 30 days" checked={formData.rememberMe} onChange={handleInputChange} className="sr-only peer" />
                    <div className="w-[18px] h-[18px] rounded-md border-2 border-gray-300 bg-white peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center shrink-0 shadow-sm">
                      {formData.rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                      {formData.rememberMe && rememberMeDaysLeft < REMEMBER_ME_DAYS
                        ? `Remembered — ${rememberMeDaysLeft} day${rememberMeDaysLeft !== 1 ? 's' : ''} left`
                        : 'Remember me'}
                    </span>
                  </label>
                  {/* <span className="text-sm font-semibold text-amber-600 hover:text-amber-700 cursor-default select-none">
                    Forgot Password?
                  </span> */}
                </div>
              )}

              {/* Submit */}
              <Motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.01, y: isLoading ? 0 : -2 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className="w-full h-14 lg:h-12 mt-1 rounded-full font-bold text-sm text-white transition-shadow disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-lg shadow-amber-300/40 hover:enabled:shadow-xl hover:enabled:shadow-amber-400/50"
                style={{ background: 'linear-gradient(135deg,#d97706 0%,#f59e0b 55%,#fb923c 100%)' }}
              >
                {isLoading ? (
                  <>
                    <span className="login-loader" role="status" aria-label="Loading" />
                    <span className="tracking-wide">{resetMode ? 'Resetting...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    {/* <ArrowRight size={17} /> */}
                    {resetMode ? 'Reset & Sign In' : 'Sign In'}
                  </>
                )}
              </Motion.button>
            </form>
          </Motion.div>

          {/* Trust badges */}
          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-5 lg:mt-3 bg-white/70 backdrop-blur-md border border-gray-100 rounded-2xl px-4 py-3.5 lg:py-2.5 flex items-center justify-around gap-2 shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secure Login</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-200 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Data Protected</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-200 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Headphones className="w-3.5 h-3.5 text-blue-500" />
              <span>24/7 Support</span>
            </div>
          </Motion.div>

          {/* Footer */}
          <p className="mt-6 lg:mt-3 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} <span className="font-semibold text-gray-500">Electronic Educare</span>. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
