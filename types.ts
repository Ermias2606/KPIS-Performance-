export enum Role {
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Admin (HQ)',
  MANAGER = 'Branch Manager',
  OFFICER = 'Officer',
  STAFF = 'Staff Member',
}

export const isSuperAdminRole = (role?: Role | string): boolean => {
  return role === Role.SUPER_ADMIN || role === 'SUPER_ADMIN';
};

export const isAdminRole = (role?: Role | string): boolean => {
  return (
    role === Role.SUPER_ADMIN ||
    role === Role.ADMIN ||
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN'
  );
};

export const isManagerOrAboveRole = (role?: Role | string): boolean => {
  return isAdminRole(role) || role === Role.MANAGER || role === 'MANAGER';
};

export const isOfficerOrAboveRole = (role?: Role | string): boolean => {
  return isManagerOrAboveRole(role) || role === Role.OFFICER || role === 'OFFICER';
};

export const getRoleHierarchyLevel = (role?: Role | string): number => {
  switch (role) {
    case Role.SUPER_ADMIN:
    case 'SUPER_ADMIN':
      return 5;
    case Role.ADMIN:
    case 'ADMIN':
      return 4;
    case Role.MANAGER:
    case 'MANAGER':
      return 3;
    case Role.OFFICER:
    case 'OFFICER':
      return 2;
    case Role.STAFF:
    case 'STAFF':
    default:
      return 1;
  }
};

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

export type EmploymentType = 'Full-Time' | 'Contract' | 'Part-Time' | 'Seconded';
export type EmployeeStatus = 'Active' | 'On Leave' | 'Transferred' | 'Probation';

export interface Employee {
  id: number;
  name: string;
  role: Role;
  branchId: number;
  pin: string;
  username?: string;
  password?: string;
  passwordHash?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  mustChangePassword?: boolean;
  passwordResetRequested?: boolean;
  lastPasswordResetAt?: string;
  lastPasswordResetBy?: string;
  lastLoginAt?: string;
  employeeCode?: string;
  organizationId?: number;
  organizationRoleId?: string;
  positionTitle?: string;
  email?: string;
  phone?: string;
  department?: string;
  employmentType?: EmploymentType;
  hireDate?: string;
  qualification?: string;
  specialization?: string;
  supervisorId?: number;
  location?: string;
  emergencyContact?: string;
  skills?: string[];
  notes?: string;
  status?: EmployeeStatus;
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
  organizationId?: number;
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
  organizationId?: number;
}

export type OrganizationSector =
  | 'Manufacturing & Production'
  | 'Service & Hospitality'
  | 'Financial & Banking Services'
  | 'Technology & SaaS'
  | 'Healthcare & Medical'
  | 'Retail & Supply Chain'
  | 'Agriculture & Agro-Processing'
  | 'Education & Research'
  | 'Public Sector & NGO'
  | string;

export interface OrganizationPositionRole {
  id: string;
  title: string;
  department: string;
  systemRole: Role;
  responsibilities?: string;
  requiredCount?: number;
  isRequired?: boolean;
}

export type OrganizationServiceStatus = 'Active' | 'Suspended' | 'Trial';
export type OrganizationServicePlanTier = 'Starter' | 'Enterprise' | 'Custom Service Plan';

export interface OrganizationCapabilities {
  kpiScorecard: boolean;
  periodicPlans: boolean;
  backlogEngine: boolean;
  employeeEvaluations: boolean;
  customerFeedback: boolean;
  reportsAndExports: boolean;
  lanAndSnapshots: boolean;
}

export interface OrganizationQuotas {
  maxEmployees: number;
  maxBranches: number;
  maxStorageMb: number;
}

export interface SystemProviderConfig {
  serviceTitle: string;
  ownerName: string;
  ownerEmail: string;
  masterPasskey: string;
  masterPin: string;
  updatedAt?: string;
}

export interface Organization {
  id: number;
  name: string;
  code: string;
  sector: OrganizationSector;
  logoUrl?: string;
  description?: string;
  headquarters?: string;
  establishedDate?: string;
  primaryCurrency?: string;
  isActive?: boolean;
  requiredPositions?: OrganizationPositionRole[];
  serviceStatus?: OrganizationServiceStatus;
  planTier?: OrganizationServicePlanTier;
  capabilities?: OrganizationCapabilities;
  quotas?: OrganizationQuotas;
  primaryAdminEmail?: string;
  ownerNotes?: string;
}

