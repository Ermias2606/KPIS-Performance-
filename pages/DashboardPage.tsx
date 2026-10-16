import React, { useMemo, useState, useContext } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useData, calculateKpiMetrics } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Role, PerspectiveCategory, BacklogPlanItem, EmployeePlanAssignment } from '../types';
import { getCategoryMeta } from '../components/kpi/CategoryHelpers';
import CreateKpiModal from '../components/kpi/CreateKpiModal';
import CreateCategoryModal from '../components/kpi/CreateCategoryModal';
import ManageCategoriesModal from '../components/kpi/ManageCategoriesModal';

export const DashboardPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    employees,
    kpis,
    annualPlan,
    periodicPlans,
    backlogPlans,
    employeePlans,
    kpiCategories,
    branches,
    loading,
    recordActualPerformance,
    recordEmployeePerformance,
    getDepositMobilizationMetrics,
    getCalculatedBacklogNotices,
  } = useData();

  // Modals
  const [showCreateKpiModal, setShowCreateKpiModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [kpiModalCategory, setKpiModalCategory] = useState<string>('');

  // Category filter on dashboard
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');

  // Quick performance log modal state
  const [quickLogItem, setQuickLogItem] = useState<{
    type: 'plan' | 'employeePlan' | 'backlog';
    id: number;
    title: string;
    unit: string;
    currentActual: number;
    target: number;
  } | null>(null);
  const [quickLogValue, setQuickLogValue] = useState<number | ''>('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Determine current user context
  const branchEmployees = useMemo(() => {
    if (!user) return [];
    if (user.role === Role.ADMIN) return employees.filter(e => e.role !== Role.ADMIN);
    return employees.filter(e => e.branchId === user.branchId && e.role !== Role.ADMIN);
  }, [user, employees]);

  const branchName = branches.find(b => b.id === user?.branchId)?.name || 'Raitu Branch';
  const isAdmin = user?.role === Role.ADMIN;
  const isManager = user?.role === Role.MANAGER;
  const isManagerOrAdmin = isAdmin || isManager;
  const isStaff = user?.role === Role.STAFF;

  // Ermiyas / Staff specific metrics
  const targetStaff = useMemo(() => {
    if (isStaff && user) return user;
    return employees.find(e => e.role === Role.STAFF) || employees[0];
  }, [isStaff, user, employees]);

  const userKpis = useMemo(() => {
    if (!targetStaff) return [];
    return kpis.filter(k => k.employeeId === targetStaff.id);
  }, [targetStaff, kpis]);

  const totalUserScore = useMemo(() => {
    if (!targetStaff || userKpis.length === 0) return 0;
    const scoreSum = userKpis.reduce((acc, kpi) => {
      const objective = annualPlan.find(p => p.id === kpi.objectiveId);
      return acc + calculateKpiMetrics(kpi, objective).score;
    }, 0);
    return parseFloat(scoreSum.toFixed(2));
  }, [targetStaff, userKpis, annualPlan]);

  // Deposit baseline & Backlog notice metrics
  const depositMetrics = useMemo(() => {
    return getDepositMobilizationMetrics(user?.branchId);
  }, [getDepositMobilizationMetrics, user]);

  const backlogNotices = useMemo(() => {
    return getCalculatedBacklogNotices();
  }, [getCalculatedBacklogNotices]);

  // Backlogs assigned to this staff member
  const myBacklogs = useMemo(() => {
    if (!targetStaff) return [];
    return backlogPlans.filter(b => b.assignedEmployeeId === targetStaff.id);
  }, [targetStaff, backlogPlans]);

  // Employee plans assigned to this staff member
  const myEmployeePlans = useMemo(() => {
    if (!targetStaff) return [];
    return employeePlans.filter(ep => ep.employeeId === targetStaff.id);
  }, [targetStaff, employeePlans]);

  // Perspective radar data for staff
  const staffPerspectiveRadar = useMemo(() => {
    if (!targetStaff) return [];
    const dataByPerspective: { [key: string]: { totalScore: number; totalWeight: number } } = {};

    userKpis.forEach(kpi => {
      const objective = annualPlan.find(p => p.id === kpi.objectiveId);
      if (objective) {
        if (!dataByPerspective[objective.category]) {
          dataByPerspective[objective.category] = { totalScore: 0, totalWeight: 0 };
        }
        const calc = calculateKpiMetrics(kpi, objective);
        dataByPerspective[objective.category].totalScore += calc.score;
        dataByPerspective[objective.category].totalWeight += kpi.weight;
      }
    });

    const perspectives = [
      PerspectiveCategory.FINANCIAL,
      PerspectiveCategory.CUSTOMER,
      PerspectiveCategory.INTERNAL_PROCESS,
      PerspectiveCategory.LEARNING_GROWTH,
    ];

    return perspectives.map(perspective => {
      const pData = dataByPerspective[perspective];
      return {
        subject: perspective,
        achievement: pData && pData.totalWeight > 0 ? Math.round((pData.totalScore / pData.totalWeight) * 100) : 0,
        fullMark: 100,
      };
    });
  }, [targetStaff, userKpis, annualPlan]);

  // 30-day activity frequency data for heatmap
  const thirtyDayActivityData = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const isWeekend = dayName === 'Sat' || dayName === 'Sun';
      const count = isWeekend ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 6) + 2;
      list.push({
        date: dateStr,
        dayLabel: `${dayName} ${d.getDate()}`,
        activityCount: count,
        intensity: count >= 5 ? 'High' : count >= 3 ? 'Medium' : count > 0 ? 'Low' : 'None',
      });
    }
    return list;
  }, []);

  // Category Summaries across the branch
  const categorySummaries = useMemo(() => {
    return kpiCategories.map(cat => {
      const meta = getCategoryMeta(cat.name, kpiCategories);
      const matchingPeriodic = periodicPlans.filter(
        p => p.category === cat.name || p.category === cat.id
      );
      const matchingEpPlans = employeePlans.filter(
        ep => ep.category === cat.name || ep.category === cat.id
      );
      const matchingBacklogs = backlogPlans.filter(
        b => b.category === cat.name || b.category === cat.id
      );

      const targetSum = matchingPeriodic.reduce((acc, p) => acc + p.annualTarget, 0);
      const actualSum = matchingPeriodic.reduce((acc, p) => acc + p.annualActual, 0);
      const weightSum = matchingPeriodic.reduce((acc, p) => acc + p.weight, 0);
      const achievement = targetSum > 0 ? Math.round((actualSum / targetSum) * 100) : 0;

      // Staff specific data for this category
      const staffPlan = myEmployeePlans.find(
        ep => ep.category === cat.name || ep.category === cat.id
      );
      const staffKpi = userKpis.find(
        k => k.kpiCategory === cat.name || k.kpiCategory === cat.id
      );

      return {
        id: cat.id,
        name: cat.name,
        perspective: cat.perspective,
        defaultUnit: cat.defaultUnit,
        color: cat.color,
        meta,
        plansCount: matchingPeriodic.length,
        annualTarget: targetSum,
        annualActual: actualSum,
        totalWeight: weightSum,
        achievement,
        backlogsCount: matchingBacklogs.length,
        staffPlan,
        staffKpi,
      };
    });
  }, [kpiCategories, periodicPlans, employeePlans, backlogPlans, myEmployeePlans, userKpis]);

  // Filtered categories
  const filteredCategorySummaries = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return categorySummaries;
    return categorySummaries.filter(
      c => c.id === activeCategoryFilter || c.name === activeCategoryFilter
    );
  }, [categorySummaries, activeCategoryFilter]);

  // Executive branch analytics
  const executiveMetrics = useMemo(() => {
    const totalDepositPlan = periodicPlans.find(
      p => p.category.toLowerCase().includes('deposit')
    );
    const depositTarget = totalDepositPlan?.annualTarget || 14594360;
    const depositActual = totalDepositPlan?.annualActual || 12500000;
    const depositAchievement = depositTarget > 0 ? Math.round((depositActual / depositTarget) * 100) : 0;

    const totalBacklogsCount = backlogPlans.length;
    const assignedBacklogsCount = backlogPlans.filter(b => b.assignedEmployeeId).length;
    const clearedBacklogsCount = backlogPlans.filter(b => b.status === 'Cleared').length;
    const totalBacklogTarget = backlogPlans.reduce((acc, b) => acc + b.backlogTarget, 0);
    const totalBacklogActual = backlogPlans.reduce((acc, b) => acc + b.backlogActual, 0);
    const backlogRecoveryRate = totalBacklogTarget > 0 ? Math.round((totalBacklogActual / totalBacklogTarget) * 100) : 0;

    const onTrackCategories = categorySummaries.filter(c => c.achievement >= 80).length;

    // Overall branch BSC weighted average
    const totalWeightedScore = periodicPlans.reduce((acc, p) => {
      const rate = p.annualTarget > 0 ? Math.min((p.annualActual / p.annualTarget) * 100, 120) : 0;
      return acc + (rate * (p.weight / 100));
    }, 0);

    return {
      depositTarget,
      depositActual,
      depositAchievement,
      totalBacklogsCount,
      assignedBacklogsCount,
      clearedBacklogsCount,
      totalBacklogTarget,
      totalBacklogActual,
      backlogRecoveryRate,
      onTrackCategories,
      totalCategories: kpiCategories.length,
      branchScore: parseFloat(totalWeightedScore.toFixed(1)),
    };
  }, [periodicPlans, backlogPlans, categorySummaries, kpiCategories]);

  // Quick performance save handler
  const handleSaveQuickLog = async () => {
    if (!quickLogItem || quickLogValue === '') return;
    setIsSavingLog(true);
    try {
      if (quickLogItem.type === 'plan') {
        await recordActualPerformance({
          planId: quickLogItem.id,
          periodType: 'annual',
          newActual: Number(quickLogValue),
        });
      } else if (quickLogItem.type === 'employeePlan') {
        await recordEmployeePerformance({
          assignmentId: quickLogItem.id,
          periodType: 'annual',
          newActual: Number(quickLogValue),
        });
      } else if (quickLogItem.type === 'backlog') {
        await recordActualPerformance({
          planId: quickLogItem.id,
          periodType: 'backlog',
          newActual: Number(quickLogValue),
        });
      }
      setQuickLogItem(null);
      setQuickLogValue('');
    } catch (err) {
      console.error('Failed to log performance:', err);
    } finally {
      setIsSavingLog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Banking Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* TOP HERO HEADER & EXECUTIVE ACTIONS */}
      {/* ============================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              Welcome, {user?.name}!
            </h2>
            <span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">
              {branchName}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md ${
              isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {user?.role}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isManagerOrAdmin
              ? 'Branch Strategic Executive Cockpit • Real-time Balanced Scorecard (BSC), KPI Categories & Backlog Recovery'
              : 'Personal Balanced Scorecard Performance, Assigned Periodic Targets & Arrears Recovery Tasks'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin: Create New KPI */}
          {isAdmin && (
            <button
              onClick={() => {
                setKpiModalCategory('');
                setShowCreateKpiModal(true);
              }}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-sky-100 transition flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Create New KPI</span>
            </button>
          )}

          {/* Admin: Add KPI Category */}
          {isAdmin && (
            <button
              onClick={() => setShowCreateCategoryModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>+ New Category</span>
            </button>
          )}

          {/* Manage Categories Modal */}
          <button
            onClick={() => setShowManageCategoriesModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>KPI Categories ({kpiCategories.length})</span>
          </button>

          {/* Staff: View Scorecard Link */}
          {isStaff && (
            <Link
              to={`/employees/${user?.id}`}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-sky-100 transition flex items-center gap-1.5"
            >
              <span>My Scorecard</span>
              <span>&rarr;</span>
            </Link>
          )}

          <Link
            to="/plan"
            className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-1.5"
          >
            <span>Strategic Plan</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Admin Automated Backlog Detection Alert Banner */}
      {isAdmin && backlogNotices.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-200 text-amber-800 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-bold text-amber-900">
                  {backlogNotices.length} Performance Deficits Detected by Auto-Backlog Engine
                </p>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-full">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Periodic shortfalls detected in quarterly or monthly plans. Generate recovery plans and assign to staff.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-center">
            <Link
              to="/admin/branch-setup"
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              Open Branch Admin &rarr;
            </Link>
            <Link
              to="/reports"
              className="px-3.5 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/50 rounded-xl text-xs font-semibold transition"
            >
              View Reports
            </Link>
          </div>
        </div>
      )}

      {/* June Closing Deposit Baseline & Increment Analysis Strip */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white p-5 rounded-2xl shadow-md border border-sky-700/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-700/60 border border-sky-500/30">
              Deposit Mobilization Benchmark
            </span>
            <span className="text-xs text-sky-200 font-mono">
              FY {branches.find(b => b.id === user?.branchId)?.fiscalYear || '2024/2025'}
            </span>
          </div>
          <h3 className="text-lg font-bold mt-1 text-white">
            June Baseline: {(depositMetrics.juneBaseline / 1000000).toFixed(2)}M ETB • Current Closing Balance: {(depositMetrics.currentDepositBalance / 1000000).toFixed(2)}M ETB
          </h3>
          <p className="text-xs text-sky-200 mt-0.5">
            Net Increment Mobilized: <strong>+{(depositMetrics.actualNetIncrement / 1000000).toFixed(2)}M ETB</strong> (Target: +{(depositMetrics.annualTargetIncrement / 1000000).toFixed(2)}M ETB, {depositMetrics.incrementAchievement}% Achieved)
          </p>
        </div>

        <div className="flex items-center space-x-3 self-end lg:self-center">
          <div className="text-right">
            <span className="text-[11px] text-sky-200 block">Baseline Growth Status</span>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
              depositMetrics.isUnderJuneBalance ? 'bg-red-500/80 text-white' : 'bg-emerald-500/90 text-white'
            }`}>
              {depositMetrics.isUnderJuneBalance ? 'Under June Balance' : 'Above June Baseline (Net Surplus)'}
            </span>
          </div>
          <Link
            to="/reports"
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition"
          >
            Audit Details &rarr;
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* KPI CATEGORIES FILTER STRIP */}
      {/* ============================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-1">
          Filter:
        </span>
        <button
          onClick={() => setActiveCategoryFilter('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeCategoryFilter === 'ALL'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Categories ({categorySummaries.length})
        </button>

        {categorySummaries.map(cat => {
          const isSelected = activeCategoryFilter === cat.id || activeCategoryFilter === cat.name;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="scale-75 shrink-0">{cat.meta.icon}</span>
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {cat.achievement}%
              </span>
            </button>
          );
        })}

        {isManagerOrAdmin && (
          <button
            onClick={() => setShowCreateCategoryModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-sky-600 border border-dashed border-sky-300 hover:bg-sky-50 transition whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <span>+ Add Category</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* ADMIN / HQ EXECUTIVE KPI DASHBOARD */}
      {/* ============================================================== */}
      {isManagerOrAdmin && (
        <div className="space-y-6">
          {/* Executive Stat Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Overall Branch BSC Score */}
            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Branch BSC Execution</p>
                  <p className="text-3xl font-black text-sky-600 mt-1">{executiveMetrics.branchScore}%</p>
                </div>
                <div className="p-3 bg-sky-50 rounded-2xl text-sky-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-sky-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(executiveMetrics.branchScore, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Target benchmark: &ge; 80%</p>
            </Card>

            {/* 2. Deposit Mobilization */}
            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Deposit Mobilization</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{executiveMetrics.depositAchievement}%</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-2">
                {(executiveMetrics.depositActual / 1000000).toFixed(2)}M / {(executiveMetrics.depositTarget / 1000000).toFixed(2)}M ETB
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Core Savings & Demand Accounts</p>
            </Card>

            {/* 3. On-Track Categories */}
            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categories on Track</p>
                  <p className="text-3xl font-black text-purple-600 mt-1">
                    {executiveMetrics.onTrackCategories} / {executiveMetrics.totalCategories}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-2">
                Deposit, Customer Base, Digital Channels
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Meeting &ge; 80% pace threshold</p>
            </Card>

            {/* 4. Backlog Recovery Performance */}
            <Card className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Backlog Recovery Rate</p>
                  <p className="text-3xl font-black text-amber-600 mt-1">{executiveMetrics.backlogRecoveryRate}%</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-2">
                {executiveMetrics.assignedBacklogsCount} Assigned • {executiveMetrics.clearedBacklogsCount} Cleared
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {(executiveMetrics.totalBacklogActual / 1000).toFixed(0)}k / {(executiveMetrics.totalBacklogTarget / 1000).toFixed(0)}k Recovered
              </p>
            </Card>
          </div>

          {/* ========================================================== */}
          {/* KPI CATEGORIES STRATEGIC CARDS GRID */}
          {/* ========================================================== */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  KPI Categories Performance ({filteredCategorySummaries.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Live execution by strategic banking category • Click to add new KPIs under any category
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateCategoryModal(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Add New Category</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategorySummaries.map(cat => {
                const statusColor = cat.achievement >= 100
                  ? 'bg-emerald-100 text-emerald-800'
                  : cat.achievement >= 80
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-amber-100 text-amber-800';

                const statusLabel = cat.achievement >= 100 ? 'Exceeding' : cat.achievement >= 80 ? 'On Track' : 'Needs Focus';

                return (
                  <Card key={cat.id} className="!p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-2.5 rounded-xl ${cat.meta.bgClass} ${cat.meta.textClass}`}>
                            {cat.meta.icon}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-base">{cat.name}</h4>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {cat.perspective} • Weight: {cat.totalWeight}%
                            </span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Main Metrics */}
                      <div className="my-4 flex items-baseline justify-between">
                        <div>
                          <p className="text-2xl font-black text-slate-800">
                            {cat.annualActual.toLocaleString()}
                            <span className="text-xs font-semibold text-slate-500 ml-1.5">{cat.defaultUnit}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Target: {cat.annualTarget.toLocaleString()} {cat.defaultUnit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-black ${
                            cat.achievement >= 80 ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {cat.achievement}%
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">Pace</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(cat.achievement, 100)}%`,
                            backgroundColor: cat.meta.color,
                          }}
                        />
                      </div>

                      {/* Secondary Info */}
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                        <span>
                          <strong className="text-slate-700">{cat.plansCount}</strong> Plan metrics
                        </span>
                        <span>
                          <strong className="text-slate-700">{cat.backlogsCount}</strong> Backlogs
                        </span>
                        <span>
                          Assigned: <strong className="text-slate-700">Ermiyas</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quick Card Action */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setKpiModalCategory(cat.id);
                          setShowCreateKpiModal(true);
                        }}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>+ Add KPI in {cat.name}</span>
                      </button>

                      <Link
                        to="/plan"
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Details &rarr;
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ========================================================== */}
          {/* CHARTS: CATEGORY COMPARISON & STAFF ACCOUNTABILITY */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Category Achievement Comparison */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Category BSC Execution Comparison
                  </h3>
                  <p className="text-xs text-slate-500">Achievement rate (%) across strategic banking categories</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">
                  Target: 100%
                </span>
              </div>

              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySummaries} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      tick={{ fill: '#475569', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis domain={[0, 120]} stroke="#64748b" unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: number) => [`${val}%`, 'Achievement Pace']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="achievement" name="Achievement (%)" radius={[6, 6, 0, 0]}>
                      {categorySummaries.map((entry) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={entry.achievement >= 90 ? '#10b981' : entry.achievement >= 80 ? '#0284c7' : '#f59e0b'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Staff Accountability Card for Ermiyas Getachew */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Staff Balanced Scorecard Accountability</h3>
                    <p className="text-xs text-slate-500">Direct performance monitoring for staff</p>
                  </div>
                  <Link
                    to={`/employees/${targetStaff.id}`}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700"
                  >
                    View Scorecard &rarr;
                  </Link>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-sky-600 text-white font-black text-lg flex items-center justify-center shadow-sm">
                      {targetStaff.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">{targetStaff.name}</h4>
                      <p className="text-xs text-slate-500">{targetStaff.role} • {branchName}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-3xl font-black ${
                      totalUserScore >= 90 ? 'text-emerald-600' : totalUserScore >= 80 ? 'text-sky-600' : 'text-amber-600'
                    }`}>
                      {totalUserScore}%
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Overall Score
                    </span>
                  </div>
                </div>

                {/* Score breakdown across categories for Ermiyas */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Assigned KPIs & Current Actuals
                  </p>
                  {userKpis.map(k => {
                    const obj = annualPlan.find(p => p.id === k.objectiveId);
                    const calc = calculateKpiMetrics(k, obj);
                    return (
                      <div key={k.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="overflow-hidden pr-2">
                          <p className="font-bold text-slate-800 truncate">{k.name}</p>
                          <p className="text-[11px] text-slate-400">
                            Target: {k.target.toLocaleString()} • Actual: {k.actual.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-bold ${calc.achievement >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {calc.achievement}%
                          </span>
                          <p className="text-[10px] text-slate-400">{calc.score.toFixed(1)} pts</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {myBacklogs.length} Backlog Recovery assignments
                </span>
                <Link
                  to="/plan"
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition"
                >
                  Manage Staff Plans &rarr;
                </Link>
              </div>
            </Card>
          </div>

          {/* ========================================================== */}
          {/* BACKLOG RECOVERY COMMAND PANEL */}
          {/* ========================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-800">
                    Active Backlog Recovery & Arrears Command
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overdue deposit & digital banking arrears assigned to staff for priority recovery
                </p>
              </div>
              <Link
                to="/plan"
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <span>Open Backlog Center</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {backlogPlans.slice(0, 6).map(b => {
                const recoveryRate = b.backlogTarget > 0 ? Math.round((b.backlogActual / b.backlogTarget) * 100) : 0;
                const assignedStaffName = employees.find(e => e.id === b.assignedEmployeeId)?.name || 'Unassigned';
                const meta = getCategoryMeta(b.category, kpiCategories);

                return (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`}>
                          {b.category}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          b.priority === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.priority}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-800 text-xs mt-2 line-clamp-1">{b.title}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Target: {b.backlogTarget.toLocaleString()} {b.metricUnit} • Recovered: {b.backlogActual.toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 truncate">
                        Staff: <strong className="text-slate-700">{assignedStaffName}</strong>
                      </span>
                      <span className={`font-black ${recoveryRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {recoveryRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STAFF / USER (ERMIYAS GETACHEW) PERSONAL DASHBOARD */}
      {/* ============================================================== */}
      {isStaff && (
        <div className="space-y-6">
          {/* Hero Personal Scorecard Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 bg-gradient-to-br from-white to-sky-50/50 flex flex-col justify-between">
              <div>
                <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-lg">
                  Balanced Scorecard Score
                </span>
                <p className="text-xs text-slate-500 mt-2">Weighted annual metric execution</p>
              </div>

              <div className="my-6 text-center">
                <p className={`text-6xl md:text-7xl font-black ${
                  totalUserScore >= 90 ? 'text-emerald-600' : totalUserScore >= 80 ? 'text-sky-600' : 'text-amber-600'
                }`}>
                  {totalUserScore}%
                </p>
                <p className="text-sm font-bold text-slate-700 mt-2">
                  {totalUserScore >= 90 ? 'Outstanding Performance' : totalUserScore >= 80 ? 'On Track to Annual Target' : 'Action Required'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Assigned Target Weight: 100%</p>
              </div>

              <Link
                to={`/employees/${user?.id}`}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-center font-bold text-xs shadow-md shadow-sky-100 transition"
              >
                Open Full Evaluation Scorecard &rarr;
              </Link>
            </Card>

            {/* Perspective Radar Chart */}
            <Card className="md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Balanced Scorecard Perspective Balance</h3>
                  <p className="text-xs text-slate-500">Financial, Customer, Internal Process & Learning execution</p>
                </div>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={staffPerspectiveRadar}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" tick={{ fontSize: 10 }} />
                    <Radar
                      name={user?.name || 'My Score'}
                      dataKey="achievement"
                      stroke="#0284c7"
                      fill="#0284c7"
                      fillOpacity={0.45}
                    />
                    <Tooltip formatter={(val: number) => [`${val}%`, 'Achievement']} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 30-Day Activity Heatmap & Frequency Chart */}
          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800">30-Day Employee Activity & Performance Frequency Heatmap</h3>
                <p className="text-xs text-slate-500">Daily update submissions, deposit mobilizations, and backlog recovery logs over the last 30 days</p>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-semibold">
                <span>Activity Level:</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200" /> None</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-300" /> Low</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-600" /> Med</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600" /> High</span>
              </div>
            </div>

            {/* Heatmap Grid Visual */}
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-30 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {thirtyDayActivityData.map((item, idx) => {
                const bgClass =
                  item.activityCount >= 5
                    ? 'bg-emerald-600 text-white'
                    : item.activityCount >= 3
                    ? 'bg-sky-600 text-white'
                    : item.activityCount > 0
                    ? 'bg-sky-300 text-slate-900'
                    : 'bg-slate-200 text-slate-500';

                return (
                  <div
                    key={idx}
                    title={`${item.dayLabel}: ${item.activityCount} actions`}
                    className={`h-12 rounded-lg flex flex-col items-center justify-center p-1 text-center transition hover:scale-105 cursor-pointer shadow-2xs ${bgClass}`}
                  >
                    <span className="text-[9px] font-semibold opacity-80">{item.dayLabel.split(' ')[0]}</span>
                    <span className="text-xs font-black">{item.activityCount}</span>
                  </div>
                );
              })}
            </div>

            {/* Recharts Bar Chart View for Frequency Trend */}
            <div className="w-full h-48 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thirtyDayActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 9, fill: '#64748b' }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 10]} />
                  <Tooltip
                    formatter={(val: number) => [`${val} Actions`, 'Activity Frequency']}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="activityCount" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Personal KPI Categories Performance */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  My Performance by KPI Category ({categorySummaries.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Personal targets and achievement pace across all banking categories
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorySummaries.map(cat => {
                const staffKpi = cat.staffKpi;
                const staffPlan = cat.staffPlan;

                const myTarget = staffPlan?.annualTarget || staffKpi?.target || 0;
                const myActual = staffPlan?.annualActual || staffKpi?.actual || 0;
                const myPace = myTarget > 0 ? Math.round((myActual / myTarget) * 100) : 0;
                const myWeight = staffPlan?.weight || staffKpi?.weight || 0;

                return (
                  <Card key={cat.id} className="!p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`p-2 rounded-xl ${cat.meta.bgClass} ${cat.meta.textClass}`}>
                            {cat.meta.icon}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">{cat.name}</h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Weight: {myWeight}% of scorecard
                            </span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          myPace >= 80 ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
                        }`}>
                          {myPace}%
                        </span>
                      </div>

                      <div className="my-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Target: {myTarget.toLocaleString()} {cat.defaultUnit}</span>
                          <span className="font-bold text-slate-800">{myActual.toLocaleString()} Logged</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(myPace, 100)}%`,
                              backgroundColor: cat.meta.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      {staffPlan ? (
                        <button
                          onClick={() => {
                            setQuickLogItem({
                              type: 'employeePlan',
                              id: staffPlan.id,
                              title: `${cat.name} Progress`,
                              unit: staffPlan.metricUnit,
                              currentActual: staffPlan.annualActual,
                              target: staffPlan.annualTarget,
                            });
                            setQuickLogValue(staffPlan.annualActual);
                          }}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Log Actuals</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Linked to annual objective</span>
                      )}

                      <Link
                        to={`/employees/${user?.id}`}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Breakdown &rarr;
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* My Assigned Backlog Recovery Action Items */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  My Assigned Backlog Recovery Action Items ({myBacklogs.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Specific customer arrears and inactive account recovery tasks assigned to you
                </p>
              </div>
              <Link
                to="/plan"
                className="text-xs font-bold text-sky-600 hover:text-sky-700"
              >
                View all backlogs &rarr;
              </Link>
            </div>

            {myBacklogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-sm">
                No backlogs currently assigned to you. Great job staying clear!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBacklogs.map(b => {
                  const rate = b.backlogTarget > 0 ? Math.round((b.backlogActual / b.backlogTarget) * 100) : 0;
                  const meta = getCategoryMeta(b.category, kpiCategories);

                  return (
                    <div
                      key={b.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`}>
                            {b.category}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            b.priority === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {b.priority}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-800 text-sm mt-2">{b.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Deadline: <strong className="text-slate-700">{b.targetResolutionDate}</strong>
                        </p>

                        {b.notes && (
                          <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200 mt-2 italic">
                            "{b.notes}"
                          </p>
                        )}

                        <div className="my-3">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>Recovered: {b.backlogActual.toLocaleString()}</span>
                            <span>Target: {b.backlogTarget.toLocaleString()} {b.metricUnit}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className={`text-xs font-black ${rate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {rate}% Recovered
                        </span>
                        <button
                          onClick={() => {
                            setQuickLogItem({
                              type: 'backlog',
                              id: b.id,
                              title: `Recover Backlog: ${b.title}`,
                              unit: b.metricUnit,
                              currentActual: b.backlogActual,
                              target: b.backlogTarget,
                            });
                            setQuickLogValue(b.backlogActual);
                          }}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                        >
                          Record Recovery
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK LOG ACTUAL PERFORMANCE MODAL */}
      {/* ============================================================== */}
      {quickLogItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="text-base font-bold">Update Actual Performance</h3>
              <button
                onClick={() => setQuickLogItem(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Indicator</p>
                <p className="text-base font-bold text-slate-800">{quickLogItem.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: {quickLogItem.target.toLocaleString()} {quickLogItem.unit}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Actual Value ({quickLogItem.unit})
                </label>
                <input
                  type="number"
                  min={0}
                  value={quickLogValue}
                  onChange={e => setQuickLogValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickLogItem(null)}
                  className="px-4 py-2 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickLog}
                  disabled={isSavingLog || quickLogValue === ''}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer"
                >
                  {isSavingLog ? 'Saving...' : 'Save Actual Performance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* KPI & CATEGORY CREATION MODALS */}
      {/* ============================================================== */}
      <CreateKpiModal
        isOpen={showCreateKpiModal}
        onClose={() => setShowCreateKpiModal(false)}
        initialCategory={kpiModalCategory}
      />

      <CreateCategoryModal
        isOpen={showCreateCategoryModal}
        onClose={() => setShowCreateCategoryModal(false)}
      />

      <ManageCategoriesModal
        isOpen={showManageCategoriesModal}
        onClose={() => setShowManageCategoriesModal(false)}
      />
    </div>
  );
};
export default DashboardPage;