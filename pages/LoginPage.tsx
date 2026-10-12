import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Role } from '../types';

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login, users } = useContext(AuthContext);

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
    }
  };

  const handleQuickSelect = (userPin: string) => {
    setPin(userPin);
    handleLogin(undefined, userPin);
  };

  const adminUser = users.find(u => u.role === Role.ADMIN);
  const ermiyasUser = users.find(u => u.name.toLowerCase().includes('ermias') || u.name.toLowerCase().includes('ermiyas'));

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-600 p-3 rounded-2xl mb-3 shadow-md shadow-sky-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3m6-6h3m-21 0h3m12 0a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Raitu Branch Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Balanced Scorecard (BSC) & Performance Management</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="pin" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
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
            Sign In
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
                  <span className="font-semibold text-slate-800 group-hover:text-sky-700">{adminUser.name}</span>
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
                  <span className="font-semibold text-slate-800 group-hover:text-sky-700">{ermiyasUser.name}</span>
                  <span className="text-xs text-slate-400 ml-2">({ermiyasUser.role})</span>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  PIN: {ermiyasUser.pin}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