export interface Branch {
  id: number;
  name: string;
  code?: string; // e.g. "HQ-01"
  district?: string; // e.g. "Central Operations Zone"
  fiscalYear?: string; // e.g. "2024/2025"
  openingDate?: string;
  juneClosingDepositBalance?: number; // Previous June closing baseline
  isActive?: boolean;
  organizationId?: number;
  sector?: OrganizationSector;
  logoUrl?: string;
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
  organizationId?: number;
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
  organizationId?: number;
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
  organizationId?: number;
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

export type AuditActionType =
  | 'AUTH_LOGIN'
  | 'AUTH_LOCKOUT'
  | 'ACCOUNT_UNLOCK'
  | 'PASSWORD_RESET'
  | 'ROLE_CHANGE'
  | 'KPI_UPDATE'
  | 'PLAN_UPDATE'
  | 'ORG_CHANGE'
  | 'ORG_MUTATION'
  | 'SNAPSHOT_CREATE'
  | 'SNAPSHOT_RESTORE'
  | 'BULK_IMPORT'
  | 'KPI_ENGINE_RUN';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  organizationId: number;
  branchId?: number;
  actorId: number;
  actorName: string;
  actorRole: Role | string;
  actionType: AuditActionType;
  targetEntity: string;
  targetId?: string | number;
  summary: string;
  previousValue?: string;
  newValue?: string;
}

export interface SyncQueueItem {
  id: string;
  timestamp: string;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  organizationId: number;
  retryCount: number;
}

export interface DatabaseSnapshot {
  id: string;
  createdAt: string;
  createdBy: string;
  organizationId: number;
  label: string;
  triggerType: 'Scheduled' | 'Manual' | 'Pre-Restore';
  recordCounts: {
    organizations: number;
    branches: number;
    employees: number;
    kpis: number;
    plans: number;
    backlogs: number;
  };
  data?: {
    organizations: Organization[];
    branches: Branch[];
    employees: Employee[];
    annualPlan: AnnualPlanObjective[];
    kpis: Kpi[];
    periodicPlans: PeriodicPlanItem[];
    backlogPlans: BacklogPlanItem[];
    employeePlans: EmployeePlanAssignment[];
  };
}

export interface KpiEngineScheduleConfig {
  enabled: boolean;
  intervalSeconds: number;
  autoSyncBacklogs: boolean;
  runOnMutation: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  totalRunsCount: number;
}

export interface KpiEngineShortfallAlert {
  id: string;
  category: string;
  kpiName: string;
  periodName: string;
  target: number;
  actual: number;
  deficit: number;
  metricUnit: string;
  severity: 'Urgent' | 'High' | 'Medium' | 'Low';
  source: 'branch' | 'employee';
  employeeName?: string;
  autoSyncedBacklogId?: number;
  backlogGenerated?: boolean;
}

export interface KpiEngineCalculationResult {
  executedAt: string;
  triggerSource: 'Periodic Scheduler' | 'Mutation Hook' | 'Manual Trigger' | 'Startup' | string;
  organizationId: number;
  branchId: number;
  employeeScores: {
    employeeId: number;
    employeeName: string;
    role: string;
    kpiCount: number;
    totalWeight?: number;
    activeBacklogsCount?: number;
    weightedScore: number;
    averageAchievement: number;
  }[];
  perspectiveScores?: {
    perspective: string;
    objectiveCount: number;
    averageAchievement: number;
    weightedScore: number;
  }[];
  perspectiveBreakdown?: {
    perspective: string;
    totalWeight: number;
    weightedScore: number;
    achievement: number;
  }[];
  shortfallAlerts?: KpiEngineShortfallAlert[];
  detectedShortfallsCount: number;
  overallBranchAchievement: number;
  averageEmployeeWeightedScore?: number;
  netDepositIncrement: number;
  reconciledPlansCount?: number;
  autoGeneratedBacklogsCount?: number;
  autoClearedBacklogsCount?: number;
  reconciledBacklogsCount?: number;
  totalBacklogDeficitRemaining?: number;
}


