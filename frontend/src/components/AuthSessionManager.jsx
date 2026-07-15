import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_NOTICE, getTokenExpiryMs, logoutAndRedirect } from '../utils/authSession';

const POLL_INTERVAL_MS   = 30_000; // check every 30s (was 1s)
const WARN_BEFORE_MS     = 5 * 60 * 1000; // warn 5 min before expiry

const AuthSessionManager = () => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const runExpiryCheck = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const expiryMs = getTokenExpiryMs(token);
      if (!expiryMs || expiryMs <= Date.now()) {
        setShowWarning(false);
        logoutAndRedirect({
          navigate,
          notice: AUTH_NOTICE.EXPIRED,
          clearAllLocalStorage: true,
        });
        return;
      }

      const remaining = expiryMs - Date.now();
      if (remaining <= WARN_BEFORE_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    // Check immediately on mount and on tab becoming visible
    runExpiryCheck();
    const intervalId = window.setInterval(runExpiryCheck, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runExpiryCheck();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [navigate]);

  // Countdown ticker only when warning is visible (saves resources)
  useEffect(() => {
    if (!showWarning) return;
    const tick = setInterval(() => {
      const token = localStorage.getItem('token');
      const expiryMs = token ? getTokenExpiryMs(token) : null;
      if (!expiryMs) return;
      const remaining = expiryMs - Date.now();
      if (remaining <= 0) {
        setShowWarning(false);
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [showWarning]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleStayLoggedIn = async () => {
    setShowWarning(false);
  };

  const handleLogoutNow = () => {
    setShowWarning(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT, clearAllLocalStorage: true });
  };

  if (!showWarning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label="Session expiring soon"
      className="fixed bottom-5 right-5 z-9999 w-80 rounded-2xl border border-amber-200 bg-white shadow-2xl overflow-hidden"
    >
      {/* Amber top bar */}
      <div className="h-1 bg-linear-to-r from-amber-400 to-orange-400" />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Session expiring soon</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Your session will expire in{' '}
              <span className="font-bold text-amber-600">{formatTime(secondsLeft)}</span>.
              Save your work and stay logged in.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleLogoutNow}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs font-semibold transition-colors"
          >
            Logout now
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthSessionManager;
