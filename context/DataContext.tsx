import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import {
  Employee,
  Branch,
  AnnualPlanObjective,
  Kpi,
  CalculatedKpi,
  PerspectiveCategory,
  PeriodicPlanItem,
  BacklogPlanItem,
  EmployeePlanAssignment,
  KpiCategoryItem,
  BacklogNotice,
} from '../types';
import { INITIAL_KPI_CATEGORIES } from '../constants';
import * as db from '../services/db';
import {
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  fetchCollectionFromFirestore,
  batchSeedCollection,
} from '../services/firestoreSync';

const firestoreSave = (collectionName: string, item: any) => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    saveDocumentToFirestore(collectionName, item).catch(() => {});
  }
};

const firestoreDelete = (collectionName: string, id: any) => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    deleteDocumentFromFirestore(collectionName, id).catch(() => {});
  }
};

interface RecordPerformanceParams {
  planId: number;
  periodType: 'annual' | 'quarter' | 'month' | 'backlog';
  periodKey?: 'q1' | 'q2' | 'q3' | 'q4' | number;
  newActual: number;
  isIncremental?: boolean;
}

interface RecordEmployeePerformanceParams {
  assignmentId: number;
  periodType: 'annual' | 'quarter' | 'month';
  periodKey?: 'q1' | 'q2' | 'q3' | 'q4' | number;
  newActual: number;
  isIncremental?: boolean;
}

export interface CreateFullKpiParams {
  name: string;
  category: string; // ID or category name
  perspective: PerspectiveCategory;
  metricUnit: string;
  annualTarget: number;
  annualActual?: number;
  weight: number;
  assignToEmployeeId?: number;
  employeeTarget?: number;
  employeeActual?: number;
  addToPeriodicPlan?: boolean;
  addToAnnualPlan?: boolean;
}

interface DepositMobilizationMetrics {
  juneBaseline: number;
  annualTargetIncrement: number;
  actualNetIncrement: number;
  currentDepositBalance: number;
  incrementAchievement: number;
  netVariance: number;
  isUnderJuneBalance: boolean;
  underJuneBalanceAmount: number;
  quarterlyIncrements: {
    q1: { target: number; actual: number; variance: number; achievement: number };
    q2: { target: number; actual: number; variance: number; achievement: number };
    q3: { target: number; actual: number; variance: number; achievement: number };
    q4: { target: number; actual: number; variance: number; achievement: number };
  };
  monthlyIncrements: { [m: number]: { target: number; actual: number; variance: number; achievement: number } };
}

interface DataContextType {
  employees: Employee[];
  branches: Branch[];
  activeBranchId: number;
  setActiveBranchId: (id: number) => void;
  fiscalYear: string;
  setFiscalYear: (year: string) => Promise<void>;
  annualPlan: AnnualPlanObjective[];
  kpis: Kpi[];
  periodicPlans: PeriodicPlanItem[];
  backlogPlans: BacklogPlanItem[];
  employeePlans: EmployeePlanAssignment[];
  kpiCategories: KpiCategoryItem[];
  loading: boolean;
  refreshData: () => void;
  getEmployeeKpis: (employeeId: number) => CalculatedKpi[];
  updateKpi: (kpi: Kpi) => Promise<void>;
  addKpi: (kpi: Omit<Kpi, 'id'>) => Promise<void>;
  deleteKpi: (id: number) => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (employee: Employee) => Promise<void>;
  deleteEmployee: (id: number) => Promise<void>;
  addBranch: (branch: Omit<Branch, 'id'>) => Promise<Branch>;
  updateBranch: (branch: Branch) => Promise<void>;
  deleteBranch: (id: number) => Promise<void>;
  movePlanToBranch: (planId: number, targetBranchId: number, planType: 'periodic' | 'annual' | 'backlog') => Promise<void>;
  addObjective: (objective: Omit<AnnualPlanObjective, 'id'>) => Promise<void>;
  updateObjective: (objective: AnnualPlanObjective) => Promise<void>;
  deleteObjective: (id: number) => Promise<void>;
  updatePeriodicPlan: (plan: PeriodicPlanItem) => Promise<void>;
  addPeriodicPlan: (plan: Omit<PeriodicPlanItem, 'id'>) => Promise<void>;
  deletePeriodicPlan: (id: number) => Promise<void>;
  updateBacklogPlan: (item: BacklogPlanItem) => Promise<void>;
  addBacklogPlan: (item: Omit<BacklogPlanItem, 'id'>) => Promise<void>;
  deleteBacklogPlan: (id: number) => Promise<void>;
  assignBacklogPlan: (
    backlogId: number,
    employeeId: number | undefined,
    additionalInfo?: Partial<BacklogPlanItem>
  ) => Promise<void>;
  unassignBacklogPlan: (backlogId: number) => Promise<void>;
  recordActualPerformance: (params: RecordPerformanceParams) => Promise<void>;
  assignEmployeePlan: (assignment: Omit<EmployeePlanAssignment, 'id'>) => Promise<void>;
  updateEmployeePlan: (assignment: EmployeePlanAssignment) => Promise<void>;
  deleteEmployeePlan: (id: number) => Promise<void>;
  recordEmployeePerformance: (params: RecordEmployeePerformanceParams) => Promise<void>;
  addKpiCategory: (cat: Omit<KpiCategoryItem, 'id'> & { id?: string }) => Promise<KpiCategoryItem>;
  updateKpiCategory: (cat: KpiCategoryItem) => Promise<void>;
  deleteKpiCategory: (id: string) => Promise<void>;
  createFullKpi: (params: CreateFullKpiParams) => Promise<void>;
  getCalculatedBacklogNotices: () => BacklogNotice[];
  convertNoticeToBacklogPlan: (notice: BacklogNotice, assignedEmployeeId?: number) => Promise<void>;
  dismissNotice: (noticeId: string) => void;
  getDepositMobilizationMetrics: (branchId?: number) => DepositMobilizationMetrics;
}

