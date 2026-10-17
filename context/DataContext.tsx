import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import {
  Employee,
  Branch,
  Organization,
  AnnualPlanObjective,
  Kpi,
  CalculatedKpi,
  PerspectiveCategory,
  PeriodicPlanItem,
  BacklogPlanItem,
  EmployeePlanAssignment,
  KpiCategoryItem,
  BacklogNotice,
  AuditLogEntry,
  DatabaseSnapshot,
  SyncQueueItem,
  KpiEngineCalculationResult,
  KpiEngineScheduleConfig,
  OrganizationCapabilities,
  OrganizationQuotas,
  OrganizationServicePlanTier,
  OrganizationServiceStatus,
  Role,
} from '../types';
import {
  INITIAL_KPI_CATEGORIES,
  INITIAL_ORGANIZATIONS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  DEFAULT_ORGANIZATION_QUOTAS,
  getDefaultPositionsForSector,
} from '../constants';
import * as db from '../services/db';
import {
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  fetchCollectionFromFirestore,
  batchSeedCollection,
  subscribeCollectionFromFirestore,
} from '../services/firestoreSync';
import {
  getOfflineMutationQueue,
  flushOfflineMutationQueueToServer,
  pushMutationToServerOrQueue,
  apiFetchAuditLogs,
  apiRunKpiCalculationEngine,
  apiFetchKpiEngineStatus,
  apiUpdateKpiEngineSchedule,
  apiFetchSnapshots,
  apiCreateSnapshot,
  apiRestoreSnapshot,
  apiBulkImportRecords,
  apiSystemProvisionOrganization,
  apiUpdateOrganizationServiceConfig,
  connectRealtimeBackendSocket,
} from '../services/backendApi';

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

const dedupeById = <T extends { id: string | number }>(items: T[]): T[] => {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(String(item.id), item);
    }
  }
  return Array.from(map.values());
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
  category: string;
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
  organizations: Organization[];
  activeOrganizationId: number;
  activeOrganization: Organization;
  setActiveOrganizationId: (id: number) => void;
  addOrganization: (org: Omit<Organization, 'id'>) => Promise<Organization>;
  updateOrganization: (org: Organization) => Promise<void>;
  deleteOrganization: (id: number) => Promise<void>;
  provisionClientOrganization: (params: {
    name: string;
    code: string;
    sector: string;
    headquarters?: string;
    primaryCurrency?: string;
    description?: string;
    planTier?: OrganizationServicePlanTier;
    quotas?: Partial<OrganizationQuotas>;
    capabilities?: Partial<OrganizationCapabilities>;
    initialBranchName?: string;
    initialBranchDistrict?: string;
    adminName?: string;
    adminUsername?: string;
    adminEmail?: string;
    adminPassword?: string;
    adminPin?: string;
  }) => Promise<{ organization?: Organization; branch?: Branch; admin?: Employee }>;
  updateOrganizationServiceConfig: (params: {
    organizationId: number;
    serviceStatus?: OrganizationServiceStatus;
    planTier?: OrganizationServicePlanTier;
    capabilities?: Partial<OrganizationCapabilities>;
    quotas?: Partial<OrganizationQuotas>;
    ownerNotes?: string;
    assignAdmin?: {
      name: string;
      username: string;
      email: string;
      password: string;
      pin: string;
      role?: Role;
    };
  }) => Promise<{ organization?: Organization; admin?: Employee }>;
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
  // Enterprise Backend & Real-Time Governance Capabilities
  wsConnected: boolean;
  offlineQueue: SyncQueueItem[];
  flushOfflineQueue: () => Promise<number>;
  auditLogs: AuditLogEntry[];
  refreshAuditLogs: (orgId?: number | 'ALL', actionType?: string) => Promise<void>;
  snapshots: DatabaseSnapshot[];
  createSnapshot: (label: string) => Promise<DatabaseSnapshot | null>;
  restoreSnapshot: (snapshotId: string) => Promise<boolean>;
  latestKpiEngineResult: KpiEngineCalculationResult | null;
  kpiEngineSchedule: KpiEngineScheduleConfig;
  runKpiEngineAudit: (syncBacklogs?: boolean) => Promise<KpiEngineCalculationResult | null>;
  updateKpiEngineSchedule: (
    config: Partial<KpiEngineScheduleConfig>
  ) => Promise<KpiEngineScheduleConfig | null>;
  bulkImportData: (
    entityType: 'employees' | 'kpis' | 'periodicPlans' | 'branches' | 'fullSnapshot',
    records: any
  ) => Promise<number>;
  connectedPeers: any[];
}

