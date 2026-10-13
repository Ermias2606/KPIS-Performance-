import React from 'react';
import { NavLink } from 'react-router-dom';
import { Employee, Role } from '../../types';

interface SidebarProps {
  user: Employee;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const SidebarIcon: React.FC<{ path: string }> = ({ path }) => {
  const icons: { [key: string]: React.ReactNode } = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
    ),
    employees: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
    ),
    'my scorecard': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    plan: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
      </svg>
    ),
    reports: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
    'landing portal': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
      </svg>
    ),
  };
  return icons[path.toLowerCase()] || null;
};

const NavItem: React.FC<{ to: string; label: string }> = ({ to, label }) => {
  const baseClasses = 'flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm transition-all font-medium';
  const inactiveClasses = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  const activeClasses = 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-100';

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      <SidebarIcon path={label} />
      <span>{label}</span>
    </NavLink>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, setIsOpen }) => {
  const isAdmin = user.role === Role.ADMIN;
  const isManager = user.role === Role.MANAGER;
  const isStaff = user.role === Role.STAFF;

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-30
    w-64 bg-white p-4 border-r border-slate-200
    flex flex-col
    transform transition-transform duration-300 ease-in-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    md:relative md:translate-x-0 md:flex-shrink-0
  `;

  return (
    <>
      <div className={sidebarClasses}>
        <div className="flex items-center justify-between px-2 pb-6 pt-2">
          <div className="flex items-center space-x-3">
            <div className="bg-sky-600 p-2 rounded-xl shadow-sm shadow-sky-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3m6-6h3m-21 0h3m12 0a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Raitu BSC</h1>
              <p className="text-[11px] text-slate-400 font-medium">Performance Tracker</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-slate-800" aria-label="Close sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 bg-white">
          <NavItem to="/dashboard" label="Dashboard" />
          {(isAdmin || isManager) && <NavItem to="/employees" label="Employees" />}
          {(isStaff || isManager) && <NavItem to={`/employees/${user.id}`} label="My Scorecard" />}
          <NavItem to="/plan" label="Plan" />
          {(isAdmin || isManager) && <NavItem to="/reports" label="Reports" />}
          <NavItem to="/" label="Landing Portal" />
        </nav>

        <div className="mt-auto p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Raitu Branch</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Offline-first BSC system</p>
        </div>
      </div>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;