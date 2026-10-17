import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_ORGANIZATIONS,
  INITIAL_KPI_CATEGORIES,
  BRANCHES,
  EMPLOYEES,
  ANNUAL_PLAN_2026,
  KPIS,
  PERIODIC_PLANS_2026,
  INITIAL_BACKLOG_PLANS,
  INITIAL_EMPLOYEE_ASSIGNMENTS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  DEFAULT_ORGANIZATION_QUOTAS,
  DEFAULT_SYSTEM_PROVIDER_CONFIG,
  getDefaultPositionsForSector,
} from './constants';
import {
  Employee,
  Organization,
  OrganizationCapabilities,
  OrganizationQuotas,
  OrganizationServiceStatus,
  OrganizationServicePlanTier,
  SystemProviderConfig,
  Branch,
  AnnualPlanObjective,
  Kpi,
  PeriodicPlanItem,
  BacklogPlanItem,
  EmployeePlanAssignment,
  KpiCategoryItem,
  AuditLogEntry,
  AuditActionType,
  DatabaseSnapshot,
  KpiEngineCalculationResult,
  KpiEngineScheduleConfig,
  KpiEngineShortfallAlert,
  PerspectiveCategory,
  Role,
  isAdminRole,
  getRoleHierarchyLevel,
} from './types';

const PORT = 3000;
const DATA_FILE = path.resolve(process.cwd(), 'server-data.json');
const TOKEN_SECRET = process.env.SESSION_SECRET || 'pt-enterprise-bsc-hmac-secret-key-2026';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Cryptographic Password Hashing (Salted scrypt)
function hashPassword(plain: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordHash(plain: string, storedHash?: string, legacyPlain?: string): boolean {
  if (storedHash && storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const expected = hashPassword(plain, salt);
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(storedHash));
    }
  }
  if (legacyPlain) {
    return plain === legacyPlain;
  }
  return false;
}

// Signed Session Token Utilities
interface SessionTokenPayload {
  employeeId: number;
  username: string;
  name: string;
  role: Role | string;
  organizationId: number;
  branchId: number;
  iat: number;
  exp: number;
}

function createSignedToken(emp: Employee): string {
  const payload: SessionTokenPayload = {
    employeeId: emp.id,
    username: emp.username || `user${emp.id}`,
    name: emp.name,
    role: emp.role,
    organizationId: emp.organizationId || 1,
    branchId: emp.branchId || 1,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24h
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${sig}`;
}

function verifySignedToken(token: string): SessionTokenPayload | null {
  try {
    const [base64Payload, sig] = token.split('.');
    if (!base64Payload || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(base64Payload)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const payload: SessionTokenPayload = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf8')
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

interface ServerStore {
  organizations: Organization[];
  branches: Branch[];
  employees: Employee[];
  annualPlan: AnnualPlanObjective[];
  kpis: Kpi[];
  periodicPlans: PeriodicPlanItem[];
  backlogPlans: BacklogPlanItem[];
  employeePlans: EmployeePlanAssignment[];
  kpiCategories: KpiCategoryItem[];
  auditLogs: AuditLogEntry[];
  snapshots: DatabaseSnapshot[];
  recoveryCodes: Record<
    string,
    { code: string; employeeId: number; email: string; expiresAt: number }
  >;
  kpiEngineSchedule: KpiEngineScheduleConfig;
  lastKpiEngineResult?: KpiEngineCalculationResult;
  systemProviderConfig: SystemProviderConfig;
}

const DEFAULT_KPI_ENGINE_SCHEDULE: KpiEngineScheduleConfig = {
  enabled: true,
  intervalSeconds: 60,
  autoSyncBacklogs: true,
  runOnMutation: true,
  totalRunsCount: 0,
};

function createInitialStore(): ServerStore {
  const seededEmployees: Employee[] = EMPLOYEES.map((emp) => ({
    ...emp,
    passwordHash: hashPassword(emp.password || 'Password@123'),
    failedLoginAttempts: 0,
    lockedUntil: null,
  }));

  const initialAudit: AuditLogEntry = {
    id: `audit-${Date.now()}-init`,
    timestamp: new Date().toISOString(),
    organizationId: 1,
    branchId: 1,
    actorId: 1,
    actorName: 'System Sovereign',
    actorRole: Role.SUPER_ADMIN,
    actionType: 'SNAPSHOT_CREATE',
    targetEntity: 'System',
    targetId: 'INIT',
    summary:
      'Initialized enterprise backend store with salted scrypt password hashes and multi-organization partitions.',
  };

  const baseStore: ServerStore = {
    organizations: [...INITIAL_ORGANIZATIONS],
    branches: [...BRANCHES],
    employees: seededEmployees,
    annualPlan: [...ANNUAL_PLAN_2026],
    kpis: [...KPIS],
    periodicPlans: [...PERIODIC_PLANS_2026],
    backlogPlans: [...INITIAL_BACKLOG_PLANS],
    employeePlans: [...INITIAL_EMPLOYEE_ASSIGNMENTS],
    kpiCategories: [...INITIAL_KPI_CATEGORIES],
    auditLogs: [initialAudit],
    snapshots: [],
    recoveryCodes: {},
    kpiEngineSchedule: { ...DEFAULT_KPI_ENGINE_SCHEDULE },
    systemProviderConfig: { ...DEFAULT_SYSTEM_PROVIDER_CONFIG },
  };

  // Create initial baseline snapshot
  const baselineSnapshot: DatabaseSnapshot = {
    id: `snap-init-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: 'Automated Startup Engine',
    organizationId: 1,
    label: 'Initial System Baseline Snapshot',
    triggerType: 'Scheduled',
    recordCounts: {
      organizations: baseStore.organizations.length,
      branches: baseStore.branches.length,
      employees: baseStore.employees.length,
      kpis: baseStore.kpis.length,
      plans: baseStore.periodicPlans.length,
      backlogs: baseStore.backlogPlans.length,
    },
    data: {
      organizations: JSON.parse(JSON.stringify(baseStore.organizations)),
      branches: JSON.parse(JSON.stringify(baseStore.branches)),
      employees: JSON.parse(JSON.stringify(baseStore.employees)),
      annualPlan: JSON.parse(JSON.stringify(baseStore.annualPlan)),
      kpis: JSON.parse(JSON.stringify(baseStore.kpis)),
      periodicPlans: JSON.parse(JSON.stringify(baseStore.periodicPlans)),
      backlogPlans: JSON.parse(JSON.stringify(baseStore.backlogPlans)),
      employeePlans: JSON.parse(JSON.stringify(baseStore.employeePlans)),
    },
  };

  baseStore.snapshots.push(baselineSnapshot);
  return baseStore;
}

let store: ServerStore = loadStore();

function dedupeServerList<T extends { id: string | number }>(items: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id !== undefined && item.id !== null) {
      map.set(String(item.id), item);
    }
  }
  return Array.from(map.values());
}

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as ServerStore;
      if (parsed && Array.isArray(parsed.employees) && parsed.employees.length > 0) {
        const seenEmails = new Set<string>();
        const uniqueEmployees: Employee[] = [];
        for (const e of dedupeServerList(parsed.employees)) {
          const emailKey = e.email?.trim().toLowerCase();
          if (emailKey && seenEmails.has(emailKey)) continue;
          if (emailKey) seenEmails.add(emailKey);
          uniqueEmployees.push({
            ...e,
            passwordHash: e.passwordHash || hashPassword(e.password || 'Password@123'),
            failedLoginAttempts: e.failedLoginAttempts ?? 0,
            lockedUntil: e.lockedUntil ?? null,
          });
        }
        parsed.employees = uniqueEmployees;
        parsed.organizations = dedupeServerList(parsed.organizations).map((org) => {
          const cleanLogo =
            org.logoUrl && org.logoUrl.includes('images.unsplash.com')
              ? undefined
              : org.logoUrl;
          return {
            ...org,
            logoUrl: cleanLogo,
            serviceStatus: org.serviceStatus || 'Active',
            planTier: org.planTier || 'Enterprise',
            capabilities: {
              ...DEFAULT_ORGANIZATION_CAPABILITIES,
              ...(org.capabilities || {}),
            },
            quotas: {
              ...DEFAULT_ORGANIZATION_QUOTAS,
              ...(org.quotas || {}),
            },
          };
        });
        parsed.branches = dedupeServerList(parsed.branches);
        parsed.annualPlan = dedupeServerList(parsed.annualPlan);
        parsed.kpis = dedupeServerList(parsed.kpis);
        parsed.periodicPlans = dedupeServerList(parsed.periodicPlans);
        parsed.backlogPlans = dedupeServerList(parsed.backlogPlans);
        parsed.employeePlans = dedupeServerList(parsed.employeePlans);
        parsed.kpiCategories = dedupeServerList(parsed.kpiCategories);
        parsed.auditLogs = dedupeServerList(parsed.auditLogs || []);
        parsed.snapshots = dedupeServerList(parsed.snapshots || []);
        parsed.recoveryCodes = parsed.recoveryCodes || {};
        parsed.kpiEngineSchedule = {
          ...DEFAULT_KPI_ENGINE_SCHEDULE,
          ...(parsed.kpiEngineSchedule || {}),
        };
        parsed.systemProviderConfig = {
          ...DEFAULT_SYSTEM_PROVIDER_CONFIG,
          ...(parsed.systemProviderConfig || {}),
        };
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load server-data.json, initializing fresh store:', err);
  }
  const fresh = createInitialStore();
  persistStore(fresh);
  return fresh;
}

