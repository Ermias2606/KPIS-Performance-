import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Role } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, users, login, logout, isOnline, firebaseUser } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path || path === 'dashboard') return 'Dashboard';
    if (location.pathname.match(/^\/employees\/\d+$/)) {
      return user?.role === Role.STAFF ? 'My Scorecard' : 'Employee Scorecard';
    }
    if (path.startsWith('employees')) return 'Employee Management';
    if (path === 'plan') return '2026 Annual Plan Objectives';
    if (path === 'reports') return 'Performance Reports & Exports';
    if (path === 'network') return 'Branch LAN & Multi-Device Hub';
    if (path === 'admin') return 'Branch & Fiscal Year Setup';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <header className="bg-white shadow-xs px-4 py-3 md:px-6 flex justify-between items-center z-20 border-b border-slate-200">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
          aria-label="Open sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 className="text-base md:text-lg font-bold text-slate-800 leading-tight">{getPageTitle()}</h1>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'Firestore Sync Active' : 'Offline (Local IndexedDB)'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Branch LAN & Devices Button */}
        <button
          onClick={() => navigate('/network')}
          title="Connect Branch Devices & LAN Setup"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <span className="hidden sm:inline">Branch LAN</span>
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton variant="compact" />

        {/* Portal Home Link */}
        <button
          onClick={() => navigate('/')}
          title="Return to Public Landing Portal"
          className="hidden sm:inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
        >
          Portal
        </button>

        {/* Quick User Switcher for testing both dashboards */}
        {users.length > 1 && (
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {users.slice(0, 3).map((u) => (
              <button
                key={u.id}
                onClick={() => login(u.pin)}
                title={`Switch to ${u.name} (${u.role})`}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  user?.id === u.id
                    ? 'bg-white text-slate-800 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {u.role === Role.ADMIN ? 'Admin (HQ)' : u.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-2">
          {firebaseUser?.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}

          <div className="text-right hidden sm:block">
            <p className="font-bold text-slate-800 text-xs leading-tight">{user?.name}</p>
            <p className="text-[10px] text-slate-500">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
          aria-label="Logout"
          title="Logout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;