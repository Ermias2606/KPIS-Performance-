import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  Organization,
  OrganizationCapabilities,
  OrganizationServicePlanTier,
  OrganizationServiceStatus,
  Role,
  isAdminRole,
} from '../types';
import {
  DEFAULT_ORGANIZATION_CAPABILITIES,
  DEFAULT_ORGANIZATION_QUOTAS,
} from '../constants';

const SECTORS = [
  'Service & Hospitality',
  'Manufacturing & Production',
  'Financial & Banking Services',
  'Technology & SaaS',
  'Healthcare & Medical',
  'Retail & Supply Chain',
  'Agriculture & Agro-Processing',
  'Education & Research',
  'Public Sector & NGO',
];

const CAPABILITY_DEFINITIONS: {
  key: keyof OrganizationCapabilities;
  label: string;
  description: string;
}[] = [
  {
    key: 'kpiScorecard',
    label: 'Balanced Scorecard & KPIs',
    description: 'Strategic objectives, weighted KPIs, and branch performance scorecards.',
  },
  {
    key: 'periodicPlans',
    label: 'Periodic Plans (M1–M12 & Q1–Q4)',
    description: 'Monthly and quarterly target distribution, deposit baselines, and actuals.',
  },
  {
    key: 'backlogEngine',
    label: 'Automated Backlog Recovery Engine',
    description: 'Server-side shortfall detection and staff deficit recovery plans.',
  },
  {
    key: 'employeeEvaluations',
    label: 'Employee Appraisals & Approvals',
    description: 'Staff self-ratings, manager evaluations, and HQ approval workflows.',
  },
  {
    key: 'customerFeedback',
    label: 'Customer Feedback & QR Surveys',
    description: 'Client satisfaction ratings and frontline employee service attribution.',
  },
  {
    key: 'reportsAndExports',
    label: 'Analytics Reports & CSV/JSON Exports',
    description: 'Executive performance summaries, printable reports, and bulk data exports.',
  },
  {
    key: 'lanAndSnapshots',
    label: 'LAN Multi-Device Sync & Snapshots',
    description: 'Real-time WebSocket terminal sync, immutable audit logs, and point-in-time restore.',
  },
];

const SystemDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isSystemOwner,
    systemProviderConfig,
    logoutSystemOwner,
    updateSystemOwnerCredentials,
    switchUser,
  } = useAuth();
  const {
    organizations,
    branches,
    employees,
    kpis,
    periodicPlans,
    backlogPlans,
    auditLogs,
    setActiveOrganizationId,
    setActiveBranchId,
    provisionClientOrganization,
    updateOrganizationServiceConfig,
    deleteOrganization,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    'organizations' | 'capabilities' | 'quotas-admins' | 'usage-security'
  >('organizations');
  const [selectedOrgId, setSelectedOrgId] = useState<number>(
    organizations[0]?.id || 1
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Provision Organization Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgSector, setNewOrgSector] = useState(SECTORS[0]);
  const [newOrgHq, setNewOrgHq] = useState('');
  const [newOrgCurrency, setNewOrgCurrency] = useState('ETB');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [newOrgTier, setNewOrgTier] =
    useState<OrganizationServicePlanTier>('Enterprise');
  const [newOrgMaxEmployees, setNewOrgMaxEmployees] = useState(50);
  const [newOrgMaxBranches, setNewOrgMaxBranches] = useState(15);
  const [newBranchName, setNewBranchName] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('Password@123');
  const [newAdminPin, setNewAdminPin] = useState('1111');

  // Assign / Reset Org Admin Form State
  const [adminTargetOrgId, setAdminTargetOrgId] = useState<number>(
    organizations[0]?.id || 1
  );
  const [assignName, setAssignName] = useState('');
  const [assignUsername, setAssignUsername] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignPassword, setAssignPassword] = useState('Password@123');
  const [assignPin, setAssignPin] = useState('1111');
  const [assignRole, setAssignRole] = useState<Role>(Role.SUPER_ADMIN);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  // Owner Passkey & Profile Settings State
  const [serviceTitleInput, setServiceTitleInput] = useState(
    systemProviderConfig.serviceTitle
  );
  const [ownerNameInput, setOwnerNameInput] = useState(
    systemProviderConfig.ownerName
  );
  const [ownerEmailInput, setOwnerEmailInput] = useState(
    systemProviderConfig.ownerEmail
  );
  const [newPasskeyInput, setNewPasskeyInput] = useState(
    systemProviderConfig.masterPasskey
  );
  const [newPinInput, setNewPinInput] = useState(
    systemProviderConfig.masterPin
  );

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Compute cross-organization metrics
  const orgMetricsMap = useMemo(() => {
    const map = new Map<
      number,
      {
        employeeCount: number;
        branchCount: number;
        kpiCount: number;
        planCount: number;
        backlogCount: number;
        clearedBacklogs: number;
        auditCount: number;
        estimatedStorageKb: number;
        admins: typeof employees;
      }
    >();

    organizations.forEach((org) => {
      const orgBranches = branches.filter(
        (b) => (b.organizationId || 1) === org.id
      );
      const orgEmployees = employees.filter(
        (e) => (e.organizationId || 1) === org.id
      );
      const orgKpis = kpis.filter((k) => (k.organizationId || 1) === org.id);
      const orgPlans = periodicPlans.filter(
        (p) => (p.organizationId || 1) === org.id
      );
      const orgBacklogs = backlogPlans.filter(
        (bp) => (bp.organizationId || 1) === org.id
      );
      const clearedBacklogs = orgBacklogs.filter(
        (bp) => bp.status === 'Cleared'
      ).length;
      const orgAudits = auditLogs.filter((a) => a.organizationId === org.id);
      const admins = orgEmployees.filter((e) => isAdminRole(e.role));

      const estimatedStorageKb = Math.max(
        12,
        Math.round(
          (orgEmployees.length * 2.4 +
            orgBranches.length * 1.8 +
            orgKpis.length * 1.5 +
            orgPlans.length * 4.2 +
            orgBacklogs.length * 1.9 +
            orgAudits.length * 0.8) *
            10
        ) / 10
      );

      map.set(org.id, {
        employeeCount: orgEmployees.length,
        branchCount: orgBranches.length,
        kpiCount: orgKpis.length,
        planCount: orgPlans.length,
        backlogCount: orgBacklogs.length,
        clearedBacklogs,
        auditCount: orgAudits.length,
        estimatedStorageKb,
        admins,
      });
    });

    return map;
  }, [
    organizations,
    branches,
    employees,
    kpis,
    periodicPlans,
    backlogPlans,
    auditLogs,
  ]);

  const filteredOrganizations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.sector.toLowerCase().includes(q) ||
        (o.headquarters || '').toLowerCase().includes(q)
    );
  }, [organizations, searchTerm]);

  const selectedOrg: Organization =
    organizations.find((o) => o.id === selectedOrgId) || organizations[0];

  const handleEnterOrganizationWorkspace = (org: Organization) => {
    setActiveOrganizationId(org.id);
    const orgBranches = branches.filter(
      (b) => (b.organizationId || 1) === org.id
    );
    if (orgBranches.length > 0) {
      setActiveBranchId(orgBranches[0].id);
    }
    const orgAdmin =
      employees.find(
        (e) => (e.organizationId || 1) === org.id && isAdminRole(e.role)
      ) || employees.find((e) => e.id === 1);
    if (orgAdmin) {
      switchUser(orgAdmin.id);
    }
    navigate('/dashboard');
  };

  const handleToggleOrgStatus = async (
    org: Organization,
    nextStatus: OrganizationServiceStatus
  ) => {
    await updateOrganizationServiceConfig({
      organizationId: org.id,
      serviceStatus: nextStatus,
    });
    showToast(
      'success',
      `Updated "${org.name}" service status to ${nextStatus}.`
    );
  };

  const handleChangePlanTier = async (
    org: Organization,
    nextTier: OrganizationServicePlanTier
  ) => {
    await updateOrganizationServiceConfig({
      organizationId: org.id,
      planTier: nextTier,
    });
    showToast('success', `Updated "${org.name}" service plan to ${nextTier}.`);
  };

  const handleToggleCapability = async (
    org: Organization,
    key: keyof OrganizationCapabilities
  ) => {
    const currentCaps = {
      ...DEFAULT_ORGANIZATION_CAPABILITIES,
      ...(org.capabilities || {}),
    };
    const nextValue = !currentCaps[key];
    await updateOrganizationServiceConfig({
      organizationId: org.id,
      capabilities: {
        ...currentCaps,
        [key]: nextValue,
      },
    });
    showToast(
      'success',
      `${nextValue ? 'Enabled' : 'Disabled'} ${
        CAPABILITY_DEFINITIONS.find((c) => c.key === key)?.label || key
      } for ${org.name}.`
    );
  };

  const handleApplyCapabilityPreset = async (
    org: Organization,
    preset: 'all' | 'core'
  ) => {
    const nextCaps: OrganizationCapabilities =
      preset === 'all'
        ? { ...DEFAULT_ORGANIZATION_CAPABILITIES }
        : {
            kpiScorecard: true,
            periodicPlans: true,
            backlogEngine: false,
            employeeEvaluations: true,
            customerFeedback: false,
            reportsAndExports: true,
            lanAndSnapshots: false,
          };
    await updateOrganizationServiceConfig({
      organizationId: org.id,
      capabilities: nextCaps,
    });
    showToast(
      'success',
      `Applied ${
        preset === 'all' ? 'Full Enterprise' : 'Core Starter'
      } module preset to ${org.name}.`
    );
  };

  const handleUpdateQuotas = async (
    org: Organization,
    maxEmployees: number,
    maxBranches: number,
    maxStorageMb: number
  ) => {
    await updateOrganizationServiceConfig({
      organizationId: org.id,
      quotas: {
        maxEmployees: Math.max(1, maxEmployees),
        maxBranches: Math.max(1, maxBranches),
        maxStorageMb: Math.max(50, maxStorageMb),
      },
    });
    showToast(
      'success',
      `Updated seat and branch quotas for "${org.name}".`
    );
  };

  const handleProvisionOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsProvisioning(true);
    try {
      const code =
        newOrgCode.trim().toUpperCase() ||
        newOrgName
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 4) + '-HQ';

      const res = await provisionClientOrganization({
        name: newOrgName.trim(),
        code,
        sector: newOrgSector,
        headquarters: newOrgHq.trim() || 'Corporate Headquarters',
        primaryCurrency: newOrgCurrency.trim() || 'ETB',
        description:
          newOrgDescription.trim() ||
          `Managed ${newOrgSector} enterprise organization.`,
        planTier: newOrgTier,
        quotas: {
          maxEmployees: Number(newOrgMaxEmployees) || 50,
          maxBranches: Number(newOrgMaxBranches) || 15,
          maxStorageMb: newOrgTier === 'Enterprise' ? 1024 : 250,
        },
        initialBranchName:
          newBranchName.trim() || `${newOrgName.trim()} — Main HQ Branch`,
        adminName: newAdminName.trim() || undefined,
        adminUsername: newAdminUsername.trim() || undefined,
        adminEmail: newAdminEmail.trim() || undefined,
        adminPassword: newAdminPassword.trim() || 'Password@123',
        adminPin: newAdminPin.trim() || '1111',
      });

      if (res.organization) {
        setSelectedOrgId(res.organization.id);
        setAdminTargetOrgId(res.organization.id);
        showToast(
          'success',
          `Provisioned organization "${res.organization.name}" (${res.organization.code}) with initial HQ branch${
            res.admin ? ` and admin @${res.admin.username}` : ''
          }.`
        );
      }

      setShowProvisionModal(false);
      setNewOrgName('');
      setNewOrgCode('');
      setNewOrgHq('');
      setNewOrgDescription('');
      setNewBranchName('');
      setNewAdminName('');
      setNewAdminUsername('');
      setNewAdminEmail('');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleAssignOrgAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignName.trim() || !assignUsername.trim()) return;
    setIsSavingAdmin(true);
    try {
      const targetOrg = organizations.find((o) => o.id === adminTargetOrgId);
      const res = await updateOrganizationServiceConfig({
        organizationId: adminTargetOrgId,
        assignAdmin: {
          name: assignName.trim(),
          username: assignUsername.trim().toLowerCase(),
          email:
            assignEmail.trim() ||
            `${assignUsername.trim().toLowerCase()}@${(
              targetOrg?.code || 'org'
            ).toLowerCase()}.com`,
          password: assignPassword.trim() || 'Password@123',
          pin: assignPin.trim() || '1111',
          role: assignRole,
        },
      });
      if (res.admin) {
        showToast(
          'success',
          `Assigned ${res.admin.name} (@${res.admin.username}, PIN: ${res.admin.pin}) as ${res.admin.role} for ${targetOrg?.name}.`
        );
        setAssignName('');
        setAssignUsername('');
        setAssignEmail('');
      }
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleSaveSystemCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateSystemOwnerCredentials({
      serviceTitle: serviceTitleInput,
      ownerName: ownerNameInput,
      ownerEmail: ownerEmailInput,
      newMasterPasskey: newPasskeyInput,
      newMasterPin: newPinInput,
    });
    showToast(res.success ? 'success' : 'error', res.message);
  };

  if (!isSystemOwner) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5 text-center">
          <h1 className="text-xl font-bold text-white">
            System Owner Authentication Required
          </h1>
          <p className="text-sm text-slate-400">
            This Main System Control Dashboard is restricted to the platform owner and service provider.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            Return to Landing Portal
          </button>
        </div>
      </div>
    );
  }

  const totalPlatformEmployees = employees.length;
  const totalPlatformBranches = branches.length;
  const totalPlatformKpis = kpis.length;
  const activeOrgsCount = organizations.filter(
    (o) => (o.serviceStatus || 'Active') === 'Active'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — 4 Concise Nav Links — 1 Primary Action) */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {systemProviderConfig.serviceTitle || 'System Control Plane'}
          </button>

          {/* Zone 2: 4 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('organizations')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                activeTab === 'organizations'
                  ? 'border-orange-500 text-white font-semibold'
                  : 'border-transparent'
              }`}
            >
              Organizations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('capabilities')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                activeTab === 'capabilities'
                  ? 'border-orange-500 text-white font-semibold'
                  : 'border-transparent'
              }`}
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quotas-admins')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                activeTab === 'quotas-admins'
                  ? 'border-orange-500 text-white font-semibold'
                  : 'border-transparent'
              }`}
            >
              Quotas & Admins
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('usage-security')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                activeTab === 'usage-security'
                  ? 'border-orange-500 text-white font-semibold'
                  : 'border-transparent'
              }`}
            >
              Platform Telemetry
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowProvisionModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Provision Organization
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Executive Context Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Service Provider Control Plane</span>
              <span aria-hidden="true">·</span>
              <span>{systemProviderConfig.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span>{systemProviderConfig.ownerEmail}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Main System Control Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              Dual-Login Portal
            </button>
            <button
              type="button"
              onClick={() => {
                logoutSystemOwner();
                navigate('/');
              }}
              className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              Lock System Session
            </button>
          </div>
        </div>

        {/* Status Feedback Toast */}
        {statusBanner && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-500 hover:text-slate-800 ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Platform-Wide Telemetry Strip (4-column full-width row, tabular-nums) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 font-medium">
              Client Organizations
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {organizations.length}
              </span>
              <span className="text-xs text-emerald-700 font-mono tabular-nums">
                {activeOrgsCount} Active · {organizations.length - activeOrgsCount} Suspended
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 font-medium">
              Provisioned Branches & Units
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {totalPlatformBranches}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Across {organizations.length} tenants
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 font-medium">
              Active Employee Seats
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {totalPlatformEmployees}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {
                  employees.filter((e) => isAdminRole(e.role))
                    .length
                }{' '}
                Org Admins
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 font-medium">
              Tracked KPIs & Periodic Plans
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {totalPlatformKpis + periodicPlans.length}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {backlogPlans.length} Recovery items
              </span>
            </div>
          </div>
        </div>

        {/* Mobile / Secondary Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'organizations'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            01. Client Organizations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('capabilities')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'capabilities'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            02. Module Capabilities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quotas-admins')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'quotas-admins'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            03. Seat Quotas & Org Admins
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('usage-security')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'usage-security'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            04. Usage Telemetry & Owner Passkey
          </button>
        </div>

        {/* TAB 1: CLIENT ORGANIZATIONS & PROVISIONING */}
        {activeTab === 'organizations' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  01. Provisioned Client Organizations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create, inspect, suspend, or launch into any client organization workspace as the service provider.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter organizations by name, code, sector..."
                  className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 w-64"
                />
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  + New Organization
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-5">Organization & Sector</th>
                    <th className="py-3 px-4">Service Status</th>
                    <th className="py-3 px-4">Service Plan</th>
                    <th className="py-3 px-4 text-right">Seats Used</th>
                    <th className="py-3 px-4 text-right">Branches</th>
                    <th className="py-3 px-4 text-right">Modules</th>
                    <th className="py-3 px-5 text-right">Provider Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredOrganizations.map((org) => {
                    const metrics = orgMetricsMap.get(org.id);
                    const status = org.serviceStatus || 'Active';
                    const quotas = org.quotas || DEFAULT_ORGANIZATION_QUOTAS;
                    const caps = {
                      ...DEFAULT_ORGANIZATION_CAPABILITIES,
                      ...(org.capabilities || {}),
                    };
                    const enabledCapsCount =
                      Object.values(caps).filter(Boolean).length;

                    return (
                      <tr
                        key={org.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-900">
                            {org.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{org.code}</span>
                            <span aria-hidden="true">·</span>
                            <span>{org.sector}</span>
                            <span aria-hidden="true">·</span>
                            <span>{org.headquarters || 'HQ'}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <select
                            aria-label={`Service status for ${org.name}`}
                            value={status}
                            onChange={(e) =>
                              handleToggleOrgStatus(
                                org,
                                e.target.value as OrganizationServiceStatus
                              )
                            }
                            className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer ${
                              status === 'Active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : status === 'Suspended'
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <option value="Active">Active (Operational)</option>
                            <option value="Trial">Trial Evaluation</option>
                            <option value="Suspended">Suspended (Blocked)</option>
                          </select>
                        </td>

                        <td className="py-4 px-4">
                          <select
                            aria-label={`Plan tier for ${org.name}`}
                            value={org.planTier || 'Enterprise'}
                            onChange={(e) =>
                              handleChangePlanTier(
                                org,
                                e.target.value as OrganizationServicePlanTier
                              )
                            }
                            className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                          >
                            <option value="Starter">Starter Tier</option>
                            <option value="Enterprise">Enterprise Tier</option>
                            <option value="Custom Service Plan">
                              Custom Service Plan
                            </option>
                          </select>
                        </td>

                        <td className="py-4 px-4 text-right font-mono tabular-nums text-xs">
                          <span className="font-semibold text-slate-900">
                            {metrics?.employeeCount || 0}
                          </span>
                          <span className="text-slate-400">
                            {' '}
                            / {quotas.maxEmployees}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right font-mono tabular-nums text-xs">
                          <span className="font-semibold text-slate-900">
                            {metrics?.branchCount || 0}
                          </span>
                          <span className="text-slate-400">
                            {' '}
                            / {quotas.maxBranches}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right font-mono tabular-nums text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrgId(org.id);
                              setActiveTab('capabilities');
                            }}
                            className="text-orange-700 hover:underline font-semibold cursor-pointer"
                          >
                            {enabledCapsCount} / 7 Enabled
                          </button>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleEnterOrganizationWorkspace(org)
                              }
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
                            >
                              Open Workspace &rarr;
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrgId(org.id);
                                setAdminTargetOrgId(org.id);
                                setActiveTab('quotas-admins');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap"
                            >
                              Configure
                            </button>
                            {organizations.length > 1 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteOrganization(org.id);
                                  showToast(
                                    'success',
                                    `Removed organization "${org.name}".`
                                  );
                                }}
                                className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: CAPABILITY & MODULE ACCESS MATRIX */}
        {activeTab === 'capabilities' && selectedOrg && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  02. Per-Organization Capability & Module Governance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control which application features and modules are enabled for each client organization. Disabled modules are automatically hidden from the organization workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select organization for capabilities"
                  value={selectedOrg.id}
                  onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg outline-none cursor-pointer"
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleApplyCapabilityPreset(selectedOrg, 'all')}
                  className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
                >
                  Enable All Modules
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyCapabilityPreset(selectedOrg, 'core')
                  }
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
                >
                  Core Starter Only
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {CAPABILITY_DEFINITIONS.map((cap) => {
                const orgCaps = {
                  ...DEFAULT_ORGANIZATION_CAPABILITIES,
                  ...(selectedOrg.capabilities || {}),
                };
                const isEnabled = Boolean(orgCaps[cap.key]);

                return (
                  <div
                    key={cap.key}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-900">
                        {cap.label}
                      </div>
                      <p className="text-xs text-slate-500">{cap.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          isEnabled ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={() =>
                          handleToggleCapability(selectedOrg, cap.key)
                        }
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                          isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: SEAT QUOTAS & ORGANIZATION ADMINS */}
        {activeTab === 'quotas-admins' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Quotas per Organization */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  03. Organization Seat, Branch & Storage Quotas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure resource limits allocated to each client organization.
                </p>
              </div>

              <div className="divide-y divide-slate-200">
                {organizations.map((org) => {
                  const metrics = orgMetricsMap.get(org.id);
                  const quotas = org.quotas || DEFAULT_ORGANIZATION_QUOTAS;
                  const empPct = Math.min(
                    100,
                    Math.round(
                      ((metrics?.employeeCount || 0) /
                        Math.max(1, quotas.maxEmployees)) *
                        100
                    )
                  );

                  return (
                    <div key={org.id} className="py-5 first:pt-1 last:pb-1 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {org.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-mono">{org.code}</span>
                            <span aria-hidden="true">·</span>
                            <span>{org.planTier || 'Enterprise'}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Admins:{' '}
                              {metrics?.admins
                                .map((a) => `@${a.username || a.name}`)
                                .join(', ') || 'None assigned'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setAdminTargetOrgId(org.id)}
                          className="text-xs font-semibold text-orange-700 hover:underline cursor-pointer"
                        >
                          Assign Admin &rarr;
                        </button>
                      </div>

                      {/* Seat utilization bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600">
                          <span>
                            Employee Seats: {metrics?.employeeCount || 0} /{' '}
                            {quotas.maxEmployees}
                          </span>
                          <span>{empPct}% utilized</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              empPct > 90 ? 'bg-red-600' : 'bg-slate-900'
                            }`}
                            style={{ width: `${empPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Editable Quota Inputs */}
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Max Employee Seats
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={quotas.maxEmployees}
                            onChange={(e) =>
                              handleUpdateQuotas(
                                org,
                                Number(e.target.value),
                                quotas.maxBranches,
                                quotas.maxStorageMb
                              )
                            }
                            className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Max Branches
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={quotas.maxBranches}
                            onChange={(e) =>
                              handleUpdateQuotas(
                                org,
                                quotas.maxEmployees,
                                Number(e.target.value),
                                quotas.maxStorageMb
                              )
                            }
                            className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Storage Quota (MB)
                          </label>
                          <input
                            type="number"
                            min={50}
                            step={50}
                            value={quotas.maxStorageMb}
                            onChange={(e) =>
                              handleUpdateQuotas(
                                org,
                                quotas.maxEmployees,
                                quotas.maxBranches,
                                Number(e.target.value)
                              )
                            }
                            className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Assign / Reset Organization Admin */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900">
                  Assign or Reset Organization Admin
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create or update the primary HQ Super Admin / Admin account for a client organization.
                </p>
              </div>

              <form onSubmit={handleAssignOrgAdmin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Client Organization
                  </label>
                  <select
                    value={adminTargetOrgId}
                    onChange={(e) => setAdminTargetOrgId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Administrator Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={assignName}
                    onChange={(e) => setAssignName(e.target.value)}
                    placeholder="e.g. Dawit Mekonnen"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Login Username
                    </label>
                    <input
                      type="text"
                      required
                      value={assignUsername}
                      onChange={(e) => setAssignUsername(e.target.value)}
                      placeholder="e.g. dawit.admin"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hierarchy Role
                    </label>
                    <select
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value as Role)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      <option value={Role.SUPER_ADMIN}>Super Admin (Org)</option>
                      <option value={Role.ADMIN}>Admin (HQ)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recovery & Notification Email
                  </label>
                  <input
                    type="email"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    placeholder="admin@client-organization.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      required
                      value={assignPassword}
                      onChange={(e) => setAssignPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quick Access PIN
                    </label>
                    <input
                      type="text"
                      required
                      value={assignPin}
                      onChange={(e) => setAssignPin(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingAdmin}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-60"
                >
                  {isSavingAdmin
                    ? 'Provisioning Admin...'
                    : 'Save & Assign Organization Admin'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: CROSS-ORGANIZATION USAGE TELEMETRY & OWNER PASSKEY */}
        {activeTab === 'usage-security' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Cross-Org Telemetry Table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  04. Cross-Organization Usage, Storage & KPI Activity
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time operational footprint and Balanced Scorecard activity across all client tenants.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-3 text-right">Employees</th>
                      <th className="py-3 px-3 text-right">KPIs & Plans</th>
                      <th className="py-3 px-3 text-right">Backlogs</th>
                      <th className="py-3 px-3 text-right">Audit Logs</th>
                      <th className="py-3 px-4 text-right">Data Footprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {organizations.map((org) => {
                      const m = orgMetricsMap.get(org.id);
                      return (
                        <tr key={org.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {org.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {org.code} · {org.serviceStatus || 'Active'}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {m?.employeeCount || 0}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {(m?.kpiCount || 0) + (m?.planCount || 0)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {m?.clearedBacklogs || 0}/{m?.backlogCount || 0} cleared
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {m?.auditCount || 0}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {m?.estimatedStorageKb || 12} KB
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 5 Cols: Owner Master Passkey & Secret PIN Security */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900">
                  Owner / Developer Security & Master Passkey
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your Service Provider identity and rotate the Master Passkey or Secret PIN used on the Main System Dashboard Login.
                </p>
              </div>

              <form onSubmit={handleSaveSystemCredentials} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform Service Title
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceTitleInput}
                    onChange={(e) => setServiceTitleInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Owner / Developer Name
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerNameInput}
                      onChange={(e) => setOwnerNameInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      required
                      value={ownerEmailInput}
                      onChange={(e) => setOwnerEmailInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      System Master Passkey
                    </label>
                    <input
                      type="text"
                      required
                      value={newPasskeyInput}
                      onChange={(e) => setNewPasskeyInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Secret System PIN
                    </label>
                    <input
                      type="text"
                      required
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Update System Owner Credentials
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* PROVISION NEW CLIENT ORGANIZATION MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Provision New Client Organization
                </h2>
                <p className="text-xs text-slate-500">
                  Create a new tenant workspace, seed its HQ branch, and optionally assign its initial Super Admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleProvisionOrganization} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g.Abyssinia Logistics & Supply"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Code *
                  </label>
                  <input
                    type="text"
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value)}
                    placeholder="e.g. ALS-HQ"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Industry Sector
                  </label>
                  <select
                    value={newOrgSector}
                    onChange={(e) => setNewOrgSector(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Plan Tier
                  </label>
                  <select
                    value={newOrgTier}
                    onChange={(e) =>
                      setNewOrgTier(
                        e.target.value as OrganizationServicePlanTier
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Enterprise">Enterprise Tier</option>
                    <option value="Starter">Starter Tier</option>
                    <option value="Custom Service Plan">
                      Custom Service Plan
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Headquarters Location
                  </label>
                  <input
                    type="text"
                    value={newOrgHq}
                    onChange={(e) => setNewOrgHq(e.target.value)}
                    placeholder="Addis Ababa, Bole"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Employee Seats
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newOrgMaxEmployees}
                    onChange={(e) =>
                      setNewOrgMaxEmployees(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Branches
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newOrgMaxBranches}
                    onChange={(e) =>
                      setNewOrgMaxBranches(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-2">
                  Initial Organization Super Admin (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Admin Full Name (e.g. Meron Tadesse)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="Admin Username (e.g. meron.admin)"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Initial Password"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value)}
                    placeholder="Quick PIN (e.g. 1111)"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-60"
                >
                  {isProvisioning
                    ? 'Provisioning...'
                    : 'Provision Organization & Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemDashboardPage;