function persistStore(currentStore: ServerStore = store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(currentStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to persist server store:', err);
  }
}

function appendAuditLog(params: {
  organizationId?: number;
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
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    organizationId: params.organizationId || 1,
    branchId: params.branchId || 1,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    actionType: params.actionType,
    targetEntity: params.targetEntity,
    targetId: params.targetId,
    summary: params.summary,
    previousValue: params.previousValue,
    newValue: params.newValue,
  };
  store.auditLogs.unshift(entry);
  if (store.auditLogs.length > 500) {
    store.auditLogs = store.auditLogs.slice(0, 500);
  }
  persistStore();
  return entry;
}

// Connected WebSocket clients
interface ConnectedPeer {
  ws: WebSocket;
  clientId: string;
  userName: string;
  userRole: string;
  organizationId: number;
  branchId: number;
  connectedAt: string;
}

const connectedPeers = new Map<WebSocket, ConnectedPeer>();

function broadcastWsEvent(type: string, payload: any, excludeWs?: WebSocket) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
  for (const [clientWs] of connectedPeers.entries()) {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }
}

function broadcastPresence() {
  const peers = Array.from(connectedPeers.values()).map((p) => ({
    clientId: p.clientId,
    userName: p.userName,
    userRole: p.userRole,
    organizationId: p.organizationId,
    branchId: p.branchId,
    connectedAt: p.connectedAt,
  }));
  broadcastWsEvent('presence:update', { peers });
}

// RBAC Middleware Helpers
function extractActorFromReq(req: Request): SessionTokenPayload {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const verified = verifySignedToken(token);
    if (verified) return verified;
  }
  // Fallback header or default admin actor for local/offline bridge requests
  const fallbackId = Number(req.headers['x-actor-id']) || 1;
  const matchedEmp = store.employees.find((e) => e.id === fallbackId) || store.employees[0];
  return {
    employeeId: matchedEmp?.id || 1,
    username: matchedEmp?.username || 'superadmin',
    name: matchedEmp?.name || 'Admin User',
    role: matchedEmp?.role || Role.SUPER_ADMIN,
    organizationId: matchedEmp?.organizationId || 1,
    branchId: matchedEmp?.branchId || 1,
    iat: Date.now(),
    exp: Date.now() + 3600000,
  };
}

