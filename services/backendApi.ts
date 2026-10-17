import {
  AuditLogEntry,
  Branch,
  DatabaseSnapshot,
  Employee,
  KpiEngineCalculationResult,
  KpiEngineScheduleConfig,
  Organization,
  OrganizationCapabilities,
  OrganizationQuotas,
  OrganizationServicePlanTier,
  OrganizationServiceStatus,
  Role,
  SyncQueueItem,
  SystemProviderConfig,
} from '../types';

const OFFLINE_QUEUE_KEY = 'pt_offline_sync_queue';
const AUTH_TOKEN_KEY = 'pt_auth_bearer_token';

export const getStoredAuthToken = (): string | null => {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredAuthToken = (token: string | null) => {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const getAuthHeaders = (actorId?: number): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getStoredAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (actorId) {
    headers['X-Actor-Id'] = String(actorId);
  }
  return headers;
};

// ============================================================================
// OFFLINE MUTATION QUEUE MANAGEMENT
// ============================================================================
export const getOfflineMutationQueue = (): SyncQueueItem[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const enqueueOfflineMutation = (
  collection: string,
  operation: 'create' | 'update' | 'delete',
  payload: any,
  organizationId: number = 1
): SyncQueueItem[] => {
  const queue = getOfflineMutationQueue();
  const item: SyncQueueItem = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    collection,
    operation,
    payload,
    organizationId,
    retryCount: 0,
  };
  const updated = [...queue, item];
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
};

export const clearOfflineMutationQueue = () => {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // ignore
  }
};

export const flushOfflineMutationQueueToServer = async (
  actorId?: number
): Promise<{ flushedCount: number; remainingCount: number }> => {
  const queue = getOfflineMutationQueue();
  if (queue.length === 0) return { flushedCount: 0, remainingCount: 0 };

  try {
    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: getAuthHeaders(actorId),
      body: JSON.stringify({ items: queue }),
    });
    if (res.ok) {
      clearOfflineMutationQueue();
      return { flushedCount: queue.length, remainingCount: 0 };
    }
  } catch {
    // Remain in queue while offline
  }
  return { flushedCount: 0, remainingCount: queue.length };
};

export const pushMutationToServerOrQueue = async (
  collection: string,
  operation: 'create' | 'update' | 'delete',
  payload: any,
  organizationId: number = 1,
  actorId?: number
): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineMutation(collection, operation, payload, organizationId);
    return false;
  }

  try {
    const res = await fetch('/api/sync/mutate', {
      method: 'POST',
      headers: getAuthHeaders(actorId),
      body: JSON.stringify({ collection, operation, payload }),
    });
    if (!res.ok) {
      enqueueOfflineMutation(collection, operation, payload, organizationId);
      return false;
    }
    return true;
  } catch {
    enqueueOfflineMutation(collection, operation, payload, organizationId);
    return false;
  }
};

// ============================================================================
// AUTHENTICATION & SECURITY API CALLS
// ============================================================================
export const apiLogin = async (params: {
  identifier?: string;
  secret: string;
  mode: 'credentials' | 'pin';
}): Promise<{
  ok: boolean;
  status: number;
  user?: Employee;
  token?: string;
  error?: string;
  lockedUntil?: string;
  failedLoginAttempts?: number;
}> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return {
    ok: res.ok,
    status: res.status,
    ...data,
  };
};

export const apiUnlockAccount = async (
  targetEmployeeId: number,
  actorId?: number
): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
  const res = await fetch('/api/auth/unlock', {
    method: 'POST',
    headers: getAuthHeaders(actorId),
    body: JSON.stringify({ targetEmployeeId }),
  });
  return res.json();
};

export const apiAdminResetPassword = async (params: {
  targetEmployeeId: number;
  newPassword: string;
  newPin?: string;
  mustChange?: boolean;
  actorId?: number;
}): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
  const res = await fetch('/api/auth/admin-reset', {
    method: 'POST',
    headers: getAuthHeaders(params.actorId),
    body: JSON.stringify(params),
  });
  return res.json();
};

