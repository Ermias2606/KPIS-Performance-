import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { DEFAULT_ORGANIZATION_CAPABILITIES } from '../constants';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    users,
    login,
    loginWithCredentials,
    loginWithGoogle,
    isGoogleLoading,
    isSystemOwner,
    systemProviderConfig,
    loginAsSystemOwner,
  } = useAuth();
  const {
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    branches,
    employees,
    setActiveBranchId,
  } = useData();

  // Organization Login Form State
  const [orgAuthMode, setOrgAuthMode] = useState<'credentials' | 'pin'>('credentials');
  const [orgIdentifier, setOrgIdentifier] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [orgPin, setOrgPin] = useState('');
  const [orgError, setOrgError] = useState<string | null>(null);
  const [isOrgSubmitting, setIsOrgSubmitting] = useState(false);

  // Main System Dashboard Login (Owner / Service Provider) State
  const [ownerSecret, setOwnerSecret] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isOwnerSubmitting, setIsOwnerSubmitting] = useState(false);

  const isOrgSuspended = activeOrganization?.serviceStatus === 'Suspended';

  const orgBranches = branches.filter(
    (b) => (b.organizationId || 1) === activeOrganization?.id
  );
  const orgEmployees = (users.length > 0 ? users : employees).filter(
    (e) => (e.organizationId || 1) === activeOrganization?.id
  );
  const orgCapabilities = {
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
    ...(activeOrganization?.capabilities || {}),
  };
  const enabledModulesCount = Object.values(orgCapabilities).filter(Boolean).length;

  const handleSelectOrganization = (orgId: number) => {
    setOrgError(null);
    setActiveOrganizationId(orgId);
    const matchingBranches = branches.filter((b) => (b.organizationId || 1) === orgId);
    if (matchingBranches.length > 0) {
      setActiveBranchId(matchingBranches[0].id);
    }
  };

  const handleOrganizationCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    if (isOrgSuspended) {
      setOrgError(
        `Access to "${activeOrganization?.name}" is currently suspended by the Platform Service Provider.`
      );
      return;
    }
    setIsOrgSubmitting(true);
    try {
      const res = await loginWithCredentials(orgIdentifier, orgPassword);
      if (!res.user) {
        setOrgError(res.error || 'Invalid organization username or password.');
      } else {
        if (res.user.organizationId) {
          setActiveOrganizationId(res.user.organizationId);
        }
        navigate('/dashboard');
      }
    } finally {
      setIsOrgSubmitting(false);
    }
  };

  const handleOrganizationPinSubmit = (e?: React.FormEvent, overridePin?: string) => {
    if (e) e.preventDefault();
    setOrgError(null);
    if (isOrgSuspended) {
      setOrgError(
        `Access to "${activeOrganization?.name}" is currently suspended by the Platform Service Provider.`
      );
      return;
    }
    const targetPin = overridePin !== undefined ? overridePin : orgPin;
    if (!targetPin.trim()) {
      setOrgError('Please enter your 4-digit employee PIN.');
      return;
    }
    const logged = login(targetPin.trim());
    if (!logged) {
      setOrgError('Invalid employee PIN for this organization.');
    } else {
      if (logged.organizationId) {
        setActiveOrganizationId(logged.organizationId);
      }
      navigate('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    setOrgError(null);
    if (isOrgSuspended) {
      setOrgError(
        `Access to "${activeOrganization?.name}" is currently suspended by the Platform Service Provider.`
      );
      return;
    }
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setOrgError(err.message || 'Google Sign-In was cancelled or failed.');
    }
  };

  const handleSystemOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerError(null);
    setIsOwnerSubmitting(true);
    try {
      const res = await loginAsSystemOwner(ownerSecret);
      if (!res.success) {
        setOwnerError(
          res.error || 'Invalid System Master Passkey or Secret PIN.'
        );
      } else {
        navigate('/system-dashboard');
      }
    } finally {
      setIsOwnerSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — 4 Concise Nav Links — 1 Primary Action) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Performance Tracker
          </a>

          {/* Zone 2: 4 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#organization-login"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Organization Login
            </a>
            <a
              href="#system-dashboard-login"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              System Dashboard
            </a>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Password Recovery
            </button>
            {isSystemOwner && (
              <button
                type="button"
                onClick={() => navigate('/system-dashboard')}
                className="text-orange-700 hover:text-orange-800 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Control Plane
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                navigate(
                  isSystemOwner
                    ? '/system-dashboard'
                    : user
                    ? '/dashboard'
                    : '/login'
                )
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSystemOwner
                ? 'Open System Dashboard'
                : user
                ? 'Open Org Workspace'
                : 'Full Login Page'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Simplified Dual-Gateway Viewport */}
      <main className="flex-1 flex items-center py-10 px-6">
        <div className="max-w-7xl mx-auto w-full space-y-8">
          {/* Concise Portal Header */}
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Multi-Tenant Balanced Scorecard SaaS</span>
              <span aria-hidden="true">·</span>
              <span>Organization Workspaces</span>
              <span aria-hidden="true">·</span>
              <span>Service Provider Control Plane</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Select Your Portal Gateway
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sign into your organization workspace to manage KPIs, periodic plans, and employee evaluations, or authenticate into the Main System Control Dashboard as the platform service provider.
            </p>
          </div>

          {/* Dual Gateway Split: 2 Equal Stretch Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* GATEWAY 1: ORGANIZATION LOGIN (Client Tenant Portal) */}
            <section
              id="organization-login"
              className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-orange-700">
                      01. Client Tenant Workspace
                    </p>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Organization Login
                    </h2>
                  </div>

                  {/* Active Organization Selector */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="portal-org-select"
                      className="text-xs font-medium text-slate-500 whitespace-nowrap"
                    >
                      Organization:
                    </label>
                    <select
                      id="portal-org-select"
                      value={activeOrganization?.id || 1}
                      onChange={(e) =>
                        handleSelectOrganization(Number(e.target.value))
                      }
                      className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-orange-600 cursor-pointer"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.code})
                          {org.serviceStatus === 'Suspended'
                            ? ' — Suspended'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Organization Context Strip (Unboxed metadata with · separators) */}
                {activeOrganization && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {activeOrganization.name}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeOrganization.sector}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {orgBranches.length} Branch{orgBranches.length === 1 ? '' : 'es'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {enabledModulesCount}/7 Modules Active
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${
                        isOrgSuspended ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      Status: {activeOrganization.serviceStatus || 'Active'}
                    </span>
                  </div>
                )}

                {isOrgSuspended ? (
                  <div className="p-5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                    <h3 className="text-sm font-bold text-red-900">
                      Organization Service Suspended
                    </h3>
                    <p className="text-xs text-red-700 leading-relaxed">
                      Workspace access for <strong>{activeOrganization?.name}</strong> has been suspended by the Platform Service Provider. Please contact the system owner or reactivate this organization from the Main System Dashboard.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mode Switcher */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setOrgAuthMode('credentials');
                          setOrgError(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                          orgAuthMode === 'credentials'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Username & Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrgAuthMode('pin');
                          setOrgError(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                          orgAuthMode === 'pin'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Quick PIN Login
                      </button>
                    </div>

                    {orgError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                        {orgError}
                      </div>
                    )}

                    {orgAuthMode === 'credentials' ? (
                      <form
                        onSubmit={handleOrganizationCredentialsSubmit}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Username, Email, or Employee Code
                            </label>
                            <input
                              type="text"
                              required
                              value={orgIdentifier}
                              onChange={(e) => setOrgIdentifier(e.target.value)}
                              placeholder="e.g. superadmin, selam.t, EMP-002"
                              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-600"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Password
                              </label>
                              <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-[11px] font-semibold text-orange-700 hover:underline cursor-pointer"
                              >
                                Forgot password?
                              </button>
                            </div>
                            <input
                              type="password"
                              required
                              value={orgPassword}
                              onChange={(e) => setOrgPassword(e.target.value)}
                              placeholder="Enter password (e.g. Password@123)"
                              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-600"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <button
                            type="submit"
                            disabled={isOrgSubmitting}
                            className="w-full sm:flex-1 py-2.5 px-5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          >
                            {isOrgSubmitting
                              ? 'Signing In...'
                              : `Sign In to ${activeOrganization?.name || 'Organization'}`}
                          </button>
                          <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isGoogleLoading}
                            className="w-full sm:w-auto py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            {isGoogleLoading ? 'Connecting...' : 'Sign In with Google'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form
                        onSubmit={(e) => handleOrganizationPinSubmit(e)}
                        className="space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="password"
                            value={orgPin}
                            onChange={(e) => setOrgPin(e.target.value)}
                            placeholder="Enter 4-digit PIN (e.g. 1111, 1234)"
                            className="flex-1 px-3.5 py-2.5 text-center font-mono tracking-widest text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-600"
                          />
                          <button
                            type="submit"
                            className="py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            Unlock Workspace
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>

              {/* Quick Organization Role Access Footer */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Quick Organization Demo Accounts ({activeOrganization?.code})
                  </span>
                  <span>Password: Password@123</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(orgEmployees.length > 0 ? orgEmployees : users.slice(0, 4))
                    .slice(0, 5)
                    .map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        disabled={isOrgSuspended}
                        onClick={() => handleOrganizationPinSubmit(undefined, emp.pin)}
                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-orange-50 hover:text-orange-800 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <span className="font-semibold">{emp.name}</span>
                        <span className="text-slate-400"> · {emp.role}</span>
                      </button>
                    ))}
                </div>
              </div>
            </section>

            {/* GATEWAY 2: MAIN SYSTEM DASHBOARD LOGIN (Owner / Developer Service Provider) */}
            <section
              id="system-dashboard-login"
              className="lg:col-span-5 bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5">
                <div className="pb-5 border-b border-slate-800">
                  <p className="text-xs font-semibold text-orange-400">
                    02. Platform Owner & Developer Control Plane
                  </p>
                  <h2 className="text-xl font-bold text-white mt-0.5">
                    Main System Dashboard Login
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Service provider console for creating client organizations, configuring module capabilities, setting employee seat quotas, and assigning organization admins.
                  </p>
                </div>

                {/* Live Service Provider Summary Grid (tabular-nums) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-[11px] text-slate-400">
                      Managed Organizations
                    </p>
                    <p className="text-lg font-bold text-white font-mono tabular-nums mt-0.5">
                      {organizations.length} Tenants
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-[11px] text-slate-400">
                      Total Platform Seats
                    </p>
                    <p className="text-lg font-bold text-white font-mono tabular-nums mt-0.5">
                      {employees.length} Users · {branches.length} Units
                    </p>
                  </div>
                </div>

                {ownerError && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg font-medium">
                    {ownerError}
                  </div>
                )}

                <form onSubmit={handleSystemOwnerSubmit} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="owner-master-secret"
                        className="text-xs font-semibold text-slate-300"
                      >
                        System Master Passkey or Secret PIN
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setOwnerSecret(systemProviderConfig.masterPasskey)
                        }
                        className="text-[11px] text-orange-400 hover:underline cursor-pointer"
                      >
                        Fill Owner Passkey
                      </button>
                    </div>
                    <input
                      id="owner-master-secret"
                      type="password"
                      required
                      value={ownerSecret}
                      onChange={(e) => setOwnerSecret(e.target.value)}
                      placeholder="Enter Master Passkey (SYS-OWNER-2026) or PIN (999999)"
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isOwnerSubmitting}
                    className="w-full py-2.5 px-5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {isOwnerSubmitting
                      ? 'Verifying System Owner...'
                      : 'Launch Main System Control Dashboard'}
                  </button>
                </form>

                {isSystemOwner && (
                  <button
                    type="button"
                    onClick={() => navigate('/system-dashboard')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Active Owner Session Detected — Open Control Dashboard &rarr;
                  </button>
                )}
              </div>

              {/* Service Provider Capabilities Summary */}
              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">
                    Owner Default Credentials
                  </span>
                  <span className="font-mono text-slate-300">
                    Passkey: {systemProviderConfig.masterPasskey} · PIN:{' '}
                    {systemProviderConfig.masterPin}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Owner capabilities: Create & suspend organizations · Toggle per-org modules · Set employee & branch quotas · Provision organization admins.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            <span>Performance Tracker Multi-Organization SaaS Platform</span>
            <span aria-hidden="true"> · </span>
            <span>Balanced Scorecard & Daily KPI Governance</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Organization Login
            </button>
            <span aria-hidden="true">·</span>
            <a
              href="#system-dashboard-login"
              className="hover:text-slate-900"
            >
              System Owner Control Plane
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
