import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useData, calculateKpiMetrics } from '../../context/DataContext';
import { Role } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  onMenuClick: () => void;
}

type SearchCategoryFilter = 'all' | 'employees' | 'branches' | 'kpis';

interface GlobalSearchResultItem {
  id: string;
  category: 'employees' | 'branches' | 'kpis';
  title: string;
  subtitle: string;
  metaRight: string;
  action: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, users, switchUser, logout, isOnline, firebaseUser, changeOwnPassword, isSystemOwner } =
    useContext(AuthContext);
  const {
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    branches,
    activeBranchId,
    setActiveBranchId,
    employees,
    kpis,
    annualPlan,
    periodicPlans,
    refreshData,
    wsConnected,
    offlineQueue,
    flushOfflineQueue,
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  // Global Search Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchCategoryFilter>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [secMessage, setSecMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Keyboard shortcut (Ctrl+K or Cmd+K) & Click outside listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  // Build unified global search results across Employees, Branches/Organizations, and KPIs/Plans
  const searchResults = useMemo<GlobalSearchResultItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const results: GlobalSearchResultItem[] = [];

    // 1. Employees across organization
    if (searchFilter === 'all' || searchFilter === 'employees') {
      employees.forEach((emp) => {
        const branchName =
          branches.find((b) => b.id === emp.branchId)?.name || `Branch #${emp.branchId}`;
        const orgName =
          organizations.find((o) => o.id === emp.organizationId)?.name ||
          activeOrganization?.name ||
          'Organization';
        const searchableText = [
          emp.name,
          emp.username,
          emp.employeeCode,
          emp.role,
          emp.positionTitle,
          emp.department,
          emp.email,
          emp.specialization,
          ...(emp.skills || []),
          branchName,
          orgName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!q || searchableText.includes(q)) {
          results.push({
            id: `emp-${emp.id}`,
            category: 'employees',
            title: emp.name,
            subtitle: `${emp.positionTitle || emp.role} · ${emp.department || 'Operations'} · ${branchName}`,
            metaRight: `${emp.employeeCode || `EMP-00${emp.id}`} · @${emp.username || 'user'}`,
            action: () => {
              if (emp.organizationId) setActiveOrganizationId(emp.organizationId);
              if (emp.branchId) setActiveBranchId(emp.branchId);
              navigate(`/employees/${emp.id}`);
              setIsSearchOpen(false);
              setSearchQuery('');
            },
          });
        }
      });
    }

    // 2. Branches & Organizations
    if (searchFilter === 'all' || searchFilter === 'branches') {
      branches.forEach((br) => {
        const org = organizations.find((o) => o.id === br.organizationId);
        const searchableText = [
          br.name,
          br.code,
          br.district,
          br.fiscalYear,
          br.sector,
          org?.name,
          org?.code,
          org?.sector,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!q || searchableText.includes(q)) {
          const isCurrent = br.id === activeBranchId;
          results.push({
            id: `branch-${br.id}`,
            category: 'branches',
            title: br.name,
            subtitle: `${org?.name || activeOrganization?.name || 'Organization'} · ${
              br.district || 'Operations Zone'
            } · FY ${br.fiscalYear || '2024/2025'}`,
            metaRight: `${br.code || `BR-0${br.id}`}${isCurrent ? ' · Active' : ''}`,
            action: () => {
              if (br.organizationId) setActiveOrganizationId(br.organizationId);
              setActiveBranchId(br.id);
              navigate('/admin');
              setIsSearchOpen(false);
              setSearchQuery('');
            },
          });
        }
      });

      organizations.forEach((org) => {
        const searchableText = [
          org.name,
          org.code,
          org.sector,
          org.headquarters,
          org.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (q && searchableText.includes(q)) {
          results.push({
            id: `org-${org.id}`,
            category: 'branches',
            title: `${org.name} (Organization)`,
            subtitle: `${org.sector} · ${org.headquarters || 'Corporate HQ'}`,
            metaRight: org.code,
            action: () => {
              setActiveOrganizationId(org.id);
              navigate('/admin');
              setIsSearchOpen(false);
              setSearchQuery('');
            },
          });
        }
      });
    }

    // 3. Specific KPIs & Periodic/Strategic Objectives
    if (searchFilter === 'all' || searchFilter === 'kpis') {
      kpis.forEach((kpi) => {
        const owner = employees.find((e) => e.id === kpi.employeeId);
        const obj = annualPlan.find((o) => o.id === kpi.objectiveId);
        const calc = calculateKpiMetrics(kpi, obj);
        const searchableText = [
          kpi.name,
          kpi.kpiCategory,
          owner?.name,
          owner?.employeeCode,
          obj?.objective,
          obj?.category,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!q || searchableText.includes(q)) {
          results.push({
            id: `kpi-${kpi.id}`,
            category: 'kpis',
            title: kpi.name,
            subtitle: `Employee KPI · ${owner?.name || `Staff #${kpi.employeeId}`} · ${
              kpi.kpiCategory || obj?.category || 'Scorecard'
            }`,
            metaRight: `${calc.achievement}% (${kpi.actual.toLocaleString()} / ${kpi.target.toLocaleString()})`,
            action: () => {
              navigate(`/employees/${kpi.employeeId}`);
              setIsSearchOpen(false);
              setSearchQuery('');
            },
          });
        }
      });

      periodicPlans.forEach((plan) => {
        const ach =
          plan.annualTarget > 0
            ? Math.round((plan.annualActual / plan.annualTarget) * 100)
            : 100;
        const searchableText = [plan.name, String(plan.category), plan.metricUnit]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!q || searchableText.includes(q)) {
          results.push({
            id: `plan-${plan.id}`,
            category: 'kpis',
            title: plan.name,
            subtitle: `Periodic Plan KPI · ${plan.category} · Weight ${plan.weight}%`,
            metaRight: `${ach}% (${plan.annualActual.toLocaleString()} ${plan.metricUnit})`,
            action: () => {
              navigate('/plan');
              setIsSearchOpen(false);
              setSearchQuery('');
            },
          });
        }
      });
    }

    return results.slice(0, 18);
  }, [
    searchQuery,
    searchFilter,
    employees,
    branches,
    organizations,
    activeOrganization,
    activeBranchId,
    kpis,
    annualPlan,
    periodicPlans,
    navigate,
    setActiveBranchId,
    setActiveOrganizationId,
  ]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, searchFilter]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        searchResults.length > 0 ? (prev + 1) % searchResults.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        searchResults.length > 0
          ? (prev - 1 + searchResults.length) % searchResults.length
          : 0
      );
    } else if (e.key === 'Enter' && searchResults[highlightedIndex]) {
      e.preventDefault();
      searchResults[highlightedIndex].action();
    }
  };

  const openSecurityModal = () => {
    setCurrentSecret('');
    setNewPassword('');
    setConfirmPassword('');
    setNewUsername(user?.username || '');
    setNewEmail(user?.email || '');
    setSecMessage(null);
    setShowSecurityModal(true);
  };

  const handleSelfPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecMessage(null);
    if (newPassword !== confirmPassword) {
      setSecMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    const res = await changeOwnPassword(currentSecret, newPassword, newEmail, newUsername);
    if (!res.success) {
      setSecMessage({ type: 'error', text: res.message });
    } else {
      setSecMessage({ type: 'success', text: res.message });
      refreshData();
      setTimeout(() => {
        setShowSecurityModal(false);
      }, 1000);
    }
  };

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path || path === 'dashboard') return 'Dashboard';
    if (location.pathname.match(/^\/employees\/\d+$/)) {
      return user?.role === Role.STAFF ? 'My Scorecard' : 'Employee Profile & Scorecard';
    }
    if (path.startsWith('employees')) return 'Employees, Hierarchy & Organization Roles';
    if (path === 'plan') return 'Strategic & Periodic Plan Objectives';
    if (path === 'reports') return 'Performance Reports & Exports';
    if (path === 'network') return 'Organization LAN & Multi-Device Hub';
    if (path === 'admin') return 'Organization, Branch & Fiscal Setup';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const getCategoryLabel = (cat: 'employees' | 'branches' | 'kpis') => {
    if (cat === 'employees') return 'Employee';
    if (cat === 'branches') return 'Branch / Org';
    return 'KPI / Plan';
  };

  return (
    <>
      <header className="bg-white shadow-xs px-4 py-3 md:px-6 flex flex-wrap lg:flex-nowrap justify-between items-center gap-3 z-20 border-b border-slate-200">
        {/* Left Zone: Mobile Menu Trigger + Page Title & Organization Telemetry */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Open sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-800 leading-tight whitespace-nowrap">
              {getPageTitle()}
            </h1>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
              <button
                type="button"
                onClick={() => navigate('/admin/branch-setup')}
                title="Open Organization, Branch & Fiscal Setup"
                className="font-semibold text-orange-700 hover:text-orange-800 hover:underline truncate max-w-[180px] sm:max-w-none cursor-pointer"
              >
                {activeOrganization?.name || 'Performance Tracker'}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigate('/admin/branch-setup')}
                className="hidden sm:inline hover:text-slate-800 hover:underline cursor-pointer"
                title="Configure Organization Sector, Branches & Fiscal Year"
              >
                {activeOrganization?.sector || 'Enterprise'} (Setup)
              </button>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected && isOnline
                    ? 'bg-emerald-500'
                    : isOnline
                    ? 'bg-sky-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-400 whitespace-nowrap">
                {wsConnected && isOnline
                  ? 'Real-Time WS + Cloud Sync'
                  : isOnline
                  ? 'Cloud Synced'
                  : 'Offline Queue Active'}
              </span>
              {offlineQueue.length > 0 && (
                <button
                  onClick={() => flushOfflineQueue()}
                  title="Click to flush queued offline mutations to backend"
                  className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold text-[10px] border border-amber-300 cursor-pointer whitespace-nowrap"
                >
                  {offlineQueue.length} Queued · Sync Now
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center Zone: Global Organization Search Bar (Employees, Branches, KPIs) */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-md w-full order-3 lg:order-2"
        >
          <div className="relative flex items-center">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search employees, branches, or KPIs... (Ctrl+K)"
              aria-label="Global search for employees, branches, or KPIs"
              className="w-full pl-9 pr-16 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 text-[11px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
              >
                Clear
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Results Dropdown Palette */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              {/* Interactive Category Filter Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 gap-2">
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'employees', label: 'Employees' },
                      { id: 'branches', label: 'Branches' },
                      { id: 'kpis', label: 'KPIs' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSearchFilter(tab.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                        searchFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap">
                  {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Results List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {searchResults.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-slate-500">
                    No matching employees, branches, or KPIs found for{' '}
                    <span className="font-semibold text-slate-800">"{searchQuery}"</span>.
                  </div>
                ) : (
                  searchResults.map((item, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={item.action}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                          isHighlighted ? 'bg-sky-50/90' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              · {getCategoryLabel(item.category)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-sky-700">
                            {item.metaRight}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Keyboard Hints Footer */}
              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Use ↑↓ arrows to navigate · Enter to open</span>
                <span>ESC to close</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Zone: Actions, Role Switcher & User Account */}
        <div className="flex items-center space-x-2 md:space-x-3 order-2 lg:order-3 shrink-0">
          {isSystemOwner && (
            <button
              type="button"
              onClick={() => navigate('/system-dashboard')}
              title="Return to Owner / Service Provider Main System Dashboard"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              <span>System Control Plane</span>
            </button>
          )}

          {user?.mustChangePassword && (
            <button
              onClick={openSecurityModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              <span>Reset Password Required</span>
            </button>
          )}

          {/* Branch LAN & Devices Button */}
          <button
            onClick={() => navigate('/network')}
            title="Connect Branch Devices & LAN Setup"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition cursor-pointer whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5 text-sky-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
            <span className="hidden sm:inline">Branch LAN</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="compact" />

          {/* Quick Role Switcher for testing hierarchy roles */}
          {users.length > 1 && (
            <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {users.slice(0, 5).map((u) => (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  title={`Switch to ${u.name} (${u.role})`}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    user?.id === u.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {u.role === Role.SUPER_ADMIN
                    ? 'Super Admin'
                    : u.role === Role.ADMIN
                    ? 'Admin'
                    : u.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          {/* User Account & Security Settings Trigger */}
          <button
            onClick={openSecurityModal}
            title="Account Security, Username & Password Settings"
            className="flex items-center space-x-2 px-2 py-1 rounded-xl hover:bg-slate-100 transition cursor-pointer text-left"
          >
            {firebaseUser?.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt={user?.name || 'User'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs relative">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                {user?.mustChangePassword && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                )}
              </div>
            )}

            <div className="text-right hidden sm:block">
              <p className="font-bold text-slate-800 text-xs leading-tight whitespace-nowrap">
                {user?.name}
              </p>
              <p className="text-[10px] text-slate-500 whitespace-nowrap">
                {user?.role} · <span className="font-mono">@{user?.username || 'user'}</span>
              </p>
            </div>
          </button>

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

      {/* Self-Service Security, Username & Password Change Modal */}
      {showSecurityModal && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  My Login Security & Password Settings
                </h3>
                <p className="text-xs text-slate-500">
                  {user.name} ({user.role}) · {user.positionTitle || 'Organization Member'}
                </p>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {user.mustChangePassword && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>Administrator Password Reset Notice:</strong> Your password was recently
                reset by an administrator ({user.lastPasswordResetBy || 'Admin'}). Please set a new
                personal password below.
              </div>
            )}

            <form onSubmit={handleSelfPasswordUpdate} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Recovery Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@org.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Current Password or PIN
                </label>
                <input
                  type="password"
                  required
                  value={currentSecret}
                  onChange={(e) => setCurrentSecret(e.target.value)}
                  placeholder="Enter current password or 4-digit PIN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {secMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium border ${
                    secMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {secMessage.text}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Update Password & Security
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;