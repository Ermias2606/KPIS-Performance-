import React, { useMemo, useState, useContext } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import {
  KpiCategory,
  Role,
  PeriodicPlanItem,
  BacklogPlanItem,
  EmployeePlanAssignment,
  PlanTimeframe,
  BacklogPriority,
  BacklogStatus,
} from '../types';
import Card from '../components/ui/Card';
import { getCategoryMeta } from '../components/kpi/CategoryHelpers';
import CreateKpiModal from '../components/kpi/CreateKpiModal';
import CreateCategoryModal from '../components/kpi/CreateCategoryModal';
import ManageCategoriesModal from '../components/kpi/ManageCategoriesModal';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const CATEGORY_COLORS: { [key in KpiCategory]: string } = {
  [KpiCategory.DEPOSIT]: '#0284c7', // Sky Blue
  [KpiCategory.CUSTOMER_BASE]: '#10b981', // Emerald
  [KpiCategory.MOBILE_BANKING]: '#8b5cf6', // Violet
  [KpiCategory.CARD_BANKING]: '#f59e0b', // Amber
  [KpiCategory.INTERNET_BANKING]: '#ec4899', // Pink
};

const CATEGORY_ICONS: { [key in KpiCategory]: React.ReactNode } = {
  [KpiCategory.DEPOSIT]: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" />
    </svg>
  ),
  [KpiCategory.CUSTOMER_BASE]: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  [KpiCategory.MOBILE_BANKING]: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  [KpiCategory.CARD_BANKING]: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  [KpiCategory.INTERNET_BANKING]: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
};

const AnnualPlanPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    employees,
    periodicPlans,
    backlogPlans,
    employeePlans,
    kpiCategories,
    loading,
    updatePeriodicPlan,
    addPeriodicPlan,
    deletePeriodicPlan,
    addBacklogPlan,
    updateBacklogPlan,
    deleteBacklogPlan,
    assignBacklogPlan,
    unassignBacklogPlan,
    recordActualPerformance,
    assignEmployeePlan,
    updateEmployeePlan,
    deleteEmployeePlan,
    recordEmployeePerformance,
  } = useData();

  const [activeTimeframe, setActiveTimeframe] = useState<PlanTimeframe>('annual');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<number | 'ALL'>('ALL');
  const [selectedBacklogEmpFilter, setSelectedBacklogEmpFilter] = useState<number | 'ALL' | 'UNASSIGNED'>('ALL');

  // KPI & Category Global Modals
  const [showGlobalCreateKpi, setShowGlobalCreateKpi] = useState(false);
  const [showGlobalCreateCategory, setShowGlobalCreateCategory] = useState(false);
  const [showGlobalManageCategories, setShowGlobalManageCategories] = useState(false);

  // Backlog View Mode & Assignment States
  const [backlogViewMode, setBacklogViewMode] = useState<'grid' | 'table'>('grid');
  const [showAssignBacklogModal, setShowAssignBacklogModal] = useState(false);
  const [assignBacklogMode, setAssignBacklogMode] = useState<'existing' | 'new'>('existing');
  const [selectedBacklogForAssignment, setSelectedBacklogForAssignment] = useState<number | null>(null);
  const [assignBacklogTargetEmpId, setAssignBacklogTargetEmpId] = useState<number>(2);
  const [assignBacklogTargetDate, setAssignBacklogTargetDate] = useState('End of Q4 2026');
  const [assignBacklogPriority, setAssignBacklogPriority] = useState<BacklogPriority>('High');
  const [assignBacklogNotes, setAssignBacklogNotes] = useState('');
  const [assignBacklogCustomTarget, setAssignBacklogCustomTarget] = useState<number | ''>('');

  // Modal 1: Plan Add/Edit
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PeriodicPlanItem | null>(null);
  const [modalCategory, setModalCategory] = useState<KpiCategory>(KpiCategory.DEPOSIT);
  const [modalName, setModalName] = useState('');
  const [modalUnit, setModalUnit] = useState('ETB');
  const [modalAnnualTarget, setModalAnnualTarget] = useState<number>(100000);
  const [modalAnnualActual, setModalAnnualActual] = useState<number>(85000);
  const [modalWeight, setModalWeight] = useState<number>(20);

  // Modal 2: Backlog Plan Add/Edit
  const [showBacklogModal, setShowBacklogModal] = useState(false);
  const [backlogCategory, setBacklogCategory] = useState<KpiCategory>(KpiCategory.DEPOSIT);
  const [backlogTitle, setBacklogTitle] = useState('');
  const [backlogUnit, setBacklogUnit] = useState('ETB');
  const [backlogTarget, setBacklogTarget] = useState<number>(500000);
  const [backlogActual, setBacklogActual] = useState<number>(0);
  const [backlogOrigin, setBacklogOrigin] = useState('Q3 Shortfall');
  const [backlogResolution, setBacklogResolution] = useState('End of Q4 2026');
  const [backlogPriority, setBacklogPriority] = useState<BacklogPriority>('High');
  const [backlogStatus, setBacklogStatus] = useState<BacklogStatus>('In Progress');
  const [backlogAssignedEmpId, setBacklogAssignedEmpId] = useState<number | ''>(2);
  const [backlogNotes, setBacklogNotes] = useState('');

  // Modal 3: Employee Plan Assignment Modal
  const [showAssignEmpModal, setShowAssignEmpModal] = useState(false);
  const [editingEmpAssignment, setEditingEmpAssignment] = useState<EmployeePlanAssignment | null>(null);
  const [assignEmpId, setAssignEmpId] = useState<number>(employees.find(e => e.role !== Role.ADMIN)?.id || 2);
  const [assignCategory, setAssignCategory] = useState<KpiCategory>(KpiCategory.DEPOSIT);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignUnit, setAssignUnit] = useState('ETB');
  const [assignAnnualTarget, setAssignAnnualTarget] = useState<number>(1000000);
  const [assignAnnualActual, setAssignAnnualActual] = useState<number>(0);
  const [assignWeight, setAssignWeight] = useState<number>(20);
  const [assignNotes, setAssignNotes] = useState('');

  // Modal 4: Actual Performance Input Modal
  const [showPerfInputModal, setShowPerfInputModal] = useState(false);
  const [perfStreamType, setPerfStreamType] = useState<'periodic' | 'employee' | 'backlog'>('employee');
  const [perfSelectedPlanId, setPerfSelectedPlanId] = useState<number>(1);
  const [perfSelectedEmpPlanId, setPerfSelectedEmpPlanId] = useState<number>(employeePlans[0]?.id || 1);
  const [perfPeriodType, setPerfPeriodType] = useState<'annual' | 'quarter' | 'month'>('annual');
  const [perfQuarterKey, setPerfQuarterKey] = useState<'q1' | 'q2' | 'q3' | 'q4'>('q4');
  const [perfMonthKey, setPerfMonthKey] = useState<number>(10);
  const [perfInputVal, setPerfInputVal] = useState<number>(0);
  const [perfIsIncremental, setPerfIsIncremental] = useState<boolean>(false);

  // Inline Quick Edit for Quarterly and Monthly
  const [inlineEditingQuarter, setInlineEditingQuarter] = useState<{ planId: number; qKey: 'q1' | 'q2' | 'q3' | 'q4' } | null>(null);
  const [inlineQuarterVal, setInlineQuarterVal] = useState<number>(0);

  const [inlineEditingMonth, setInlineEditingMonth] = useState<{ planId: number; month: number } | null>(null);
  const [inlineMonthVal, setInlineMonthVal] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === Role.ADMIN;
  const staffMembers = useMemo(() => employees.filter(e => e.role !== Role.ADMIN), [employees]);

  const categories = useMemo(() => {
    return kpiCategories.map(c => c.name);
  }, [kpiCategories]);

  const filteredPlans = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return periodicPlans;
    return periodicPlans.filter(p => p.category === selectedCategoryFilter);
  }, [periodicPlans, selectedCategoryFilter]);

  const filteredBacklogs = useMemo(() => {
    let list = backlogPlans;
    if (selectedCategoryFilter !== 'ALL') {
      list = list.filter(b => b.category === selectedCategoryFilter);
    }
    if (selectedBacklogEmpFilter === 'UNASSIGNED') {
      list = list.filter(b => !b.assignedEmployeeId);
    } else if (selectedBacklogEmpFilter !== 'ALL') {
      list = list.filter(b => b.assignedEmployeeId === selectedBacklogEmpFilter);
    }
    return list;
  }, [backlogPlans, selectedCategoryFilter, selectedBacklogEmpFilter]);

  const filteredEmployeePlans = useMemo(() => {
    let list = employeePlans;
    if (selectedEmployeeFilter !== 'ALL') {
      list = list.filter(ep => ep.employeeId === selectedEmployeeFilter);
    }
    if (selectedCategoryFilter !== 'ALL') {
      list = list.filter(ep => ep.category === selectedCategoryFilter);
    }
    return list;
  }, [employeePlans, selectedEmployeeFilter, selectedCategoryFilter]);

  // Employee-specific assigned backlogs
  const employeeAssignedBacklogs = useMemo(() => {
    const targetEmpId = selectedEmployeeFilter === 'ALL' ? (staffMembers[0]?.id || 2) : selectedEmployeeFilter;
    return backlogPlans.filter(b => b.assignedEmployeeId === targetEmpId);
  }, [backlogPlans, selectedEmployeeFilter, staffMembers]);

  // Unassigned branch backlogs pool
  const unassignedBacklogs = useMemo(() => {
    return backlogPlans.filter(b => !b.assignedEmployeeId);
  }, [backlogPlans]);

  // Current targeted employee object for employee tab
  const currentTargetEmployee = useMemo(() => {
    const targetEmpId = selectedEmployeeFilter === 'ALL' ? (staffMembers[0]?.id || 2) : selectedEmployeeFilter;
    return employees.find(e => e.id === targetEmpId) || staffMembers[0];
  }, [selectedEmployeeFilter, staffMembers, employees]);

  // Targeted employee backlog metrics
  const employeeBacklogStats = useMemo(() => {
    const totalAssigned = employeeAssignedBacklogs.length;
    let targetSum = 0;
    let actualSum = 0;
    let clearedCount = 0;
    employeeAssignedBacklogs.forEach(b => {
      targetSum += b.backlogTarget;
      actualSum += b.backlogActual;
      if (b.status === 'Cleared') clearedCount += 1;
    });
    const rate = targetSum > 0 ? Math.round((actualSum / targetSum) * 100) : 0;
    return {
      totalAssigned,
      targetSum,
      actualSum,
      clearedCount,
      rate,
    };
  }, [employeeAssignedBacklogs]);

  // Overall Plan KPI Analytics
  const analyticsSummary = useMemo(() => {
    if (periodicPlans.length === 0) return { overallAchievement: 0, totalWeight: 0, onTrackCount: 0 };
    let weightedScore = 0;
    let totalWeight = 0;
    let onTrack = 0;

    periodicPlans.forEach(p => {
      const achieve = p.annualTarget > 0 ? (p.annualActual / p.annualTarget) * 100 : 0;
      weightedScore += (achieve / 100) * p.weight;
      totalWeight += p.weight;
      if (achieve >= 80) onTrack += 1;
    });

    return {
      overallAchievement: totalWeight > 0 ? parseFloat((weightedScore / totalWeight * 100).toFixed(1)) : 0,
      totalWeight,
      onTrackCount: onTrack,
    };
  }, [periodicPlans]);

  // Backlog Summary Metrics
  const backlogSummary = useMemo(() => {
    const totalBacklogCount = backlogPlans.length;
    const clearedCount = backlogPlans.filter(b => b.status === 'Cleared').length;
    const inProgressCount = backlogPlans.filter(b => b.status === 'In Progress').length;
    const assignedCount = backlogPlans.filter(b => !!b.assignedEmployeeId).length;

    let totalTargetUnits = 0;
    let totalActualUnits = 0;
    backlogPlans.forEach(b => {
      totalTargetUnits += b.backlogTarget;
      totalActualUnits += b.backlogActual;
    });

    const resolutionRate = totalTargetUnits > 0 ? Math.round((totalActualUnits / totalTargetUnits) * 100) : 0;

    return {
      totalBacklogCount,
      clearedCount,
      inProgressCount,
      assignedCount,
      resolutionRate,
      totalTargetUnits,
      totalActualUnits,
    };
  }, [backlogPlans]);

  // Employee Assignment Summary Metrics
  const employeeAssignmentSummary = useMemo(() => {
    const totalAssignments = filteredEmployeePlans.length;
    let weightedScore = 0;
    let totalWeight = 0;

    filteredEmployeePlans.forEach(ep => {
      const rate = ep.annualTarget > 0 ? (ep.annualActual / ep.annualTarget) * 100 : 0;
      weightedScore += (rate / 100) * ep.weight;
      totalWeight += ep.weight;
    });

    const overallScore = totalWeight > 0 ? parseFloat((weightedScore / totalWeight * 100).toFixed(1)) : 0;

    return {
      totalAssignments,
      totalWeight,
      overallScore,
    };
  }, [filteredEmployeePlans]);

  // Recharts Data for Category Comparison
  const categoryComparisonData = useMemo(() => {
    return periodicPlans.map(p => {
      const achieveRate = p.annualTarget > 0 ? Math.round((p.annualActual / p.annualTarget) * 100) : 0;
      return {
        category: p.category,
        name: p.name,
        target: p.annualTarget,
        actual: p.annualActual,
        achievement: Math.min(achieveRate, 120),
        weight: p.weight,
        unit: p.metricUnit,
      };
    });
  }, [periodicPlans]);

  // Recharts Data for Quarterly Progression
  const quarterlyProgressionData = useMemo(() => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
    return quarters.map(q => {
      const qKey = q.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
      let totalTarget = 0;
      let totalActual = 0;
      let qAchievementSum = 0;

      periodicPlans.forEach(p => {
        const qData = p.quarterly[qKey];
        if (qData) {
          totalTarget += qData.target;
          totalActual += qData.actual;
          const rate = qData.target > 0 ? (qData.actual / qData.target) * 100 : 0;
          qAchievementSum += rate * (p.weight / 100);
        }
      });

      return {
        quarter: q,
        target: totalTarget,
        actual: totalActual,
        achievementRate: Math.round(qAchievementSum),
      };
    });
  }, [periodicPlans]);

  // Recharts Data for Monthly Trajectory (Jan - Dec)
  const monthlyTrajectoryData = useMemo(() => {
    let cumTarget = 0;
    let cumActual = 0;

    return MONTH_NAMES.map((name, index) => {
      const monthNum = index + 1;
      let mTarget = 0;
      let mActual = 0;

      periodicPlans.forEach(p => {
        const m = p.monthly[monthNum];
        if (m) {
          mTarget += m.target;
          mActual += m.actual;
        }
      });

      cumTarget += mTarget;
      if (mActual > 0 || monthNum <= 11) {
        cumActual += mActual;
      }

      return {
        month: name,
        monthNum,
        monthlyTarget: mTarget,
        monthlyActual: mActual,
        cumulativeTarget: cumTarget,
        cumulativeActual: cumActual,
      };
    });
  }, [periodicPlans]);

  // Pie chart data for weights
  const weightDistributionData = useMemo(() => {
    return periodicPlans.map(p => ({
      name: p.category,
      value: p.weight,
      color: CATEGORY_COLORS[p.category] || '#64748b',
    }));
  }, [periodicPlans]);

  // Handlers for Plan Modal
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    setModalCategory(KpiCategory.DEPOSIT);
    setModalName('Deposit Mobilization Plan');
    setModalUnit('ETB');
    setModalAnnualTarget(1000000);
    setModalAnnualActual(850000);
    setModalWeight(20);
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plan: PeriodicPlanItem) => {
    setEditingPlan(plan);
    setModalCategory(plan.category);
    setModalName(plan.name);
    setModalUnit(plan.metricUnit);
    setModalAnnualTarget(plan.annualTarget);
    setModalAnnualActual(plan.annualActual);
    setModalWeight(plan.weight);
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      if (editingPlan) {
        const updated: PeriodicPlanItem = {
          ...editingPlan,
          category: modalCategory,
          name: modalName,
          metricUnit: modalUnit,
          annualTarget: Number(modalAnnualTarget),
          annualActual: Number(modalAnnualActual),
          weight: Number(modalWeight),
        };
        await updatePeriodicPlan(updated);
      } else {
        const qTarget = Math.round(Number(modalAnnualTarget) / 4);
        const qActual = Math.round(Number(modalAnnualActual) / 4);
        const mTarget = Math.round(Number(modalAnnualTarget) / 12);
        const mActual = Math.round(Number(modalAnnualActual) / 11);

        const newPlan: Omit<PeriodicPlanItem, 'id'> = {
          category: modalCategory,
          name: modalName,
          metricUnit: modalUnit,
          annualTarget: Number(modalAnnualTarget),
          annualActual: Number(modalAnnualActual),
          weight: Number(modalWeight),
          quarterly: {
            q1: { target: qTarget, actual: qActual },
            q2: { target: qTarget, actual: qActual },
            q3: { target: qTarget, actual: qActual },
            q4: { target: qTarget, actual: qActual },
          },
          monthly: {
            1: { target: mTarget, actual: mActual },
            2: { target: mTarget, actual: mActual },
            3: { target: mTarget, actual: mActual },
            4: { target: mTarget, actual: mActual },
            5: { target: mTarget, actual: mActual },
            6: { target: mTarget, actual: mActual },
            7: { target: mTarget, actual: mActual },
            8: { target: mTarget, actual: mActual },
            9: { target: mTarget, actual: mActual },
            10: { target: mTarget, actual: mActual },
            11: { target: mTarget, actual: mActual },
            12: { target: mTarget, actual: 0 },
          },
        };
        await addPeriodicPlan(newPlan);
      }
      setShowPlanModal(false);
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Backlog Plan Assignment & Creation
  const handleOpenAssignBacklog = (
    mode: 'existing' | 'new' = 'existing',
    backlogItem?: BacklogPlanItem,
    targetEmpId?: number
  ) => {
    setAssignBacklogMode(mode);
    const empId = targetEmpId !== undefined ? targetEmpId : (staffMembers[0]?.id || 2);
    setAssignBacklogTargetEmpId(empId);

    if (mode === 'existing') {
      const targetItem = backlogItem || backlogPlans.find(b => !b.assignedEmployeeId) || backlogPlans[0];
      if (targetItem) {
        setSelectedBacklogForAssignment(targetItem.id);
        setAssignBacklogTargetDate(targetItem.targetResolutionDate || 'End of Q4 2026');
        setAssignBacklogPriority(targetItem.priority || 'High');
        setAssignBacklogNotes(targetItem.notes || '');
        setAssignBacklogCustomTarget(targetItem.backlogTarget);
      }
    } else {
      setBacklogCategory(backlogItem?.category || KpiCategory.DEPOSIT);
      setBacklogTitle('');
      setBacklogUnit('ETB');
      setBacklogTarget(500000);
      setBacklogActual(0);
      setBacklogOrigin('Q3 Shortfall');
      setBacklogResolution('End of Q4 2026');
      setBacklogPriority('High');
      setBacklogStatus('In Progress');
      setBacklogAssignedEmpId(empId);
      setBacklogNotes('');
    }
    setShowAssignBacklogModal(true);
  };

  const handleOpenAddBacklog = (prefillEmployeeId?: number) => {
    handleOpenAssignBacklog('new', undefined, prefillEmployeeId);
  };

  const handleConfirmBacklogAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      if (assignBacklogMode === 'existing') {
        if (!selectedBacklogForAssignment) return;
        const addInfo: Partial<BacklogPlanItem> = {
          targetResolutionDate: assignBacklogTargetDate,
          priority: assignBacklogPriority,
          notes: assignBacklogNotes,
        };
        if (assignBacklogCustomTarget !== '') {
          addInfo.backlogTarget = Number(assignBacklogCustomTarget);
        }
        await assignBacklogPlan(selectedBacklogForAssignment, assignBacklogTargetEmpId, addInfo);
      } else {
        if (!backlogTitle.trim()) return;
        await addBacklogPlan({
          category: backlogCategory,
          title: backlogTitle.trim(),
          metricUnit: backlogUnit,
          backlogTarget: Number(backlogTarget),
          backlogActual: Number(backlogActual),
          originPeriod: backlogOrigin,
          targetResolutionDate: backlogResolution,
          priority: backlogPriority,
          status: backlogStatus,
          assignedEmployeeId: assignBacklogTargetEmpId,
          assignedDate: new Date().toISOString().split('T')[0],
          notes: backlogNotes,
        });
      }
      setShowAssignBacklogModal(false);
    } catch (err) {
      console.error('Failed to save backlog plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBacklog = handleConfirmBacklogAssignment;

  const handleUnassignBacklog = async (backlogId: number) => {
    if (!isAdmin) return;
    await unassignBacklogPlan(backlogId);
  };

  // Handlers for Employee Plan Assignment Modal
  const handleOpenAssignEmpPlan = (assignment?: EmployeePlanAssignment) => {
    if (assignment) {
      setEditingEmpAssignment(assignment);
      setAssignEmpId(assignment.employeeId);
      setAssignCategory(assignment.category);
      setAssignTitle(assignment.title);
      setAssignUnit(assignment.metricUnit);
      setAssignAnnualTarget(assignment.annualTarget);
      setAssignAnnualActual(assignment.annualActual);
      setAssignWeight(assignment.weight);
      setAssignNotes(assignment.notes || '');
    } else {
      setEditingEmpAssignment(null);
      setAssignEmpId(staffMembers[0]?.id || 2);
      setAssignCategory(KpiCategory.DEPOSIT);
      setAssignTitle('Deposit Mobilization Individual Target');
      setAssignUnit('ETB');
      setAssignAnnualTarget(5000000);
      setAssignAnnualActual(4200000);
      setAssignWeight(30);
      setAssignNotes('');
    }
    setShowAssignEmpModal(true);
  };

  const handleSaveEmployeeAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!assignTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const qTarget = Math.round(Number(assignAnnualTarget) / 4);
      const qActual = Math.round(Number(assignAnnualActual) / 4);
      const mTarget = Math.round(Number(assignAnnualTarget) / 12);
      const mActual = Math.round(Number(assignAnnualActual) / 11);

      if (editingEmpAssignment) {
        const updated: EmployeePlanAssignment = {
          ...editingEmpAssignment,
          employeeId: Number(assignEmpId),
          category: assignCategory,
          title: assignTitle.trim(),
          metricUnit: assignUnit,
          annualTarget: Number(assignAnnualTarget),
          annualActual: Number(assignAnnualActual),
          weight: Number(assignWeight),
          notes: assignNotes,
        };
        await updateEmployeePlan(updated);
      } else {
        const newAssignment: Omit<EmployeePlanAssignment, 'id'> = {
          employeeId: Number(assignEmpId),
          category: assignCategory,
          title: assignTitle.trim(),
          metricUnit: assignUnit,
          annualTarget: Number(assignAnnualTarget),
          annualActual: Number(assignAnnualActual),
          weight: Number(assignWeight),
          quarterly: {
            q1: { target: qTarget, actual: qActual },
            q2: { target: qTarget, actual: qActual },
            q3: { target: qTarget, actual: qActual },
            q4: { target: qTarget, actual: qActual },
          },
          monthly: {
            1: { target: mTarget, actual: mActual },
            2: { target: mTarget, actual: mActual },
            3: { target: mTarget, actual: mActual },
            4: { target: mTarget, actual: mActual },
            5: { target: mTarget, actual: mActual },
            6: { target: mTarget, actual: mActual },
            7: { target: mTarget, actual: mActual },
            8: { target: mTarget, actual: mActual },
            9: { target: mTarget, actual: mActual },
            10: { target: mTarget, actual: mActual },
            11: { target: mTarget, actual: mActual },
            12: { target: mTarget, actual: 0 },
          },
          assignedDate: new Date().toISOString().split('T')[0],
          notes: assignNotes,
        };
        await assignEmployeePlan(newAssignment);
      }
      setShowAssignEmpModal(false);
    } catch (err) {
      console.error('Failed to assign employee plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Performance Input Modal
  const handleOpenPerfInput = (stream: 'periodic' | 'employee' | 'backlog' = 'employee', planId?: number) => {
    setPerfStreamType(stream);
    if (stream === 'employee') {
      setPerfSelectedEmpPlanId(planId || employeePlans[0]?.id || 1);
    } else if (stream === 'periodic') {
      setPerfSelectedPlanId(planId || periodicPlans[0]?.id || 1);
    } else {
      setPerfSelectedPlanId(planId || backlogPlans[0]?.id || 1);
    }
    setPerfPeriodType('annual');
    setPerfInputVal(0);
    setPerfIsIncremental(false);
    setShowPerfInputModal(true);
  };

  const handleSavePerformanceInput = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (perfStreamType === 'employee') {
        await recordEmployeePerformance({
          assignmentId: perfSelectedEmpPlanId,
          periodType: perfPeriodType,
          periodKey: perfPeriodType === 'quarter' ? perfQuarterKey : perfPeriodType === 'month' ? perfMonthKey : undefined,
          newActual: Number(perfInputVal),
          isIncremental: perfIsIncremental,
        });
      } else if (perfStreamType === 'backlog') {
        await recordActualPerformance({
          planId: perfSelectedPlanId,
          periodType: 'backlog',
          newActual: Number(perfInputVal),
          isIncremental: perfIsIncremental,
        });
      } else {
        await recordActualPerformance({
          planId: perfSelectedPlanId,
          periodType: perfPeriodType,
          periodKey: perfPeriodType === 'quarter' ? perfQuarterKey : perfPeriodType === 'month' ? perfMonthKey : undefined,
          newActual: Number(perfInputVal),
          isIncremental: perfIsIncremental,
        });
      }
      setShowPerfInputModal(false);
    } catch (err) {
      console.error('Failed to record performance input:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Quarter Save for branch plans
  const handleInlineQuarterSave = async (planId: number, qKey: 'q1' | 'q2' | 'q3' | 'q4') => {
    await recordActualPerformance({
      planId,
      periodType: 'quarter',
      periodKey: qKey,
      newActual: Number(inlineQuarterVal),
      isIncremental: false,
    });
    setInlineEditingQuarter(null);
  };

  // Inline Month Save for branch plans
  const handleInlineMonthSave = async (planId: number, month: number) => {
    await recordActualPerformance({
      planId,
      periodType: 'month',
      periodKey: month,
      newActual: Number(inlineMonthVal),
      isIncremental: false,
    });
    setInlineEditingMonth(null);
  };

  // Quick Backlog Status Toggle
  const handleToggleBacklogStatus = async (item: BacklogPlanItem) => {
    const nextStatus: BacklogStatus = item.status === 'Cleared' ? 'In Progress' : 'Cleared';
    await updateBacklogPlan({
      ...item,
      status: nextStatus,
      backlogActual: nextStatus === 'Cleared' ? item.backlogTarget : item.backlogActual,
    });
  };

  // Quick Backlog Employee Assignment / Reassignment
  const handleQuickAssignBacklog = async (backlogId: number, newEmpId: number | undefined) => {
    if (newEmpId) {
      await assignBacklogPlan(backlogId, newEmpId);
    } else {
      await unassignBacklogPlan(backlogId);
    }
  };
  const handleQuickReassignBacklog = handleQuickAssignBacklog;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Strategic Plans & Assignments...</div>
      </div>
    );
  }

  const currentSelectedEmpPlan = employeePlans.find(ep => ep.id === perfSelectedEmpPlanId);
  const currentSelectedPlan = periodicPlans.find(p => p.id === perfSelectedPlanId);
  const currentSelectedBacklog = backlogPlans.find(b => b.id === perfSelectedPlanId);

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              2026 Strategic Plans & Performance
            </h2>
            <span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">
              Raitu Branch
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Annual & periodic targets, employee plans, employee backlog recovery assignments, and live tracking
          </p>
        </div>

        {/* Action Buttons: Plans Button, Assign Employee Plan, Assign Backlog, Record Performance */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Create New KPI Button */}
          {isAdmin && (
            <button
              onClick={() => setShowGlobalCreateKpi(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-sky-100 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Create KPI</span>
            </button>
          )}

          {/* New Category Button */}
          {isAdmin && (
            <button
              onClick={() => setShowGlobalCreateCategory(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>+ Category</span>
            </button>
          )}

          {/* Manage Categories */}
          <button
            onClick={() => setShowGlobalManageCategories(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Categories ({kpiCategories.length})</span>
          </button>

          {/* Assign Plan to Employee Button */}
          {isAdmin && (
            <button
              onClick={() => handleOpenAssignEmpPlan()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Assign Staff Plan</span>
            </button>
          )}

          {/* Add / Assign Backlog Plan Button */}
          {isAdmin && (
            <button
              onClick={() => handleOpenAssignBacklog('existing')}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-amber-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>+ Assign Backlog</span>
            </button>
          )}

          {/* Record Actual Performance Button */}
          <button
            onClick={() => handleOpenPerfInput('employee')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-emerald-100 transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Record Performance</span>
          </button>
        </div>
      </div>

      {/* KPI Categories Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategoryFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            selectedCategoryFilter === 'ALL'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Categories
        </button>

        {kpiCategories.map(cat => {
          const isSelected = selectedCategoryFilter === cat.name || selectedCategoryFilter === cat.id;
          const meta = getCategoryMeta(cat.name, kpiCategories);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.name)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="scale-75 shrink-0">{meta.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            onClick={() => setShowGlobalCreateCategory(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50 transition whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <span>+ Add Category</span>
          </button>
        )}
      </div>

      {/* Executive Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase">Overall BSC Execution</p>
          <p className="text-2xl font-black text-sky-600 mt-1">{analyticsSummary.overallAchievement}%</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-sky-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(analyticsSummary.overallAchievement, 100)}%` }}
            />
          </div>
        </Card>

        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase">Assigned Employee Plans</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{employeePlans.length} Plans</p>
          <p className="text-[11px] text-slate-400 mt-1">Ermiyas Getachew: 100% weight</p>
        </Card>

        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase">Backlogs Assigned to Staff</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {backlogSummary.assignedCount} / {backlogSummary.totalBacklogCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {backlogSummary.resolutionRate}% Total Recovered Rate
          </p>
        </Card>

        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-semibold uppercase">On-Track Categories</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {analyticsSummary.onTrackCount} / {periodicPlans.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Achievement &ge; 80% threshold</p>
        </Card>
      </div>

      {/* Timeframe View Switcher Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex flex-wrap gap-1 shadow-2xs">
        <button
          onClick={() => setActiveTimeframe('annual')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeTimeframe === 'annual'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          1. Annual Plan
        </button>

        <button
          onClick={() => setActiveTimeframe('quarterly')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeTimeframe === 'quarterly'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          2. Quarterly Plan (Q1 - Q4)
        </button>

        <button
          onClick={() => setActiveTimeframe('monthly')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeTimeframe === 'monthly'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          3. Monthly Plan (Jan - Dec)
        </button>

        {/* Employee Plans & Performances Tab */}
        <button
          onClick={() => setActiveTimeframe('employee')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTimeframe === 'employee'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>4. Employee Plans ({employeePlans.length})</span>
        </button>

        {/* Backlog Plan Tab */}
        <button
          onClick={() => setActiveTimeframe('backlog')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTimeframe === 'backlog'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>5. Employee Backlogs ({backlogPlans.length})</span>
        </button>

        <button
          onClick={() => setActiveTimeframe('analytics')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTimeframe === 'analytics'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>6. Admin Analytics Suite</span>
        </button>
      </div>

      {/* ---------------- VIEW 1: ANNUAL PLAN ---------------- */}
      {activeTimeframe === 'annual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlans.map(plan => {
              const achievement = plan.annualTarget > 0 ? (plan.annualActual / plan.annualTarget) * 100 : 0;
              const roundedAchieve = Math.round(achievement);

              return (
                <Card key={plan.id} className="flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          {CATEGORY_ICONS[plan.category]}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                            {plan.category}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm leading-snug">{plan.name}</h4>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {plan.weight}% Weight
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-4 py-2 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[11px] text-slate-500 font-medium">Target ({plan.metricUnit})</p>
                        <p className="text-lg font-bold text-slate-800 mt-0.5">{plan.annualTarget.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 font-medium">Actual ({plan.metricUnit})</p>
                        <p className="text-lg font-bold text-sky-700 mt-0.5">{plan.annualActual.toLocaleString()}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                        <span className="text-slate-500">Achievement Rate:</span>
                        <span className={`font-extrabold ${roundedAchieve >= 90 ? 'text-emerald-600' : roundedAchieve >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
                          {roundedAchieve}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            roundedAchieve >= 90 ? 'bg-emerald-500' : roundedAchieve >= 80 ? 'bg-sky-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(roundedAchieve, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-800 px-2 py-1 rounded hover:bg-sky-50 transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePeriodicPlan(plan.id)}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- VIEW 2: QUARTERLY PLAN ---------------- */}
      {activeTimeframe === 'quarterly' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">2026 Quarterly Performance Breakdown</h3>
                <p className="text-xs text-slate-500">Click on any quarter actual cell to edit directly</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Category & KPI</th>
                    <th className="p-3 text-center">Unit</th>
                    <th className="p-3 text-center bg-slate-200/50">Q1 Target</th>
                    <th className="p-3 text-center bg-slate-200/50">Q1 Actual</th>
                    <th className="p-3 text-center">Q2 Target</th>
                    <th className="p-3 text-center">Q2 Actual</th>
                    <th className="p-3 text-center bg-slate-200/50">Q3 Target</th>
                    <th className="p-3 text-center bg-slate-200/50">Q3 Actual</th>
                    <th className="p-3 text-center">Q4 Target</th>
                    <th className="p-3 text-center">Q4 Actual</th>
                    <th className="p-3 text-center font-bold">Annual Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredPlans.map(plan => {
                    const annualAch = plan.annualTarget > 0 ? Math.round((plan.annualActual / plan.annualTarget) * 100) : 0;
                    const quarters: ('q1' | 'q2' | 'q3' | 'q4')[] = ['q1', 'q2', 'q3', 'q4'];

                    return (
                      <tr key={plan.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                          {CATEGORY_ICONS[plan.category]}
                          <div>
                            <p>{plan.name}</p>
                            <span className="text-[10px] text-slate-400 font-normal">{plan.category}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">{plan.metricUnit}</td>

                        {quarters.map(qKey => {
                          const isEditing = inlineEditingQuarter?.planId === plan.id && inlineEditingQuarter?.qKey === qKey;
                          const qData = plan.quarterly[qKey];
                          const isAlternate = qKey === 'q1' || qKey === 'q3';

                          return (
                            <React.Fragment key={qKey}>
                              <td className={`p-3 text-center font-mono ${isAlternate ? 'bg-slate-50/50' : ''}`}>
                                {qData.target.toLocaleString()}
                              </td>
                              <td className={`p-3 text-center font-mono font-bold ${isAlternate ? 'bg-slate-50/50' : ''}`}>
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      autoFocus
                                      value={inlineQuarterVal}
                                      onChange={(e) => setInlineQuarterVal(Number(e.target.value))}
                                      className="w-20 text-center text-xs p-1 border border-sky-400 rounded bg-white"
                                    />
                                    <button
                                      onClick={() => handleInlineQuarterSave(plan.id, qKey)}
                                      className="px-1.5 py-1 bg-emerald-600 text-white rounded text-[10px]"
                                    >
                                      ✓
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    onClick={() => {
                                      setInlineEditingQuarter({ planId: plan.id, qKey });
                                      setInlineQuarterVal(qData.actual);
                                    }}
                                    className="cursor-pointer text-sky-700 hover:text-sky-900 hover:underline px-1 py-0.5 rounded hover:bg-sky-50"
                                    title="Click to edit actual"
                                  >
                                    {qData.actual.toLocaleString()}
                                  </span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        <td className={`p-3 text-center font-bold ${annualAch >= 90 ? 'text-emerald-600' : annualAch >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
                          {plan.annualActual.toLocaleString()} ({annualAch}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Quarterly Trend Visualizer */}
          <Card>
            <h4 className="font-bold text-slate-800 text-sm mb-3">Quarterly Achievement Pace (%)</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterlyProgressionData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" stroke="#64748b" />
                  <YAxis unit="%" stroke="#64748b" domain={[0, 120]} />
                  <Tooltip formatter={(val: number) => [`${val}%`, 'Execution Rate']} />
                  <Bar dataKey="achievementRate" fill="#0284c7" radius={[4, 4, 0, 0]} name="Achievement (%)">
                    {quarterlyProgressionData.map((entry, index) => (
                      <Cell
                        key={`quarter-${index}`}
                        fill={entry.achievementRate >= 90 ? '#10b981' : entry.achievementRate >= 80 ? '#0284c7' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- VIEW 3: MONTHLY PLAN ---------------- */}
      {activeTimeframe === 'monthly' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Monthly Trajectory & Target Rollout (M1 - M12)</h3>
                <p className="text-xs text-slate-500">Click on any month actual value to update immediately</p>
              </div>
              <button
                onClick={() => handleOpenPerfInput('periodic')}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>Input Month Performance</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Metric</th>
                    {MONTH_NAMES.map(m => (
                      <th key={m} className="p-2.5 text-center">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                  {filteredPlans.map(plan => (
                    <React.Fragment key={plan.id}>
                      <tr className="bg-slate-50/50">
                        <td rowSpan={2} className="p-2.5 font-sans font-bold text-slate-800 border-r border-slate-200">
                          {plan.category}
                        </td>
                        <td className="p-2.5 font-sans font-medium text-slate-500">Target</td>
                        {MONTH_NAMES.map((_, idx) => (
                          <td key={idx} className="p-2.5 text-center text-slate-600">
                            {plan.monthly[idx + 1]?.target.toLocaleString() || 0}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 font-sans font-bold text-sky-700">Actual</td>
                        {MONTH_NAMES.map((_, idx) => {
                          const mNum = idx + 1;
                          const isEditing = inlineEditingMonth?.planId === plan.id && inlineEditingMonth?.month === mNum;
                          const actualVal = plan.monthly[mNum]?.actual || 0;

                          return (
                            <td key={idx} className="p-2.5 text-center font-bold text-sky-600">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    autoFocus
                                    value={inlineMonthVal}
                                    onChange={(e) => setInlineMonthVal(Number(e.target.value))}
                                    className="w-16 text-center text-[10px] p-0.5 border border-sky-400 rounded bg-white font-mono"
                                  />
                                  <button
                                    onClick={() => handleInlineMonthSave(plan.id, mNum)}
                                    className="px-1 py-0.5 bg-emerald-600 text-white rounded text-[9px]"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => {
                                    setInlineEditingMonth({ planId: plan.id, month: mNum });
                                    setInlineMonthVal(actualVal);
                                  }}
                                  className="cursor-pointer hover:underline hover:bg-sky-50 px-1 py-0.5 rounded"
                                  title="Click to edit month actual"
                                >
                                  {actualVal > 0 ? actualVal.toLocaleString() : '-'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Monthly Trajectory Chart */}
          <Card>
            <h4 className="font-bold text-slate-800 text-sm mb-3">Cumulative Annual Trajectory (Target vs Actual)</h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrajectoryData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="cumulativeTarget" stroke="#64748b" fillOpacity={1} fill="url(#colorTarget)" name="Cumulative Target" />
                  <Area type="monotone" dataKey="cumulativeActual" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Cumulative Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- VIEW 4: SPECIFIC EMPLOYEE PLANS & PERFORMANCES ---------------- */}
      {activeTimeframe === 'employee' && (
        <div className="space-y-6">
          {/* Employee Selection & Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-indigo-50 border border-indigo-200 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-indigo-950">Employee Specific Target Plans & Performance Assigning</h3>
                <p className="text-xs text-indigo-700">Assign individual targets across core categories and record employee realization</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedEmployeeFilter}
                onChange={(e) => setSelectedEmployeeFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="bg-white border border-indigo-300 text-xs font-semibold px-3 py-2 rounded-xl text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Staff Members ({staffMembers.length})</option>
                {staffMembers.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>

              {isAdmin && (
                <button
                  onClick={() => handleOpenAssignEmpPlan()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Assign New Plan</span>
                </button>
              )}
            </div>
          </div>

          {/* Employee Portfolio Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="!p-4 bg-white border border-slate-200">
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Assigned Plans</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{employeeAssignmentSummary.totalAssignments}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Deposit, Customer, Digital</p>
            </Card>

            <Card className="!p-4 bg-white border border-slate-200">
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Assigned Weight</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{employeeAssignmentSummary.totalWeight}%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Scorecard coverage</p>
            </Card>

            <Card className="!p-4 bg-white border border-slate-200">
              <p className="text-xs text-slate-400 font-semibold uppercase">Composite Execution</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{employeeAssignmentSummary.overallScore}%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Weighted staff score</p>
            </Card>

            <Card className="!p-4 bg-white border border-slate-200">
              <p className="text-xs text-slate-400 font-semibold uppercase">Assigned Backlogs</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{employeeAssignedBacklogs.length} Backlogs</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Carryover arrears targets</p>
            </Card>
          </div>

          {/* Section 1: Assigned Core KPI Plans */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                1. Core BSC KPI Target Assignments
              </h4>
              <span className="text-xs text-slate-500 font-medium">{filteredEmployeePlans.length} Active Targets</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEmployeePlans.map(ep => {
                const assignedEmp = employees.find(e => e.id === ep.employeeId);
                const rate = ep.annualTarget > 0 ? Math.round((ep.annualActual / ep.annualTarget) * 100) : 0;

                return (
                  <Card key={ep.id} className="flex flex-col justify-between hover:shadow-md transition border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            {CATEGORY_ICONS[ep.category]}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                              {ep.category}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm leading-snug">{ep.title}</h4>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          {ep.weight}% Weight
                        </span>
                      </div>

                      {/* Assigned Employee Tag */}
                      <div className="flex items-center gap-2 mt-3 p-2 bg-slate-50 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {assignedEmp?.name.charAt(0) || 'E'}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{assignedEmp?.name || 'Staff'}</p>
                          <p className="text-[10px] text-slate-400">{assignedEmp?.role}</p>
                        </div>
                        {ep.assignedDate && (
                          <span className="text-[10px] font-mono text-slate-400">{ep.assignedDate}</span>
                        )}
                      </div>

                      {/* Target & Actual Numbers */}
                      <div className="grid grid-cols-2 gap-3 my-3 py-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Assigned Target ({ep.metricUnit})</p>
                          <p className="text-base font-bold text-slate-800 mt-0.5">{ep.annualTarget.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Achieved Actual ({ep.metricUnit})</p>
                          <p className="text-base font-bold text-indigo-700 mt-0.5">{ep.annualActual.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Branch Plan Contribution Percentage */}
                      {(() => {
                        const matchingBranchPlan = periodicPlans.find(p => p.category === ep.category);
                        const branchTarget = matchingBranchPlan ? matchingBranchPlan.annualTarget : 1;
                        const branchContribPct = branchTarget > 0 ? Math.round((ep.annualTarget / branchTarget) * 100) : 0;
                        return (
                          <div className="mb-3 text-[11px] font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 flex items-center justify-between">
                            <span>Branch Plan Share:</span>
                            <span className="font-mono font-black">{branchContribPct}% of Branch {ep.category} Plan</span>
                          </div>
                        );
                      })()}

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-slate-500">Execution Score:</span>
                          <span className={`font-extrabold ${rate >= 90 ? 'text-emerald-600' : rate >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
                            {rate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 80 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Quarter Breakdown Preview */}
                      <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                        <div className="bg-slate-50 p-1 rounded">
                          <p className="text-slate-400 text-[9px]">Q1</p>
                          <p className="font-bold text-slate-700">{ep.quarterly.q1.actual.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-1 rounded">
                          <p className="text-slate-400 text-[9px]">Q2</p>
                          <p className="font-bold text-slate-700">{ep.quarterly.q2.actual.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-1 rounded">
                          <p className="text-slate-400 text-[9px]">Q3</p>
                          <p className="font-bold text-slate-700">{ep.quarterly.q3.actual.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-1 rounded">
                          <p className="text-slate-400 text-[9px]">Q4</p>
                          <p className="font-bold text-slate-700">{ep.quarterly.q4.actual.toLocaleString()}</p>
                        </div>
                      </div>

                      {ep.notes && (
                        <p className="text-[10px] text-slate-400 italic mt-2.5">
                          Note: {ep.notes}
                        </p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleOpenPerfInput('employee', ep.id)}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Assign Performance</span>
                      </button>

                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenAssignEmpPlan(ep)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEmployeePlan(ep.id)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 px-1.5 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Section 2: Assigned Backlog Recovery Targets for this Employee */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-amber-500/10 border border-amber-200 p-4 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h4 className="text-base font-bold text-slate-800">
                    Assigned Backlog Recovery Targets for {currentTargetEmployee?.name || 'Employee'}
                  </h4>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                    {employeeBacklogStats.totalAssigned} Assigned
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Arrears, rollover shortfalls, and recovery queues specifically allocated to {currentTargetEmployee?.name}
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => handleOpenAssignBacklog('existing', undefined, currentTargetEmployee?.id)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Assign Backlog Target</span>
                  </button>
                </div>
              )}
            </div>

            {/* Backlog Summary Stats for this Employee */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Assigned Backlogs</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{employeeBacklogStats.totalAssigned}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{employeeBacklogStats.clearedCount} Cleared</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Target</p>
                <p className="text-xl font-black text-amber-600 mt-0.5">{employeeBacklogStats.targetSum.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Assigned Target Units</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Recovered</p>
                <p className="text-xl font-black text-emerald-600 mt-0.5">{employeeBacklogStats.actualSum.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Realized Arrears</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Recovery Score</p>
                <p className={`text-xl font-black mt-0.5 ${employeeBacklogStats.rate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {employeeBacklogStats.rate}%
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className={`h-1 rounded-full ${employeeBacklogStats.rate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(employeeBacklogStats.rate, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Unassigned Backlogs Queue Alert & 1-Click Allocation */}
            {isAdmin && unassignedBacklogs.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 text-sm font-bold">⚡ Unassigned Backlog Queue</span>
                    <span className="text-[11px] text-amber-800">
                      {unassignedBacklogs.length} items available in branch pool
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-700">
                    Click to allocate directly to {currentTargetEmployee?.name}:
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {unassignedBacklogs.map(uItem => (
                    <div key={uItem.id} className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-700 uppercase">{uItem.category}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-500 font-mono">{uItem.backlogTarget.toLocaleString()} {uItem.metricUnit}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 truncate" title={uItem.title}>{uItem.title}</p>
                      </div>
                      <button
                        onClick={() => handleQuickAssignBacklog(uItem.id, currentTargetEmployee?.id)}
                        className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                      >
                        + Allocate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Employee Assigned Backlog Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {employeeAssignedBacklogs.map(bItem => {
                const bRate = bItem.backlogTarget > 0 ? Math.round((bItem.backlogActual / bItem.backlogTarget) * 100) : 0;
                const isCleared = bItem.status === 'Cleared';

                return (
                  <Card key={bItem.id} className="flex flex-col justify-between hover:shadow-md transition border border-amber-200 bg-amber-50/20">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                            {CATEGORY_ICONS[bItem.category]}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                              {bItem.category} Backlog
                            </span>
                            <h5 className="font-bold text-slate-800 text-sm leading-snug">{bItem.title}</h5>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          bItem.priority === 'Urgent'
                            ? 'bg-red-100 text-red-700'
                            : bItem.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {bItem.priority}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 my-3 py-2 bg-white p-3 rounded-xl border border-amber-100 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Backlog Target</p>
                          <p className="font-bold text-slate-800 text-base mt-0.5">
                            {bItem.backlogTarget.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{bItem.metricUnit}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Recovered Actual</p>
                          <p className="font-bold text-emerald-600 text-base mt-0.5">
                            {bItem.backlogActual.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{bItem.metricUnit}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Recovery Progress:</span>
                          <span className={`font-bold ${bRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {bRate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${bRate >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(bRate, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500 space-y-0.5">
                        <p><span className="font-semibold text-slate-600">Origin:</span> {bItem.originPeriod}</p>
                        <p><span className="font-semibold text-slate-600">Resolution Target:</span> {bItem.targetResolutionDate}</p>
                        {bItem.assignedDate && <p><span className="font-semibold text-slate-600">Assigned:</span> {bItem.assignedDate}</p>}
                        {bItem.notes && <p className="italic text-slate-400 text-[10px] mt-1 bg-amber-50/50 p-1.5 rounded">{bItem.notes}</p>}
                      </div>
                    </div>

                    <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenPerfInput('backlog', bItem.id)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                        >
                          Record Recovery
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAssignBacklog('existing', bItem, currentTargetEmployee?.id)}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          >
                            Reassign
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <button
                            onClick={() => handleUnassignBacklog(bItem.id)}
                            title="Unassign and return to branch pool"
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded transition cursor-pointer"
                          >
                            Unassign
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleBacklogStatus(bItem)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                            isCleared
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {isCleared ? 'Reopen' : 'Mark Cleared'}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {employeeAssignedBacklogs.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm">
                <p className="font-semibold text-slate-600 mb-1">No backlog plans assigned to {currentTargetEmployee?.name || 'this employee'} yet.</p>
                <p className="text-xs text-slate-400 mb-3">You can allocate existing arrears from the branch pool above or click "+ Assign Backlog Target".</p>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenAssignBacklog('existing', undefined, currentTargetEmployee?.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    + Assign Backlog Target
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- VIEW 5: EMPLOYEE BACKLOG PLANS & ARREARS ---------------- */}
      {activeTimeframe === 'backlog' && (
        <div className="space-y-6">
          {/* Top Backlog Executive Banner */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-amber-500/10 border border-amber-200 p-5 rounded-2xl">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <h3 className="text-lg font-bold text-slate-800">
                  Employee Backlog Plan & Arrears Recovery Engine
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-200 text-amber-900">
                  {backlogSummary.assignedCount} / {backlogSummary.totalBacklogCount} Assigned to Staff
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Assign rollover shortfalls, arrears, and dormant account reactivation queues to specific branch staff
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Table / Grid Switcher */}
              <div className="bg-white p-1 rounded-xl border border-amber-200 flex items-center shadow-2xs">
                <button
                  onClick={() => setBacklogViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    backlogViewMode === 'grid'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setBacklogViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    backlogViewMode === 'table'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Matrix Table</span>
                </button>
              </div>

              {/* Employee Filter */}
              <select
                value={selectedBacklogEmpFilter}
                onChange={(e) => setSelectedBacklogEmpFilter(e.target.value === 'ALL' ? 'ALL' : e.target.value === 'UNASSIGNED' ? 'UNASSIGNED' : Number(e.target.value))}
                className="bg-white border border-amber-300 text-xs font-semibold px-3 py-2 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="ALL">All Backlogs ({backlogPlans.length})</option>
                {staffMembers.map(emp => (
                  <option key={emp.id} value={emp.id}>Assigned to {emp.name}</option>
                ))}
                <option value="UNASSIGNED">Unassigned Backlogs ({unassignedBacklogs.length})</option>
              </select>

              {isAdmin && (
                <button
                  onClick={() => handleOpenAssignBacklog('existing')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>+ Assign Backlog to Employee</span>
                </button>
              )}
            </div>
          </div>

          {/* Unassigned Backlogs Queue Alert & Immediate Employee Allocation */}
          {isAdmin && unassignedBacklogs.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h4 className="text-sm font-bold text-amber-950">
                    Unassigned Backlog Items Requiring Employee Allocation ({unassignedBacklogs.length})
                  </h4>
                </div>
                <p className="text-xs text-amber-800">
                  These arrears are in the branch pool and need to be allocated to an employee
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedBacklogs.map(uItem => (
                  <div key={uItem.id} className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase">{uItem.category}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{uItem.priority}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{uItem.title}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Target: <span className="font-bold text-slate-700 font-mono">{uItem.backlogTarget.toLocaleString()} {uItem.metricUnit}</span>
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickAssignBacklog(uItem.id, Number(e.target.value));
                          }
                        }}
                        defaultValue=""
                        className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 w-full"
                      >
                        <option value="" disabled>Assign to employee...</option>
                        {staffMembers.map(emp => (
                          <option key={emp.id} value={emp.id}>Assign to {emp.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleOpenAssignBacklog('existing', uItem)}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLE VIEW (Matrix) */}
          {backlogViewMode === 'table' && (
            <Card>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Strategic Backlog & Arrears Allocation Matrix</h4>
                <span className="text-xs text-slate-400 font-medium">Showing {filteredBacklogs.length} backlogs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Backlog Title & Origin</th>
                      <th className="p-3">Assigned Staff</th>
                      <th className="p-3 text-right">Target</th>
                      <th className="p-3 text-right">Recovered</th>
                      <th className="p-3 text-center">Progress</th>
                      <th className="p-3 text-center">Priority</th>
                      <th className="p-3">Resolution Deadline</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredBacklogs.map(item => {
                      const rate = item.backlogTarget > 0 ? Math.round((item.backlogActual / item.backlogTarget) * 100) : 0;
                      const isCleared = item.status === 'Cleared';
                      const assignedEmp = employees.find(e => e.id === item.assignedEmployeeId);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="p-3">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              {CATEGORY_ICONS[item.category]}
                              <span className="text-[11px]">{item.category}</span>
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Origin: {item.originPeriod}</p>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {assignedEmp ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-bold">
                                    {assignedEmp.name.charAt(0)}
                                  </div>
                                  <span className="font-semibold text-slate-800 text-xs">{assignedEmp.name}</span>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                                  Unassigned
                                </span>
                              )}
                              {isAdmin && (
                                <select
                                  value={item.assignedEmployeeId || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleQuickAssignBacklog(item.id, Number(e.target.value));
                                    } else {
                                      handleUnassignBacklog(item.id);
                                    }
                                  }}
                                  className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-600"
                                >
                                  <option value="">(Unassign)</option>
                                  {staffMembers.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            {item.backlogTarget.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.metricUnit}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            {item.backlogActual.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.metricUnit}</span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="w-20 mx-auto">
                              <span className={`text-[11px] font-extrabold ${rate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {rate}%
                              </span>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.priority === 'Urgent'
                                ? 'bg-red-100 text-red-700'
                                : item.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 text-xs">{item.targetResolutionDate}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleBacklogStatus(item)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                                isCleared
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              }`}
                            >
                              {item.status}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPerfInput('backlog', item.id)}
                                title="Record recovery actual"
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded text-[11px] transition cursor-pointer"
                              >
                                Recovery
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleOpenAssignBacklog('existing', item)}
                                    title="Assign / Reassign to employee"
                                    className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded text-[11px] transition cursor-pointer"
                                  >
                                    Assign
                                  </button>
                                  <button
                                    onClick={() => deleteBacklogPlan(item.id)}
                                    title="Delete backlog"
                                    className="px-1.5 py-1 text-red-500 hover:text-red-700 font-bold rounded hover:bg-red-50 transition cursor-pointer"
                                  >
                                    &times;
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* GRID VIEW (Cards) */}
          {backlogViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBacklogs.map(item => {
                const rate = item.backlogTarget > 0 ? Math.round((item.backlogActual / item.backlogTarget) * 100) : 0;
                const isCleared = item.status === 'Cleared';
                const assignedEmp = employees.find(e => e.id === item.assignedEmployeeId);

                return (
                  <Card key={item.id} className="flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            {CATEGORY_ICONS[item.category]}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                              {item.category}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm leading-snug">{item.title}</h4>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.priority === 'Urgent'
                            ? 'bg-red-100 text-red-700'
                            : item.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.priority}
                        </span>
                      </div>

                      {/* Assigned Employee Header Bar */}
                      <div className="flex items-center justify-between mt-3 p-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          {assignedEmp ? (
                            <>
                              <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-bold">
                                {assignedEmp.name.charAt(0)}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">
                                {assignedEmp.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              Unassigned (In Pool)
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAssignBacklog('existing', item)}
                            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition cursor-pointer"
                          >
                            {assignedEmp ? 'Reassign' : '+ Assign Staff'}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 my-3 py-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Backlog Target</p>
                          <p className="font-bold text-slate-800 text-base mt-0.5">
                            {item.backlogTarget.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{item.metricUnit}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Recovered Actual</p>
                          <p className="font-bold text-emerald-600 text-base mt-0.5">
                            {item.backlogActual.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{item.metricUnit}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Recovery Progress:</span>
                          <span className={`font-bold ${rate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {rate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500 space-y-1">
                        <p><span className="font-semibold text-slate-600">Origin:</span> {item.originPeriod}</p>
                        <p><span className="font-semibold text-slate-600">Resolution Target:</span> {item.targetResolutionDate}</p>
                        {item.assignedDate && <p><span className="font-semibold text-slate-600">Assigned Date:</span> {item.assignedDate}</p>}
                        {item.notes && <p className="italic text-slate-400 text-[10px] bg-slate-50 p-1.5 rounded">{item.notes}</p>}
                      </div>
                    </div>

                    <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenPerfInput('backlog', item.id)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                        >
                          Record Recovery
                        </button>
                        {isAdmin && assignedEmp && (
                          <button
                            onClick={() => handleUnassignBacklog(item.id)}
                            title="Unassign to branch pool"
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-1.5 py-1.5 rounded transition cursor-pointer"
                          >
                            Unassign
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleBacklogStatus(item)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                            isCleared
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {isCleared ? 'Reopen' : 'Mark Cleared'}
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => deleteBacklogPlan(item.id)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 px-1.5 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredBacklogs.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
              <p className="font-semibold text-slate-600 mb-1">No backlog plans found matching current filter.</p>
              <p className="text-xs text-slate-400 mb-3">You can click "+ Assign Backlog to Employee" to allocate arrears.</p>
              {isAdmin && (
                <button
                  onClick={() => handleOpenAssignBacklog('existing')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  + Assign Backlog to Employee
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- VIEW 6: ADMIN ANALYTICS CAPABILITIES ---------------- */}
      {activeTimeframe === 'analytics' && (
        <div className="space-y-6">
          {/* Top Analytics Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-sky-500 text-white text-[10px] font-bold uppercase rounded">Admin Suite</span>
                <h3 className="text-lg font-bold">Executive Strategic Analytics & Pacing Engine</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Real-time target deviation, weight attribution, employee plan alignment, and backlog recovery diagnostics
              </p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Branch Index</p>
                <p className="text-2xl font-black text-sky-400">{analyticsSummary.overallAchievement}%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Employee Score</p>
                <p className="text-2xl font-black text-indigo-400">{employeeAssignmentSummary.overallScore}%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Backlog Rate</p>
                <p className="text-2xl font-black text-amber-400">{backlogSummary.resolutionRate}%</p>
              </div>
            </div>
          </div>

          {/* Chart Grid: Category Achievement & Weight Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <h4 className="font-bold text-slate-800 text-base mb-1">Target vs Actual Performance by Category</h4>
              <p className="text-xs text-slate-400 mb-4">Normalized execution percentage across core banking categories (100% = Target)</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryComparisonData} margin={{ top: 10, right: 20, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#64748b" interval={0} angle={-15} textAnchor="end" height={45} tick={{ fontSize: 11 }} />
                    <YAxis unit="%" stroke="#64748b" domain={[0, 120]} />
                    <Tooltip
                      formatter={(val: number) => [`${val}%`, 'Execution Rate']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="achievement" name="Achievement (%)" radius={[4, 4, 0, 0]}>
                      {categoryComparisonData.map((entry) => (
                        <Cell
                          key={`cell-${entry.category}`}
                          fill={CATEGORY_COLORS[entry.category] || '#0284c7'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h4 className="font-bold text-slate-800 text-base mb-1">Strategic Weight Allocation</h4>
              <p className="text-xs text-slate-400 mb-4">Portfolio balance across categories</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weightDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {weightDistributionData.map((entry, index) => (
                        <Cell key={`slice-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [`${val}%`, 'Weight']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2 text-xs">
                {weightDistributionData.map(item => (
                  <div key={item.name} className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </span>
                    <span className="font-bold text-slate-800">{item.value}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Variance Diagnostic Table */}
          <Card>
            <h4 className="font-bold text-slate-800 text-base mb-1">Variance & Gap Diagnostic Matrix</h4>
            <p className="text-xs text-slate-400 mb-4">Detailed target variance and run-rate gap analysis for decision making</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Annual Target</th>
                    <th className="p-3">Current Actual</th>
                    <th className="p-3 text-center">Execution %</th>
                    <th className="p-3">Deficit / Gap</th>
                    <th className="p-3 text-center">Strategic Weight</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {periodicPlans.map(p => {
                    const rate = p.annualTarget > 0 ? (p.annualActual / p.annualTarget) * 100 : 0;
                    const gap = Math.max(0, p.annualTarget - p.annualActual);
                    const isExceeded = p.annualActual >= p.annualTarget;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[p.category] }} />
                          <span>{p.category}</span>
                        </td>
                        <td className="p-3 font-mono">{p.annualTarget.toLocaleString()} {p.metricUnit}</td>
                        <td className="p-3 font-mono text-sky-700 font-bold">{p.annualActual.toLocaleString()} {p.metricUnit}</td>
                        <td className={`p-3 text-center font-extrabold ${rate >= 90 ? 'text-emerald-600' : rate >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
                          {rate.toFixed(1)}%
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {isExceeded ? (
                            <span className="text-emerald-600 font-semibold">+ Surpassed</span>
                          ) : (
                            <span>{gap.toLocaleString()} {p.metricUnit}</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">{p.weight}%</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            rate >= 90 ? 'bg-emerald-100 text-emerald-800' : rate >= 80 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rate >= 90 ? 'Outstanding' : rate >= 80 ? 'On Target' : 'Action Required'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- MODAL 1: ADD / EDIT PLAN ---------------- */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingPlan ? 'Edit Strategic Plan' : 'Configure New Periodic Plan'}
              </h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  KPI Category
                </label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value as KpiCategory)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Plan Title / Objective
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deposit Mobilization Growth"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Metric Unit
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ETB, Accounts, Users, Cards"
                    value={modalUnit}
                    onChange={(e) => setModalUnit(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Strategic Weight (%)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={modalWeight}
                    onChange={(e) => setModalWeight(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Annual Target
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={modalAnnualTarget}
                    onChange={(e) => setModalAnnualTarget(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Annual Actual (To Date)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={modalAnnualActual}
                    onChange={(e) => setModalAnnualActual(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingPlan ? 'Update Plan' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: ASSIGN BACKLOG TO EMPLOYEE MODAL ---------------- */}
      {(showAssignBacklogModal || showBacklogModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Assign Backlog Recovery Plan to Employee
                  </h3>
                  <p className="text-xs text-slate-400">Allocate arrears and recovery queues to staff</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignBacklogModal(false);
                  setShowBacklogModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setAssignBacklogMode('existing')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  assignBacklogMode === 'existing'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Assign Existing Backlog ({backlogPlans.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignBacklogMode('new')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  assignBacklogMode === 'new'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Create & Assign New Backlog
              </button>
            </div>

            <form onSubmit={handleConfirmBacklogAssignment} className="space-y-3.5">
              {/* MODE 1: ASSIGN EXISTING BACKLOG */}
              {assignBacklogMode === 'existing' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Select Backlog Item to Assign
                    </label>
                    <select
                      value={selectedBacklogForAssignment || ''}
                      onChange={(e) => {
                        const bId = Number(e.target.value);
                        setSelectedBacklogForAssignment(bId);
                        const found = backlogPlans.find(b => b.id === bId);
                        if (found) {
                          setAssignBacklogTargetDate(found.targetResolutionDate || 'End of Q4 2026');
                          setAssignBacklogPriority(found.priority || 'High');
                          setAssignBacklogNotes(found.notes || '');
                          setAssignBacklogCustomTarget(found.backlogTarget);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      {backlogPlans.map(b => {
                        const assignedTo = employees.find(e => e.id === b.assignedEmployeeId)?.name;
                        return (
                          <option key={b.id} value={b.id}>
                            [{b.category}] {b.title} — {b.backlogTarget.toLocaleString()} {b.metricUnit} ({assignedTo ? `Assigned to ${assignedTo}` : 'Unassigned Pool'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Assign To Employee
                      </label>
                      <select
                        value={assignBacklogTargetEmpId}
                        onChange={(e) => setAssignBacklogTargetEmpId(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      >
                        {staffMembers.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Target Resolution Horizon
                      </label>
                      <input
                        type="text"
                        required
                        value={assignBacklogTargetDate}
                        onChange={(e) => setAssignBacklogTargetDate(e.target.value)}
                        placeholder="e.g. End of Q4 2026, Nov 2026"
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Backlog Recovery Target
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={assignBacklogCustomTarget}
                        onChange={(e) => setAssignBacklogCustomTarget(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl font-mono text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Priority Level
                      </label>
                      <select
                        value={assignBacklogPriority}
                        onChange={(e) => setAssignBacklogPriority(e.target.value as BacklogPriority)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      >
                        <option value="Urgent">Urgent</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Recovery Instructions & Notes for Employee
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Specific client portfolio, agricultural unions, or action steps..."
                      value={assignBacklogNotes}
                      onChange={(e) => setAssignBacklogNotes(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </>
              )}

              {/* MODE 2: CREATE & ASSIGN NEW BACKLOG */}
              {assignBacklogMode === 'new' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Assign To Employee
                      </label>
                      <select
                        value={assignBacklogTargetEmpId}
                        onChange={(e) => setAssignBacklogTargetEmpId(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      >
                        {staffMembers.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        KPI Category
                      </label>
                      <select
                        value={backlogCategory}
                        onChange={(e) => setBacklogCategory(e.target.value as KpiCategory)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      >
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Backlog Plan Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Q3 Savings Mobilization Arrears Recovery"
                      value={backlogTitle}
                      onChange={(e) => setBacklogTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Metric Unit
                      </label>
                      <input
                        type="text"
                        required
                        value={backlogUnit}
                        onChange={(e) => setBacklogUnit(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Backlog Target
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={backlogTarget}
                        onChange={(e) => setBacklogTarget(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Recovered (Actual)
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={backlogActual}
                        onChange={(e) => setBacklogActual(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl text-center font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Origin Shortfall Period
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Q3 Shortfall, Q2 Rollover"
                        value={backlogOrigin}
                        onChange={(e) => setBacklogOrigin(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Target Resolution
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. End of Q4 2026, Nov 2026"
                        value={backlogResolution}
                        onChange={(e) => setBacklogResolution(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Priority
                      </label>
                      <select
                        value={backlogPriority}
                        onChange={(e) => setBacklogPriority(e.target.value as BacklogPriority)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      >
                        <option value="Urgent">Urgent</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Status
                      </label>
                      <select
                        value={backlogStatus}
                        onChange={(e) => setBacklogStatus(e.target.value as BacklogStatus)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Pending">Pending</option>
                        <option value="Cleared">Cleared</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Recovery Action Notes & Guidelines
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Key recovery steps, target client list, or resolution plan..."
                      value={backlogNotes}
                      onChange={(e) => setBacklogNotes(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignBacklogModal(false);
                    setShowBacklogModal(false);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : assignBacklogMode === 'existing'
                    ? 'Confirm Backlog Assignment'
                    : 'Create & Assign Backlog Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: ASSIGN EMPLOYEE PLAN ---------------- */}
      {showAssignEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingEmpAssignment ? 'Edit Assigned Plan' : 'Assign Strategic Plan to Employee'}
                </h3>
              </div>
              <button
                onClick={() => setShowAssignEmpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeAssignment} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Assign To Employee
                  </label>
                  <select
                    value={assignEmpId}
                    onChange={(e) => setAssignEmpId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {staffMembers.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    KPI Category
                  </label>
                  <select
                    value={assignCategory}
                    onChange={(e) => setAssignCategory(e.target.value as KpiCategory)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Individual Plan Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Savings Mobilization Target"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Metric Unit
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ETB, Accounts, Users, Cards"
                    value={assignUnit}
                    onChange={(e) => setAssignUnit(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Scorecard Weight (%)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={assignWeight}
                    onChange={(e) => setAssignWeight(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Assigned Annual Target
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={assignAnnualTarget}
                    onChange={(e) => setAssignAnnualTarget(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Realized Actual To Date
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={assignAnnualActual}
                    onChange={(e) => setAssignAnnualActual(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Manager Instructions & Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Specific strategies, target customer groups, or performance expectations..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignEmpModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingEmpAssignment ? 'Update Assignment' : 'Assign to Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 4: ACTUAL PERFORMANCE INPUT ---------------- */}
      {showPerfInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Record Actual Performance
                </h3>
              </div>
              <button
                onClick={() => setShowPerfInputModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePerformanceInput} className="space-y-4">
              {/* Target Stream selector: Employee vs Branch Plan vs Backlog */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Select Target Stream
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPerfStreamType('employee')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                      perfStreamType === 'employee'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Employee Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfStreamType('periodic')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                      perfStreamType === 'periodic'
                        ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Branch Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfStreamType('backlog')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                      perfStreamType === 'backlog'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Backlog
                  </button>
                </div>
              </div>

              {/* Selection based on stream */}
              {perfStreamType === 'employee' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Select Employee Assignment
                  </label>
                  <select
                    value={perfSelectedEmpPlanId}
                    onChange={(e) => setPerfSelectedEmpPlanId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {employeePlans.map(ep => {
                      const empName = employees.find(e => e.id === ep.employeeId)?.name || 'Staff';
                      return (
                        <option key={ep.id} value={ep.id}>
                          {empName} • [{ep.category}] {ep.title}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {perfStreamType === 'periodic' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Select Branch Strategic Plan
                  </label>
                  <select
                    value={perfSelectedPlanId}
                    onChange={(e) => setPerfSelectedPlanId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  >
                    {periodicPlans.map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.category}] {p.name} ({p.metricUnit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {perfStreamType === 'backlog' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Select Backlog Item
                  </label>
                  <select
                    value={perfSelectedPlanId}
                    onChange={(e) => setPerfSelectedPlanId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    {backlogPlans.map(b => {
                      const assignedEmp = employees.find(e => e.id === b.assignedEmployeeId);
                      return (
                        <option key={b.id} value={b.id}>
                          [{b.category}] {b.title} {assignedEmp ? `(${assignedEmp.name})` : '(Unassigned)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Period selection */}
              {perfStreamType !== 'backlog' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Timeframe Horizon
                    </label>
                    <select
                      value={perfPeriodType}
                      onChange={(e) => setPerfPeriodType(e.target.value as 'annual' | 'quarter' | 'month')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    >
                      <option value="annual">Annual Total</option>
                      <option value="quarter">Quarterly Milestone</option>
                      <option value="month">Monthly Realization</option>
                    </select>
                  </div>

                  {perfPeriodType === 'quarter' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Select Quarter
                      </label>
                      <select
                        value={perfQuarterKey}
                        onChange={(e) => setPerfQuarterKey(e.target.value as 'q1' | 'q2' | 'q3' | 'q4')}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-medium"
                      >
                        <option value="q1">Q1 (Jan - Mar)</option>
                        <option value="q2">Q2 (Apr - Jun)</option>
                        <option value="q3">Q3 (Jul - Sep)</option>
                        <option value="q4">Q4 (Oct - Dec)</option>
                      </select>
                    </div>
                  )}

                  {perfPeriodType === 'month' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Select Month
                      </label>
                      <select
                        value={perfMonthKey}
                        onChange={(e) => setPerfMonthKey(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-medium"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m} 2026</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Current Context Display */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                {perfStreamType === 'employee' && currentSelectedEmpPlan && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employee Target:</span>
                      <span className="font-bold text-slate-800">
                        {perfPeriodType === 'quarter'
                          ? currentSelectedEmpPlan.quarterly[perfQuarterKey]?.target.toLocaleString()
                          : perfPeriodType === 'month'
                          ? currentSelectedEmpPlan.monthly[perfMonthKey]?.target.toLocaleString()
                          : currentSelectedEmpPlan.annualTarget.toLocaleString()}{' '}
                        {currentSelectedEmpPlan.metricUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Realized:</span>
                      <span className="font-bold text-indigo-700">
                        {perfPeriodType === 'quarter'
                          ? currentSelectedEmpPlan.quarterly[perfQuarterKey]?.actual.toLocaleString()
                          : perfPeriodType === 'month'
                          ? currentSelectedEmpPlan.monthly[perfMonthKey]?.actual.toLocaleString()
                          : currentSelectedEmpPlan.annualActual.toLocaleString()}{' '}
                        {currentSelectedEmpPlan.metricUnit}
                      </span>
                    </div>
                  </>
                )}

                {perfStreamType === 'periodic' && currentSelectedPlan && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch Target:</span>
                      <span className="font-bold text-slate-800">
                        {perfPeriodType === 'quarter'
                          ? currentSelectedPlan.quarterly[perfQuarterKey]?.target.toLocaleString()
                          : perfPeriodType === 'month'
                          ? currentSelectedPlan.monthly[perfMonthKey]?.target.toLocaleString()
                          : currentSelectedPlan.annualTarget.toLocaleString()}{' '}
                        {currentSelectedPlan.metricUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Realized:</span>
                      <span className="font-bold text-sky-700">
                        {perfPeriodType === 'quarter'
                          ? currentSelectedPlan.quarterly[perfQuarterKey]?.actual.toLocaleString()
                          : perfPeriodType === 'month'
                          ? currentSelectedPlan.monthly[perfMonthKey]?.actual.toLocaleString()
                          : currentSelectedPlan.annualActual.toLocaleString()}{' '}
                        {currentSelectedPlan.metricUnit}
                      </span>
                    </div>
                  </>
                )}

                {perfStreamType === 'backlog' && currentSelectedBacklog && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned To:</span>
                      <span className="font-bold text-amber-800">
                        {employees.find(e => e.id === currentSelectedBacklog.assignedEmployeeId)?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Backlog Target:</span>
                      <span className="font-bold text-slate-800">
                        {currentSelectedBacklog.backlogTarget.toLocaleString()} {currentSelectedBacklog.metricUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Recovered to Date:</span>
                      <span className="font-bold text-emerald-700">
                        {currentSelectedBacklog.backlogActual.toLocaleString()} {currentSelectedBacklog.metricUnit}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Performance Figure Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">
                    Achieved Performance Figure
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={perfIsIncremental}
                      onChange={(e) => setPerfIsIncremental(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Add to existing (+)</span>
                  </label>
                </div>
                <input
                  type="number"
                  required
                  min={0}
                  value={perfInputVal}
                  onChange={(e) => setPerfInputVal(Number(e.target.value))}
                  placeholder="Enter achieved amount..."
                  className="w-full px-4 py-2.5 text-center text-lg font-bold font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPerfInputModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Recording...' : 'Save Performance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Modals: Create KPI, Create Category, Manage Categories */}
      <CreateKpiModal
        isOpen={showGlobalCreateKpi}
        onClose={() => setShowGlobalCreateKpi(false)}
      />

      <CreateCategoryModal
        isOpen={showGlobalCreateCategory}
        onClose={() => setShowGlobalCreateCategory(false)}
      />

      <ManageCategoriesModal
        isOpen={showGlobalManageCategories}
        onClose={() => setShowGlobalManageCategories(false)}
      />
    </div>
  );
};

export default AnnualPlanPage;