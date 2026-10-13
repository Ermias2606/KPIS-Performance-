import React, { useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Branch, Role, BacklogNotice, BacklogPriority } from '../types';

export const BranchAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    branches,
    activeBranchId,
    setActiveBranchId,
    fiscalYear,
    setFiscalYear,
    addBranch,
    updateBranch,
    deleteBranch,
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

  // Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // New Branch Form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchDistrict, setNewBranchDistrict] = useState('West Hararghe District');
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
  const [selectedPlanToMove, setSelectedPlanToMove] = useState<{ id: number; name: string; type: 'periodic' | 'annual' | 'backlog' } | null>(null);
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
    return employees.filter(e => e.branchId === activeBranchId && e.role !== Role.ADMIN);
  }, [employees, activeBranchId]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !newBranchCode.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await addBranch({
        name: newBranchName.trim(),
        code: newBranchCode.trim().toUpperCase(),
        district: newBranchDistrict.trim(),
        fiscalYear: newBranchFiscalYear,
        juneClosingDepositBalance: Number(newBranchJuneDeposit) || 0,
        openingDate: newBranchOpeningDate,
        isActive: false,
      });
      setShowAddBranchModal(false);
      setNewBranchName('');
      setNewBranchCode('');
      setSuccessBanner(`Branch "${created.name}" (${created.code}) created successfully.`);
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
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Administrator Access Required</h2>
        <p className="text-sm text-slate-500 mt-2">Only HQ Administrators can configure branches and fiscal year cycles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-800 rounded-full border border-sky-200">
              HQ Administration Portal
            </span>
            <span className="text-xs text-slate-400 font-mono">FY {activeBranch?.fiscalYear || fiscalYear}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Branch Management & Fiscal Year Configuration
          </h1>
          <p className="text-sm text-slate-500">
            Create branches, manage baseline deposit June balances, assign periodic plans, and monitor auto-calculated shortfall notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/network')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 cursor-pointer border border-slate-300"
          >
            <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <span>Branch LAN & Multi-Device Hub</span>
          </button>
          <button
            onClick={() => setShowAddBranchModal(true)}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Branch</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Branch Overview & June Baseline Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-sky-100">
                {activeBranch?.code?.slice(0, 2) || 'RB'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-900">{activeBranch?.name}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                    {activeBranch?.code || 'RTU-01'}
                  </span>
                  {activeBranch?.isActive && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                      Primary Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeBranch?.district || 'West Hararghe District'} • Opened: {activeBranch?.openingDate || '2021-07-01'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingBranch(activeBranch);
                  setShowEditBranchModal(true);
                }}
                className="px-3 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Edit Branch Details
              </button>
            </div>
          </div>

          {/* June Baseline & Deposit Increment Metric Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Previous June Closing Balance
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {(depositMetrics.juneBaseline / 1000000).toFixed(2)}M ETB
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Audited baseline closing deposit as of June 30
              </p>
            </div>

            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider block">
                Target Increment / Net Target
              </span>
              <div className="text-xl font-bold text-sky-900 mt-1 font-mono">
                +{(depositMetrics.annualTargetIncrement / 1000000).toFixed(2)}M ETB
              </div>
              <p className="text-[11px] text-sky-600 mt-1">
                Mobilization target over June baseline
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${depositMetrics.isUnderJuneBalance ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-wider block ${depositMetrics.isUnderJuneBalance ? 'text-red-700' : 'text-emerald-700'}`}>
                  Current Net Growth
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${depositMetrics.isUnderJuneBalance ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}`}>
                  {depositMetrics.isUnderJuneBalance ? 'Under June' : 'Above June'}
                </span>
              </div>
              <div className={`text-xl font-bold mt-1 font-mono ${depositMetrics.isUnderJuneBalance ? 'text-red-700' : 'text-emerald-700'}`}>
                {depositMetrics.isUnderJuneBalance ? '-' : '+'}
                {(depositMetrics.actualNetIncrement / 1000000).toFixed(2)}M ETB
              </div>
              <p className={`text-[11px] mt-1 ${depositMetrics.isUnderJuneBalance ? 'text-red-600' : 'text-emerald-600'}`}>
                Total balance: {(depositMetrics.currentDepositBalance / 1000000).toFixed(2)}M ETB ({depositMetrics.incrementAchievement}% target)
              </p>
            </div>
          </div>

          {/* Quick Branch Switcher Pill Selector */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Switch Active Branch Context:
            </span>
            <div className="flex items-center space-x-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setActiveBranchId(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
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
              <p className="text-xs text-slate-500">Bank Financial Year Alignment</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Sets the evaluation cycle for annual objectives, quarterly targets, monthly distributions, and June closing balance comparisons.
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
                <span className="text-slate-500">Ethiopian Calendar:</span>
                <span className="font-semibold text-slate-800">Hamle 01 - Sene 30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quarter Alignment:</span>
                <span className="font-semibold text-slate-800">Q1-Q4 (3 Months each)</span>
              </div>
            </div>

            <button
              onClick={handleFiscalYearUpdate}
              disabled={isUpdatingFiscalYear || selectedFiscalYear === activeBranch?.fiscalYear}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1"
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
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">
                  {backlogNotices.length} Active Shortfalls
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically scans period variations (Plan minus Actual). Alerts administrators where actual performance lagged behind target.
              </p>
            </div>
          </div>
        </div>

        {backlogNotices.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
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
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      notice.severity === 'High' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {notice.severity} Deficit
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
                    {notice.employeeName && (
                      <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                        Assigned to: {notice.employeeName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelectedNoticeForConversion(notice);
                      setConversionAssigneeId(notice.employeeId || branchEmployees[0]?.id);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1"
                  >
                    <span>Create Recovery Plan</span>
                  </button>
                  <button
                    onClick={() => dismissNotice(notice.id)}
                    className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition"
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
            <h3 className="text-lg font-bold text-slate-900">Branch Plan Assignments & Movement</h3>
            <p className="text-xs text-slate-500">
              Move branch annual, periodic (quarterly/monthly), and backlog recovery plans across branch entities.
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
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                  >
                    Move Branch &rarr;
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
                      {obj.category} • Weight: {obj.weight}%
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanToMove({ id: obj.id, name: obj.objective, type: 'annual' })}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                  >
                    Move Branch &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Backlog Recovery Plans */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Backlog Recovery Plans ({backlogPlans.length})</span>
              <span className="text-[11px] text-amber-600 font-normal">Arrears Recovery</span>
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
                      Shortfall: {item.backlogTarget.toLocaleString()} {item.metricUnit} • {item.status}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanToMove({ id: item.id, name: item.title, type: 'backlog' })}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                  >
                    Move Branch &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Modal: Create New Branch */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create New Branch</h3>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asbe Teferi Main Branch"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ATF-02"
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
                  District / Zone
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
                  June Closing Deposit Baseline (ETB)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 320000000"
                  value={newBranchJuneDeposit}
                  onChange={e => setNewBranchJuneDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  End of previous year closing balance to measure net mobilization growth.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Branch Opening Date
                </label>
                <input
                  type="date"
                  value={newBranchOpeningDate}
                  onChange={e => setNewBranchOpeningDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
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
                  {isSubmitting ? 'Creating...' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Active Branch */}
      {showEditBranchModal && editingBranch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Branch Details</h3>
              <button onClick={() => setShowEditBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    value={editingBranch.code || ''}
                    onChange={e => setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-sky-500"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  June Closing Deposit Balance (ETB)
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
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
                  {isSubmitting ? 'Saving...' : 'Update Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Convert Backlog Notice into Plan */}
      {selectedNoticeForConversion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {branchEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.positionTitle || emp.role})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Assigning will add this recovery item to the employee's scorecard backlog task list.
                </span>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Move Plan to Another Branch</h3>
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
                  Destination Branch
                </label>
                <select
                  value={targetBranchToMoveTo}
                  onChange={e => setTargetBranchToMoveTo(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500"
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