export const DataContext = createContext<DataContextType>({} as DataContextType);

export const useData = () => useContext(DataContext);

// Helper function for calculation
export const calculateKpiMetrics = (kpi: Kpi, objective: AnnualPlanObjective | undefined): CalculatedKpi => {
  const safeObjective: AnnualPlanObjective = objective || {
    id: kpi.objectiveId || 0,
    category: PerspectiveCategory.FINANCIAL,
    objective: 'General Objective',
  };

  let achievementPercentage = 0;
  if (kpi.target > 0) {
    if (safeObjective.objective.toLowerCase().includes('time')) {
      achievementPercentage = kpi.actual > 0 ? (kpi.target / kpi.actual) * 100 : 100;
    } else {
      achievementPercentage = (kpi.actual / kpi.target) * 100;
    }
  } else if (kpi.target === 0 && kpi.actual === 0) {
    achievementPercentage = 100;
  }

  if (isNaN(achievementPercentage) || !isFinite(achievementPercentage)) {
    achievementPercentage = 0;
  }

  // Cap achievement between 0% and 120%
  achievementPercentage = Math.min(Math.max(achievementPercentage, 0), 120);

  const score = (achievementPercentage / 100) * (kpi.weight || 0);

  return {
    ...kpi,
    objective: safeObjective,
    achievement: Math.round(achievementPercentage),
    score: parseFloat(score.toFixed(2)),
  };
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number>(1);
  const [fiscalYear, setFiscalYearState] = useState<string>('2024/2025');
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('raitu_dismissed_notices') || '[]');
    } catch {
      return [];
    }
  });
  const [annualPlan, setAnnualPlan] = useState<AnnualPlanObjective[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [periodicPlans, setPeriodicPlans] = useState<PeriodicPlanItem[]>([]);
  const [backlogPlans, setBacklogPlans] = useState<BacklogPlanItem[]>([]);
  const [employeePlans, setEmployeePlans] = useState<EmployeePlanAssignment[]>([]);
  const [kpiCategories, setKpiCategories] = useState<KpiCategoryItem[]>(INITIAL_KPI_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [emp, br, plan, kpiItems, pPlans, bPlans, epPlans, cats] = await Promise.all([
        db.getAll<Employee>('employees'),
        db.getAll<Branch>('branches'),
        db.getAll<AnnualPlanObjective>('annualPlan'),
        db.getAll<Kpi>('kpis'),
        db.getAll<PeriodicPlanItem>('plans'),
        db.getAll<BacklogPlanItem>('backlogPlans'),
        db.getAll<EmployeePlanAssignment>('employeePlans'),
        db.getAll<KpiCategoryItem>('kpiCategories').catch(() => []),
      ]);
      setEmployees(emp);
      if (br && br.length > 0) {
        setBranches(br);
        const activeBr = br.find(b => b.isActive) || br[0];
        setActiveBranchId(prev => br.some(b => b.id === prev) ? prev : activeBr.id);
        if (activeBr.fiscalYear) {
          setFiscalYearState(activeBr.fiscalYear);
        }
      }
      setAnnualPlan(plan);
      setKpis(kpiItems);
      setPeriodicPlans(pPlans);
      setBacklogPlans(bPlans);
      setEmployeePlans(epPlans);
      setKpiCategories(cats && cats.length > 0 ? cats : INITIAL_KPI_CATEGORIES);

      // Non-blocking background sync: If online and Firestore is unseeded, populate initial records
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setTimeout(async () => {
          try {
            const remoteEmps = await fetchCollectionFromFirestore<Employee>('employees');
            if (remoteEmps.length === 0 && emp.length > 0) {
              await batchSeedCollection('employees', emp);
              if (plan.length > 0) await batchSeedCollection('annualPlanObjectives', plan);
              if (kpiItems.length > 0) await batchSeedCollection('kpis', kpiItems);
              if (pPlans.length > 0) await batchSeedCollection('periodicPlans', pPlans);
              if (bPlans.length > 0) await batchSeedCollection('backlogPlans', bPlans);
              if (epPlans.length > 0) await batchSeedCollection('employeePlans', epPlans);
            }
          } catch {
            // Graceful fallback for offline or unauthenticated initialization
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to load data from DB:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getEmployeeKpis = useCallback((employeeId: number): CalculatedKpi[] => {
    const employeeKpis = kpis.filter(k => k.employeeId === employeeId);
    return employeeKpis.map(kpi => {
      const objective = annualPlan.find(p => p.id === kpi.objectiveId);
      return calculateKpiMetrics(kpi, objective);
    });
  }, [kpis, annualPlan]);
  
  const updateKpi = async (kpi: Kpi) => {
    await db.update('kpis', kpi);
    firestoreSave('kpis', kpi);
    await fetchData();
  };

  const addKpi = async (kpi: Omit<Kpi, 'id'>) => {
    const id = await db.add('kpis', kpi);
    firestoreSave('kpis', { ...kpi, id });
    await fetchData();
  };

  const deleteKpi = async (id: number) => {
    await db.deleteById('kpis', id);
    firestoreDelete('kpis', id);
    await fetchData();
  };

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    const id = await db.add('employees', employee);
    firestoreSave('employees', { ...employee, id });
    await fetchData();
  };

  const updateEmployee = async (employee: Employee) => {
    await db.update('employees', employee);
    firestoreSave('employees', employee);
    await fetchData();
  };

  const deleteEmployee = async (id: number) => {
    const employeeKpis = kpis.filter(k => k.employeeId === id);
    for (const k of employeeKpis) {
      await db.deleteById('kpis', k.id);
      firestoreDelete('kpis', k.id);
    }
    const empPlans = employeePlans.filter(ep => ep.employeeId === id);
    for (const ep of empPlans) {
      await db.deleteById('employeePlans', ep.id);
      firestoreDelete('employeePlans', ep.id);
    }
    await db.deleteById('employees', id);
    firestoreDelete('employees', id);
    await fetchData();
  };

  const addBranch = async (branchData: Omit<Branch, 'id'>): Promise<Branch> => {
    const nextId = branches.length > 0 ? Math.max(...branches.map(b => b.id)) + 1 : 1;
    const newBranch: Branch = {
      ...branchData,
      id: nextId,
      isActive: branchData.isActive ?? false,
      juneClosingDepositBalance: branchData.juneClosingDepositBalance ?? 320000000,
      fiscalYear: branchData.fiscalYear || fiscalYear,
    };
    await db.add('branches', newBranch);
    firestoreSave('branches', newBranch);
    await fetchData();
    return newBranch;
  };

  const updateBranch = async (branchData: Branch) => {
    await db.update('branches', branchData);
    firestoreSave('branches', branchData);
    await fetchData();
  };

  const deleteBranch = async (id: number) => {
    await db.deleteById('branches', id);
    firestoreDelete('branches', id);
    if (activeBranchId === id) {
      const remaining = branches.filter(b => b.id !== id);
      if (remaining.length > 0) setActiveBranchId(remaining[0].id);
    }
    await fetchData();
  };

  const setFiscalYear = async (newYear: string) => {
    setFiscalYearState(newYear);
    const currBranch = branches.find(b => b.id === activeBranchId);
    if (currBranch) {
      const updated = { ...currBranch, fiscalYear: newYear };
      await updateBranch(updated);
    }
  };

  const movePlanToBranch = async (
    planId: number,
    targetBranchId: number,
    planType: 'periodic' | 'annual' | 'backlog'
  ) => {
    if (planType === 'periodic') {
      const plan = periodicPlans.find(p => p.id === planId);
      if (plan) {
        const updated = { ...plan, branchId: targetBranchId };
        await db.update('plans', updated);
        firestoreSave('periodicPlans', updated);
      }
    } else if (planType === 'annual') {
      const obj = annualPlan.find(p => p.id === planId);
      if (obj) {
        const updated = { ...obj, branchId: targetBranchId };
        await db.update('annualPlan', updated);
        firestoreSave('annualPlanObjectives', updated);
      }
    } else if (planType === 'backlog') {
      const item = backlogPlans.find(b => b.id === planId);
      if (item) {
        const updated = { ...item, branchId: targetBranchId };
        await db.update('backlogPlans', updated);
        firestoreSave('backlogPlans', updated);
      }
    }
    await fetchData();
  };

  const addObjective = async (objective: Omit<AnnualPlanObjective, 'id'>) => {
    const id = await db.add('annualPlan', objective);
    firestoreSave('annualPlanObjectives', { ...objective, id });
    await fetchData();
  };

  const updateObjective = async (objective: AnnualPlanObjective) => {
    await db.update('annualPlan', objective);
    firestoreSave('annualPlanObjectives', objective);
    await fetchData();
  };

  const deleteObjective = async (id: number) => {
    await db.deleteById('annualPlan', id);
    firestoreDelete('annualPlanObjectives', id);
    await fetchData();
  };

  const updatePeriodicPlan = async (plan: PeriodicPlanItem) => {
    await db.update('plans', plan);
    firestoreSave('periodicPlans', plan);
    await fetchData();
  };

  const addPeriodicPlan = async (plan: Omit<PeriodicPlanItem, 'id'>) => {
    const id = await db.add('plans', plan);
    firestoreSave('periodicPlans', { ...plan, id });
    await fetchData();
  };

  const deletePeriodicPlan = async (id: number) => {
    await db.deleteById('plans', id);
    firestoreDelete('periodicPlans', id);
    await fetchData();
  };

  const updateBacklogPlan = async (item: BacklogPlanItem) => {
    await db.update('backlogPlans', item);
    firestoreSave('backlogPlans', item);
    await fetchData();
  };

  const addBacklogPlan = async (item: Omit<BacklogPlanItem, 'id'>) => {
    const id = await db.add('backlogPlans', item);
    firestoreSave('backlogPlans', { ...item, id });
    await fetchData();
  };

  const deleteBacklogPlan = async (id: number) => {
    await db.deleteById('backlogPlans', id);
    firestoreDelete('backlogPlans', id);
    await fetchData();
  };

  const assignBacklogPlan = async (
    backlogId: number,
    employeeId: number | undefined,
    additionalInfo?: Partial<BacklogPlanItem>
  ) => {
    const item = backlogPlans.find(b => b.id === backlogId);
    if (item) {
      const updated: BacklogPlanItem = {
        ...item,
        assignedEmployeeId: employeeId,
        assignedDate: employeeId ? (item.assignedDate || new Date().toISOString().split('T')[0]) : undefined,
        ...(additionalInfo || {}),
      };
      if (!employeeId) {
        delete updated.assignedEmployeeId;
        delete updated.assignedDate;
      }
      await db.update('backlogPlans', updated);
      firestoreSave('backlogPlans', updated);
      await fetchData();
    }
  };

  const unassignBacklogPlan = async (backlogId: number) => {
    await assignBacklogPlan(backlogId, undefined);
  };

  // Centralized actual performance input processor for branch periodic & backlog plans
  const recordActualPerformance = async ({
    planId,
    periodType,
    periodKey,
    newActual,
    isIncremental = false,
  }: RecordPerformanceParams) => {
    if (periodType === 'backlog') {
      const backlogItem = backlogPlans.find(b => b.id === planId);
      if (backlogItem) {
        const finalActual = isIncremental ? backlogItem.backlogActual + newActual : newActual;
        const newStatus = finalActual >= backlogItem.backlogTarget ? 'Cleared' : 'In Progress';
        const updatedBacklog = {
          ...backlogItem,
          backlogActual: finalActual,
          status: newStatus,
        };
        await db.update('backlogPlans', updatedBacklog);
        firestoreSave('backlogPlans', updatedBacklog);
      }
    } else {
      const plan = periodicPlans.find(p => p.id === planId);
      if (plan) {
        const updated = { ...plan };

        if (periodType === 'annual') {
          updated.annualActual = isIncremental ? updated.annualActual + newActual : newActual;
        } else if (periodType === 'quarter' && typeof periodKey === 'string') {
          const qKey = periodKey as 'q1' | 'q2' | 'q3' | 'q4';
          const currentQ = updated.quarterly[qKey]?.actual || 0;
          const finalQ = isIncremental ? currentQ + newActual : newActual;
          updated.quarterly = {
            ...updated.quarterly,
            [qKey]: { ...updated.quarterly[qKey], actual: finalQ },
          };
          updated.annualActual =
            updated.quarterly.q1.actual +
            updated.quarterly.q2.actual +
            updated.quarterly.q3.actual +
            updated.quarterly.q4.actual;
        } else if (periodType === 'month' && typeof periodKey === 'number') {
          const mKey = periodKey;
          const currentM = updated.monthly[mKey]?.actual || 0;
          const finalM = isIncremental ? currentM + newActual : newActual;
          updated.monthly = {
            ...updated.monthly,
            [mKey]: { ...updated.monthly[mKey], actual: finalM },
          };
          let sumMonths = 0;
          for (let i = 1; i <= 12; i++) {
            sumMonths += updated.monthly[i]?.actual || 0;
          }
          updated.annualActual = sumMonths;
        }

        await db.update('plans', updated);
        firestoreSave('periodicPlans', updated);

        // Synchronize with Ermiyas's corresponding employee KPI
        const matchingKpi = kpis.find(k => k.kpiCategory === plan.category);
        if (matchingKpi) {
          const updatedKpi = {
            ...matchingKpi,
            actual: updated.annualActual,
          };
          await db.update('kpis', updatedKpi);
          firestoreSave('kpis', updatedKpi);
        }
      }
    }

    await fetchData();
  };

  // Specific Employee Plan Assignment & Performance Methods
  const assignEmployeePlan = async (assignment: Omit<EmployeePlanAssignment, 'id'>) => {
    const newId = await db.add('employeePlans', assignment);
    const assignedWithId = { ...assignment, id: Number(newId) };
    firestoreSave('employeePlans', assignedWithId);

    // Sync or create corresponding KPI for the employee's scorecard
    const matchingObjective = annualPlan.find(ap => ap.kpiCategory === assignment.category) || annualPlan[0];
    const existingKpi = kpis.find(k => k.employeeId === assignment.employeeId && k.kpiCategory === assignment.category);

    if (existingKpi) {
      const updatedKpi = {
        ...existingKpi,
        name: assignment.title,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      };
      await db.update('kpis', updatedKpi);
      firestoreSave('kpis', updatedKpi);
    } else if (matchingObjective) {
      const newKpi = {
        employeeId: assignment.employeeId,
        objectiveId: matchingObjective.id,
        name: assignment.title,
        kpiCategory: assignment.category,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      };
      const newKpiId = await db.add('kpis', newKpi);
      firestoreSave('kpis', { ...newKpi, id: Number(newKpiId) });
    }

    await fetchData();
  };

  const updateEmployeePlan = async (assignment: EmployeePlanAssignment) => {
    await db.update('employeePlans', assignment);
    firestoreSave('employeePlans', assignment);

    // Synchronize KPI
    const matchingKpi = kpis.find(k => k.employeeId === assignment.employeeId && k.kpiCategory === assignment.category);
    if (matchingKpi) {
      const updatedKpi = {
        ...matchingKpi,
        name: assignment.title,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      };
      await db.update('kpis', updatedKpi);
      firestoreSave('kpis', updatedKpi);
    }

    await fetchData();
  };

  const deleteEmployeePlan = async (id: number) => {
    const item = employeePlans.find(ep => ep.id === id);
    if (item) {
      const matchingKpi = kpis.find(k => k.employeeId === item.employeeId && k.kpiCategory === item.category);
      if (matchingKpi) {
        await db.deleteById('kpis', matchingKpi.id);
        firestoreDelete('kpis', matchingKpi.id);
      }
    }
    await db.deleteById('employeePlans', id);
    firestoreDelete('employeePlans', id);
    await fetchData();
  };

  const recordEmployeePerformance = async ({
    assignmentId,
    periodType,
    periodKey,
    newActual,
    isIncremental = false,
  }: RecordEmployeePerformanceParams) => {
    const item = employeePlans.find(ep => ep.id === assignmentId);
    if (!item) return;

    const updated = { ...item };

    if (periodType === 'annual') {
      updated.annualActual = isIncremental ? updated.annualActual + newActual : newActual;
    } else if (periodType === 'quarter' && typeof periodKey === 'string') {
      const qKey = periodKey as 'q1' | 'q2' | 'q3' | 'q4';
      const curQ = updated.quarterly[qKey]?.actual || 0;
      const finalQ = isIncremental ? curQ + newActual : newActual;
      updated.quarterly = {
        ...updated.quarterly,
        [qKey]: { ...updated.quarterly[qKey], actual: finalQ },
      };
      updated.annualActual =
        updated.quarterly.q1.actual +
        updated.quarterly.q2.actual +
        updated.quarterly.q3.actual +
        updated.quarterly.q4.actual;
    } else if (periodType === 'month' && typeof periodKey === 'number') {
      const mKey = periodKey;
      const curM = updated.monthly[mKey]?.actual || 0;
      const finalM = isIncremental ? curM + newActual : newActual;
      updated.monthly = {
        ...updated.monthly,
        [mKey]: { ...updated.monthly[mKey], actual: finalM },
      };
      let sumM = 0;
      for (let i = 1; i <= 12; i++) {
        sumM += updated.monthly[i]?.actual || 0;
      }
      updated.annualActual = sumM;
    }

    await db.update('employeePlans', updated);
    firestoreSave('employeePlans', updated);

    // Sync employee KPI in real time
    const matchingKpi = kpis.find(k => k.employeeId === updated.employeeId && k.kpiCategory === updated.category);
    if (matchingKpi) {
      const updatedKpi = {
        ...matchingKpi,
        actual: updated.annualActual,
      };
      await db.update('kpis', updatedKpi);
      firestoreSave('kpis', updatedKpi);
    }

    await fetchData();
  };

  const addKpiCategory = async (cat: Omit<KpiCategoryItem, 'id'> & { id?: string }): Promise<KpiCategoryItem> => {
    const slug = cat.id || cat.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const newCat: KpiCategoryItem = {
      ...cat,
      id: slug,
      isSystem: false,
    };
    await db.update('kpiCategories', newCat);
    firestoreSave('kpiCategories', newCat);
    await fetchData();
    return newCat;
  };

  const updateKpiCategory = async (cat: KpiCategoryItem) => {
    await db.update('kpiCategories', cat);
    firestoreSave('kpiCategories', cat);
    await fetchData();
  };

  const deleteKpiCategory = async (id: string) => {
    await db.deleteById('kpiCategories', id);
    firestoreDelete('kpiCategories', id);
    await fetchData();
  };

  const createFullKpi = async (params: CreateFullKpiParams) => {
    let objectiveId = 0;
    // 1. Add to Annual Plan Objectives if enabled
    if (params.addToAnnualPlan !== false) {
      const objData = {
        category: params.perspective,
        kpiCategory: params.category,
        objective: params.name,
        target: params.annualTarget,
        actual: params.annualActual || 0,
        unit: params.metricUnit,
        weight: params.weight,
      };
      const newObjId = await db.add('annualPlan', objData);
      objectiveId = Number(newObjId);
      firestoreSave('annualPlanObjectives', { ...objData, id: objectiveId });
    }

    // 2. Add to Periodic Plan Items if enabled
    if (params.addToPeriodicPlan !== false) {
      const qTarget = Math.round(params.annualTarget / 4);
      const qActual = Math.round((params.annualActual || 0) / 4);
      const mTarget = Math.round(params.annualTarget / 12);
      const mActual = Math.round((params.annualActual || 0) / 12);

      const monthly: { [key: number]: { target: number; actual: number } } = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = {
          target: mTarget,
          actual: m <= 9 ? mActual : 0,
        };
      }

      const planData = {
        category: params.category,
        name: params.name,
        metricUnit: params.metricUnit,
        annualTarget: params.annualTarget,
        annualActual: params.annualActual || 0,
        weight: params.weight,
        quarterly: {
          q1: { target: qTarget, actual: qActual },
          q2: { target: qTarget, actual: qActual },
          q3: { target: qTarget, actual: qActual },
          q4: { target: qTarget, actual: params.annualActual ? Math.max(0, params.annualActual - qActual * 3) : 0 },
        },
        monthly,
      };

      const planId = await db.add('plans', planData);
      firestoreSave('periodicPlans', { ...planData, id: Number(planId) });
    }

    // 3. Assign to Employee if employee specified
    if (params.assignToEmployeeId) {
      const empTarget = params.employeeTarget !== undefined ? params.employeeTarget : params.annualTarget;
      const empActual = params.employeeActual !== undefined ? params.employeeActual : (params.annualActual || 0);

      // Add to Employee Balanced Scorecard (kpis store)
      const kpiData = {
        employeeId: params.assignToEmployeeId,
        objectiveId: objectiveId || 1,
        name: params.name,
        kpiCategory: params.category,
        weight: params.weight,
        target: empTarget,
        actual: empActual,
      };
      const kpiId = await db.add('kpis', kpiData);
      firestoreSave('kpis', { ...kpiData, id: Number(kpiId) });

      // Add to Employee Plans store
      const qTarget = Math.round(empTarget / 4);
      const qActual = Math.round(empActual / 4);
      const mTarget = Math.round(empTarget / 12);
      const mActual = Math.round(empActual / 12);

      const monthly: { [key: number]: { target: number; actual: number } } = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { target: mTarget, actual: m <= 9 ? mActual : 0 };
      }

      const empPlanData = {
        employeeId: params.assignToEmployeeId,
        category: params.category,
        title: params.name,
        metricUnit: params.metricUnit,
        annualTarget: empTarget,
        annualActual: empActual,
        weight: params.weight,
        quarterly: {
          q1: { target: qTarget, actual: qActual },
          q2: { target: qTarget, actual: qActual },
          q3: { target: qTarget, actual: qActual },
          q4: { target: qTarget, actual: empActual ? Math.max(0, empActual - qActual * 3) : 0 },
        },
        monthly,
        assignedDate: new Date().toISOString().split('T')[0],
      };

      const empPlanId = await db.add('employeePlans', empPlanData);
      firestoreSave('employeePlans', { ...empPlanData, id: Number(empPlanId) });
    }

    await fetchData();
  };

  const dismissNotice = useCallback((noticeId: string) => {
    setDismissedNoticeIds(prev => {
      const next = [...prev, noticeId];
      try {
        localStorage.setItem('raitu_dismissed_notices', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const getCalculatedBacklogNotices = useCallback((): BacklogNotice[] => {
    const notices: BacklogNotice[] = [];
    const now = new Date().toISOString().split('T')[0];

    periodicPlans.forEach(plan => {
      const quarters = ['q1', 'q2', 'q3', 'q4'] as const;
      quarters.forEach(q => {
        const qData = plan.quarterly[q];
        if (qData && qData.target > 0 && qData.actual < qData.target) {
          const deficit = qData.target - qData.actual;
          const noticeId = `notice-branch-${plan.id}-${q}`;
          if (!dismissedNoticeIds.includes(noticeId)) {
            notices.push({
              id: noticeId,
              planId: plan.id,
              category: plan.category,
              kpiName: plan.name,
              periodType: 'quarter',
              periodName: q.toUpperCase(),
              target: qData.target,
              actual: qData.actual,
              deficit,
              metricUnit: plan.metricUnit,
              severity: deficit > qData.target * 0.3 ? 'High' : 'Medium',
              source: 'branch',
              detectedAt: now,
            });
          }
        }
      });

      for (let m = 1; m <= 12; m++) {
        const mData = plan.monthly[m];
        if (mData && mData.target > 0 && mData.actual < mData.target) {
          const deficit = mData.target - mData.actual;
          const noticeId = `notice-branch-${plan.id}-m${m}`;
          const monthNames = [
            'Month 1 (July)', 'Month 2 (August)', 'Month 3 (September)',
            'Month 4 (October)', 'Month 5 (November)', 'Month 6 (December)',
            'Month 7 (January)', 'Month 8 (February)', 'Month 9 (March)',
            'Month 10 (April)', 'Month 11 (May)', 'Month 12 (June)',
          ];
          if (!dismissedNoticeIds.includes(noticeId)) {
            notices.push({
              id: noticeId,
              planId: plan.id,
              category: plan.category,
              kpiName: plan.name,
              periodType: 'month',
              periodName: monthNames[m - 1] || `Month ${m}`,
              target: mData.target,
              actual: mData.actual,
              deficit,
              metricUnit: plan.metricUnit,
              severity: deficit > mData.target * 0.4 ? 'High' : 'Medium',
              source: 'branch',
              detectedAt: now,
            });
          }
        }
      }
    });

    employeePlans.forEach(ep => {
      const emp = employees.find(e => e.id === ep.employeeId);
      const quarters = ['q1', 'q2', 'q3', 'q4'] as const;
      quarters.forEach(q => {
        const qData = ep.quarterly[q];
        if (qData && qData.target > 0 && qData.actual < qData.target) {
          const deficit = qData.target - qData.actual;
          const noticeId = `notice-emp-${ep.id}-${q}`;
          if (!dismissedNoticeIds.includes(noticeId)) {
            notices.push({
              id: noticeId,
              planId: ep.id,
              category: ep.category,
              kpiName: ep.title,
              periodType: 'quarter',
              periodName: `${q.toUpperCase()} (Staff: ${emp?.name || 'Staff'})`,
              target: qData.target,
              actual: qData.actual,
              deficit,
              metricUnit: ep.metricUnit,
              severity: 'Medium',
              source: 'employee',
              employeeId: ep.employeeId,
              employeeName: emp?.name,
              detectedAt: now,
            });
          }
        }
      });
    });

    return notices;
  }, [periodicPlans, employeePlans, employees, dismissedNoticeIds]);

  const convertNoticeToBacklogPlan = async (notice: BacklogNotice, assignedEmployeeId?: number) => {
    const newBacklog: Omit<BacklogPlanItem, 'id'> = {
      category: notice.category,
      title: `${notice.kpiName} [${notice.periodName} Deficit Recovery]`,
      metricUnit: notice.metricUnit,
      backlogTarget: notice.deficit,
      backlogActual: 0,
      originPeriod: `${notice.periodName} Performance Shortfall`,
      targetResolutionDate: 'End of Current Quarter',
      priority: notice.severity === 'High' ? 'Urgent' : 'High',
      status: 'Pending',
      assignedEmployeeId: assignedEmployeeId || notice.employeeId,
      assignedDate: new Date().toISOString().split('T')[0],
      notes: `Auto-generated from ${notice.source === 'branch' ? 'branch plan' : 'staff scorecard'} variation. Planned: ${notice.target.toLocaleString()} ${notice.metricUnit}, Actual: ${notice.actual.toLocaleString()} ${notice.metricUnit}.`,
    };
    await addBacklogPlan(newBacklog);
    dismissNotice(notice.id);
  };

  const getDepositMobilizationMetrics = useCallback((targetBranchId?: number): DepositMobilizationMetrics => {
    const branchToUse = branches.find(b => b.id === (targetBranchId || activeBranchId)) || branches[0];
    const juneBaseline = branchToUse?.juneClosingDepositBalance || 320000000;

    const depositPeriodicPlan = periodicPlans.find(p =>
      p.category.toLowerCase().includes('deposit') || p.name.toLowerCase().includes('deposit')
    ) || periodicPlans[0];

    const annualTargetIncrement = depositPeriodicPlan?.annualTarget || 14594360;
    const actualNetIncrement = depositPeriodicPlan?.annualActual || 12500000;
    const currentDepositBalance = juneBaseline + actualNetIncrement;
    const netVariance = actualNetIncrement - annualTargetIncrement;
    const incrementAchievement = annualTargetIncrement > 0
      ? Math.round((actualNetIncrement / annualTargetIncrement) * 100)
      : 100;
    const isUnderJuneBalance = actualNetIncrement < 0;
    const underJuneBalanceAmount = isUnderJuneBalance ? Math.abs(actualNetIncrement) : 0;

    const quarterlyIncrements = {
      q1: {
        target: depositPeriodicPlan?.quarterly.q1.target || 0,
        actual: depositPeriodicPlan?.quarterly.q1.actual || 0,
        variance: (depositPeriodicPlan?.quarterly.q1.actual || 0) - (depositPeriodicPlan?.quarterly.q1.target || 0),
        achievement: depositPeriodicPlan?.quarterly.q1.target
          ? Math.round(((depositPeriodicPlan.quarterly.q1.actual) / depositPeriodicPlan.quarterly.q1.target) * 100)
          : 0,
      },
      q2: {
        target: depositPeriodicPlan?.quarterly.q2.target || 0,
        actual: depositPeriodicPlan?.quarterly.q2.actual || 0,
        variance: (depositPeriodicPlan?.quarterly.q2.actual || 0) - (depositPeriodicPlan?.quarterly.q2.target || 0),
        achievement: depositPeriodicPlan?.quarterly.q2.target
          ? Math.round(((depositPeriodicPlan.quarterly.q2.actual) / depositPeriodicPlan.quarterly.q2.target) * 100)
          : 0,
      },
      q3: {
        target: depositPeriodicPlan?.quarterly.q3.target || 0,
        actual: depositPeriodicPlan?.quarterly.q3.actual || 0,
        variance: (depositPeriodicPlan?.quarterly.q3.actual || 0) - (depositPeriodicPlan?.quarterly.q3.target || 0),
        achievement: depositPeriodicPlan?.quarterly.q3.target
          ? Math.round(((depositPeriodicPlan.quarterly.q3.actual) / depositPeriodicPlan.quarterly.q3.target) * 100)
          : 0,
      },
      q4: {
        target: depositPeriodicPlan?.quarterly.q4.target || 0,
        actual: depositPeriodicPlan?.quarterly.q4.actual || 0,
        variance: (depositPeriodicPlan?.quarterly.q4.actual || 0) - (depositPeriodicPlan?.quarterly.q4.target || 0),
        achievement: depositPeriodicPlan?.quarterly.q4.target
          ? Math.round(((depositPeriodicPlan.quarterly.q4.actual) / depositPeriodicPlan.quarterly.q4.target) * 100)
          : 0,
      },
    };

    const monthlyIncrements: { [m: number]: { target: number; actual: number; variance: number; achievement: number } } = {};
    for (let m = 1; m <= 12; m++) {
      const mData = depositPeriodicPlan?.monthly[m] || { target: 0, actual: 0 };
      monthlyIncrements[m] = {
        target: mData.target,
        actual: mData.actual,
        variance: mData.actual - mData.target,
        achievement: mData.target > 0 ? Math.round((mData.actual / mData.target) * 100) : 0,
      };
    }

    return {
      juneBaseline,
      annualTargetIncrement,
      actualNetIncrement,
      currentDepositBalance,
      incrementAchievement,
      netVariance,
      isUnderJuneBalance,
      underJuneBalanceAmount,
      quarterlyIncrements,
      monthlyIncrements,
    };
  }, [branches, activeBranchId, periodicPlans]);

  const value = {
    employees,
    branches,
    activeBranchId,
    setActiveBranchId,
    fiscalYear,
    setFiscalYear,
    annualPlan,
    kpis,
    periodicPlans,
    backlogPlans,
    employeePlans,
    kpiCategories,
    loading,
    refreshData: fetchData,
    getEmployeeKpis,
    updateKpi,
    addKpi,
    deleteKpi,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addBranch,
    updateBranch,
    deleteBranch,
    movePlanToBranch,
    addObjective,
    updateObjective,
    deleteObjective,
    updatePeriodicPlan,
    addPeriodicPlan,
    deletePeriodicPlan,
    updateBacklogPlan,
    addBacklogPlan,
    deleteBacklogPlan,
    assignBacklogPlan,
    unassignBacklogPlan,
    recordActualPerformance,
    assignEmployeePlan,
    updateEmployeePlan,
    deleteEmployeePlan,
    recordEmployeePerformance,
    addKpiCategory,
    updateKpiCategory,
    deleteKpiCategory,
    createFullKpi,
    getCalculatedBacklogNotices,
    convertNoticeToBacklogPlan,
    dismissNotice,
    getDepositMobilizationMetrics,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