function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const actor = extractActorFromReq(req);
  if (!isAdminRole(actor.role)) {
    res.status(403).json({
      error: 'Forbidden: Requires Super Admin or Admin (HQ) system hierarchy role.',
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // =========================================================================
  // 1. HEALTH & SYSTEM TELEMETRY ENDPOINT
  // =========================================================================
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      connectedClients: connectedPeers.size,
      counts: {
        organizations: store.organizations.length,
        branches: store.branches.length,
        employees: store.employees.length,
        auditLogs: store.auditLogs.length,
        snapshots: store.snapshots.length,
      },
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION, HASHING, LOCKOUT & RECOVERY ENDPOINTS
  // =========================================================================
  app.post('/api/auth/login', (req, res) => {
    const { identifier, secret, mode } = req.body as {
      identifier?: string;
      secret?: string;
      mode?: 'credentials' | 'pin';
    };

    const cleanSecret = (secret || '').trim();
    if (!cleanSecret) {
      res.status(400).json({ error: 'Password or PIN is required.' });
      return;
    }

    let matched: Employee | undefined;
    if (mode === 'pin' && !identifier) {
      matched = store.employees.find(
        (u) =>
          u.pin.trim() === cleanSecret ||
          verifyPasswordHash(cleanSecret, u.passwordHash, u.password)
      );
    } else {
      const cleanId = (identifier || '').trim().toLowerCase();
      matched = store.employees.find((u) => {
        const uname = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const code = (u.employeeCode || '').toLowerCase();
        const name = u.name.toLowerCase();
        return uname === cleanId || email === cleanId || code === cleanId || name === cleanId;
      });
    }

    if (!matched) {
      res.status(401).json({
        error: 'No employee account found matching those credentials.',
      });
      return;
    }

    const matchedOrg = store.organizations.find(
      (o) => o.id === (matched?.organizationId || 1)
    );
    if (matchedOrg && matchedOrg.serviceStatus === 'Suspended') {
      res.status(403).json({
        error: `Organization "${matchedOrg.name}" is currently suspended by the Platform Service Provider. Please contact the system owner.`,
      });
      return;
    }

    // Check Account Lockout
    if (matched.lockedUntil) {
      const lockTime = new Date(matched.lockedUntil).getTime();
      if (Date.now() < lockTime) {
        const remainingMin = Math.ceil((lockTime - Date.now()) / 60000);
        res.status(423).json({
          error: `Account is temporarily locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Try again in ${remainingMin} min or contact Super Admin / Admin to unlock.`,
          lockedUntil: matched.lockedUntil,
          failedLoginAttempts: matched.failedLoginAttempts || MAX_FAILED_ATTEMPTS,
        });
        return;
      } else {
        // Lockout expired automatically
        matched.lockedUntil = null;
        matched.failedLoginAttempts = 0;
      }
    }

    const isPinMatch = matched.pin.trim() === cleanSecret;
    const isPwdMatch = verifyPasswordHash(cleanSecret, matched.passwordHash, matched.password);

    if (!isPinMatch && !isPwdMatch) {
      const attempts = (matched.failedLoginAttempts || 0) + 1;
      matched.failedLoginAttempts = attempts;

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        matched.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        const audit = appendAuditLog({
          organizationId: matched.organizationId || 1,
          branchId: matched.branchId,
          actorId: matched.id,
          actorName: matched.name,
          actorRole: matched.role,
          actionType: 'AUTH_LOCKOUT',
          targetEntity: 'Employee',
          targetId: matched.id,
          summary: `Account @${matched.username} locked for 15 minutes after ${attempts} consecutive failed login attempts.`,
        });
        broadcastWsEvent('audit:created', audit);
        broadcastWsEvent('entity:mutated', {
          collection: 'employees',
          operation: 'update',
          item: matched,
        });
        persistStore();

        res.status(423).json({
          error: `Account locked for 15 minutes after ${MAX_FAILED_ATTEMPTS} failed login attempts. Contact an Administrator to unlock.`,
          lockedUntil: matched.lockedUntil,
          failedLoginAttempts: attempts,
        });
        return;
      }

      persistStore();
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      res.status(401).json({
        error: `Invalid password or PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary account lockout.`,
        failedLoginAttempts: attempts,
      });
      return;
    }

    // Successful authentication: reset failed attempts & upgrade hash if needed
    matched.failedLoginAttempts = 0;
    matched.lockedUntil = null;
    matched.lastLoginAt = new Date().toISOString();
    if (!matched.passwordHash) {
      matched.passwordHash = hashPassword(matched.password || 'Password@123');
    }
    persistStore();

    const token = createSignedToken(matched);
    const audit = appendAuditLog({
      organizationId: matched.organizationId || 1,
      branchId: matched.branchId,
      actorId: matched.id,
      actorName: matched.name,
      actorRole: matched.role,
      actionType: 'AUTH_LOGIN',
      targetEntity: 'Employee',
      targetId: matched.id,
      summary: `${matched.name} (@${matched.username}) signed in with ${matched.role} privileges.`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      user: matched,
      token,
    });
  });

  // Unlock a rate-limited / locked employee account (Super Admin / Admin)
  app.post('/api/auth/unlock', requireAdminMiddleware, (req, res) => {
    const actor = extractActorFromReq(req);
    const { targetEmployeeId } = req.body as { targetEmployeeId: number };
    const target = store.employees.find((e) => e.id === Number(targetEmployeeId));
    if (!target) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    target.failedLoginAttempts = 0;
    target.lockedUntil = null;
    persistStore();

    const audit = appendAuditLog({
      organizationId: target.organizationId || actor.organizationId,
      branchId: target.branchId,
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType: 'ACCOUNT_UNLOCK',
      targetEntity: 'Employee',
      targetId: target.id,
      summary: `Administrator ${actor.name} unlocked account for ${target.name} (@${target.username}) and cleared failed login counter.`,
    });

    broadcastWsEvent('audit:created', audit);
    broadcastWsEvent('entity:mutated', {
      collection: 'employees',
      operation: 'update',
      item: target,
    });

    res.json({ success: true, employee: target });
  });

  // Admin Reset Password
  app.post('/api/auth/admin-reset', requireAdminMiddleware, (req, res) => {
    const actor = extractActorFromReq(req);
    const { targetEmployeeId, newPassword, newPin, mustChange } = req.body as {
      targetEmployeeId: number;
      newPassword: string;
      newPin?: string;
      mustChange?: boolean;
    };

    const target = store.employees.find((e) => e.id === Number(targetEmployeeId));
    if (!target) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const cleanPwd = (newPassword || 'Reset@2026').trim();
    target.password = cleanPwd;
    target.passwordHash = hashPassword(cleanPwd);
    if (newPin && newPin.trim()) {
      target.pin = newPin.trim();
    }
    target.mustChangePassword = mustChange ?? true;
    target.passwordResetRequested = false;
    target.failedLoginAttempts = 0;
    target.lockedUntil = null;
    target.lastPasswordResetAt = new Date().toISOString();
    target.lastPasswordResetBy = actor.name;
    persistStore();

    const audit = appendAuditLog({
      organizationId: target.organizationId || actor.organizationId,
      branchId: target.branchId,
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType: 'PASSWORD_RESET',
      targetEntity: 'Employee',
      targetId: target.id,
      summary: `Administrator ${actor.name} reset password for ${target.name} (@${target.username}).`,
    });

    broadcastWsEvent('audit:created', audit);
    broadcastWsEvent('entity:mutated', {
      collection: 'employees',
      operation: 'update',
      item: target,
    });

    res.json({ success: true, employee: target });
  });

  // Self-Service Password & Recovery Email Change
  app.post('/api/auth/change-password', (req, res) => {
    const { employeeId, currentSecret, newPassword, newEmail, newUsername } = req.body as {
      employeeId: number;
      currentSecret: string;
      newPassword: string;
      newEmail?: string;
      newUsername?: string;
    };

    const target = store.employees.find((e) => e.id === Number(employeeId));
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const isCurrentValid =
      target.pin.trim() === currentSecret.trim() ||
      verifyPasswordHash(currentSecret.trim(), target.passwordHash, target.password);

    if (!isCurrentValid) {
      res.status(401).json({ error: 'Current password or PIN does not match our records.' });
      return;
    }

    const cleanNew = newPassword.trim();
    target.password = cleanNew;
    target.passwordHash = hashPassword(cleanNew);
    if (newEmail && newEmail.trim()) target.email = newEmail.trim();
    if (newUsername && newUsername.trim()) target.username = newUsername.trim().toLowerCase();
    target.mustChangePassword = false;
    target.passwordResetRequested = false;
    target.failedLoginAttempts = 0;
    target.lockedUntil = null;
    target.lastPasswordResetAt = new Date().toISOString();
    target.lastPasswordResetBy = 'Self (User)';
    persistStore();

    const audit = appendAuditLog({
      organizationId: target.organizationId || 1,
      branchId: target.branchId,
      actorId: target.id,
      actorName: target.name,
      actorRole: target.role,
      actionType: 'PASSWORD_RESET',
      targetEntity: 'Employee',
      targetId: target.id,
      summary: `${target.name} (@${target.username}) updated their personal password and recovery email.`,
    });

    broadcastWsEvent('audit:created', audit);
    broadcastWsEvent('entity:mutated', {
      collection: 'employees',
      operation: 'update',
      item: target,
    });

    res.json({ success: true, employee: target });
  });

  // Server-Dispatched Email Recovery Code Request
  app.post('/api/auth/recovery/request', (req, res) => {
    const { email } = req.body as { email: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    const matched = store.employees.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );

    if (!matched) {
      res.status(404).json({
        success: false,
        message: 'No employee account found matching that registered email address.',
      });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.recoveryCodes[cleanEmail] = {
      code,
      employeeId: matched.id,
      email: cleanEmail,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    matched.passwordResetRequested = true;
    persistStore();

    const audit = appendAuditLog({
      organizationId: matched.organizationId || 1,
      branchId: matched.branchId,
      actorId: matched.id,
      actorName: matched.name,
      actorRole: matched.role,
      actionType: 'PASSWORD_RESET',
      targetEntity: 'Employee',
      targetId: matched.id,
      summary: `Password recovery verification code dispatched to ${matched.email} for @${matched.username}.`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      verificationCode: code,
      employeeName: matched.name,
      username: matched.username,
      message: `Server dispatched 6-digit recovery code to ${matched.email}.`,
    });
  });

  // Complete Email Password Recovery
  app.post('/api/auth/recovery/complete', (req, res) => {
    const { email, code, newPassword } = req.body as {
      email: string;
      code: string;
      newPassword: string;
    };
    const cleanEmail = (email || '').trim().toLowerCase();
    const record = store.recoveryCodes[cleanEmail];

    if (!record || Date.now() > record.expiresAt) {
      res.status(400).json({
        success: false,
        message: 'Recovery code has expired or does not exist. Please request a new code.',
      });
      return;
    }

    if (record.code !== (code || '').trim()) {
      res.status(400).json({
        success: false,
        message: 'Invalid 6-digit verification code.',
      });
      return;
    }

    const matched = store.employees.find((u) => u.id === record.employeeId);
    if (!matched) {
      res.status(404).json({ success: false, message: 'Employee account not found.' });
      return;
    }

    const cleanPwd = newPassword.trim();
    matched.password = cleanPwd;
    matched.passwordHash = hashPassword(cleanPwd);
    matched.mustChangePassword = false;
    matched.passwordResetRequested = false;
    matched.failedLoginAttempts = 0;
    matched.lockedUntil = null;
    matched.lastPasswordResetAt = new Date().toISOString();
    matched.lastPasswordResetBy = 'Email Recovery Protocol';
    matched.lastLoginAt = new Date().toISOString();
    delete store.recoveryCodes[cleanEmail];
    persistStore();

    const token = createSignedToken(matched);
    const audit = appendAuditLog({
      organizationId: matched.organizationId || 1,
      branchId: matched.branchId,
      actorId: matched.id,
      actorName: matched.name,
      actorRole: matched.role,
      actionType: 'PASSWORD_RESET',
      targetEntity: 'Employee',
      targetId: matched.id,
      summary: `${matched.name} (@${matched.username}) completed email-verified password recovery.`,
    });

    broadcastWsEvent('audit:created', audit);
    broadcastWsEvent('entity:mutated', {
      collection: 'employees',
      operation: 'update',
      item: matched,
    });

    res.json({
      success: true,
      user: matched,
      token,
      message: 'Password reset verified and completed!',
    });
  });

  // =========================================================================
  // 3. STATE SYNC & OFFLINE MUTATION QUEUE BATCH ENDPOINTS
  // =========================================================================
  app.get('/api/state', (_req, res) => {
    res.json({
      organizations: store.organizations,
      branches: store.branches,
      employees: store.employees,
      annualPlan: store.annualPlan,
      kpis: store.kpis,
      periodicPlans: store.periodicPlans,
      backlogPlans: store.backlogPlans,
      employeePlans: store.employeePlans,
      kpiCategories: store.kpiCategories,
      auditLogs: store.auditLogs.slice(0, 150),
      snapshots: store.snapshots.map(({ data, ...meta }) => meta),
      kpiEngineSchedule: store.kpiEngineSchedule,
      lastKpiEngineResult: store.lastKpiEngineResult,
      systemProviderConfig: {
        ...store.systemProviderConfig,
        masterPasskey: store.systemProviderConfig.masterPasskey,
        masterPin: store.systemProviderConfig.masterPin,
      },
    });
  });

  // =========================================================================
  // 5. SERVER-SIDE AUTOMATED KPI & BACKLOG CALCULATION ENGINE + SCHEDULER
  // =========================================================================
  let kpiEngineTimer: ReturnType<typeof setInterval> | null = null;

  function executeAutomatedKpiAndBacklogEngine(params: {
    organizationId?: number;
    branchId?: number;
    triggerSource: 'Periodic Scheduler' | 'Mutation Hook' | 'Manual Trigger' | 'Startup';
    actor?: SessionTokenPayload;
    autoSyncBacklogsOverride?: boolean;
  }): KpiEngineCalculationResult {
    const orgId = Number(params.organizationId) || 1;
    const brId = Number(params.branchId) || 1;
    const shouldSyncBacklogs =
      params.autoSyncBacklogsOverride !== undefined
        ? params.autoSyncBacklogsOverride
        : store.kpiEngineSchedule.autoSyncBacklogs;

    let reconciledPlansCount = 0;

    // Step 1: Reconcile Periodic Plans (roll up quarters if greater than 0 and sync with Annual Plan Objectives)
    store.periodicPlans.forEach((plan) => {
      if (plan.quarterly) {
        const qSum =
          (plan.quarterly.q1?.actual || 0) +
          (plan.quarterly.q2?.actual || 0) +
          (plan.quarterly.q3?.actual || 0) +
          (plan.quarterly.q4?.actual || 0);
        if (qSum > 0 && plan.annualActual !== qSum) {
          plan.annualActual = qSum;
          reconciledPlansCount++;
        }
      }
      // Reconcile matching AnnualPlanObjective actual
      const matchingObj = store.annualPlan.find(
        (obj) =>
          (obj.kpiCategory &&
            String(obj.kpiCategory).toLowerCase() === String(plan.category).toLowerCase()) ||
          obj.objective.toLowerCase() === plan.name.toLowerCase()
      );
      if (matchingObj && matchingObj.actual !== plan.annualActual) {
        matchingObj.actual = plan.annualActual;
        reconciledPlansCount++;
      }
    });

    // Step 2: Reconcile Employee Plan Assignments into Individual Employee KPIs
    store.employeePlans.forEach((ep) => {
      if (ep.quarterly) {
        const qSum =
          (ep.quarterly.q1?.actual || 0) +
          (ep.quarterly.q2?.actual || 0) +
          (ep.quarterly.q3?.actual || 0) +
          (ep.quarterly.q4?.actual || 0);
        if (qSum > 0 && ep.annualActual !== qSum) {
          ep.annualActual = qSum;
          reconciledPlansCount++;
        }
      }
      const matchingKpi = store.kpis.find(
        (k) =>
          k.employeeId === ep.employeeId &&
          String(k.kpiCategory || '').toLowerCase() === String(ep.category).toLowerCase()
      );
      if (matchingKpi && matchingKpi.actual !== ep.annualActual) {
        matchingKpi.actual = ep.annualActual;
        reconciledPlansCount++;
      }
    });

    // Step 3: Compute Employee Weighted Balanced Scorecard Scores
    const employeeScores = store.employees
      .filter((e) => getRoleHierarchyLevel(e.role) < 4)
      .map((emp) => {
        const empKpis = store.kpis.filter((k) => k.employeeId === emp.id);
        let weightedScore = 0;
        let achSum = 0;

        empKpis.forEach((k) => {
          const obj = store.annualPlan.find((o) => o.id === k.objectiveId);
          let ach = k.target > 0 ? (k.actual / k.target) * 100 : 100;
          if (obj?.objective.toLowerCase().includes('time') && k.actual > 0) {
            ach = (k.target / k.actual) * 100;
          }
          ach = Math.min(Math.max(ach, 0), 120);
          achSum += ach;
          weightedScore += (ach / 100) * (k.weight || 0);
        });

        const totalWeight = empKpis.reduce((acc, k) => acc + (k.weight || 0), 0);
        const activeBacklogsCount = store.backlogPlans.filter(
          (b) => b.assignedEmployeeId === emp.id && b.status !== 'Cleared'
        ).length;

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          kpiCount: empKpis.length,
          totalWeight,
          activeBacklogsCount,
          weightedScore: Number(weightedScore.toFixed(2)),
          averageAchievement:
            empKpis.length > 0 ? Math.round(achSum / empKpis.length) : 0,
        };
      });

    const averageEmployeeWeightedScore =
      employeeScores.length > 0
        ? Number(
            (
              employeeScores.reduce((acc, s) => acc + s.weightedScore, 0) /
              employeeScores.length
            ).toFixed(2)
          )
        : 0;

    // Step 4: Compute BSC Perspective-Level Aggregate Scores
    const perspectives = [
      PerspectiveCategory.FINANCIAL,
      PerspectiveCategory.CUSTOMER,
      PerspectiveCategory.INTERNAL_PROCESS,
      PerspectiveCategory.LEARNING_GROWTH,
    ];
    const perspectiveScores = perspectives.map((persp) => {
      const objs = store.annualPlan.filter((o) => o.category === persp);
      let achSum = 0;
      let weightedSum = 0;
      let weightTotal = 0;
      objs.forEach((o) => {
        const target = o.target || 0;
        const actual = o.actual || 0;
        let ach = target > 0 ? (actual / target) * 100 : 100;
        if (o.objective.toLowerCase().includes('time') && actual > 0) {
          ach = (target / actual) * 100;
        }
        ach = Math.min(Math.max(ach, 0), 120);
        achSum += ach;
        weightTotal += o.weight || 0;
        weightedSum += (ach / 100) * (o.weight || 0);
      });
      const avgAch = objs.length > 0 ? Math.round(achSum / objs.length) : 100;
      return {
        perspective: persp,
        objectiveCount: objs.length,
        totalWeight: weightTotal,
        averageAchievement: avgAch,
        achievement: avgAch,
        weightedScore: Number(weightedSum.toFixed(2)),
      };
    });

    // Step 5: Detect Shortfall Variances & Auto-Reconcile Backlog Plans
    const shortfallAlerts: KpiEngineShortfallAlert[] = [];
    let totalAch = 0;
    let autoGeneratedBacklogsCount = 0;
    let autoClearedBacklogsCount = 0;

    // Auto-clear existing backlog items that have met or exceeded their recovery target
    if (shouldSyncBacklogs) {
      store.backlogPlans.forEach((bItem) => {
        if (bItem.backlogActual >= bItem.backlogTarget && bItem.status !== 'Cleared') {
          bItem.status = 'Cleared';
          autoClearedBacklogsCount++;
        } else if (
          bItem.backlogActual > 0 &&
          bItem.backlogActual < bItem.backlogTarget &&
          bItem.status === 'Pending'
        ) {
          bItem.status = 'In Progress';
        }
      });
    }

    store.periodicPlans.forEach((plan) => {
      const ach = plan.annualTarget > 0 ? (plan.annualActual / plan.annualTarget) * 100 : 100;
      totalAch += Math.min(ach, 120);

      (['q1', 'q2', 'q3', 'q4'] as const).forEach((qKey) => {
        const q = plan.quarterly?.[qKey];
        if (q && q.target > 0 && q.actual < q.target) {
          const deficit = q.target - q.actual;
          const deficitRatio = deficit / q.target;
          const severity: 'Urgent' | 'High' | 'Medium' | 'Low' =
            deficitRatio > 0.35 ? 'Urgent' : deficitRatio > 0.2 ? 'High' : 'Medium';
          const periodLabel = qKey.toUpperCase();

          // Check if a backlog item already tracks this category + quarter shortfall
          let matchingBacklog = store.backlogPlans.find(
            (b) =>
              String(b.category).toLowerCase() === String(plan.category).toLowerCase() &&
              b.originPeriod.toUpperCase().includes(periodLabel)
          );

          // Auto-create backlog recovery item for significant Q1-Q3 shortfalls if enabled
          if (shouldSyncBacklogs && !matchingBacklog && qKey !== 'q4' && deficit > 0) {
            const nextBacklogId =
              store.backlogPlans.length > 0
                ? Math.max(...store.backlogPlans.map((b) => b.id)) + 1
                : 1;
            const autoBacklog: BacklogPlanItem = {
              id: nextBacklogId,
              category: plan.category,
              title: `${plan.name} [${periodLabel} Shortfall Recovery]`,
              metricUnit: plan.metricUnit,
              backlogTarget: deficit,
              backlogActual: 0,
              originPeriod: `${periodLabel} Shortfall (Auto-Engine)`,
              targetResolutionDate: 'End of Current Quarter',
              priority: severity,
              status: 'Pending',
              branchId: plan.branchId || brId,
              organizationId: plan.organizationId || orgId,
              assignedEmployeeId: 2,
              assignedDate: new Date().toISOString().split('T')[0],
              notes: `Auto-generated by Server KPI & Backlog Engine. Planned: ${q.target.toLocaleString()} ${plan.metricUnit}, Actual: ${q.actual.toLocaleString()} ${plan.metricUnit}.`,
            };
            store.backlogPlans.push(autoBacklog);
            matchingBacklog = autoBacklog;
            autoGeneratedBacklogsCount++;
          }

          shortfallAlerts.push({
            id: `sf-branch-${plan.id}-${qKey}`,
            category: String(plan.category),
            kpiName: plan.name,
            periodName: periodLabel,
            target: q.target,
            actual: q.actual,
            deficit,
            metricUnit: plan.metricUnit,
            severity,
            source: 'branch',
            autoSyncedBacklogId: matchingBacklog?.id,
            backlogGenerated: Boolean(matchingBacklog),
          });
        }
      });
    });

    // Also inspect Employee Plan quarterly shortfalls
    store.employeePlans.forEach((ep) => {
      const emp = store.employees.find((e) => e.id === ep.employeeId);
      (['q1', 'q2', 'q3'] as const).forEach((qKey) => {
        const q = ep.quarterly?.[qKey];
        if (q && q.target > 0 && q.actual < q.target) {
          const deficit = q.target - q.actual;
          shortfallAlerts.push({
            id: `sf-emp-${ep.id}-${qKey}`,
            category: String(ep.category),
            kpiName: ep.title,
            periodName: `${qKey.toUpperCase()} (${emp?.name || `Staff #${ep.employeeId}`})`,
            target: q.target,
            actual: q.actual,
            deficit,
            metricUnit: ep.metricUnit,
            severity: deficit > q.target * 0.3 ? 'High' : 'Medium',
            source: 'employee',
            employeeName: emp?.name,
          });
        }
      });
    });

    const overallBranchAchievement =
      store.periodicPlans.length > 0
        ? Math.round(totalAch / store.periodicPlans.length)
        : 0;

    const depositPlan = store.periodicPlans.find(
      (p) => String(p.category).toUpperCase().includes('DEPOSIT')
    );
    const netDepositIncrement = depositPlan ? depositPlan.annualActual : 0;

    const totalBacklogDeficitRemaining = store.backlogPlans
      .filter((b) => b.status !== 'Cleared')
      .reduce((acc, b) => acc + Math.max(0, b.backlogTarget - b.backlogActual), 0);

    const nowIso = new Date().toISOString();
    const nextRunIso = store.kpiEngineSchedule.enabled
      ? new Date(Date.now() + store.kpiEngineSchedule.intervalSeconds * 1000).toISOString()
      : undefined;

    store.kpiEngineSchedule = {
      ...store.kpiEngineSchedule,
      lastRunAt: nowIso,
      nextRunAt: nextRunIso,
      totalRunsCount: (store.kpiEngineSchedule.totalRunsCount || 0) + 1,
    };

    const result: KpiEngineCalculationResult = {
      executedAt: nowIso,
      triggerSource: params.triggerSource,
      organizationId: orgId,
      branchId: brId,
      employeeScores,
      perspectiveScores,
      perspectiveBreakdown: perspectiveScores,
      shortfallAlerts: shortfallAlerts.slice(0, 30),
      detectedShortfallsCount: shortfallAlerts.length,
      overallBranchAchievement,
      averageEmployeeWeightedScore,
      netDepositIncrement,
      reconciledPlansCount,
      autoGeneratedBacklogsCount,
      autoClearedBacklogsCount,
      reconciledBacklogsCount: autoClearedBacklogsCount,
      totalBacklogDeficitRemaining,
    };

    store.lastKpiEngineResult = result;
    persistStore();

    // Record audit entry on manual or startup runs, or when backlogs/plans were auto-reconciled
    if (
      params.triggerSource === 'Manual Trigger' ||
      params.triggerSource === 'Startup' ||
      autoGeneratedBacklogsCount > 0 ||
      autoClearedBacklogsCount > 0 ||
      reconciledPlansCount > 0
    ) {
      const actor = params.actor || {
        employeeId: 1,
        username: 'kpi-engine',
        name:
          params.triggerSource === 'Periodic Scheduler'
            ? 'Periodic KPI Engine Scheduler'
            : 'Automated KPI & Backlog Engine',
        role: Role.SUPER_ADMIN,
        organizationId: orgId,
        branchId: brId,
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      const audit = appendAuditLog({
        organizationId: orgId,
        branchId: brId,
        actorId: actor.employeeId,
        actorName: actor.name,
        actorRole: actor.role,
        actionType: 'KPI_ENGINE_RUN',
        targetEntity: 'KPIEngine',
        targetId: `ORG-${orgId}`,
        summary: `[${params.triggerSource}] Aggregate score: ${overallBranchAchievement}%, ${shortfallAlerts.length} shortfalls audited, ${autoGeneratedBacklogsCount} backlog(s) generated, ${autoClearedBacklogsCount} cleared.`,
      });
      broadcastWsEvent('audit:created', audit);
    }

    // Broadcast updated aggregate scores and reconciled entities to all connected clients
    broadcastWsEvent('kpi_engine:updated', {
      result,
      schedule: store.kpiEngineSchedule,
      kpis: store.kpis,
      periodicPlans: store.periodicPlans,
      annualPlan: store.annualPlan,
      backlogPlans: store.backlogPlans,
    });

    return result;
  }

  function restartKpiEngineScheduler() {
    if (kpiEngineTimer) {
      clearInterval(kpiEngineTimer);
      kpiEngineTimer = null;
    }
    if (store.kpiEngineSchedule.enabled && store.kpiEngineSchedule.intervalSeconds >= 10) {
      const ms = store.kpiEngineSchedule.intervalSeconds * 1000;
      store.kpiEngineSchedule.nextRunAt = new Date(Date.now() + ms).toISOString();
      kpiEngineTimer = setInterval(() => {
        executeAutomatedKpiAndBacklogEngine({
          organizationId: 1,
          branchId: 1,
          triggerSource: 'Periodic Scheduler',
        });
      }, ms);
    } else {
      store.kpiEngineSchedule.nextRunAt = undefined;
    }
  }

  function applyEntityMutation(
    collection: string,
    operation: 'create' | 'update' | 'delete',
    payload: any,
    actor: SessionTokenPayload
  ) {
    const keyMap: Record<string, keyof ServerStore> = {
      organizations: 'organizations',
      branches: 'branches',
      employees: 'employees',
      annualPlan: 'annualPlan',
      annualPlanObjectives: 'annualPlan',
      kpis: 'kpis',
      plans: 'periodicPlans',
      periodicPlans: 'periodicPlans',
      backlogPlans: 'backlogPlans',
      employeePlans: 'employeePlans',
      kpiCategories: 'kpiCategories',
    };

    const storeKey = keyMap[collection];
    if (!storeKey) return null;

    const list = store[storeKey] as any[];
    if (operation === 'create' || operation === 'update') {
      if (collection === 'employees' && payload.password && !payload.passwordHash) {
        payload.passwordHash = hashPassword(payload.password);
      }
      const idx = list.findIndex((item) => String(item.id) === String(payload.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
    } else if (operation === 'delete') {
      const targetId = typeof payload === 'object' ? payload.id : payload;
      const idx = list.findIndex((item) => String(item.id) === String(targetId));
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    }

    // Record Audit Log for key mutations
    const actionType: AuditActionType =
      collection === 'kpis'
        ? 'KPI_UPDATE'
        : collection === 'organizations'
        ? 'ORG_CHANGE'
        : collection === 'employees'
        ? 'ROLE_CHANGE'
        : 'PLAN_UPDATE';

    const itemName =
      payload?.name || payload?.title || payload?.objective || `#${payload?.id || payload}`;

    const audit = appendAuditLog({
      organizationId: payload?.organizationId || actor.organizationId || 1,
      branchId: payload?.branchId || actor.branchId || 1,
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType,
      targetEntity: collection,
      targetId: payload?.id ?? String(payload),
      summary: `${actor.name} performed ${operation.toUpperCase()} on ${collection} (${itemName}).`,
    });

    broadcastWsEvent('entity:mutated', {
      collection,
      operation,
      item: payload,
    });
    broadcastWsEvent('audit:created', audit);

    // Automatically trigger KPI & Backlog Engine when performance entries change
    const kpiRelatedCollections = [
      'kpis',
      'plans',
      'periodicPlans',
      'annualPlan',
      'annualPlanObjectives',
      'backlogPlans',
      'employeePlans',
    ];
    if (store.kpiEngineSchedule.runOnMutation && kpiRelatedCollections.includes(collection)) {
      executeAutomatedKpiAndBacklogEngine({
        organizationId: payload?.organizationId || actor.organizationId || 1,
        branchId: payload?.branchId || actor.branchId || 1,
        triggerSource: 'Mutation Hook',
        actor,
      });
    }

    return audit;
  }

  app.post('/api/sync/mutate', (req, res) => {
    const actor = extractActorFromReq(req);
    const { collection, operation, payload } = req.body as {
      collection: string;
      operation: 'create' | 'update' | 'delete';
      payload: any;
    };
    const audit = applyEntityMutation(collection, operation, payload, actor);
    persistStore();
    res.json({
      success: true,
      audit,
      lastKpiEngineResult: store.lastKpiEngineResult,
    });
  });

  app.post('/api/sync/batch', (req, res) => {
    const actor = extractActorFromReq(req);
    const { items } = req.body as {
      items: {
        id: string;
        collection: string;
        operation: 'create' | 'update' | 'delete';
        payload: any;
      }[];
    };

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Invalid batch items array.' });
      return;
    }

    for (const item of items) {
      applyEntityMutation(item.collection, item.operation, item.payload, actor);
    }
    persistStore();
    res.json({
      success: true,
      processed: items.length,
      lastKpiEngineResult: store.lastKpiEngineResult,
    });
  });

  // =========================================================================
  // 4. IMMUTABLE AUDIT LOG ENDPOINTS
  // =========================================================================
  app.get('/api/audit-logs', (req, res) => {
    const { organizationId, actionType, limit } = req.query;
    let logs = [...store.auditLogs];
    if (organizationId && organizationId !== 'ALL') {
      logs = logs.filter((l) => l.organizationId === Number(organizationId));
    }
    if (actionType && actionType !== 'ALL') {
      logs = logs.filter((l) => l.actionType === actionType);
    }
    const max = Math.min(Number(limit) || 150, 500);
    res.json({ logs: logs.slice(0, max) });
  });

  // Get current KPI Engine status, schedule config, and latest result
  app.get('/api/kpi-engine/status', (_req, res) => {
    if (!store.lastKpiEngineResult) {
      executeAutomatedKpiAndBacklogEngine({
        organizationId: 1,
        branchId: 1,
        triggerSource: 'Startup',
      });
    }
    res.json({
      schedule: store.kpiEngineSchedule,
      lastResult: store.lastKpiEngineResult,
    });
  });

  // Configure periodic scheduler for automated KPI & Backlog calculation engine
  app.post('/api/kpi-engine/schedule', (req, res) => {
    const actor = extractActorFromReq(req);
    const { enabled, intervalSeconds, autoSyncBacklogs, runOnMutation } =
      req.body as Partial<KpiEngineScheduleConfig>;

    if (typeof enabled === 'boolean') store.kpiEngineSchedule.enabled = enabled;
    if (typeof intervalSeconds === 'number' && intervalSeconds >= 10) {
      store.kpiEngineSchedule.intervalSeconds = intervalSeconds;
    }
    if (typeof autoSyncBacklogs === 'boolean') {
      store.kpiEngineSchedule.autoSyncBacklogs = autoSyncBacklogs;
    }
    if (typeof runOnMutation === 'boolean') {
      store.kpiEngineSchedule.runOnMutation = runOnMutation;
    }

    restartKpiEngineScheduler();
    const latestResult = executeAutomatedKpiAndBacklogEngine({
      organizationId: actor.organizationId || 1,
      branchId: actor.branchId || 1,
      triggerSource: 'Manual Trigger',
      actor,
    });

    res.json({
      success: true,
      schedule: store.kpiEngineSchedule,
      lastResult: latestResult,
    });
  });

  // Trigger immediate server-side KPI & Backlog recalculation
  app.post('/api/kpi-engine/recalculate', (req, res) => {
    const actor = extractActorFromReq(req);
    const { organizationId = 1, branchId = 1, autoSyncBacklogs } = req.body as {
      organizationId?: number;
      branchId?: number;
      autoSyncBacklogs?: boolean;
    };

    const result = executeAutomatedKpiAndBacklogEngine({
      organizationId: Number(organizationId),
      branchId: Number(branchId),
      triggerSource: 'Manual Trigger',
      actor,
      autoSyncBacklogsOverride: autoSyncBacklogs,
    });

    res.json(result);
  });

  // =========================================================================
  // 6. SCHEDULED & POINT-IN-TIME SNAPSHOTS & RESTORE
  // =========================================================================
  function createSnapshotRecord(params: {
    label: string;
    createdBy: string;
    organizationId: number;
    triggerType: 'Scheduled' | 'Manual' | 'Pre-Restore';
  }): DatabaseSnapshot {
    const snap: DatabaseSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
      organizationId: params.organizationId,
      label: params.label,
      triggerType: params.triggerType,
      recordCounts: {
        organizations: store.organizations.length,
        branches: store.branches.length,
        employees: store.employees.length,
        kpis: store.kpis.length,
        plans: store.periodicPlans.length,
        backlogs: store.backlogPlans.length,
      },
      data: {
        organizations: JSON.parse(JSON.stringify(store.organizations)),
        branches: JSON.parse(JSON.stringify(store.branches)),
        employees: JSON.parse(JSON.stringify(store.employees)),
        annualPlan: JSON.parse(JSON.stringify(store.annualPlan)),
        kpis: JSON.parse(JSON.stringify(store.kpis)),
        periodicPlans: JSON.parse(JSON.stringify(store.periodicPlans)),
        backlogPlans: JSON.parse(JSON.stringify(store.backlogPlans)),
        employeePlans: JSON.parse(JSON.stringify(store.employeePlans)),
      },
    };
    store.snapshots.unshift(snap);
    if (store.snapshots.length > 25) {
      store.snapshots = store.snapshots.slice(0, 25);
    }
    persistStore();
    return snap;
  }

  app.get('/api/snapshots', (_req, res) => {
    const metadataList = store.snapshots.map(({ data, ...meta }) => meta);
    res.json({ snapshots: metadataList });
  });

  app.post('/api/snapshots', requireAdminMiddleware, (req, res) => {
    const actor = extractActorFromReq(req);
    const { label, organizationId, triggerType } = req.body as {
      label?: string;
      organizationId?: number;
      triggerType?: 'Scheduled' | 'Manual';
    };

    const snap = createSnapshotRecord({
      label: label?.trim() || `Manual Point-in-Time Snapshot (${new Date().toLocaleTimeString()})`,
      createdBy: actor.name,
      organizationId: Number(organizationId) || actor.organizationId || 1,
      triggerType: triggerType || 'Manual',
    });

    const audit = appendAuditLog({
      organizationId: snap.organizationId,
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType: 'SNAPSHOT_CREATE',
      targetEntity: 'Snapshot',
      targetId: snap.id,
      summary: `Created ${snap.triggerType} database snapshot "${snap.label}" (${snap.recordCounts.employees} employees, ${snap.recordCounts.kpis} KPIs).`,
    });

    broadcastWsEvent('audit:created', audit);
    const { data, ...meta } = snap;
    res.json({ success: true, snapshot: meta });
  });

  app.post('/api/snapshots/:id/restore', requireAdminMiddleware, (req, res) => {
    const actor = extractActorFromReq(req);
    const targetSnap = store.snapshots.find((s) => s.id === req.params.id);
    if (!targetSnap || !targetSnap.data) {
      res.status(404).json({ error: 'Snapshot not found or has no payload.' });
      return;
    }

    // Create automatic Pre-Restore safety snapshot first
    createSnapshotRecord({
      label: `Auto Safety Backup prior to restoring "${targetSnap.label}"`,
      createdBy: actor.name,
      organizationId: targetSnap.organizationId,
      triggerType: 'Pre-Restore',
    });

    store.organizations = JSON.parse(JSON.stringify(targetSnap.data.organizations));
    store.branches = JSON.parse(JSON.stringify(targetSnap.data.branches));
    store.employees = JSON.parse(JSON.stringify(targetSnap.data.employees));
    store.annualPlan = JSON.parse(JSON.stringify(targetSnap.data.annualPlan));
    store.kpis = JSON.parse(JSON.stringify(targetSnap.data.kpis));
    store.periodicPlans = JSON.parse(JSON.stringify(targetSnap.data.periodicPlans));
    store.backlogPlans = JSON.parse(JSON.stringify(targetSnap.data.backlogPlans));
    store.employeePlans = JSON.parse(JSON.stringify(targetSnap.data.employeePlans));
    persistStore();

    const audit = appendAuditLog({
      organizationId: targetSnap.organizationId,
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType: 'SNAPSHOT_RESTORE',
      targetEntity: 'Snapshot',
      targetId: targetSnap.id,
      summary: `Restored point-in-time snapshot "${targetSnap.label}" from ${targetSnap.createdAt.slice(0, 16)}.`,
    });

    broadcastWsEvent('audit:created', audit);
    broadcastWsEvent('snapshot:restored', {
      snapshotId: targetSnap.id,
      label: targetSnap.label,
      state: {
        organizations: store.organizations,
        branches: store.branches,
        employees: store.employees,
        annualPlan: store.annualPlan,
        kpis: store.kpis,
        periodicPlans: store.periodicPlans,
        backlogPlans: store.backlogPlans,
        employeePlans: store.employeePlans,
      },
    });

    res.json({
      success: true,
      restoredSnapshotId: targetSnap.id,
      state: {
        organizations: store.organizations,
        branches: store.branches,
        employees: store.employees,
        annualPlan: store.annualPlan,
        kpis: store.kpis,
        periodicPlans: store.periodicPlans,
        backlogPlans: store.backlogPlans,
        employeePlans: store.employeePlans,
      },
    });
  });

  // =========================================================================
  // 7. BULK CSV / JSON IMPORT & BACKUP ENDPOINT
  // =========================================================================
  app.post('/api/import-export/bulk', requireAdminMiddleware, (req, res) => {
    const actor = extractActorFromReq(req);
    const { entityType, records, organizationId = 1 } = req.body as {
      entityType: 'employees' | 'kpis' | 'periodicPlans' | 'branches' | 'fullSnapshot';
      records: any;
      organizationId?: number;
    };

    let importedCount = 0;

    if (entityType === 'fullSnapshot' && records && typeof records === 'object') {
      if (Array.isArray(records.employees)) {
        records.employees.forEach((emp: Employee) => {
          applyEntityMutation('employees', 'update', emp, actor);
          importedCount++;
        });
      }
      if (Array.isArray(records.kpis)) {
        records.kpis.forEach((k: Kpi) => {
          applyEntityMutation('kpis', 'update', k, actor);
          importedCount++;
        });
      }
      if (Array.isArray(records.periodicPlans)) {
        records.periodicPlans.forEach((p: PeriodicPlanItem) => {
          applyEntityMutation('periodicPlans', 'update', p, actor);
          importedCount++;
        });
      }
    } else if (Array.isArray(records)) {
      records.forEach((rec, index) => {
        if (entityType === 'employees') {
          const nextId =
            rec.id ||
            (store.employees.length > 0
              ? Math.max(...store.employees.map((e) => e.id)) + 1 + index
              : 10 + index);
          const uname =
            rec.username ||
            (rec.name || `user${nextId}`).toLowerCase().replace(/\s+/g, '.');
          const emp: Employee = {
            id: Number(nextId),
            name: rec.name || `Imported Employee ${nextId}`,
            username: uname,
            password: rec.password || 'Password@123',
            passwordHash: hashPassword(rec.password || 'Password@123'),
            pin: String(rec.pin || '1234'),
            role: (rec.role as Role) || Role.STAFF,
            positionTitle: rec.positionTitle || rec.role || 'Operations Specialist',
            department: rec.department || 'Operations',
            email: rec.email || `${uname}@org-tracker.com`,
            phone: rec.phone || '',
            employeeCode:
              rec.employeeCode || `EMP-${String(nextId).padStart(3, '0')}`,
            branchId: Number(rec.branchId) || 1,
            organizationId: Number(rec.organizationId || organizationId),
            qualification: rec.qualification || 'Professional Certificate',
            status: 'Active',
          };
          applyEntityMutation('employees', 'update', emp, actor);
          importedCount++;
        } else if (entityType === 'kpis') {
          const nextId =
            rec.id ||
            (store.kpis.length > 0
              ? Math.max(...store.kpis.map((k) => k.id)) + 1 + index
              : 50 + index);
          const kpi: Kpi = {
            id: Number(nextId),
            employeeId: Number(rec.employeeId) || 2,
            objectiveId: Number(rec.objectiveId) || 1,
            name: rec.name || `Imported KPI ${nextId}`,
            weight: Number(rec.weight) || 20,
            target: Number(rec.target) || 100,
            actual: Number(rec.actual) || 0,
            kpiCategory: rec.kpiCategory || 'Deposit',
            organizationId: Number(organizationId),
          };
          applyEntityMutation('kpis', 'update', kpi, actor);
          importedCount++;
        }
      });
    }

    persistStore();

    const audit = appendAuditLog({
      organizationId: Number(organizationId),
      actorId: actor.employeeId,
      actorName: actor.name,
      actorRole: actor.role,
      actionType: 'BULK_IMPORT',
      targetEntity: entityType,
      targetId: `BATCH-${importedCount}`,
      summary: `Bulk imported ${importedCount} ${entityType} records into organization #${organizationId}.`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      importedCount,
      state: {
        employees: store.employees,
        kpis: store.kpis,
        periodicPlans: store.periodicPlans,
      },
    });
  });

  // =========================================================================
  // 7B. SERVICE PROVIDER / OWNER MAIN SYSTEM CONTROL DASHBOARD ENDPOINTS
  // =========================================================================
  app.post('/api/system-provider/auth', (req, res) => {
    const { passkeyOrPin } = req.body as { passkeyOrPin?: string };
    const cleanInput = (passkeyOrPin || '').trim();
    if (!cleanInput) {
      res.status(400).json({
        success: false,
        error: 'System Master Passkey or Secret PIN is required.',
      });
      return;
    }

    const cfg = store.systemProviderConfig || DEFAULT_SYSTEM_PROVIDER_CONFIG;
    const isMatch =
      cleanInput === cfg.masterPasskey ||
      cleanInput === cfg.masterPin ||
      cleanInput.toLowerCase() === cfg.masterPasskey.toLowerCase();

    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid System Owner Master Passkey or Secret PIN.',
      });
      return;
    }

    const audit = appendAuditLog({
      organizationId: 1,
      branchId: 1,
      actorId: 0,
      actorName: cfg.ownerName || 'Platform Owner',
      actorRole: Role.SUPER_ADMIN,
      actionType: 'AUTH_LOGIN',
      targetEntity: 'SystemProvider',
      targetId: 'OWNER',
      summary: `Platform Owner (${cfg.ownerName}) authenticated into the Main System Control Dashboard.`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      config: cfg,
    });
  });

  app.post('/api/system-provider/credentials', (req, res) => {
    const {
      currentSecret,
      newMasterPasskey,
      newMasterPin,
      serviceTitle,
      ownerName,
      ownerEmail,
    } = req.body as {
      currentSecret?: string;
      newMasterPasskey?: string;
      newMasterPin?: string;
      serviceTitle?: string;
      ownerName?: string;
      ownerEmail?: string;
    };

    const cfg = store.systemProviderConfig || { ...DEFAULT_SYSTEM_PROVIDER_CONFIG };
    if (
      currentSecret &&
      currentSecret.trim() !== cfg.masterPasskey &&
      currentSecret.trim() !== cfg.masterPin
    ) {
      res.status(401).json({
        success: false,
        error: 'Current Master Passkey or PIN does not match.',
      });
      return;
    }

    if (newMasterPasskey && newMasterPasskey.trim()) {
      cfg.masterPasskey = newMasterPasskey.trim();
    }
    if (newMasterPin && newMasterPin.trim()) {
      cfg.masterPin = newMasterPin.trim();
    }
    if (serviceTitle && serviceTitle.trim()) {
      cfg.serviceTitle = serviceTitle.trim();
    }
    if (ownerName && ownerName.trim()) {
      cfg.ownerName = ownerName.trim();
    }
    if (ownerEmail && ownerEmail.trim()) {
      cfg.ownerEmail = ownerEmail.trim();
    }
    cfg.updatedAt = new Date().toISOString();
    store.systemProviderConfig = cfg;
    persistStore();

    const audit = appendAuditLog({
      organizationId: 1,
      branchId: 1,
      actorId: 0,
      actorName: cfg.ownerName,
      actorRole: Role.SUPER_ADMIN,
      actionType: 'PASSWORD_RESET',
      targetEntity: 'SystemProvider',
      targetId: 'OWNER',
      summary: `Platform Owner updated Main System Control Dashboard master passkey / profile settings.`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      config: cfg,
    });
  });

  app.post('/api/system-provider/provision-org', (req, res) => {
    const {
      name,
      code,
      sector,
      headquarters,
      primaryCurrency,
      description,
      planTier,
      quotas,
      capabilities,
      initialBranchName,
      initialBranchDistrict,
      adminName,
      adminUsername,
      adminEmail,
      adminPassword,
      adminPin,
    } = req.body as {
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
    };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Organization name is required.' });
      return;
    }

    const nextOrgId =
      store.organizations.length > 0
        ? Math.max(...store.organizations.map((o) => o.id)) + 1
        : 1;

    const cleanSector = sector || 'Service & Hospitality';
    const newOrg: Organization = {
      id: nextOrgId,
      name: name.trim(),
      code: (code || `ORG-${nextOrgId}`).trim().toUpperCase(),
      sector: cleanSector,
      headquarters: (headquarters || 'Main Corporate Headquarters').trim(),
      establishedDate: new Date().toISOString().slice(0, 10),
      primaryCurrency: (primaryCurrency || 'ETB').trim().toUpperCase(),
      description:
        (description || `Managed ${cleanSector} enterprise workspace.`).trim(),
      isActive: false,
      serviceStatus: 'Active',
      planTier: planTier || 'Enterprise',
      capabilities: {
        ...DEFAULT_ORGANIZATION_CAPABILITIES,
        ...(capabilities || {}),
      },
      quotas: {
        ...DEFAULT_ORGANIZATION_QUOTAS,
        ...(quotas || {}),
      },
      primaryAdminEmail: adminEmail?.trim() || `admin@${(code || `org${nextOrgId}`).toLowerCase()}.com`,
      requiredPositions: getDefaultPositionsForSector(cleanSector),
    };

    store.organizations.push(newOrg);
    broadcastWsEvent('entity:mutated', {
      collection: 'organizations',
      operation: 'create',
      item: newOrg,
    });

    // Seed initial HQ branch for the new organization
    const nextBranchId =
      store.branches.length > 0
        ? Math.max(...store.branches.map((b) => b.id)) + 1
        : 1;
    const newBranch: Branch = {
      id: nextBranchId,
      name: (initialBranchName || `${newOrg.name} — Main HQ Branch`).trim(),
      code: `${newOrg.code}-01`,
      district: (initialBranchDistrict || newOrg.headquarters || 'Central Zone').trim(),
      fiscalYear: '2025/2026',
      openingDate: new Date().toISOString().slice(0, 10),
      juneClosingDepositBalance: 50000000,
      isActive: true,
      organizationId: newOrg.id,
      sector: newOrg.sector,
    };
    store.branches.push(newBranch);
    broadcastWsEvent('entity:mutated', {
      collection: 'branches',
      operation: 'create',
      item: newBranch,
    });

    // Optionally seed initial Organization Super Admin user
    let createdAdmin: Employee | undefined;
    if (adminName && adminName.trim()) {
      const nextEmpId =
        store.employees.length > 0
          ? Math.max(...store.employees.map((e) => e.id)) + 1
          : 1;
      const cleanUname =
        (adminUsername || adminName.toLowerCase().replace(/\s+/g, '.')).trim().toLowerCase();
      const cleanPwd = (adminPassword || 'Password@123').trim();
      const cleanPin = (adminPin || '1111').trim();
      const firstRole = newOrg.requiredPositions?.[0];

      createdAdmin = {
        id: nextEmpId,
        name: adminName.trim(),
        role: Role.SUPER_ADMIN,
        branchId: newBranch.id,
        organizationId: newOrg.id,
        organizationRoleId: firstRole?.id,
        positionTitle: firstRole?.title || 'Organization Chief Executive & Admin',
        department: firstRole?.department || 'Executive Governance',
        username: cleanUname,
        password: cleanPwd,
        passwordHash: hashPassword(cleanPwd),
        pin: cleanPin,
        employeeCode: `EMP-${String(nextEmpId).padStart(3, '0')}`,
        email:
          adminEmail?.trim() || `${cleanUname}@${newOrg.code.toLowerCase()}.com`,
        employmentType: 'Full-Time',
        hireDate: new Date().toISOString().slice(0, 10),
        status: 'Active',
        qualification: 'Executive Leadership',
      };
      store.employees.push(createdAdmin);
      broadcastWsEvent('entity:mutated', {
        collection: 'employees',
        operation: 'create',
        item: createdAdmin,
      });
    }

    persistStore();

    const audit = appendAuditLog({
      organizationId: newOrg.id,
      branchId: newBranch.id,
      actorId: 0,
      actorName: store.systemProviderConfig?.ownerName || 'Platform Owner',
      actorRole: Role.SUPER_ADMIN,
      actionType: 'ORG_MUTATION',
      targetEntity: 'Organization',
      targetId: newOrg.id,
      summary: `Service Provider provisioned client organization "${newOrg.name}" (${newOrg.code}) on ${newOrg.planTier} plan with branch "${newBranch.name}".`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      organization: newOrg,
      branch: newBranch,
      admin: createdAdmin,
    });
  });

  app.post('/api/system-provider/org-service-config', (req, res) => {
    const {
      organizationId,
      serviceStatus,
      planTier,
      capabilities,
      quotas,
      ownerNotes,
      assignAdmin,
    } = req.body as {
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
    };

    const org = store.organizations.find((o) => o.id === Number(organizationId));
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found.' });
      return;
    }

    if (serviceStatus) org.serviceStatus = serviceStatus;
    if (planTier) org.planTier = planTier;
    if (capabilities) {
      org.capabilities = {
        ...DEFAULT_ORGANIZATION_CAPABILITIES,
        ...(org.capabilities || {}),
        ...capabilities,
      };
    }
    if (quotas) {
      org.quotas = {
        ...DEFAULT_ORGANIZATION_QUOTAS,
        ...(org.quotas || {}),
        ...quotas,
      };
    }
    if (ownerNotes !== undefined) {
      org.ownerNotes = ownerNotes;
    }

    let provisionedAdmin: Employee | undefined;
    if (assignAdmin && assignAdmin.name && assignAdmin.username) {
      const orgBranches = store.branches.filter((b) => b.organizationId === org.id);
      const targetBranchId = orgBranches[0]?.id || 1;
      const cleanUname = assignAdmin.username.trim().toLowerCase();
      const cleanPwd = (assignAdmin.password || 'Password@123').trim();
      const cleanPin = (assignAdmin.pin || '1111').trim();

      const existingAdmin = store.employees.find(
        (e) =>
          e.organizationId === org.id &&
          (e.username?.toLowerCase() === cleanUname ||
            e.email?.toLowerCase() === assignAdmin.email?.trim().toLowerCase())
      );

      if (existingAdmin) {
        existingAdmin.name = assignAdmin.name.trim();
        existingAdmin.username = cleanUname;
        existingAdmin.email = assignAdmin.email.trim();
        existingAdmin.password = cleanPwd;
        existingAdmin.passwordHash = hashPassword(cleanPwd);
        existingAdmin.pin = cleanPin;
        existingAdmin.role = assignAdmin.role || Role.SUPER_ADMIN;
        existingAdmin.lockedUntil = null;
        existingAdmin.failedLoginAttempts = 0;
        provisionedAdmin = existingAdmin;
        broadcastWsEvent('entity:mutated', {
          collection: 'employees',
          operation: 'update',
          item: existingAdmin,
        });
      } else {
        const nextEmpId =
          store.employees.length > 0
            ? Math.max(...store.employees.map((e) => e.id)) + 1
            : 1;
        provisionedAdmin = {
          id: nextEmpId,
          name: assignAdmin.name.trim(),
          username: cleanUname,
          email: assignAdmin.email.trim() || `${cleanUname}@${org.code.toLowerCase()}.com`,
          password: cleanPwd,
          passwordHash: hashPassword(cleanPwd),
          pin: cleanPin,
          role: assignAdmin.role || Role.SUPER_ADMIN,
          branchId: targetBranchId,
          organizationId: org.id,
          positionTitle: 'Organization System Controller (Assigned by Service Provider)',
          department: 'Executive Governance',
          employeeCode: `EMP-${String(nextEmpId).padStart(3, '0')}`,
          employmentType: 'Full-Time',
          hireDate: new Date().toISOString().slice(0, 10),
          status: 'Active',
        };
        store.employees.push(provisionedAdmin);
        broadcastWsEvent('entity:mutated', {
          collection: 'employees',
          operation: 'create',
          item: provisionedAdmin,
        });
      }
      org.primaryAdminEmail = provisionedAdmin.email;
    }

    persistStore();
    broadcastWsEvent('entity:mutated', {
      collection: 'organizations',
      operation: 'update',
      item: org,
    });

    const audit = appendAuditLog({
      organizationId: org.id,
      branchId: 1,
      actorId: 0,
      actorName: store.systemProviderConfig?.ownerName || 'Platform Owner',
      actorRole: Role.SUPER_ADMIN,
      actionType: 'ORG_MUTATION',
      targetEntity: 'Organization',
      targetId: org.id,
      summary: `Service Provider updated capabilities/quotas/status (${org.serviceStatus}, ${org.planTier}) for "${org.name}".`,
    });
    broadcastWsEvent('audit:created', audit);

    res.json({
      success: true,
      organization: org,
      admin: provisionedAdmin,
    });
  });

  // Initialize Automated KPI & Backlog Engine on startup and start periodic scheduler
  executeAutomatedKpiAndBacklogEngine({
    organizationId: 1,
    branchId: 1,
    triggerSource: 'Startup',
  });
  restartKpiEngineScheduler();

  // Automated Scheduled Snapshot Timer (every 30 minutes)
  setInterval(() => {
    createSnapshotRecord({
      label: `Automated Scheduled Snapshot (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
      createdBy: 'Scheduled Cron Engine',
      organizationId: 1,
      triggerType: 'Scheduled',
    });
  }, 30 * 60 * 1000);

  // =========================================================================
  // 8. VITE MIDDLEWARE / STATIC ASSETS & WEBSOCKET SERVER
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const defaultPeer: ConnectedPeer = {
      ws,
      clientId: `peer-${Math.random().toString(36).slice(2, 8)}`,
      userName: 'Connected Terminal',
      userRole: Role.STAFF,
      organizationId: 1,
      branchId: 1,
      connectedAt: new Date().toISOString(),
    };
    connectedPeers.set(ws, defaultPeer);
    broadcastPresence();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'peer:identify') {
          const existing = connectedPeers.get(ws);
          if (existing) {
            existing.clientId = msg.payload?.clientId || existing.clientId;
            existing.userName = msg.payload?.userName || existing.userName;
            existing.userRole = msg.payload?.userRole || existing.userRole;
            existing.organizationId = Number(msg.payload?.organizationId) || 1;
            existing.branchId = Number(msg.payload?.branchId) || 1;
            connectedPeers.set(ws, existing);
            broadcastPresence();
          }
        } else if (msg.type === 'entity:mutate') {
          const { collection, operation, payload, actor } = msg.payload || {};
          if (collection && operation) {
            applyEntityMutation(
              collection,
              operation,
              payload,
              actor || {
                employeeId: 1,
                username: 'system',
                name: defaultPeer.userName,
                role: defaultPeer.userRole,
                organizationId: defaultPeer.organizationId,
                branchId: defaultPeer.branchId,
                iat: Date.now(),
                exp: Date.now() + 3600000,
              }
            );
          }
        }
      } catch {
        // ignore malformed ws frames
      }
    });

    ws.on('close', () => {
      connectedPeers.delete(ws);
      broadcastPresence();
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Performance Tracker Backend] Express + WebSocket Server listening on http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
