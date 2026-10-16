export enum Role {
  STAFF = 'Staff Member',
  MANAGER = 'Branch Manager',
  ADMIN = 'Admin (HQ)',
}

export enum PerspectiveCategory {
  FINANCIAL = 'Financial',
  CUSTOMER = 'Customer',
  INTERNAL_PROCESS = 'Internal Process',
  LEARNING_GROWTH = 'Learning & Growth',
}

export enum KpiCategory {
  DEPOSIT = 'Deposit',
  CUSTOMER_BASE = 'Customer Base',
  MOBILE_BANKING = 'Mobile Banking',
  CARD_BANKING = 'Card Banking',
  INTERNET_BANKING = 'Internet Banking',
}

export type KpiCategoryType = KpiCategory | string;

export interface KpiCategoryItem {
  id: string; // e.g. 'DEPOSIT', or custom ID
  name: string; // display name, e.g. 'Deposit', 'Foreign Remittance'
  perspective: PerspectiveCategory;
  defaultUnit: string; // e.g. 'ETB', 'Accounts', 'Users', 'Cards', 'Txns'
  color: string; // Hex color code or Tailwind accent color
  description?: string;
  isSystem?: boolean; // Default bank categories vs user-created
}

export interface Employee {
  id: number;
  name: string;
  role: Role;
  branchId: number;
  pin: string;
  positionTitle?: string;
  email?: string;
  phone?: string;
  department?: string;
  status?: 'Active' | 'On Leave' | 'Transferred';
  avatarUrl?: string;
}

export interface AnnualPlanObjective {
  id: number;
  category: PerspectiveCategory;
  kpiCategory?: KpiCategoryType;
  objective: string;
  target?: number;
  actual?: number;
  unit?: string;
  weight?: number;
  branchId?: number;
}

export interface Kpi {
  id: number;
  employeeId: number;
  objectiveId: number;
  name: string;
  weight: number; // Percentage
  target: number;
  actual: number;
  kpiCategory?: KpiCategoryType;
  selfRating?: number; // 1-5 scale
  managerRating?: number; // 1-5 scale
}

export interface Branch {
  id: number;
  name: string;
  code?: string; // e.g. "RTU-01"
  district?: string; // e.g. "West Hararghe District"
  fiscalYear?: string; // e.g. "2024/2025"
  openingDate?: string;
  juneClosingDepositBalance?: number; // Previous June closing balance in ETB
  isActive?: boolean;
}

export interface FiscalYearConfig {
  fiscalYear: string;
  startDate: string;
  endDate: string;
  juneClosingDepositBalance: number;
  targetGrowthRate: number; // e.g. 20%
}

export interface CalculatedKpi extends Kpi {
  objective: AnnualPlanObjective;
  achievement: number; // (actual / target) * 100
  score: number; // achievementScore * weight
}

export type PlanTimeframe = 'annual' | 'quarterly' | 'monthly' | 'employee' | 'backlog' | 'analytics';

export interface PeriodicPlanItem {
  id: number;
  category: KpiCategoryType;
  name: string;
  metricUnit: string; // e.g. 'ETB', 'Accounts', 'Users', 'Cards'
  annualTarget: number;
  annualActual: number;
  weight: number; // Percentage
  branchId?: number;
  quarterly: {
    q1: { target: number; actual: number };
    q2: { target: number; actual: number };
    q3: { target: number; actual: number };
    q4: { target: number; actual: number };
  };
  monthly: {
    [month: number]: { target: number; actual: number };
  };
}

export type BacklogPriority = 'Urgent' | 'High' | 'Medium' | 'Low';
export type BacklogStatus = 'Pending' | 'In Progress' | 'Cleared';

export interface BacklogPlanItem {
  id: number;
  category: KpiCategoryType;
  title: string;
  metricUnit: string;
  backlogTarget: number;
  backlogActual: number;
  originPeriod: string; // e.g. "Q2 2026 Shortfall", "Prior Period Inactive"
  targetResolutionDate: string; // e.g. "End of Q4", "Nov 2026"
  priority: BacklogPriority;
  status: BacklogStatus;
  branchId?: number;
  assignedEmployeeId?: number; // Specific employee assigned to recover this backlog
  assignedDate?: string;
  notes?: string;
}

export interface EmployeePlanAssignment {
  id: number;
  employeeId: number;
  category: KpiCategoryType;
  title: string;
  metricUnit: string;
  annualTarget: number;
  annualActual: number;
  weight: number; // percentage
  branchId?: number;
  quarterly: {
    q1: { target: number; actual: number };
    q2: { target: number; actual: number };
    q3: { target: number; actual: number };
    q4: { target: number; actual: number };
  };
  monthly: {
    [month: number]: { target: number; actual: number };
  };
  assignedDate?: string;
  notes?: string;
}

export interface BacklogNotice {
  id: string;
  planId?: number;
  category: KpiCategoryType;
  kpiName: string;
  periodType: 'quarter' | 'month' | 'annual';
  periodName: string; // e.g. "Q1", "Q2", "Month 3 (September)"
  target: number;
  actual: number;
  deficit: number; // target - actual
  metricUnit: string;
  severity: 'Urgent' | 'High' | 'Medium' | 'Low';
  source: 'branch' | 'employee';
  employeeId?: number;
  employeeName?: string;
  detectedAt: string;
  acknowledged?: boolean;
}

export interface PerformanceSubmission {
  id: string | number;
  employeeId: number;
  employeeName: string;
  targetId: number;
  targetName: string;
  category: string;
  metricUnit: string;
  previousActual: number;
  proposedActual: number;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
}
