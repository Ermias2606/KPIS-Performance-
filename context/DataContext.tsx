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
} from '../types';
import { INITIAL_KPI_CATEGORIES } from '../constants';
import * as db from '../services/db';

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

interface DataContextType {
  employees: Employee[];
  branches: Branch[];
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
      setBranches(br);
      setAnnualPlan(plan);
      setKpis(kpiItems);
      setPeriodicPlans(pPlans);
      setBacklogPlans(bPlans);
      setEmployeePlans(epPlans);
      setKpiCategories(cats && cats.length > 0 ? cats : INITIAL_KPI_CATEGORIES);
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
    await fetchData();
  };

  const addKpi = async (kpi: Omit<Kpi, 'id'>) => {
    await db.add('kpis', kpi);
    await fetchData();
  };

  const deleteKpi = async (id: number) => {
    await db.deleteById('kpis', id);
    await fetchData();
  };

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    await db.add('employees', employee);
    await fetchData();
  };

  const updateEmployee = async (employee: Employee) => {
    await db.update('employees', employee);
    await fetchData();
  };

  const deleteEmployee = async (id: number) => {
    const employeeKpis = kpis.filter(k => k.employeeId === id);
    for (const k of employeeKpis) {
      await db.deleteById('kpis', k.id);
    }
    const empPlans = employeePlans.filter(ep => ep.employeeId === id);
    for (const ep of empPlans) {
      await db.deleteById('employeePlans', ep.id);
    }
    await db.deleteById('employees', id);
    await fetchData();
  };

  const addObjective = async (objective: Omit<AnnualPlanObjective, 'id'>) => {
    await db.add('annualPlan', objective);
    await fetchData();
  };

  const updateObjective = async (objective: AnnualPlanObjective) => {
    await db.update('annualPlan', objective);
    await fetchData();
  };

  const deleteObjective = async (id: number) => {
    await db.deleteById('annualPlan', id);
    await fetchData();
  };

  const updatePeriodicPlan = async (plan: PeriodicPlanItem) => {
    await db.update('plans', plan);
    await fetchData();
  };

  const addPeriodicPlan = async (plan: Omit<PeriodicPlanItem, 'id'>) => {
    await db.add('plans', plan);
    await fetchData();
  };

  const deletePeriodicPlan = async (id: number) => {
    await db.deleteById('plans', id);
    await fetchData();
  };

  const updateBacklogPlan = async (item: BacklogPlanItem) => {
    await db.update('backlogPlans', item);
    await fetchData();
  };

  const addBacklogPlan = async (item: Omit<BacklogPlanItem, 'id'>) => {
    await db.add('backlogPlans', item);
    await fetchData();
  };

  const deleteBacklogPlan = async (id: number) => {
    await db.deleteById('backlogPlans', id);
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
        await db.update('backlogPlans', {
          ...backlogItem,
          backlogActual: finalActual,
          status: newStatus,
        });
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

        // Synchronize with Ermiyas's corresponding employee KPI
        const matchingKpi = kpis.find(k => k.kpiCategory === plan.category);
        if (matchingKpi) {
          await db.update('kpis', {
            ...matchingKpi,
            actual: updated.annualActual,
          });
        }
      }
    }

    await fetchData();
  };

  // Specific Employee Plan Assignment & Performance Methods
  const assignEmployeePlan = async (assignment: Omit<EmployeePlanAssignment, 'id'>) => {
    const newId = await db.add('employeePlans', assignment);

    // Sync or create corresponding KPI for the employee's scorecard
    const matchingObjective = annualPlan.find(ap => ap.kpiCategory === assignment.category) || annualPlan[0];
    const existingKpi = kpis.find(k => k.employeeId === assignment.employeeId && k.kpiCategory === assignment.category);

    if (existingKpi) {
      await db.update('kpis', {
        ...existingKpi,
        name: assignment.title,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      });
    } else if (matchingObjective) {
      await db.add('kpis', {
        employeeId: assignment.employeeId,
        objectiveId: matchingObjective.id,
        name: assignment.title,
        kpiCategory: assignment.category,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      });
    }

    await fetchData();
  };

  const updateEmployeePlan = async (assignment: EmployeePlanAssignment) => {
    await db.update('employeePlans', assignment);

    // Synchronize KPI
    const matchingKpi = kpis.find(k => k.employeeId === assignment.employeeId && k.kpiCategory === assignment.category);
    if (matchingKpi) {
      await db.update('kpis', {
        ...matchingKpi,
        name: assignment.title,
        weight: assignment.weight,
        target: assignment.annualTarget,
        actual: assignment.annualActual,
      });
    }

    await fetchData();
  };

  const deleteEmployeePlan = async (id: number) => {
    const item = employeePlans.find(ep => ep.id === id);
    if (item) {
      const matchingKpi = kpis.find(k => k.employeeId === item.employeeId && k.kpiCategory === item.category);
      if (matchingKpi) {
        await db.deleteById('kpis', matchingKpi.id);
      }
    }
    await db.deleteById('employeePlans', id);
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

    // Sync employee KPI in real time
    const matchingKpi = kpis.find(k => k.employeeId === updated.employeeId && k.kpiCategory === updated.category);
    if (matchingKpi) {
      await db.update('kpis', {
        ...matchingKpi,
        actual: updated.annualActual,
      });
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
    await fetchData();
    return newCat;
  };

  const updateKpiCategory = async (cat: KpiCategoryItem) => {
    await db.update('kpiCategories', cat);
    await fetchData();
  };

  const deleteKpiCategory = async (id: string) => {
    await db.deleteById('kpiCategories', id);
    await fetchData();
  };

  const createFullKpi = async (params: CreateFullKpiParams) => {
    let objectiveId = 0;
    // 1. Add to Annual Plan Objectives if enabled
    if (params.addToAnnualPlan !== false) {
      const newObjId = await db.add('annualPlan', {
        category: params.perspective,
        kpiCategory: params.category,
        objective: params.name,
        target: params.annualTarget,
        actual: params.annualActual || 0,
        unit: params.metricUnit,
        weight: params.weight,
      });
      objectiveId = Number(newObjId);
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

      await db.add('plans', {
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
      });
    }

    // 3. Assign to Employee if employee specified
    if (params.assignToEmployeeId) {
      const empTarget = params.employeeTarget !== undefined ? params.employeeTarget : params.annualTarget;
      const empActual = params.employeeActual !== undefined ? params.employeeActual : (params.annualActual || 0);

      // Add to Employee Balanced Scorecard (kpis store)
      await db.add('kpis', {
        employeeId: params.assignToEmployeeId,
        objectiveId: objectiveId || 1,
        name: params.name,
        kpiCategory: params.category,
        weight: params.weight,
        target: empTarget,
        actual: empActual,
      });

      // Add to Employee Plans store
      const qTarget = Math.round(empTarget / 4);
      const qActual = Math.round(empActual / 4);
      const mTarget = Math.round(empTarget / 12);
      const mActual = Math.round(empActual / 12);

      const monthly: { [key: number]: { target: number; actual: number } } = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { target: mTarget, actual: m <= 9 ? mActual : 0 };
      }

      await db.add('employeePlans', {
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
      });
    }

    await fetchData();
  };

  const value = {
    employees,
    branches,
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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