export const apiChangeOwnPassword = async (params: {
  employeeId: number;
  currentSecret: string;
  newPassword: string;
  newEmail?: string;
  newUsername?: string;
}): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(params.employeeId),
    body: JSON.stringify(params),
  });
  return res.json();
};

export const apiRequestEmailRecovery = async (
  email: string
): Promise<{
  success: boolean;
  verificationCode?: string;
  employeeName?: string;
  username?: string;
  message: string;
}> => {
  const res = await fetch('/api/auth/recovery/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
};

export const apiCompleteEmailRecovery = async (params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{
  success: boolean;
  user?: Employee;
  token?: string;
  message: string;
}> => {
  const res = await fetch('/api/auth/recovery/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
};

// ============================================================================
// AUDIT LOGS, KPI ENGINE, SNAPSHOTS & BULK IMPORT API CALLS
// ============================================================================
export const apiFetchAuditLogs = async (
  organizationId?: number | 'ALL',
  actionType?: string
): Promise<AuditLogEntry[]> => {
  const query = new URLSearchParams();
  if (organizationId) query.set('organizationId', String(organizationId));
  if (actionType) query.set('actionType', actionType);
  const res = await fetch(`/api/audit-logs?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
};

export const apiRunKpiCalculationEngine = async (
  organizationId: number,
  branchId: number,
  actorId?: number,
  syncBacklogs: boolean = true
): Promise<KpiEngineCalculationResult | null> => {
  const res = await fetch('/api/kpi-engine/recalculate', {
    method: 'POST',
    headers: getAuthHeaders(actorId),
    body: JSON.stringify({ organizationId, branchId, syncBacklogs }),
  });
  if (!res.ok) return null;
  return res.json();
};

export const apiFetchKpiEngineStatus = async (
  organizationId: number,
  branchId: number
): Promise<{
  schedule: KpiEngineScheduleConfig;
  latestResult: KpiEngineCalculationResult | null;
  recentHistory: KpiEngineCalculationResult[];
} | null> => {
  const query = new URLSearchParams({
    organizationId: String(organizationId),
    branchId: String(branchId),
  });
  const res = await fetch(`/api/kpi-engine/status?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
};

export const apiUpdateKpiEngineSchedule = async (params: {
  enabled?: boolean;
  intervalSeconds?: number;
  autoSyncBacklogs?: boolean;
  runOnMutation?: boolean;
  actorId?: number;
}): Promise<{
  success: boolean;
  schedule?: KpiEngineScheduleConfig;
  latestResult?: KpiEngineCalculationResult | null;
}> => {
  const res = await fetch('/api/kpi-engine/schedule', {
    method: 'POST',
    headers: getAuthHeaders(params.actorId),
    body: JSON.stringify(params),
  });
  if (!res.ok) return { success: false };
  return res.json();
};

export const apiFetchSnapshots = async (): Promise<DatabaseSnapshot[]> => {
  const res = await fetch('/api/snapshots', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.snapshots || [];
};

export const apiCreateSnapshot = async (params: {
  label: string;
  organizationId: number;
  actorId?: number;
}): Promise<{ success: boolean; snapshot?: DatabaseSnapshot }> => {
  const res = await fetch('/api/snapshots', {
    method: 'POST',
    headers: getAuthHeaders(params.actorId),
    body: JSON.stringify(params),
  });
  return res.json();
};

export const apiRestoreSnapshot = async (
  snapshotId: string,
  actorId?: number
): Promise<{ success: boolean; state?: any; error?: string }> => {
  const res = await fetch(`/api/snapshots/${snapshotId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(actorId),
  });
  return res.json();
};

export const apiBulkImportRecords = async (params: {
  entityType: 'employees' | 'kpis' | 'periodicPlans' | 'branches' | 'fullSnapshot';
  records: any;
  organizationId: number;
  actorId?: number;
}): Promise<{ success: boolean; importedCount?: number; state?: any; error?: string }> => {
  const res = await fetch('/api/import-export/bulk', {
    method: 'POST',
    headers: getAuthHeaders(params.actorId),
    body: JSON.stringify(params),
  });
  return res.json();
};

// ============================================================================
// SYSTEM PROVIDER / OWNER CONTROL PLANE API CALLS
// ============================================================================
export const apiSystemProviderLogin = async (
  passkeyOrPin: string
): Promise<{
  success: boolean;
  config?: SystemProviderConfig;
  error?: string;
}> => {
  const res = await fetch('/api/system-provider/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passkeyOrPin }),
  });
  return res.json();
};

export const apiUpdateSystemProviderCredentials = async (params: {
  currentSecret?: string;
  newMasterPasskey?: string;
  newMasterPin?: string;
  serviceTitle?: string;
  ownerName?: string;
  ownerEmail?: string;
}): Promise<{
  success: boolean;
  config?: SystemProviderConfig;
  error?: string;
}> => {
  const res = await fetch('/api/system-provider/credentials', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  return res.json();
};

export const apiSystemProvisionOrganization = async (params: {
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
}): Promise<{
  success: boolean;
  organization?: Organization;
  branch?: Branch;
  admin?: Employee;
  error?: string;
}> => {
  const res = await fetch('/api/system-provider/provision-org', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  return res.json();
};

export const apiUpdateOrganizationServiceConfig = async (params: {
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
}): Promise<{
  success: boolean;
  organization?: Organization;
  admin?: Employee;
  error?: string;
}> => {
  const res = await fetch('/api/system-provider/org-service-config', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  return res.json();
};

// ============================================================================
// REAL-TIME WEBSOCKET CLIENT MANAGER
// ============================================================================
export interface WsClientCallbacks {
  onEntityMutated?: (data: {
    collection: string;
    operation: 'create' | 'update' | 'delete';
    item: any;
  }) => void;
  onAuditCreated?: (entry: AuditLogEntry) => void;
  onSnapshotRestored?: (data: { snapshotId: string; label: string; state: any }) => void;
  onKpiEngineUpdated?: (data: {
    result: KpiEngineCalculationResult;
    schedule: KpiEngineScheduleConfig;
    state?: any;
  }) => void;
  onPresenceUpdate?: (peers: any[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const connectRealtimeBackendSocket = (
  identity: {
    clientId: string;
    userName: string;
    userRole: string;
    organizationId: number;
    branchId: number;
  },
  callbacks: WsClientCallbacks
) => {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedIntentionally = false;

  const connect = () => {
    if (closedIntentionally) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        callbacks.onConnectionChange?.(true);
        ws?.send(
          JSON.stringify({
            type: 'peer:identify',
            payload: identity,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'entity:mutated') {
            callbacks.onEntityMutated?.(msg.payload);
          } else if (msg.type === 'audit:created') {
            callbacks.onAuditCreated?.(msg.payload);
          } else if (msg.type === 'snapshot:restored') {
            callbacks.onSnapshotRestored?.(msg.payload);
          } else if (msg.type === 'kpi_engine:updated') {
            callbacks.onKpiEngineUpdated?.(msg.payload);
          } else if (msg.type === 'presence:update') {
            callbacks.onPresenceUpdate?.(msg.payload?.peers || []);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        callbacks.onConnectionChange?.(false);
        if (!closedIntentionally) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      };

      ws.onerror = () => {
        callbacks.onConnectionChange?.(false);
      };
    } catch {
      callbacks.onConnectionChange?.(false);
    }
  };

  connect();

  return {
    updateIdentity: (newIdentity: typeof identity) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'peer:identify',
            payload: newIdentity,
          })
        );
      }
    },
    disconnect: () => {
      closedIntentionally = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
};
