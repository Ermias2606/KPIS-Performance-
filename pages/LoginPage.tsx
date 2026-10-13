import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Role } from '../types';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login, users, loginWithGoogle, isGoogleLoading, isOnline } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = (e?: React.FormEvent, pinToUse?: string) => {
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
    handleLogin(undefined, userPin);
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

  const adminUser = users.find((u) => u.role === Role.ADMIN);
  const ermiyasUser = users.find(
    (u) => u.name.toLowerCase().includes('ermias') || u.name.toLowerCase().includes('ermiyas')
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-2">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center space-x-1"
          >
            <span>&larr;</span>
            <span>Back to Landing Page</span>
          </button>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-600 p-3 rounded-2xl mb-3 shadow-md shadow-sky-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-white"
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
          <h1 className="text-2xl font-bold text-slate-800">Raitu Branch Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            Balanced Scorecard (BSC) & Performance Management
          </p>
        </div>

        {/* Google Sign-In with Firebase Auth */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 font-semibold text-slate-700 shadow-xs flex items-center justify-center space-x-3 transition cursor-pointer disabled:opacity-70"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider relative">
            Or Use Employee PIN
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="pin"
              className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2"
            >
              Enter Employee PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              autoComplete="current-password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. 1234, 4444"
              className="w-full px-4 py-3 text-center text-xl tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition font-mono"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl shadow-md font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all cursor-pointer"
          >
            Sign In with PIN
          </button>
        </form>

        {/* Quick Demo Switcher */}
        <div className="border-t border-slate-200 pt-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
            Quick Select Account
          </p>
          <div className="grid grid-cols-1 gap-2.5">
            {adminUser && (
              <button
                type="button"
                onClick={() => handleQuickSelect(adminUser.pin)}
                className="flex items-center justify-between px-3.5 py-2.5 text-left rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition text-sm group"
              >
                <div>
                  <span className="font-semibold text-slate-800 group-hover:text-sky-700">
                    {adminUser.name}
                  </span>
                  <span className="text-xs text-sky-600 font-medium ml-2">({adminUser.role})</span>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  PIN: {adminUser.pin}
                </span>
              </button>
            )}

            {ermiyasUser && (
              <button
                type="button"
                onClick={() => handleQuickSelect(ermiyasUser.pin)}
                className="flex items-center justify-between px-3.5 py-2.5 text-left rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition text-sm group"
              >
                <div>
                  <span className="font-semibold text-slate-800 group-hover:text-sky-700">
                    {ermiyasUser.name}
                  </span>
                  <span className="text-xs text-sky-600 font-medium ml-2">({ermiyasUser.role})</span>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  PIN: {ermiyasUser.pin}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-center">
          <PWAInstallButton variant="compact" />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
