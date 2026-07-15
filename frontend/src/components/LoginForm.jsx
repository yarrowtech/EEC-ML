import React, { useEffect, useState } from 'react';
import { ArrowRight, ChartNoAxesCombined, Eye, EyeOff, Lock, MessagesSquare, NotepadText, User, UserCheck2 } from 'lucide-react';
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
    { icon: <NotepadText size={16} />, label: 'Smart Assignments', desc: 'Manage homework & deadlines' },
    { icon: <UserCheck2 size={16} />, label: 'Live Attendance', desc: 'Real-time tracking & alerts' },
    { icon: <ChartNoAxesCombined size={16} />, label: 'Grade Reports', desc: 'Results & performance charts' },
    { icon: <MessagesSquare size={16} />, label: 'Messaging', desc: 'Student–teacher communication' },
  ];

  return (
    <div className="min-h-svh flex bg-gray-50">

      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[44%] relative flex-col justify-between overflow-hidden p-12 xl:p-16"
        style={{ background: `linear-gradient(160deg, ${colors.secondary} 0%, ${colors.primary} 100%)` }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        {/* Large decorative circle */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 border border-white/10 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-black/10 pointer-events-none" />
        {/* Small accent circles */}
        <div className="absolute top-1/2 right-8 w-24 h-24 rounded-full bg-yellow-300/10 border border-yellow-300/20 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center overflow-hidden">
            <img src={logo || '/logo_new.png'} alt="" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-base font-black text-white leading-none">{organizationName}</div>
            <div className="text-xs text-white/70 font-medium leading-none mt-0.5">Electronic Educare</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2 mt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
              <span className="text-xs font-semibold text-amber-100/90 tracking-wide">School Management Platform</span>
            </div>
            <h1 className="text-4xl xl:text-[2.75rem] font-black text-white leading-[1.1] tracking-tight">
              Empowering<br />
              <span className="text-yellow-300">Education,</span><br />
              Every Day
            </h1>
            <p className="mt-4 text-sm text-amber-100/60 leading-relaxed max-w-xs">
              A unified platform connecting students, teachers, and parents — built for modern schools.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-2.5 -mt-5 mb-2">
            {features.map(({ icon, label, desc }) => (
              <div
                key={label}
                className="bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl p-3.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center text-yellow-200 mb-2.5">
                  {icon}
                </div>
                <div className="text-xs font-bold text-white leading-none mb-1">{label}</div>
                <div className="text-[11px] text-amber-100/50 leading-snug">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 flex items-center justify-between pt-4">          <div className="flex gap-1.5 items-center">
            <div className="w-6 h-1.5 rounded-full bg-white/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 relative flex items-center justify-center min-h-svh px-5 py-6 sm:px-12 sm:py-10 bg-gray-50">

        {/* Background accent blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-orange-50/60 blur-2xl pointer-events-none" />

        {/* Curved divider */}
        <svg
          className="hidden lg:block absolute top-0 left-0 h-full z-10 pointer-events-none"
          style={{ width: 80, transform: 'translateX(-55%)' }}
          viewBox="0 0 80 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M40 0 C18 150 62 300 40 450 C18 600 62 750 40 900 L80 900 L80 0 Z" fill="#f9fafb" />
        </svg>

        <div className="relative z-10 w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-amber-500 flex items-center justify-center shadow-md">
              <img src={logo || '/logo_new.png'} alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-base font-black text-gray-900">{organizationName}</span>
          </div>

          {/* Card wrapper */}
          <div className="bg-transparent">

            {/* Heading */}
            <div className="mb-7">
              <div className="inline-flex items-center md:justify-start sm:justify-start justify-center gap-2 mb-4 w-full">
                <div className="h-0.5 w-5 bg-amber-400 rounded-full" />
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-[0.12em]">
                  {resetMode ? 'Password Reset' : 'Portal Access'}
                </span>
                <div className="h-0.5 w-5 bg-amber-400 rounded-full" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight text-center md:text-left">
                {resetMode ? 'Reset your password' : 'Welcome back!'}
              </h2>
              <p className="mt-1.5 text-sm text-gray-400 text-center md:text-left">
                {resetMode
                  ? 'Create a new secure password for your account'
                  : 'Sign in to access your dashboard'}
              </p>
            </div>

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

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* User ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-black uppercase tracking-wider">User ID</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
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
                    className={`bg-white w-full pl-12 pr-4 py-3.5 rounded-full border text-gray-900 placeholder-gray-300 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 ${
                      errors.username
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-gray-200 bg-gray-50 hover:border-amber-200 hover:bg-white'
                    }`}
                  />
                </div>
                {errors.username && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.username}</p>}
              </div>

              {/* Password (login mode) */}
              {!resetMode && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-black uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
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
                      className={`bg-white w-full pl-12 pr-12 py-3.5 rounded-full border text-gray-900 placeholder-gray-300 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 ${
                        errors.password
                          ? 'border-red-300 bg-red-50/30'
                          : 'border-gray-200 bg-gray-50 hover:border-amber-200 hover:bg-white'
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <input
                        type={showPass ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Create a strong password"
                        className={`w-full pl-12 pr-12 py-3.5 rounded-full border text-gray-900 placeholder-gray-300 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 ${
                          errors.newPassword
                            ? 'border-red-300 bg-red-50/30'
                            : 'border-gray-200 bg-gray-50 hover:border-amber-200 hover:bg-white'
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <input
                        type={showPass ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Re-enter your password"
                        className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border text-gray-900 placeholder-gray-300 text-sm font-medium transition-all focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 ${
                          errors.confirmPassword
                            ? 'border-red-300 bg-red-50/30'
                            : 'border-gray-200 bg-gray-50 hover:border-amber-200 hover:bg-white'
                        }`}
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 flex items-center gap-1 pl-1">⚠ {errors.confirmPassword}</p>}
                  </div>
                </>
              )}

              {/* Remember me */}
              {!resetMode && (
                <label htmlFor="remember" className="flex items-center gap-3 cursor-pointer select-none group pt-0.5">
                  <input type="checkbox" id="remember" name="rememberMe" aria-label="Remember me for 30 days" checked={formData.rememberMe} onChange={handleInputChange} className="sr-only peer" />
                  <div className="w-[18px] h-[18px] rounded-md border-2 border-gray-200 bg-white peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center shrink-0 shadow-sm">
                    {formData.rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors">
                    {formData.rememberMe && rememberMeDaysLeft < REMEMBER_ME_DAYS
                      ? `Remembered — ${rememberMeDaysLeft} day${rememberMeDaysLeft !== 1 ? 's' : ''} left`
                      : `Remember me for ${REMEMBER_ME_DAYS} days`}
                  </span>
                </label>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-1 py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg flex items-center justify-center gap-3 shadow-lg shadow-amber-200/60 hover:enabled:shadow-xl hover:enabled:shadow-amber-300/50 hover:enabled:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#d97706 0%,#f59e0b 60%,#fbbf24 100%)' }}
              >
                {isLoading ? (
                  <>
                    <span className="login-loader" role="status" aria-label="Loading" />
                    <span className="tracking-wide">{resetMode ? 'Resetting...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    {resetMode ? 'Reset & Sign In' : 'Sign In'}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Trust badges */}
          <div className="mt-5 flex items-center justify-center gap-5">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <span>Secure login</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span>Data protected</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-200" />
            <span className="text-xs text-gray-400">© {new Date().getFullYear()} EEC</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