export const DataContext = createContext<DataContextType>({} as DataContextType);

export const useData = () => useContext(DataContext);

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
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const saved = localStorage.getItem('pt_organizations');
      const parsed: Organization[] = saved ? JSON.parse(saved) : INITIAL_ORGANIZATIONS;
      return parsed.map(org => ({
        ...org,
        requiredPositions:
          org.requiredPositions && org.requiredPositions.length > 0
            ? org.requiredPositions
            : getDefaultPositionsForSector(org.sector),
      }));
    } catch {
      return INITIAL_ORGANIZATIONS;
    }
  });
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pt_active_org_id');
      return saved ? Number(saved) : INITIAL_ORGANIZATIONS[0].id;
    } catch {
      return INITIAL_ORGANIZATIONS[0].id;
    }
  });
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

  // Backend Governance & Sync State
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<SyncQueueItem[]>(() => getOfflineMutationQueue());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<any[]>([]);
  const [latestKpiEngineResult, setLatestKpiEngineResult] =
    useState<KpiEngineCalculationResult | null>(null);
  const [kpiEngineSchedule, setKpiEngineSchedule] = useState<KpiEngineScheduleConfig>({
    enabled: true,
    intervalSeconds: 30,
    autoSyncBacklogs: true,
    runOnMutation: true,
    totalRunsCount: 0,
  });

  const syncMutation = useCallback(
    async (
      collection: string,
      operation: 'create' | 'update' | 'delete',
      payload: any
    ) => {
      const actorId = Number(sessionStorage.getItem('userId')) || 1;
      await pushMutationToServerOrQueue(
        collection,
        operation,
        payload,
        activeOrganizationId,
        actorId
      );
      setOfflineQueue(getOfflineMutationQueue());
    },
    [activeOrganizationId]
  );

  const flushOfflineQueue = useCallback(async (): Promise<number> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const { flushedCount } = await flushOfflineMutationQueueToServer(actorId);
    setOfflineQueue(getOfflineMutationQueue());
    if (flushedCount > 0) {
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
    }
    return flushedCount;
  }, []);

  const refreshAuditLogs = useCallback(
    async (orgId?: number | 'ALL', actionType?: string) => {
      const logs = await apiFetchAuditLogs(orgId, actionType);
      setAuditLogs(logs);
    },
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load local IndexedDB cache first for instant responsiveness
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
      setEmployees(dedupeById(emp));
      if (br && br.length > 0) {
        const cleanBr = dedupeById(br);
        setBranches(cleanBr);
        const activeBr = cleanBr.find(b => b.isActive) || cleanBr[0];
        setActiveBranchId(prev => cleanBr.some(b => b.id === prev) ? prev : activeBr.id);
        if (activeBr.fiscalYear) {
          setFiscalYearState(activeBr.fiscalYear);
        }
      }
      setAnnualPlan(dedupeById(plan));
      setKpis(dedupeById(kpiItems));
      setPeriodicPlans(dedupeById(pPlans));
      setBacklogPlans(dedupeById(bPlans));
      setEmployeePlans(dedupeById(epPlans));
      setKpiCategories(cats && cats.length > 0 ? dedupeById(cats) : INITIAL_KPI_CATEGORIES);

      // 2. Pull authoritative state from Express Backend if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await flushOfflineMutationQueueToServer();
          setOfflineQueue(getOfflineMutationQueue());

          const res = await fetch('/api/state');
          if (res.ok) {
            const serverState = await res.json();
            if (Array.isArray(serverState.organizations) && serverState.organizations.length > 0) {
              const normalizedOrgs = dedupeById<Organization>(
                serverState.organizations.map((org: Organization) => ({
                  ...org,
                  requiredPositions:
                    org.requiredPositions && org.requiredPositions.length > 0
                      ? org.requiredPositions
                      : getDefaultPositionsForSector(org.sector),
                }))
              );
              setOrganizations(normalizedOrgs);
              localStorage.setItem('pt_organizations', JSON.stringify(normalizedOrgs));
            }
            if (Array.isArray(serverState.employees) && serverState.employees.length > 0) {
              const cleanEmps = dedupeById<Employee>(serverState.employees);
              setEmployees(cleanEmps);
              for (const item of cleanEmps) {
                await db.update('employees', item).catch(() => {});
              }
            }
            if (Array.isArray(serverState.branches) && serverState.branches.length > 0) {
              setBranches(dedupeById(serverState.branches));
            }
            if (Array.isArray(serverState.annualPlan) && serverState.annualPlan.length > 0) {
              setAnnualPlan(dedupeById(serverState.annualPlan));
            }
            if (Array.isArray(serverState.kpis) && serverState.kpis.length > 0) {
              setKpis(dedupeById(serverState.kpis));
            }
            if (Array.isArray(serverState.periodicPlans) && serverState.periodicPlans.length > 0) {
              setPeriodicPlans(dedupeById(serverState.periodicPlans));
            }
            if (Array.isArray(serverState.backlogPlans) && serverState.backlogPlans.length > 0) {
              setBacklogPlans(dedupeById(serverState.backlogPlans));
            }
            if (Array.isArray(serverState.employeePlans) && serverState.employeePlans.length > 0) {
              setEmployeePlans(dedupeById(serverState.employeePlans));
            }
            if (Array.isArray(serverState.auditLogs)) {
              setAuditLogs(dedupeById(serverState.auditLogs));
            }
            if (Array.isArray(serverState.snapshots)) {
              setSnapshots(dedupeById(serverState.snapshots));
            }
            if (serverState.kpiEngineSchedule) {
              setKpiEngineSchedule(serverState.kpiEngineSchedule);
            }
            if (serverState.lastKpiEngineResult) {
              setLatestKpiEngineResult(serverState.lastKpiEngineResult);
            } else if (
              Array.isArray(serverState.kpiEngineHistory) &&
              serverState.kpiEngineHistory.length > 0
            ) {
              setLatestKpiEngineResult(serverState.kpiEngineHistory[0]);
            }
          }
        } catch {
          // Offline mode fallback
        }

        // 3. Non-blocking background Firestore seed check
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
            // Graceful fallback
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

  // Real-Time WebSocket & Two-Way Firestore Listeners
  useEffect(() => {
    const clientId = `ws-${Math.random().toString(36).slice(2, 8)}`;
    const storedUserId = Number(sessionStorage.getItem('userId')) || 1;
    const currentEmp = employees.find((e) => e.id === storedUserId);

    const wsHandle = connectRealtimeBackendSocket(
      {
        clientId,
        userName: currentEmp?.name || 'Workstation Terminal',
        userRole: currentEmp?.role || Role.STAFF,
        organizationId: activeOrganizationId,
        branchId: activeBranchId,
      },
      {
        onConnectionChange: (connected) => {
          setWsConnected(connected);
          if (connected) {
            flushOfflineQueue().catch(() => {});
          }
        },
        onPresenceUpdate: (peers) => {
          setConnectedPeers(peers);
        },
        onAuditCreated: (entry) => {
          setAuditLogs((prev) => [entry, ...prev.filter((a) => a.id !== entry.id)].slice(0, 200));
        },
        onEntityMutated: ({ collection, operation, item }) => {
          if (collection === 'employees') {
            if (operation === 'delete') {
              const delId = typeof item === 'object' ? item.id : item;
              setEmployees((prev) => prev.filter((e) => e.id !== Number(delId)));
            } else if (item && item.id) {
              setEmployees((prev) => dedupeById([...prev.filter((e) => e.id !== item.id), item]));
              db.update('employees', item).catch(() => {});
            }
          } else if (collection === 'kpis') {
            if (operation === 'delete') {
              const delId = typeof item === 'object' ? item.id : item;
              setKpis((prev) => prev.filter((k) => k.id !== Number(delId)));
            } else if (item && item.id) {
              setKpis((prev) => dedupeById([...prev.filter((k) => k.id !== item.id), item]));
              db.update('kpis', item).catch(() => {});
            }
          } else if (collection === 'periodicPlans' || collection === 'plans') {
            if (item && item.id) {
              setPeriodicPlans((prev) => dedupeById([...prev.filter((p) => p.id !== item.id), item]));
              db.update('plans', item).catch(() => {});
            }
          } else if (collection === 'backlogPlans') {
            if (item && item.id) {
              setBacklogPlans((prev) => dedupeById([...prev.filter((b) => b.id !== item.id), item]));
              db.update('backlogPlans', item).catch(() => {});
            }
          } else if (collection === 'organizations') {
            if (item && item.id) {
              setOrganizations((prev) => {
                const next = dedupeById([...prev.filter((o) => o.id !== item.id), item]);
                localStorage.setItem('pt_organizations', JSON.stringify(next));
                return next;
              });
            }
          }
        },
        onSnapshotRestored: ({ state }) => {
          if (state) {
            if (state.organizations) setOrganizations(dedupeById(state.organizations));
            if (state.branches) setBranches(dedupeById(state.branches));
            if (state.employees) setEmployees(dedupeById(state.employees));
            if (state.annualPlan) setAnnualPlan(dedupeById(state.annualPlan));
            if (state.kpis) setKpis(dedupeById(state.kpis));
            if (state.periodicPlans) setPeriodicPlans(dedupeById(state.periodicPlans));
            if (state.backlogPlans) setBacklogPlans(dedupeById(state.backlogPlans));
            if (state.employeePlans) setEmployeePlans(dedupeById(state.employeePlans));
          }
        },
        onKpiEngineUpdated: (payload: any) => {
          if (payload?.result) {
            setLatestKpiEngineResult(payload.result);
          }
          if (payload?.schedule) {
            setKpiEngineSchedule(payload.schedule);
          }
          const st = payload?.state || payload;
          if (st) {
            if (Array.isArray(st.kpis)) setKpis(dedupeById(st.kpis));
            if (Array.isArray(st.periodicPlans)) setPeriodicPlans(dedupeById(st.periodicPlans));
            if (Array.isArray(st.backlogPlans)) setBacklogPlans(dedupeById(st.backlogPlans));
            if (Array.isArray(st.employeePlans)) setEmployeePlans(dedupeById(st.employeePlans));
          }
        },
      }
    );

    // Two-Way Firestore Real-Time Listeners (when authenticated with Firebase)
    const unsubKpis = subscribeCollectionFromFirestore<Kpi>('kpis', (remoteKpis) => {
      if (remoteKpis.length > 0) setKpis(dedupeById(remoteKpis));
    });
    const unsubPlans = subscribeCollectionFromFirestore<PeriodicPlanItem>(
      'periodicPlans',
      (remotePlans) => {
        if (remotePlans.length > 0) setPeriodicPlans(dedupeById(remotePlans));
      }
    );

    const handleOnlineFlush = () => {
      flushOfflineQueue().catch(() => {});
    };
    window.addEventListener('online', handleOnlineFlush);

    return () => {
      wsHandle.disconnect();
      unsubKpis();
      unsubPlans();
      window.removeEventListener('online', handleOnlineFlush);
    };
  }, [activeOrganizationId, activeBranchId, flushOfflineQueue]);

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
    await syncMutation('kpis', 'update', kpi);
    await fetchData();
  };

  const addKpi = async (kpi: Omit<Kpi, 'id'>) => {
    const id = await db.add('kpis', kpi);
    const created = { ...kpi, id: Number(id), organizationId: activeOrganizationId };
    firestoreSave('kpis', created);
    await syncMutation('kpis', 'create', created);
    await fetchData();
  };

  const deleteKpi = async (id: number) => {
    await db.deleteById('kpis', id);
    firestoreDelete('kpis', id);
    await syncMutation('kpis', 'delete', { id });
    await fetchData();
  };

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    const id = await db.add('employees', employee);
    const created = { ...employee, id: Number(id) };
    firestoreSave('employees', created);
    await syncMutation('employees', 'create', created);
    await fetchData();
  };

  const updateEmployee = async (employee: Employee) => {
    await db.update('employees', employee);
    firestoreSave('employees', employee);
    await syncMutation('employees', 'update', employee);
    await fetchData();
  };

  const deleteEmployee = async (id: number) => {
    const employeeKpis = kpis.filter(k => k.employeeId === id);
    for (const k of employeeKpis) {
      await db.deleteById('kpis', k.id);
      firestoreDelete('kpis', k.id);
      await syncMutation('kpis', 'delete', { id: k.id });
    }
    const empPlans = employeePlans.filter(ep => ep.employeeId === id);
    for (const ep of empPlans) {
      await db.deleteById('employeePlans', ep.id);
      firestoreDelete('employeePlans', ep.id);
      await syncMutation('employeePlans', 'delete', { id: ep.id });
    }
    await db.deleteById('employees', id);
    firestoreDelete('employees', id);
    await syncMutation('employees', 'delete', { id });
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
    await syncMutation('branches', 'create', newBranch);
    await fetchData();
    return newBranch;
  };

  const updateBranch = async (branchData: Branch) => {
    await db.update('branches', branchData);
    firestoreSave('branches', branchData);
    await syncMutation('branches', 'update', branchData);
    await fetchData();
  };

  const deleteBranch = async (id: number) => {
    await db.deleteById('branches', id);
    firestoreDelete('branches', id);
    await syncMutation('branches', 'delete', { id });
    if (activeBranchId === id) {
      const remaining = branches.filter(b => b.id !== id);
      if (remaining.length > 0) setActiveBranchId(remaining[0].id);
    }
    await fetchData();
  };

  const setActiveOrganizationId = (id: number) => {
    setActiveOrganizationIdState(id);
    localStorage.setItem('pt_active_org_id', String(id));
    const orgBranch = branches.find(b => b.organizationId === id);
    if (orgBranch) {
      setActiveBranchId(orgBranch.id);
    }
  };

  const activeOrganization = organizations.find(o => o.id === activeOrganizationId) || organizations[0] || INITIAL_ORGANIZATIONS[0];

  const addOrganization = async (orgData: Omit<Organization, 'id'>): Promise<Organization> => {
    const nextId = organizations.length > 0 ? Math.max(...organizations.map(o => o.id)) + 1 : 1;
    const newOrg: Organization = {
      ...orgData,
      id: nextId,
      isActive: orgData.isActive ?? false,
      requiredPositions:
        orgData.requiredPositions && orgData.requiredPositions.length > 0
          ? orgData.requiredPositions
          : getDefaultPositionsForSector(orgData.sector),
    };
    const updated = [...organizations, newOrg];
    setOrganizations(updated);
    localStorage.setItem('pt_organizations', JSON.stringify(updated));
    firestoreSave('organizations', newOrg);
    await syncMutation('organizations', 'create', newOrg);
    return newOrg;
  };

  const updateOrganization = async (orgData: Organization) => {
    const updated = organizations.map(o => (o.id === orgData.id ? orgData : o));
    setOrganizations(updated);
    localStorage.setItem('pt_organizations', JSON.stringify(updated));
    firestoreSave('organizations', orgData);
    await syncMutation('organizations', 'update', orgData);
  };

  const deleteOrganization = async (id: number) => {
    if (organizations.length <= 1) return;
    const updated = organizations.filter(o => o.id !== id);
    setOrganizations(updated);
    localStorage.setItem('pt_organizations', JSON.stringify(updated));
    firestoreDelete('organizations', id);
    await syncMutation('organizations', 'delete', { id });
    if (activeOrganizationId === id && updated.length > 0) {
      setActiveOrganizationId(updated[0].id);
    }
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
        await syncMutation('periodicPlans', 'update', updated);
      }
    } else if (planType === 'annual') {
      const obj = annualPlan.find(p => p.id === planId);
      if (obj) {
        const updated = { ...obj, branchId: targetBranchId };
        await db.update('annualPlan', updated);
        firestoreSave('annualPlanObjectives', updated);
        await syncMutation('annualPlan', 'update', updated);
      }
    } else if (planType === 'backlog') {
      const item = backlogPlans.find(b => b.id === planId);
      if (item) {
        const updated = { ...item, branchId: targetBranchId };
        await db.update('backlogPlans', updated);
        firestoreSave('backlogPlans', updated);
        await syncMutation('backlogPlans', 'update', updated);
      }
    }
    await fetchData();
  };

  const addObjective = async (objective: Omit<AnnualPlanObjective, 'id'>) => {
    const id = await db.add('annualPlan', objective);
    const created = { ...objective, id: Number(id) };
    firestoreSave('annualPlanObjectives', created);
    await syncMutation('annualPlan', 'create', created);
    await fetchData();
  };

  const updateObjective = async (objective: AnnualPlanObjective) => {
    await db.update('annualPlan', objective);
    firestoreSave('annualPlanObjectives', objective);
    await syncMutation('annualPlan', 'update', objective);
    await fetchData();
  };

  const deleteObjective = async (id: number) => {
    await db.deleteById('annualPlan', id);
    firestoreDelete('annualPlanObjectives', id);
    await syncMutation('annualPlan', 'delete', { id });
    await fetchData();
  };

  const updatePeriodicPlan = async (plan: PeriodicPlanItem) => {
    await db.update('plans', plan);
    firestoreSave('periodicPlans', plan);
    await syncMutation('periodicPlans', 'update', plan);
    await fetchData();
  };

  const addPeriodicPlan = async (plan: Omit<PeriodicPlanItem, 'id'>) => {
    const id = await db.add('plans', plan);
    const created = { ...plan, id: Number(id) };
    firestoreSave('periodicPlans', created);
    await syncMutation('periodicPlans', 'create', created);
    await fetchData();
  };

  const deletePeriodicPlan = async (id: number) => {
    await db.deleteById('plans', id);
    firestoreDelete('periodicPlans', id);
    await syncMutation('periodicPlans', 'delete', { id });
    await fetchData();
  };

  const updateBacklogPlan = async (item: BacklogPlanItem) => {
    await db.update('backlogPlans', item);
    firestoreSave('backlogPlans', item);
    await syncMutation('backlogPlans', 'update', item);
    await fetchData();
  };

  const addBacklogPlan = async (item: Omit<BacklogPlanItem, 'id'>) => {
    const id = await db.add('backlogPlans', item);
    const created = { ...item, id: Number(id) };
    firestoreSave('backlogPlans', created);
    await syncMutation('backlogPlans', 'create', created);
    await fetchData();
  };

  const deleteBacklogPlan = async (id: number) => {
    await db.deleteById('backlogPlans', id);
    firestoreDelete('backlogPlans', id);
    await syncMutation('backlogPlans', 'delete', { id });
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
      await syncMutation('backlogPlans', 'update', updated);
      await fetchData();
    }
  };

  const unassignBacklogPlan = async (backlogId: number) => {
    await assignBacklogPlan(backlogId, undefined);
  };

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
        const updatedBacklog: BacklogPlanItem = {
          ...backlogItem,
          backlogActual: finalActual,
          status: newStatus,
        };
        await db.update('backlogPlans', updatedBacklog);
        firestoreSave('backlogPlans', updatedBacklog);
        await syncMutation('backlogPlans', 'update', updatedBacklog);
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
        await syncMutation('periodicPlans', 'update', updated);

        const matchingKpi = kpis.find(k => k.kpiCategory === plan.category);
        if (matchingKpi) {
          const updatedKpi = {
            ...matchingKpi,
            actual: updated.annualActual,
          };
          await db.update('kpis', updatedKpi);
          firestoreSave('kpis', updatedKpi);
          await syncMutation('kpis', 'update', updatedKpi);
        }
      }
    }

    await fetchData();
  };

  const assignEmployeePlan = async (assignment: Omit<EmployeePlanAssignment, 'id'>) => {
    const newId = await db.add('employeePlans', assignment);
    const assignedWithId = { ...assignment, id: Number(newId) };
    firestoreSave('employeePlans', assignedWithId);
    await syncMutation('employeePlans', 'create', assignedWithId);

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
      await syncMutation('kpis', 'update', updatedKpi);
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
      const createdKpi = { ...newKpi, id: Number(newKpiId) };
      firestoreSave('kpis', createdKpi);
      await syncMutation('kpis', 'create', createdKpi);
    }

    await fetchData();
  };

  const updateEmployeePlan = async (assignment: EmployeePlanAssignment) => {
    await db.update('employeePlans', assignment);
    firestoreSave('employeePlans', assignment);
    await syncMutation('employeePlans', 'update', assignment);

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
      await syncMutation('kpis', 'update', updatedKpi);
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
        await syncMutation('kpis', 'delete', { id: matchingKpi.id });
      }
    }
    await db.deleteById('employeePlans', id);
    firestoreDelete('employeePlans', id);
    await syncMutation('employeePlans', 'delete', { id });
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
    await syncMutation('employeePlans', 'update', updated);

    const matchingKpi = kpis.find(k => k.employeeId === updated.employeeId && k.kpiCategory === updated.category);
    if (matchingKpi) {
      const updatedKpi = {
        ...matchingKpi,
        actual: updated.annualActual,
      };
      await db.update('kpis', updatedKpi);
      firestoreSave('kpis', updatedKpi);
      await syncMutation('kpis', 'update', updatedKpi);
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
    await syncMutation('kpiCategories', 'create', newCat);
    await fetchData();
    return newCat;
  };

  const updateKpiCategory = async (cat: KpiCategoryItem) => {
    await db.update('kpiCategories', cat);
    firestoreSave('kpiCategories', cat);
    await syncMutation('kpiCategories', 'update', cat);
    await fetchData();
  };

  const deleteKpiCategory = async (id: string) => {
    await db.deleteById('kpiCategories', id);
    firestoreDelete('kpiCategories', id);
    await syncMutation('kpiCategories', 'delete', { id });
    await fetchData();
  };

  const createFullKpi = async (params: CreateFullKpiParams) => {
    let objectiveId = 0;
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
      const createdObj = { ...objData, id: objectiveId };
      firestoreSave('annualPlanObjectives', createdObj);
      await syncMutation('annualPlan', 'create', createdObj);
    }

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
      const createdPlan = { ...planData, id: Number(planId) };
      firestoreSave('periodicPlans', createdPlan);
      await syncMutation('periodicPlans', 'create', createdPlan);
    }

    if (params.assignToEmployeeId) {
      const empTarget = params.employeeTarget !== undefined ? params.employeeTarget : params.annualTarget;
      const empActual = params.employeeActual !== undefined ? params.employeeActual : (params.annualActual || 0);

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
      const createdKpi = { ...kpiData, id: Number(kpiId) };
      firestoreSave('kpis', createdKpi);
      await syncMutation('kpis', 'create', createdKpi);

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
      const createdEmpPlan = { ...empPlanData, id: Number(empPlanId) };
      firestoreSave('employeePlans', createdEmpPlan);
      await syncMutation('employeePlans', 'create', createdEmpPlan);
    }

    await fetchData();
  };

  // Enterprise Backend Governance Actions
  const createSnapshot = async (label: string): Promise<DatabaseSnapshot | null> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const res = await apiCreateSnapshot({
      label,
      organizationId: activeOrganizationId,
      actorId,
    });
    if (res.success && res.snapshot) {
      setSnapshots((prev) => [res.snapshot!, ...prev]);
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
      return res.snapshot;
    }
    return null;
  };

  const restoreSnapshot = async (snapshotId: string): Promise<boolean> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const res = await apiRestoreSnapshot(snapshotId, actorId);
    if (res.success && res.state) {
      await fetchData();
      const snaps = await apiFetchSnapshots();
      setSnapshots(snaps);
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
      return true;
    }
    return false;
  };

  const runKpiEngineAudit = async (
    syncBacklogs: boolean = true
  ): Promise<KpiEngineCalculationResult | null> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const result = await apiRunKpiCalculationEngine(
      activeOrganizationId,
      activeBranchId,
      actorId,
      syncBacklogs
    );
    if (result) {
      setLatestKpiEngineResult(result);
      const status = await apiFetchKpiEngineStatus(activeOrganizationId, activeBranchId);
      if (status?.schedule) {
        setKpiEngineSchedule(status.schedule);
      }
      await fetchData();
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
    }
    return result;
  };

  const updateKpiEngineSchedule = async (
    config: Partial<KpiEngineScheduleConfig>
  ): Promise<KpiEngineScheduleConfig | null> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const res = await apiUpdateKpiEngineSchedule({
      ...config,
      actorId,
    });
    if (res.success && res.schedule) {
      setKpiEngineSchedule(res.schedule);
      if (res.latestResult) {
        setLatestKpiEngineResult(res.latestResult);
      }
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
      return res.schedule;
    }
    return null;
  };

  const bulkImportData = async (
    entityType: 'employees' | 'kpis' | 'periodicPlans' | 'branches' | 'fullSnapshot',
    records: any
  ): Promise<number> => {
    const actorId = Number(sessionStorage.getItem('userId')) || 1;
    const res = await apiBulkImportRecords({
      entityType,
      records,
      organizationId: activeOrganizationId,
      actorId,
    });
    if (res.success) {
      await fetchData();
      const logs = await apiFetchAuditLogs();
      setAuditLogs(logs);
      return res.importedCount || 0;
    }
    return 0;
  };

  const provisionClientOrganization = async (params: {
    name: string;
    code: string;
    sector: string;
    headquarters?: string;
    primaryCurrency?: string;
    description?: string;
    planTier?: OrganizationServicePlanTier;
    quotas?: Partial<OrganizationQuotas>;
    capabilities?: Partial<OrganizationCapabilities>;
    initialBranchName?: string;
    initialBranchDistrict?: string;
    adminName?: string;
    adminUsername?: string;
    adminEmail?: string;
    adminPassword?: string;
    adminPin?: string;
  }): Promise<{ organization?: Organization; branch?: Branch; admin?: Employee }> => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await apiSystemProvisionOrganization(params);
        if (res.success && res.organization) {
          await db.update('organizations', res.organization).catch(() => {});
          firestoreSave('organizations', res.organization);
          setOrganizations((prev) => dedupeById([...prev, res.organization!]));

          if (res.branch) {
            await db.update('branches', res.branch).catch(() => {});
            firestoreSave('branches', res.branch);
            setBranches((prev) => dedupeById([...prev, res.branch!]));
          }
          if (res.admin) {
            await db.update('employees', res.admin).catch(() => {});
            firestoreSave('employees', res.admin);
            setEmployees((prev) => dedupeById([...prev, res.admin!]));
          }
          const logs = await apiFetchAuditLogs();
          setAuditLogs(logs);
          return {
            organization: res.organization,
            branch: res.branch,
            admin: res.admin,
          };
        }
      } catch {
        // Fallback to local creation below
      }
    }

    const createdOrg = await addOrganization({
      name: params.name.trim(),
      code: params.code.trim().toUpperCase(),
      sector: params.sector,
      headquarters: params.headquarters || 'Main Corporate Headquarters',
      establishedDate: new Date().toISOString().slice(0, 10),
      primaryCurrency: params.primaryCurrency || 'ETB',
      description: params.description || `Managed ${params.sector} workspace.`,
      isActive: false,
      serviceStatus: 'Active',
      planTier: params.planTier || 'Enterprise',
      capabilities: {
        ...DEFAULT_ORGANIZATION_CAPABILITIES,
        ...(params.capabilities || {}),
      },
      quotas: {
        ...DEFAULT_ORGANIZATION_QUOTAS,
        ...(params.quotas || {}),
      },
      primaryAdminEmail: params.adminEmail || `admin@${params.code.toLowerCase()}.com`,
      requiredPositions: getDefaultPositionsForSector(params.sector),
    });

    const createdBranch = await addBranch({
      name: params.initialBranchName || `${createdOrg.name} — Main HQ Branch`,
      code: `${createdOrg.code}-01`,
      district: params.initialBranchDistrict || createdOrg.headquarters || 'Central Zone',
      fiscalYear: '2025/2026',
      openingDate: new Date().toISOString().slice(0, 10),
      juneClosingDepositBalance: 50000000,
      isActive: true,
      organizationId: createdOrg.id,
      sector: createdOrg.sector,
    });

    return { organization: createdOrg, branch: createdBranch };
  };

  const updateOrganizationServiceConfig = async (params: {
    organizationId: number;
    serviceStatus?: OrganizationServiceStatus;
    planTier?: OrganizationServicePlanTier;
    capabilities?: Partial<OrganizationCapabilities>;
    quotas?: Partial<OrganizationQuotas>;
    ownerNotes?: string;
    assignAdmin?: {
      name: string;
      username: string;
      email: string;
      password: string;
      pin: string;
      role?: Role;
    };
  }): Promise<{ organization?: Organization; admin?: Employee }> => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await apiUpdateOrganizationServiceConfig(params);
        if (res.success && res.organization) {
          await db.update('organizations', res.organization).catch(() => {});
          firestoreSave('organizations', res.organization);
          setOrganizations((prev) =>
            dedupeById(prev.map((o) => (o.id === res.organization!.id ? res.organization! : o)))
          );
          if (res.admin) {
            await db.update('employees', res.admin).catch(() => {});
            firestoreSave('employees', res.admin);
            setEmployees((prev) => {
              const exists = prev.some((e) => e.id === res.admin!.id);
              return dedupeById(
                exists
                  ? prev.map((e) => (e.id === res.admin!.id ? res.admin! : e))
                  : [...prev, res.admin!]
              );
            });
          }
          const logs = await apiFetchAuditLogs();
          setAuditLogs(logs);
          return { organization: res.organization, admin: res.admin };
        }
      } catch {
        // Fallback to local update below
      }
    }

    const existing = organizations.find((o) => o.id === params.organizationId);
    if (!existing) return {};
    const updatedOrg: Organization = {
      ...existing,
      serviceStatus: params.serviceStatus || existing.serviceStatus || 'Active',
      planTier: params.planTier || existing.planTier || 'Enterprise',
      capabilities: {
        ...DEFAULT_ORGANIZATION_CAPABILITIES,
        ...(existing.capabilities || {}),
        ...(params.capabilities || {}),
      },
      quotas: {
        ...DEFAULT_ORGANIZATION_QUOTAS,
        ...(existing.quotas || {}),
        ...(params.quotas || {}),
      },
      ownerNotes: params.ownerNotes !== undefined ? params.ownerNotes : existing.ownerNotes,
    };
    await updateOrganization(updatedOrg);
    return { organization: updatedOrg };
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

  const value: DataContextType = {
    organizations,
    activeOrganizationId,
    activeOrganization,
    setActiveOrganizationId,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    provisionClientOrganization,
    updateOrganizationServiceConfig,
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
    wsConnected,
    offlineQueue,
    flushOfflineQueue,
    auditLogs,
    refreshAuditLogs,
    snapshots,
    createSnapshot,
    restoreSnapshot,
    latestKpiEngineResult,
    kpiEngineSchedule,
    runKpiEngineAudit,
    updateKpiEngineSchedule,
    bulkImportData,
    connectedPeers,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
