import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Role } from '../../types';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, users, login, logout } = useContext(AuthContext);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path || path === 'dashboard') return 'Dashboard';
    if (location.pathname.match(/^\/employees\/\d+$/)) {
      return user?.role === Role.STAFF ? 'My Scorecard' : 'Employee Scorecard';
    }
    if (path.startsWith('employees')) return 'Employee Management';
    if (path === 'plan') return '2026 Annual Plan Objectives';
    if (path === 'reports') return 'Performance Reports & Exports';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <header className="bg-white shadow-sm px-4 py-3 md:px-6 flex justify-between items-center z-20 border-b border-slate-200">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
          aria-label="Open sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base md:text-lg font-bold text-slate-800">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Quick User Switcher for testing both dashboards */}
        {users.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {users.map(u => (
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
                {u.role === Role.ADMIN ? 'Admin (HQ)' : 'Ermiyas (Staff)'}
              </button>
            ))}
          </div>
        )}

        <div className="text-right hidden sm:block">
          <p className="font-bold text-slate-800 text-sm">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
          aria-label="Logout"
          title="Logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;