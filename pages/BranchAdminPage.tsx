import React, { useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Branch, Organization, OrganizationSector, OrganizationPositionRole, Role, isAdminRole, BacklogNotice } from '../types';
import { getDefaultPositionsForSector } from '../constants';

const ORGANIZATION_SECTORS: OrganizationSector[] = [
  'Manufacturing & Production',
  'Service & Hospitality',
  'Financial & Banking Services',
  'Technology & SaaS',
  'Healthcare & Medical',
  'Retail & Supply Chain',
  'Agriculture & Agro-Processing',
  'Education & Research',
  'Public Sector & NGO',
];

const PRESET_ORG_LOGOS = [
  {
    label: 'Enterprise & Service',
    url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
  },
  {
    label: 'Manufacturing & Industry',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=120&auto=format&fit=crop&q=80',
  },
  {
    label: 'Financial & Corporate',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=120&auto=format&fit=crop&q=80',
  },
  {
    label: 'Technology & Innovation',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=120&auto=format&fit=crop&q=80',
  },
  {
    label: 'Logistics & Supply Chain',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=120&auto=format&fit=crop&q=80',
  },
];

export const BranchAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    organizations,
    activeOrganization,
    activeOrganizationId,
    setActiveOrganizationId,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    branches,
    activeBranchId,
    setActiveBranchId,
    fiscalYear,
    setFiscalYear,
    addBranch,
    updateBranch,
    employees,
    periodicPlans,
    backlogPlans,
    annualPlan,
    movePlanToBranch,
    getCalculatedBacklogNotices,
    convertNoticeToBacklogPlan,
    dismissNotice,
    getDepositMobilizationMetrics,
  } = useData();

  // Organization Modals state
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  // New Organization Form state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgSector, setNewOrgSector] = useState<OrganizationSector>('Manufacturing & Production');
  const [newOrgLogoUrl, setNewOrgLogoUrl] = useState(PRESET_ORG_LOGOS[0].url);
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [newOrgHeadquarters, setNewOrgHeadquarters] = useState('Main Corporate Headquarters');
  const [newOrgCurrency, setNewOrgCurrency] = useState('ETB');
  const [newOrgPositions, setNewOrgPositions] = useState<OrganizationPositionRole[]>(() =>
    getDefaultPositionsForSector('Manufacturing & Production')
  );
  const [customPosTitle, setCustomPosTitle] = useState('');
  const [customPosDept, setCustomPosDept] = useState('');
  const [customPosRole, setCustomPosRole] = useState<Role>(Role.OFFICER);

  // Branch Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // New Branch Form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchOrgId, setNewBranchOrgId] = useState<number>(activeOrganizationId || 1);
  const [newBranchDistrict, setNewBranchDistrict] = useState('Central Operations District');
  const [newBranchFiscalYear, setNewBranchFiscalYear] = useState(fiscalYear || '2024/2025');
  const [newBranchJuneDeposit, setNewBranchJuneDeposit] = useState<number>(320000000);
  const [newBranchOpeningDate, setNewBranchOpeningDate] = useState('2021-07-01');

  // Convert notice modal
  const [selectedNoticeForConversion, setSelectedNoticeForConversion] = useState<BacklogNotice | null>(null);
  const [conversionAssigneeId, setConversionAssigneeId] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Fiscal year change state
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(fiscalYear);
  const [isUpdatingFiscalYear, setIsUpdatingFiscalYear] = useState(false);

  // Move plan state
  const [selectedPlanToMove, setSelectedPlanToMove] = useState<{
    id: number;
    name: string;
    type: 'periodic' | 'annual' | 'backlog';
  } | null>(null);
  const [targetBranchToMoveTo, setTargetBranchToMoveTo] = useState<number>(branches[0]?.id || 1);

  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches[0];
  }, [branches, activeBranchId]);

  const depositMetrics = useMemo(() => {
    return getDepositMobilizationMetrics(activeBranchId);
  }, [getDepositMobilizationMetrics, activeBranchId]);

  const backlogNotices = useMemo(() => {
    return getCalculatedBacklogNotices();
  }, [getCalculatedBacklogNotices]);

  const branchEmployees = useMemo(() => {
    return employees.filter(e => e.branchId === activeBranchId && !isAdminRole(e.role));
  }, [employees, activeBranchId]);

  const handleLogoFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onResult: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgCode.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await addOrganization({
        name: newOrgName.trim(),
        code: newOrgCode.trim().toUpperCase(),
        sector: newOrgSector,
        logoUrl: newOrgLogoUrl.trim() || undefined,
        description:
          newOrgDescription.trim() ||
          `${newOrgSector} organization managed via Performance Tracker.`,
        headquarters: newOrgHeadquarters.trim() || 'Corporate HQ',
        primaryCurrency: newOrgCurrency.trim() || 'ETB',
        establishedDate: new Date().toISOString().split('T')[0],
        isActive: true,
        requiredPositions:
          newOrgPositions.length > 0
            ? newOrgPositions
            : getDefaultPositionsForSector(newOrgSector),
      });
      setActiveOrganizationId(created.id);
      setShowAddOrgModal(false);
      setNewOrgName('');
      setNewOrgCode('');
      setNewOrgDescription('');
      setSuccessBanner(
        `Organization "${created.name}" (${created.sector}) created and set as active.`
      );
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setIsSubmitting(true);
    try {
      await updateOrganization(editingOrg);
      setEditingOrg(null);
      setSuccessBanner(`Organization "${editingOrg.name}" updated.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !newBranchCode.trim()) return;
    setIsSubmitting(true);
    try {
      const parentOrg = organizations.find(o => o.id === newBranchOrgId) || activeOrganization;
      const created = await addBranch({
        name: newBranchName.trim(),
        code: newBranchCode.trim().toUpperCase(),
        district: newBranchDistrict.trim(),
        fiscalYear: newBranchFiscalYear,
        juneClosingDepositBalance: Number(newBranchJuneDeposit) || 0,
        openingDate: newBranchOpeningDate,
        isActive: false,
        organizationId: parentOrg?.id,
        sector: parentOrg?.sector,
      });
      setShowAddBranchModal(false);
      setNewBranchName('');
      setNewBranchCode('');
      setSuccessBanner(`Branch/Unit "${created.name}" (${created.code}) created under ${parentOrg?.name || 'Organization'}.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setIsSubmitting(true);
    try {
      await updateBranch(editingBranch);
      setShowEditBranchModal(false);
      setEditingBranch(null);
      setSuccessBanner(`Branch "${editingBranch.name}" configuration updated.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFiscalYearUpdate = async () => {
    setIsUpdatingFiscalYear(true);
    try {
      await setFiscalYear(selectedFiscalYear);
      setSuccessBanner(`Fiscal Year updated to ${selectedFiscalYear} for branch.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingFiscalYear(false);
    }
  };

  const handleConvertNotice = async () => {
    if (!selectedNoticeForConversion) return;
    setIsSubmitting(true);
    try {
      await convertNoticeToBacklogPlan(selectedNoticeForConversion, conversionAssigneeId);
      setSuccessBanner(
        `Created Backlog Recovery Plan from ${selectedNoticeForConversion.periodName} shortfall (${selectedNoticeForConversion.deficit.toLocaleString()} ${selectedNoticeForConversion.metricUnit}).`
      );
      setSelectedNoticeForConversion(null);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMovePlanSubmit = async () => {
    if (!selectedPlanToMove) return;
    setIsSubmitting(true);
    try {
      await movePlanToBranch(selectedPlanToMove.id, Number(targetBranchToMoveTo), selectedPlanToMove.type);
      const targetName = branches.find(b => b.id === Number(targetBranchToMoveTo))?.name || 'Target Branch';
      setSuccessBanner(`Moved "${selectedPlanToMove.name}" to ${targetName}.`);
      setSelectedPlanToMove(null);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== Role.ADMIN) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Administrator Access Required</h2>
          <p className="text-sm text-slate-500 mt-2 mb-5">
            Organization creation, branch management, and fiscal year configuration are reserved for HQ Administrators.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-semibold">
            <span className="text-orange-700">Organization & Governance Setup</span>
            <span aria-hidden="true">·</span>
            <span>{activeOrganization?.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">FY {activeBranch?.fiscalYear || fiscalYear}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Organization, Branch & Fiscal Configuration
          </h1>
          <p className="text-sm text-slate-500">
            Create multi-sector organizations (Manufacturing, Service, Financial, Tech, Healthcare) with custom logos, manage operational branches/units, and configure fiscal cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddOrgModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Organization</span>
          </button>
          <button
            onClick={() => {
              setNewBranchOrgId(activeOrganization?.id || 1);
              setShowAddBranchModal(true);
            }}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Branch / Unit</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* MULTI-PURPOSE ORGANIZATION DIRECTORY & SECTOR MANAGEMENT */}
      {/* =================================================================== */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Multi-Purpose Organizations ({organizations.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an active organization or create new organizations with custom logos and industry sectors (Manufacturing, Service, Financial, Healthcare, Technology, etc.).
            </p>
          </div>
          <button
            onClick={() => setShowAddOrgModal(true)}
            className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            + Add New Organization
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {organizations.map(org => {
            const isSelected = org.id === activeOrganization?.id;
            const orgBranches = branches.filter(b => b.organizationId === org.id);

            return (
              <div
                key={org.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'bg-orange-50/40 border-orange-400 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      {org.logoUrl ? (
                        <img
                          src={org.logoUrl}
                          alt={org.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 text-white font-black text-lg flex items-center justify-center shrink-0">
                          {org.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{org.name}</h3>
                        <p className="text-xs text-orange-700 font-semibold mt-0.5">{org.sector}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Code: {org.code} · {org.headquarters || 'HQ'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {org.description && (
                    <p className="text-xs text-slate-600 mt-3 line-clamp-2">{org.description}</p>
                  )}

                  {/* Organization Required Positions Summary */}
                  <div className="mt-3 p-2.5 bg-white/80 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">
                        Required Positions & Roles ({org.requiredPositions?.length || 5})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOrganizationId(org.id);
                          navigate('/employees');
                        }}
                        className="text-sky-600 hover:text-sky-800 font-bold hover:underline cursor-pointer"
                      >
                        Manage Roles &rarr;
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(org.requiredPositions || []).slice(0, 3).map(pos => (
                        <span
                          key={pos.id}
                          className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium truncate max-w-[180px]"
                        >
                          {pos.title}
                        </span>
                      ))}
                      {(org.requiredPositions?.length || 0) > 3 && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-bold">
                          +{(org.requiredPositions?.length || 0) - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {orgBranches.length} {orgBranches.length === 1 ? 'Branch/Unit' : 'Branches/Units'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingOrg(org)}
                      className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    {organizations.length > 1 && (
                      <button
                        onClick={() => deleteOrganization(org.id)}
                        className="text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setActiveOrganizationId(org.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? 'Active Org' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Active Branch Overview & Baseline Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              {activeOrganization?.logoUrl ? (
                <img
                  src={activeOrganization.logoUrl}
                  alt={activeBranch?.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-sky-100">
                  {activeBranch?.code?.slice(0, 2) || 'UN'}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-900">{activeBranch?.name}</h2>
                  <span className="text-xs font-mono text-slate-500">
                    ({activeBranch?.code || 'UNIT-01'})
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeOrganization?.name} · {activeBranch?.sector || activeOrganization?.sector} ·{' '}
                  {activeBranch?.district || 'Central Operations Zone'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingBranch(activeBranch);
                  setShowEditBranchModal(true);
                }}
                className="px-3 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Edit Branch / Unit
              </button>
            </div>
          </div>

          {/* June Baseline & Financial Target Increment Metric Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Previous Year Closing Baseline
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                {(depositMetrics.juneBaseline / 1000000).toFixed(2)}M {activeOrganization?.primaryCurrency || 'ETB'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Audited baseline closing balance as of June 30
              </p>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider block">
                Target Annual Increment
              </span>
              <div className="text-xl font-bold text-sky-900 mt-1 font-mono tabular-nums">
                +{(depositMetrics.annualTargetIncrement / 1000000).toFixed(2)}M {activeOrganization?.primaryCurrency || 'ETB'}
              </div>
              <p className="text-[11px] text-sky-600 mt-1">
                Planned net growth over prior baseline
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                depositMetrics.isUnderJuneBalance
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider block ${
                    depositMetrics.isUnderJuneBalance ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  Current Net Growth
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    depositMetrics.isUnderJuneBalance ? 'text-red-800' : 'text-emerald-800'
                  }`}
                >
                  {depositMetrics.isUnderJuneBalance ? 'Under Baseline' : 'Above Baseline'}
                </span>
              </div>
              <div
                className={`text-xl font-bold mt-1 font-mono tabular-nums ${
                  depositMetrics.isUnderJuneBalance ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {depositMetrics.isUnderJuneBalance ? '-' : '+'}
                {(depositMetrics.actualNetIncrement / 1000000).toFixed(2)}M {activeOrganization?.primaryCurrency || 'ETB'}
              </div>
              <p
                className={`text-[11px] mt-1 ${
                  depositMetrics.isUnderJuneBalance ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                Total: {(depositMetrics.currentDepositBalance / 1000000).toFixed(2)}M ({depositMetrics.incrementAchievement}% target)
              </p>
            </div>
          </div>

          {/* Quick Branch Switcher Selector */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Switch Active Branch / Operational Unit:
            </span>
            <div className="flex items-center flex-wrap gap-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setActiveBranchId(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeBranchId === b.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {b.name} ({b.code || `ID:${b.id}`})
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Fiscal Year Setting Card */}
        <Card>
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Fiscal Year Cycle</h3>
              <p className="text-xs text-slate-500">Organizational Evaluation Period</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Sets the evaluation cycle for annual objectives, quarterly targets, monthly distributions, and baseline comparisons.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Active Fiscal Year
              </label>
              <select
                value={selectedFiscalYear}
                onChange={e => setSelectedFiscalYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="2023/2024">2023/2024 (Prior Audit Period)</option>
                <option value="2024/2025">2024/2025 (Current Operational Year)</option>
                <option value="2025/2026">2025/2026 (Upcoming Fiscal Strategy)</option>
                <option value="2026/2027">2026/2027 (Long-term BSC Horizon)</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Gregorian Span:</span>
                <span className="font-semibold text-slate-800">July 01 - June 30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quarter Alignment:</span>
                <span className="font-semibold text-slate-800">Q1-Q4 (3 Months each)</span>
              </div>
            </div>

            <button
              onClick={handleFiscalYearUpdate}
              disabled={isUpdatingFiscalYear || selectedFiscalYear === activeBranch?.fiscalYear}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>{isUpdatingFiscalYear ? 'Updating Cycle...' : 'Activate Fiscal Year'}</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Auto-Calculated Backlog Engine & Admin Notice Center */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Automated Backlog Detection & Admin Notice Engine
                </h3>
                <span className="text-xs font-bold text-amber-800">
                  ({backlogNotices.length} Active Shortfalls)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically scans period variations (Plan minus Actual) and alerts administrators where performance lagged behind target.
              </p>
            </div>
          </div>
        </div>

        {backlogNotices.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <p className="font-semibold text-slate-700">All Performance Targets Met or Exceeded</p>
            <p className="text-xs text-slate-400 mt-1">No plan variations or arrears requiring recovery intervention.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {backlogNotices.map(notice => (
              <div
                key={notice.id}
                className="py-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/80 p-2.5 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold ${
                        notice.severity === 'High' ? 'text-red-700' : 'text-amber-800'
                      }`}
                    >
                      {notice.severity} Deficit ·
                    </span>
                    <span className="text-sm font-bold text-slate-800">{notice.kpiName}</span>
                    <span className="text-xs text-slate-400 font-mono">[{notice.category}]</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>Period: <strong className="text-slate-800">{notice.periodName}</strong></span>
                    <span>Target: {notice.target.toLocaleString()} {notice.metricUnit}</span>
                    <span>Actual: {notice.actual.toLocaleString()} {notice.metricUnit}</span>
                    <span className="text-red-600 font-semibold">
                      Shortfall: -{notice.deficit.toLocaleString()} {notice.metricUnit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelectedNoticeForConversion(notice);
                      setConversionAssigneeId(notice.employeeId || branchEmployees[0]?.id);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Create Recovery Plan
                  </button>
                  <button
                    onClick={() => dismissNotice(notice.id)}
                    className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Plan Migration & Assignment Matrix */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Branch / Unit Plan Assignments & Movement</h3>
            <p className="text-xs text-slate-500">
              Move annual, periodic (quarterly/monthly), and backlog recovery plans across organizational branches or units.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Periodic Plans */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Periodic Plans ({periodicPlans.length})</span>
              <span className="text-[11px] text-sky-600 font-normal">Quarterly/Monthly</span>
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {periodicPlans.map(plan => (
                <div
                  key={plan.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{plan.name}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Target: {plan.annualTarget.toLocaleString()} {plan.metricUnit}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanToMove({ id: plan.id, name: plan.name, type: 'periodic' })}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                  >
                    Move Unit &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Annual Plan Objectives */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Annual Objectives ({annualPlan.length})</span>
              <span className="text-[11px] text-emerald-600 font-normal">BSC Strategic</span>
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {annualPlan.map(obj => (
                <div
                  key={obj.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{obj.objective}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {obj.category} · Weight: {obj.weight}%
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanToMove({ id: obj.id, name: obj.objective, type: 'annual' })}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                  >
                    Move Unit &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Backlog Recovery Plans */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Backlog Recovery Plans ({backlogPlans.length})</span>
              <span className="text-[11px] text-amber-600 font-normal">Shortfall Recovery</span>
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {backlogPlans.map(item => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Shortfall: {item.backlogTarget.toLocaleString()} {item.metricUnit} · {item.status}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanToMove({ id: item.id, name: item.title, type: 'backlog' })}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                  >
                    Move Unit &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* =================================================================== */}
      {/* MODAL: CREATE NEW ORGANIZATION */}
      {/* =================================================================== */}
      {showAddOrgModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Organization</h3>
                <p className="text-xs text-slate-500">Configure organization identity, industry sector, and brand logo</p>
              </div>
              <button onClick={() => setShowAddOrgModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Horizon Manufacturing PLC"
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Org Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HMP-01"
                    value={newOrgCode}
                    onChange={e => setNewOrgCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Industry / Sector Type
                  </label>
                  <select
                    value={newOrgSector}
                    onChange={e => {
                      const sec = e.target.value;
                      setNewOrgSector(sec);
                      setNewOrgPositions(getDefaultPositionsForSector(sec));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {ORGANIZATION_SECTORS.map(sec => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Primary Currency / Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ETB, USD, Units"
                    value={newOrgCurrency}
                    onChange={e => setNewOrgCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Organization Logo Upload & Preset Picker */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Organization Logo
                  </label>
                  <label className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer">
                    Upload Logo Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleLogoFileUpload(e, url => setNewOrgLogoUrl(url))}
                    />
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  {newOrgLogoUrl ? (
                    <img
                      src={newOrgLogoUrl}
                      alt="Logo Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
                      {newOrgName ? newOrgName.charAt(0).toUpperCase() : 'O'}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Or paste logo image URL..."
                    value={newOrgLogoUrl}
                    onChange={e => setNewOrgLogoUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
                    Or Select Sector Logo Preset:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_ORG_LOGOS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setNewOrgLogoUrl(preset.url)}
                        className={`flex items-center space-x-1.5 p-1.5 rounded-lg border text-[11px] font-medium shrink-0 cursor-pointer ${
                          newOrgLogoUrl === preset.url
                            ? 'border-orange-500 bg-orange-50 text-orange-800'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-6 h-6 rounded object-cover" />
                        <span>{preset.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Headquarters / Location
                </label>
                <input
                  type="text"
                  value={newOrgHeadquarters}
                  onChange={e => setNewOrgHeadquarters(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Mission / Organization Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the organization's core operations and strategic focus..."
                  value={newOrgDescription}
                  onChange={e => setNewOrgDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Required Positions & Roles to Maintain Organization */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase">
                      Required Positions & Roles ({newOrgPositions.length})
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Specific positions and system hierarchy roles required to maintain this {newOrgSector} organization
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {newOrgPositions.map((pos, idx) => (
                    <div
                      key={pos.id}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-800 block truncate">{pos.title}</span>
                        <span className="text-[10px] text-slate-500">
                          {pos.department} · System Role: <strong>{pos.systemRole}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setNewOrgPositions(newOrgPositions.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5 cursor-pointer"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add required position title..."
                    value={customPosTitle}
                    onChange={e => setCustomPosTitle(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Department..."
                    value={customPosDept}
                    onChange={e => setCustomPosDept(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  />
                  <div className="flex gap-1">
                    <select
                      value={customPosRole}
                      onChange={e => setCustomPosRole(e.target.value as Role)}
                      className="flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold outline-none"
                    >
                      <option value={Role.SUPER_ADMIN}>Super Admin</option>
                      <option value={Role.ADMIN}>Admin (HQ)</option>
                      <option value={Role.MANAGER}>Manager</option>
                      <option value={Role.OFFICER}>Officer</option>
                      <option value={Role.STAFF}>Staff</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!customPosTitle.trim()) return;
                        setNewOrgPositions([
                          ...newOrgPositions,
                          {
                            id: 'pos-' + Date.now(),
                            title: customPosTitle.trim(),
                            department: customPosDept.trim() || 'Operations',
                            systemRole: customPosRole,
                            requiredCount: 1,
                            isRequired: true,
                          },
                        ]);
                        setCustomPosTitle('');
                        setCustomPosDept('');
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT ORGANIZATION */}
      {/* =================================================================== */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Organization</h3>
              <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-slate-600 text-xl">
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateOrganization} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingOrg.name}
                    onChange={e => setEditingOrg({ ...editingOrg, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Org Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editingOrg.code}
                    onChange={e => setEditingOrg({ ...editingOrg, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Industry / Sector Type
                </label>
                <select
                  value={editingOrg.sector}
                  onChange={e => setEditingOrg({ ...editingOrg, sector: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                >
                  {ORGANIZATION_SECTORS.map(sec => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Organization Logo
                  </label>
                  <label className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer">
                    Upload New Logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e =>
                        handleLogoFileUpload(e, url => setEditingOrg({ ...editingOrg, logoUrl: url }))
                      }
                    />
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  {editingOrg.logoUrl && (
                    <img
                      src={editingOrg.logoUrl}
                      alt={editingOrg.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    value={editingOrg.logoUrl || ''}
                    onChange={e => setEditingOrg({ ...editingOrg, logoUrl: e.target.value })}
                    placeholder="Logo URL..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingOrg.description || ''}
                  onChange={e => setEditingOrg({ ...editingOrg, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Branch */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create New Branch / Operational Unit</h3>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Parent Organization
                </label>
                <select
                  value={newBranchOrgId}
                  onChange={e => setNewBranchOrgId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.sector})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Branch / Unit Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern Manufacturing Plant / Main Service Branch"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Unit Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NMP-02"
                    value={newBranchCode}
                    onChange={e => setNewBranchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Fiscal Year
                  </label>
                  <input
                    type="text"
                    value={newBranchFiscalYear}
                    onChange={e => setNewBranchFiscalYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  District / Operational Zone
                </label>
                <input
                  type="text"
                  value={newBranchDistrict}
                  onChange={e => setNewBranchDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Prior Year Closing Baseline ({activeOrganization?.primaryCurrency || 'ETB'})
                </label>
                <input
                  type="number"
                  required
                  value={newBranchJuneDeposit}
                  onChange={e => setNewBranchJuneDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {isSubmitting ? 'Creating...' : 'Save Branch / Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Active Branch */}
      {showEditBranchModal && editingBranch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Branch / Unit Details</h3>
              <button onClick={() => setShowEditBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Branch / Unit Name
                </label>
                <input
                  type="text"
                  required
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Unit Code
                  </label>
                  <input
                    type="text"
                    value={editingBranch.code || ''}
                    onChange={e => setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Fiscal Year
                  </label>
                  <input
                    type="text"
                    value={editingBranch.fiscalYear || '2024/2025'}
                    onChange={e => setEditingBranch({ ...editingBranch, fiscalYear: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Prior Year Closing Baseline ({activeOrganization?.primaryCurrency || 'ETB'})
                </label>
                <input
                  type="number"
                  required
                  value={editingBranch.juneClosingDepositBalance ?? 320000000}
                  onChange={e =>
                    setEditingBranch({
                      ...editingBranch,
                      juneClosingDepositBalance: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  District / Zone
                </label>
                <input
                  type="text"
                  value={editingBranch.district || ''}
                  onChange={e => setEditingBranch({ ...editingBranch, district: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditBranchModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Update Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Convert Backlog Notice into Plan */}
      {selectedNoticeForConversion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create Backlog Recovery Plan</h3>
              <button onClick={() => setSelectedNoticeForConversion(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                <p className="font-bold text-amber-900">{selectedNoticeForConversion.kpiName}</p>
                <p className="text-amber-700 mt-1">
                  Deficit Detected: <strong>{selectedNoticeForConversion.deficit.toLocaleString()} {selectedNoticeForConversion.metricUnit}</strong> ({selectedNoticeForConversion.periodName})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Assign Recovery Officer
                </label>
                <select
                  value={conversionAssigneeId}
                  onChange={e => setConversionAssigneeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                >
                  {branchEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.positionTitle || emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedNoticeForConversion(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertNotice}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {isSubmitting ? 'Creating Plan...' : 'Create & Assign Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Move Plan to Branch */}
      {selectedPlanToMove && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Move Plan to Another Unit</h3>
              <button onClick={() => setSelectedPlanToMove(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-800">
                Plan to move: <strong className="font-bold">{selectedPlanToMove.name}</strong> ({selectedPlanToMove.type})
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Destination Branch / Unit
                </label>
                <select
                  value={targetBranchToMoveTo}
                  onChange={e => setTargetBranchToMoveTo(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanToMove(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMovePlanSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold"
                >
                  {isSubmitting ? 'Transferring...' : 'Confirm Move'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchAdminPage;
