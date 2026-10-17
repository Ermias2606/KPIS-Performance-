import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Role } from '../types';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';

const getRoleBadgeStyle = (role: Role) => {
  switch (role) {
    case Role.SUPER_ADMIN:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case Role.ADMIN:
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case Role.MANAGER:
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case Role.OFFICER:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const LoginPage: React.FC = () => {
  const [authTab, setAuthTab] = useState<'credentials' | 'pin'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgotten Password by Email state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [dispatchedCode, setDispatchedCode] = useState<string | null>(null);
  const [recoveryTargetUser, setRecoveryTargetUser] = useState<{
    name?: string;
    username?: string;
  } | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const {
    login,
    loginWithCredentials,
    users,
    loginWithGoogle,
    isGoogleLoading,
    isOnline,
    requestPasswordRecoveryByEmail,
    completePasswordRecoveryByEmail,
  } = useContext(AuthContext);
  const { activeOrganization } = useData();
  const navigate = useNavigate();

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await loginWithCredentials(identifier, password);
      if (!result.user) {
        setError(result.error || 'Invalid username or password.');
      } else {
        navigate('/dashboard');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinLogin = (e?: React.FormEvent, pinToUse?: string) => {
    if (e) e.preventDefault();
    setError('');
    const targetPin = pinToUse !== undefined ? pinToUse : pin;
    if (!targetPin) {
      setError('Please enter your PIN.');
      return;
    }
    const user = login(targetPin);
    if (!user) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    } else {
      navigate('/dashboard');
    }
  };

  const handleQuickSelect = (userPin: string) => {
    setPin(userPin);
    handlePinLogin(undefined, userPin);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in was cancelled or failed.');
    }
  };

  const handleRequestEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    const res = await requestPasswordRecoveryByEmail(recoveryEmail);
    if (!res.success) {
      setRecoveryError(res.message);
      return;
    }
    setDispatchedCode(res.verificationCode || null);
    setRecoveryTargetUser({ name: res.employeeName, username: res.username });
    setRecoverySuccess(res.message);
    setRecoveryStep('verify');
  };

  const handleCompleteEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    if (newResetPassword !== confirmResetPassword) {
      setRecoveryError('New password and confirmation password do not match.');
      return;
    }
    const res = await completePasswordRecoveryByEmail(
      recoveryEmail,
      recoveryCodeInput,
      newResetPassword
    );
    if (!res.success) {
      setRecoveryError(res.message);
      return;
    }
    setRecoverySuccess(res.message);
    setTimeout(() => {
      setShowForgotModal(false);
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/50 p-4">
      <div className="w-full max-w-md p-7 space-y-5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-orange-200/70">
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-orange-700 hover:text-orange-800 font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <span>&larr;</span>
            <span>Back to Landing Portal</span>
          </button>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          {activeOrganization?.logoUrl ? (
            <img
              src={activeOrganization.logoUrl}
              alt={activeOrganization.name}
              className="w-14 h-14 rounded-2xl object-cover border border-orange-200 mb-2.5 shadow-md"
            />
          ) : (
            <div className="bg-gradient-to-br from-orange-600 to-amber-600 p-3 rounded-2xl mb-2.5 shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3m6-6h3m-21 0h3m12 0a6 6 0 11-12 0 6 6 0 0112 0z"
                />
              </svg>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">Performance Tracker</h1>
          <p className="text-xs font-semibold text-orange-700 mt-0.5">
            {activeOrganization?.name || 'Multi-Purpose Organization'} ·{' '}
            {activeOrganization?.sector || 'Enterprise BSC'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Authenticated Role-Based Access & Balanced Scorecard Portal
          </p>
        </div>

        {/* Authentication Protocol Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setAuthTab('credentials');
              setError('');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              authTab === 'credentials'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Username & Password
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('pin');
              setError('');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              authTab === 'pin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Quick PIN Access
          </button>
        </div>

        {authTab === 'credentials' ? (
          <form onSubmit={handleCredentialsLogin} className="space-y-3.5">
            <div>
              <label
                htmlFor="identifier"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Username, Email, or Employee Code
              </label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. superadmin, ermiyas.g, or EMP-002"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setRecoveryStep('request');
                    setRecoveryError('');
                    setRecoverySuccess('');
                  }}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                >
                  Forgot Password? (Email Reset)
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password (default: Password@123)"
                  className="w-full px-3.5 py-2.5 pr-16 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl shadow-md font-bold text-sm text-white bg-sky-600 hover:bg-sky-700 transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In with Credentials'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePinLogin} className="space-y-3.5">
            <div>
              <label
                htmlFor="pin"
                className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5"
              >
                Enter 4-Digit Employee PIN
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                autoComplete="current-password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 1234, 8888, 7777, 4444"
                className="w-full px-4 py-2.5 text-center text-lg tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition font-mono"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl shadow-md font-bold text-sm text-white bg-sky-600 hover:bg-sky-700 transition cursor-pointer"
            >
              Sign In with PIN
            </button>
          </form>
        )}

        {/* Google Sign-In with Firebase Auth */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 font-semibold text-xs text-slate-700 shadow-2xs flex items-center justify-center space-x-2.5 transition cursor-pointer disabled:opacity-70"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google SSO'}</span>
          </button>
        </div>

        {/* Hierarchy Role Quick Select Switcher */}
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              System Hierarchy Demo Accounts
            </p>
            <span className="text-[10px] text-slate-400 font-mono">Pwd: Password@123</span>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickSelect(u.pin)}
                className="flex items-center justify-between px-3 py-2 text-left rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/60 transition text-xs group cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 group-hover:text-sky-700 truncate">
                      {u.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded border shrink-0 ${getRoleBadgeStyle(
                        u.role
                      )}`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    <span className="font-mono text-slate-600">@{u.username || 'user'}</span> ·{' '}
                    {u.positionTitle || u.role}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-sky-600 shrink-0 group-hover:underline">
                  Sign In &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1 flex justify-center">
          <PWAInstallButton variant="compact" />
        </div>
      </div>

      {/* =================================================================== */}
      {/* FORGOTTEN PASSWORD EMAIL RECOVERY MODAL */}
      {/* =================================================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Forgotten Password Email Recovery
                </h3>
                <p className="text-xs text-slate-500">
                  Reset your login password using your registered organization email
                </p>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {recoveryStep === 'request' ? (
              <form onSubmit={handleRequestEmailCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Registered Employee Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="e.g. ermiyas.g@org-tracker.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Quick Fill Registered Emails for Testing */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    Click a Registered Account Email to Auto-Fill:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {users
                      .filter((u) => u.email)
                      .map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => setRecoveryEmail(u.email!)}
                          className="px-2 py-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-[11px] font-mono text-slate-700 cursor-pointer"
                        >
                          {u.email}
                        </button>
                      ))}
                  </div>
                </div>

                {recoveryError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
                    {recoveryError}
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Send Verification Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompleteEmailReset} className="space-y-3.5">
                {dispatchedCode && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">
                        Email Dispatch Verified ({recoveryEmail})
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">
                        Instant Preview Inbox
                      </span>
                    </div>
                    <p className="text-emerald-800">
                      Account: <strong>{recoveryTargetUser?.name}</strong> (Username:{' '}
                      <code className="font-mono font-bold">@{recoveryTargetUser?.username}</code>)
                    </p>
                    <p className="text-emerald-900 pt-1">
                      Your 6-Digit Email Recovery Code:{' '}
                      <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-emerald-300">
                        {dispatchedCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecoveryCodeInput(dispatchedCode)}
                        className="ml-2 text-[11px] font-bold text-sky-700 underline cursor-pointer"
                      >
                        Auto-Fill Code
                      </button>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    6-Digit Email Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Enter new password (min 4 chars)"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {recoveryError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
                    {recoveryError}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('request')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    &larr; Change Email
                  </button>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Reset Password & Sign In
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
