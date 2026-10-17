import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import {
  Role,
  isAdminRole,
  AuditActionType,
  KpiEngineCalculationResult,
} from '../types';
import {
  generateQrCodeUrl,
  measureFirestorePing,
  detectDeviceType,
  registerDevicePresence,
  exportBranchDatabaseSnapshot,
  importBranchDatabaseSnapshot,
  NetworkDeviceInfo,
} from '../services/networkSync';

const BranchNetworkPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    organizations,
    activeOrganization,
    activeOrganizationId,
    branches,
    activeBranchId,
    refreshData,
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
  } = useContext(DataContext);

  const isAdmin = isAdminRole(user?.role);

  const activeBranch =
    branches.find((b) => b.id === activeBranchId) ||
    branches[0] || {
      id: 1,
      name: 'Main Operations Branch',
      code: 'MOB-01',
    };

  // Top-level Console Mode switcher
  const [consoleView, setConsoleView] = useState<
    'governance-audit' | 'snapshots-import' | 'kpi-engine' | 'lan-networking'
  >('governance-audit');

  // Audit Log Filter State
  const [auditOrgFilter, setAuditOrgFilter] = useState<number | 'ALL'>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');

  // Snapshot & Bulk Import State
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [isCreatingSnap, setIsCreatingSnap] = useState<boolean>(false);
  const [restoringSnapId, setRestoringSnapId] = useState<string | null>(null);
  const [bulkEntityType, setBulkEntityType] = useState<'employees' | 'kpis'>('employees');
  const [bulkCsvText, setBulkCsvText] = useState<string>(
    'name,username,role,positionTitle,department,email,pin\nAbebe Kebede,abebe.k,Officer,Quality Assurance Officer,Operations,abebe.k@org-tracker.com,4455\nTigist Alemu,tigist.a,Staff Member,Production Specialist,Manufacturing,tigist.a@org-tracker.com,5566'
  );
  const [governanceBanner, setGovernanceBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Server-Side KPI Calculation Engine State
  const [kpiEngineResult, setKpiEngineResult] = useState<KpiEngineCalculationResult | null>(
    null
  );
  const [isRunningEngine, setIsRunningEngine] = useState<boolean>(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState<boolean>(false);

  useEffect(() => {
    if (latestKpiEngineResult) {
      setKpiEngineResult(latestKpiEngineResult);
    }
  }, [latestKpiEngineResult]);

  // Detected origin info for LAN tab
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const currentPort =
    typeof window !== 'undefined' && window.location.port ? window.location.port : '3000';
  const isCloudHost =
    currentHost.includes('run.app') ||
    currentHost.includes('web.app') ||
    currentHost.includes('firebaseapp');

  const [lanIp, setLanIp] = useState<string>(() => {
    return isCloudHost
      ? '192.168.1.100'
      : currentHost === 'localhost' || currentHost === '127.0.0.1'
      ? '192.168.1.100'
      : currentHost;
  });
  const [lanPort, setLanPort] = useState<string>(currentPort || '3000');
  const [selectedRoute, setSelectedRoute] = useState<'root' | 'login' | 'dashboard'>('root');
  const [activeTab, setActiveTab] = useState<'windows' | 'clients' | 'mobile' | 'airgap'>(
    'windows'
  );
  const [qrType, setQrType] = useState<'cloud' | 'lan'>('cloud');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{
    connected: boolean;
    latencyMs: number;
  } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [activeDevices, setActiveDevices] = useState<NetworkDeviceInfo[]>([]);
  const [showPrintPoster, setShowPrintPoster] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudUrl = 'https://ais-pre-7kx3nyozctfeisf3f6er4c-355420735883.europe-west2.run.app';

  const getFullUrl = (base: string, route: 'root' | 'login' | 'dashboard') => {
    const routeHash =
      route === 'login' ? '#/login' : route === 'dashboard' ? '#/dashboard' : '#/';
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/${routeHash}`;
  };

  const activeLanUrl = `http://${lanIp.trim()}:${lanPort.trim()}`;
  const effectiveUrl =
    qrType === 'cloud'
      ? getFullUrl(cloudUrl, selectedRoute)
      : getFullUrl(activeLanUrl, selectedRoute);

  useEffect(() => {
    let isMounted = true;
    generateQrCodeUrl(effectiveUrl).then((url) => {
      if (isMounted) setQrCodeDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [effectiveUrl, qrType, selectedRoute]);

  const runPingTest = async () => {
    setIsPinging(true);
    const res = await measureFirestorePing();
    setPingResult(res);
    setIsPinging(false);
  };

  useEffect(() => {
    runPingTest();
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  useEffect(() => {
    const deviceId = `dev-${Math.random().toString(36).substring(2, 9)}`;
    const currentDevice: NetworkDeviceInfo = {
      id: deviceId,
      name: user?.name ? `${user.name} (${user.role})` : 'Branch Workstation',
      role: user?.role || Role.STAFF,
      ipOrHost: isCloudHost ? 'Cloud Client' : `${currentHost}:${currentPort}`,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      deviceType: detectDeviceType(),
      lastSeen: Date.now(),
      isHost: !isCloudHost && (currentHost === 'localhost' || currentHost === '0.0.0.0'),
    };

    const cleanup = registerDevicePresence(currentDevice, (devices) => {
      setActiveDevices(devices);
    });

    return () => {
      cleanup();
    };
  }, [user, currentHost, currentPort, isCloudHost]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditOrgFilter !== 'ALL' && log.organizationId !== Number(auditOrgFilter)) {
        return false;
      }
      if (auditActionFilter !== 'ALL' && log.actionType !== auditActionFilter) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          log.summary.toLowerCase().includes(q) ||
          log.actorName.toLowerCase().includes(q) ||
          log.actionType.toLowerCase().includes(q) ||
          log.targetEntity.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, auditOrgFilter, auditActionFilter, auditSearch]);

  const handleCreateManualSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSnap(true);
    setGovernanceBanner(null);
    const label =
      snapshotLabel.trim() ||
      `${activeOrganization.name} Snapshot (${new Date().toLocaleTimeString()})`;
    const created = await createSnapshot(label);
    setIsCreatingSnap(false);
    if (created) {
      setSnapshotLabel('');
      setGovernanceBanner({
        type: 'success',
        text: `Created point-in-time snapshot "${created.label}" (${created.recordCounts.employees} employees, ${created.recordCounts.kpis} KPIs).`,
      });
    } else {
      setGovernanceBanner({
        type: 'error',
        text: 'Failed to create snapshot. Ensure you have Super Admin or Admin privileges.',
      });
    }
  };

  const handleRestorePointInTime = async (snapId: string, label: string) => {
    setRestoringSnapId(snapId);
    setGovernanceBanner(null);
    const ok = await restoreSnapshot(snapId);
    setRestoringSnapId(null);
    if (ok) {
      setGovernanceBanner({
        type: 'success',
        text: `Restored point-in-time snapshot "${label}" and created an automatic Pre-Restore safety backup.`,
      });
    } else {
      setGovernanceBanner({
        type: 'error',
        text: 'Could not restore snapshot.',
      });
    }
  };

  const handleBulkCsvOrJsonImport = async () => {
    setGovernanceBanner(null);
    const raw = bulkCsvText.trim();
    if (!raw) return;

    let parsedRecords: any[] = [];
    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const json = JSON.parse(raw);
        parsedRecords = Array.isArray(json) ? json : [json];
      } else {
        // Parse CSV lines
        const lines = raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          setGovernanceBanner({
            type: 'error',
            text: 'CSV input requires a header row and at least one data row.',
          });
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim());
        parsedRecords = lines.slice(1).map((line) => {
          const cols = line.split(',').map((c) => c.trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            obj[h] = cols[idx] ?? '';
          });
          return obj;
        });
      }

      const count = await bulkImportData(bulkEntityType, parsedRecords);
      setGovernanceBanner({
        type: 'success',
        text: `Successfully imported ${count} ${bulkEntityType} record(s) into ${activeOrganization.name} and logged audit entry.`,
      });
    } catch (err: any) {
      setGovernanceBanner({
        type: 'error',
        text: `Bulk import parse error: ${err.message}`,
      });
    }
  };

  const handleExecuteKpiEngine = async () => {
    setIsRunningEngine(true);
    setGovernanceBanner(null);
    const res = await runKpiEngineAudit(true);
    setIsRunningEngine(false);
    if (res) {
      setKpiEngineResult(res);
      setGovernanceBanner({
        type: 'success',
        text: `Server KPI & Backlog Engine completed: ${res.overallBranchAchievement}% branch achievement, ${res.detectedShortfallsCount} shortfall variance(s) audited, and ${res.autoGeneratedBacklogsCount} new backlog item(s) auto-generated.`,
      });
    }
  };

  const handleScheduleChange = async (
    patch: Partial<{
      enabled: boolean;
      intervalSeconds: number;
      autoSyncBacklogs: boolean;
      runOnMutation: boolean;
    }>
  ) => {
    setIsUpdatingSchedule(true);
    const updated = await updateKpiEngineSchedule(patch);
    setIsUpdatingSchedule(false);
    if (updated) {
      setGovernanceBanner({
        type: 'success',
        text: `Periodic KPI Engine scheduler updated (${
          updated.enabled ? `Active every ${updated.intervalSeconds}s` : 'Paused'
        }).`,
      });
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const downloadQrCode = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `performance-tracker-lan-qrcode-${qrType}.png`;
    link.click();
  };

  const handleExportData = async () => {
    try {
      const jsonStr = await exportBranchDatabaseSnapshot();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Performance_Tracker_Database_Snapshot_${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGovernanceBanner({ type: 'error', text: `Export error: ${err.message}` });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Reading and validating file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importBranchDatabaseSnapshot(text);
        if (res.success) {
          setImportStatus(`Success! ${res.message}`);
          refreshData();
        } else {
          setImportStatus(`Error: ${res.message}`);
        }
      } catch (err: any) {
        setImportStatus(`Failed: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const getAuditBadgeClasses = (action: AuditActionType | string) => {
    switch (action) {
      case 'AUTH_LOCKOUT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ACCOUNT_UNLOCK':
      case 'AUTH_LOGIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PASSWORD_RESET':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ROLE_CHANGE':
      case 'ORG_CHANGE':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SNAPSHOT_CREATE':
      case 'SNAPSHOT_RESTORE':
      case 'BULK_IMPORT':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Enterprise Backend & Real-Time Sync Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 text-xs font-mono font-bold mb-2 border border-sky-400/30">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {wsConnected
                ? 'EXPRESS API + WEBSOCKET + FIRESTORE TWO-WAY SYNC ACTIVE'
                : 'OFFLINE QUEUE ENGINE STANDBY'}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Backend Governance, Immutable Audit & Multi-Device Sync Hub
            </h1>
            <p className="text-slate-300 text-xs mt-1 max-w-3xl">
              Active Organization:{' '}
              <strong className="text-white">{activeOrganization.name}</strong> (
              {activeOrganization.sector}) · Cryptographic <code className="font-mono">scrypt</code>{' '}
              Authentication · Rate-Limited Lockout Protection · Point-in-Time Database Recovery
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {offlineQueue.length > 0 && (
              <button
                onClick={() => flushOfflineQueue()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Flush {offlineQueue.length} Queued Mutation(s)
              </button>
            )}
            <button
              onClick={handleExportData}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              Export Full JSON Backup
            </button>
            <button
              onClick={() => setShowPrintPoster(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Print Branch QR Poster
            </button>
          </div>
        </div>

        {/* Live Backend Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              WebSocket & Cloud Sync
            </span>
            <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
              {wsConnected ? 'CONNECTED (PORT 3000)' : 'LOCAL CACHE'}
            </span>
          </div>
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Immutable Audit Ledger
            </span>
            <span className="font-mono font-bold text-white text-sm mt-0.5 block">
              {auditLogs.length} Recorded Events
            </span>
          </div>
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Point-in-Time Snapshots
            </span>
            <span className="font-mono font-bold text-sky-300 text-sm mt-0.5 block">
              {snapshots.length} Recovery Points
            </span>
          </div>
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/70">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Connected Peers / Queue
            </span>
            <span className="font-mono font-bold text-amber-300 text-sm mt-0.5 block">
              {Math.max(connectedPeers.length, activeDevices.length, 1)} Peer(s) ·{' '}
              {offlineQueue.length} Queued
            </span>
          </div>
        </div>
      </div>

      {/* Console Navigation Bar */}
      <div className="bg-white rounded-xl p-1.5 border border-slate-200 flex flex-wrap gap-1.5 shadow-2xs">
        {[
          {
            id: 'governance-audit',
            label: `1. Immutable Audit Trail (${auditLogs.length})`,
          },
          {
            id: 'snapshots-import',
            label: `2. Point-in-Time Snapshots & Bulk CSV/JSON Import (${snapshots.length})`,
          },
          {
            id: 'kpi-engine',
            label: '3. Server-Side KPI & Shortfall Calculation Engine',
          },
          {
            id: 'lan-networking',
            label: '4. Multi-Device LAN & QR Workstation Setup',
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setConsoleView(tab.id as any)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              consoleView === tab.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {governanceBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            governanceBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{governanceBanner.text}</span>
          <button
            onClick={() => setGovernanceBanner(null)}
            className="text-slate-400 hover:text-slate-700 ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: IMMUTABLE AUDIT LOG LEDGER */}
      {/* =================================================================== */}
      {consoleView === 'governance-audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Immutable Backend Audit Log & Security Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracks every authentication event, account lockout, password reset, hierarchy role
                change, KPI update, and snapshot restore across organizations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={auditOrgFilter}
                onChange={(e) =>
                  setAuditOrgFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="ALL">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="ALL">All Action Types</option>
                <option value="AUTH_LOGIN">AUTH_LOGIN</option>
                <option value="AUTH_LOCKOUT">AUTH_LOCKOUT</option>
                <option value="ACCOUNT_UNLOCK">ACCOUNT_UNLOCK</option>
                <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                <option value="ROLE_CHANGE">ROLE_CHANGE</option>
                <option value="KPI_UPDATE">KPI_UPDATE</option>
                <option value="PLAN_UPDATE">PLAN_UPDATE</option>
                <option value="ORG_CHANGE">ORG_CHANGE</option>
                <option value="SNAPSHOT_CREATE">SNAPSHOT_CREATE</option>
                <option value="SNAPSHOT_RESTORE">SNAPSHOT_RESTORE</option>
                <option value="BULK_IMPORT">BULK_IMPORT</option>
                <option value="KPI_ENGINE_RUN">KPI_ENGINE_RUN</option>
              </select>

              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search actor, entity, summary..."
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-48"
              />

              <button
                onClick={() => refreshAuditLogs()}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Actor & Role</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Audit Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No matching audit log entries found.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const orgName =
                      organizations.find((o) => o.id === log.organizationId)?.name ||
                      `Org #${log.organizationId}`;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.timestamp.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {orgName}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{log.actorName}</span>
                          <span className="block text-[10px] text-slate-400">{log.actorRole}</span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded border font-mono font-bold text-[10px] ${getAuditBadgeClasses(
                              log.actionType
                            )}`}
                          >
                            {log.actionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {log.targetEntity} {log.targetId ? `(${log.targetId})` : ''}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{log.summary}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: POINT-IN-TIME SNAPSHOTS & BULK CSV/JSON IMPORT */}
      {/* =================================================================== */}
      {consoleView === 'snapshots-import' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Point-in-Time Snapshots */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Automated & Manual Point-in-Time Snapshots
                </h2>
                <p className="text-xs text-slate-500">
                  Server automatically captures scheduled snapshots every 30 minutes and prior to
                  any restore operation.
                </p>
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={handleCreateManualSnapshot} className="flex gap-2">
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Snapshot label (e.g., Pre-Q3 Audit Checkpoint)"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingSnap}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isCreatingSnap ? 'Creating...' : '+ Create Snapshot'}
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{snap.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          snap.triggerType === 'Pre-Restore'
                            ? 'bg-amber-100 text-amber-800'
                            : snap.triggerType === 'Manual'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {snap.triggerType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {snap.createdAt.replace('T', ' ').slice(0, 19)} · By {snap.createdBy} ·{' '}
                      {snap.recordCounts.employees} Employees · {snap.recordCounts.kpis} KPIs ·{' '}
                      {snap.recordCounts.plans} Plans
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleRestorePointInTime(snap.id, snap.label)}
                      disabled={restoringSnapId === snap.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {restoringSnapId === snap.id ? 'Restoring...' : 'Restore Point-in-Time'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right 5 Cols: Bulk CSV / JSON Database Import */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Bulk CSV / JSON Database Import Endpoint
              </h2>
              <p className="text-xs text-slate-500">
                Batch import employees (auto-hashed with <code className="font-mono">scrypt</code>)
                or KPI targets directly into <strong>{activeOrganization.name}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Target Collection:</label>
              <select
                value={bulkEntityType}
                onChange={(e) => {
                  const next = e.target.value as 'employees' | 'kpis';
                  setBulkEntityType(next);
                  if (next === 'employees') {
                    setBulkCsvText(
                      'name,username,role,positionTitle,department,email,pin\nAbebe Kebede,abebe.k,Officer,Quality Assurance Officer,Operations,abebe.k@org-tracker.com,4455\nTigist Alemu,tigist.a,Staff Member,Production Specialist,Manufacturing,tigist.a@org-tracker.com,5566'
                    );
                  } else {
                    setBulkCsvText(
                      'name,employeeId,objectiveId,kpiCategory,weight,target,actual\nExport Quality Compliance,2,1,Deposit,25,100,92\nClient Onboarding Speed,3,2,Customer Base,20,500,460'
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
              >
                <option value="employees">Employees & Credentials</option>
                <option value="kpis">Employee KPIs</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Paste CSV Rows (with header) or JSON Array:
              </label>
              <textarea
                rows={6}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <button
              onClick={handleBulkCsvOrJsonImport}
              disabled={!isAdmin}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              Execute Server Bulk Import into {activeOrganization.name}
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SERVER-SIDE AUTOMATED KPI & SHORTFALL ENGINE */}
      {/* =================================================================== */}
      {consoleView === 'kpi-engine' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Server-Side Automated KPI &amp; Backlog Calculation Engine
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Periodically reconciles monthly/quarterly entries into annual actuals, computes
                weighted Balanced Scorecard scores, and auto-generates recovery backlogs on the
                Express backend.
              </p>
            </div>
            <button
              onClick={handleExecuteKpiEngine}
              disabled={isRunningEngine}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isRunningEngine
                ? 'Running Calculation Engine...'
                : 'Run Server KPI & Backlog Engine Now'}
            </button>
          </div>

          {/* Periodic Scheduler Control Bar */}
          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    kpiEngineSchedule.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Automated Periodic Scheduler ({kpiEngineSchedule.enabled ? 'Active' : 'Paused'})
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  • Total Cycles Executed: {kpiEngineSchedule.totalRunsCount || 0}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono flex flex-wrap gap-4">
                <span>
                  Last Run:{' '}
                  {kpiEngineSchedule.lastRunAt
                    ? new Date(kpiEngineSchedule.lastRunAt).toLocaleTimeString()
                    : 'Pending'}
                </span>
                <span>
                  Next Scheduled Run:{' '}
                  {kpiEngineSchedule.enabled && kpiEngineSchedule.nextRunAt
                    ? new Date(kpiEngineSchedule.nextRunAt).toLocaleTimeString()
                    : 'Paused'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-300 font-semibold">Interval:</span>
                <select
                  value={kpiEngineSchedule.intervalSeconds}
                  disabled={isUpdatingSchedule}
                  onChange={(e) =>
                    handleScheduleChange({ intervalSeconds: Number(e.target.value) })
                  }
                  className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
                >
                  <option value={15} className="text-slate-900">
                    Every 15s
                  </option>
                  <option value={30} className="text-slate-900">
                    Every 30s
                  </option>
                  <option value={60} className="text-slate-900">
                    Every 60s
                  </option>
                  <option value={120} className="text-slate-900">
                    Every 2m
                  </option>
                  <option value={300} className="text-slate-900">
                    Every 5m
                  </option>
                </select>
              </label>

              <button
                type="button"
                disabled={isUpdatingSchedule}
                onClick={() =>
                  handleScheduleChange({
                    autoSyncBacklogs: !kpiEngineSchedule.autoSyncBacklogs,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  kpiEngineSchedule.autoSyncBacklogs
                    ? 'bg-indigo-600/30 border-indigo-400/40 text-indigo-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Auto-Generate Backlogs: {kpiEngineSchedule.autoSyncBacklogs ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                disabled={isUpdatingSchedule}
                onClick={() =>
                  handleScheduleChange({
                    runOnMutation: !kpiEngineSchedule.runOnMutation,
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  kpiEngineSchedule.runOnMutation
                    ? 'bg-sky-600/30 border-sky-400/40 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Trigger on Entry Mutation: {kpiEngineSchedule.runOnMutation ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                disabled={isUpdatingSchedule}
                onClick={() =>
                  handleScheduleChange({ enabled: !kpiEngineSchedule.enabled })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  kpiEngineSchedule.enabled
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {kpiEngineSchedule.enabled ? 'Pause Timer' : 'Resume Timer'}
              </button>
            </div>
          </div>

          {kpiEngineResult ? (
            <div className="space-y-6">
              {/* Top Aggregate Score Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Branch Achievement
                  </span>
                  <span className="block text-2xl font-black font-mono text-sky-700 mt-1">
                    {kpiEngineResult.overallBranchAchievement}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Trigger: {kpiEngineResult.triggerSource.toUpperCase()}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Avg Staff Weighted Score
                  </span>
                  <span className="block text-2xl font-black font-mono text-emerald-700 mt-1">
                    {kpiEngineResult.averageEmployeeWeightedScore} pts
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Across {kpiEngineResult.employeeScores.length} personnel
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Audited Shortfalls
                  </span>
                  <span className="block text-2xl font-black font-mono text-amber-600 mt-1">
                    {kpiEngineResult.detectedShortfallsCount} Variances
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Quarterly &amp; monthly deficits
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Auto-Synced Backlogs
                  </span>
                  <span className="block text-2xl font-black font-mono text-indigo-700 mt-1">
                    +{kpiEngineResult.autoGeneratedBacklogsCount} /{' '}
                    {kpiEngineResult.reconciledBacklogsCount}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    New Created / Cleared
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Net Primary Increment
                  </span>
                  <span className="block text-2xl font-black font-mono text-slate-900 mt-1">
                    {kpiEngineResult.netDepositIncrement.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Reconciled from period entries
                  </span>
                </div>
              </div>

              {/* Balanced Scorecard Perspective Breakdown */}
              {kpiEngineResult.perspectiveBreakdown &&
                kpiEngineResult.perspectiveBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                      Balanced Scorecard Perspective Aggregation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {kpiEngineResult.perspectiveBreakdown.map((p) => (
                        <div
                          key={p.perspective}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {p.perspective}
                            </span>
                            <span className="text-xs font-mono font-extrabold text-sky-700">
                              {p.achievement}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-2">
                            <div
                              className="bg-sky-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(p.achievement, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span>Score: {p.weightedScore}</span>
                            <span>Weight: {p.totalWeight}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Employee Weighted Score Ledger */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                  Employee Aggregate Performance Score Ledger
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Employee Name</th>
                        <th className="py-2.5 px-3">System Role</th>
                        <th className="py-2.5 px-3 text-right">Assigned KPIs</th>
                        <th className="py-2.5 px-3 text-right">Total Weight</th>
                        <th className="py-2.5 px-3 text-right">Active Backlogs</th>
                        <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                        <th className="py-2.5 px-3 text-right">Weighted BSC Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpiEngineResult.employeeScores.map((row) => (
                        <tr key={row.employeeId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {row.employeeName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{row.role}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{row.kpiCount}</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {row.totalWeight ?? 100}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {row.activeBacklogsCount ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-700">
                            {row.averageAchievement}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {row.weightedScore} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audited Shortfalls & Automated Backlog Recovery Ledger */}
              {kpiEngineResult.shortfallAlerts &&
                kpiEngineResult.shortfallAlerts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                      Audited Period Shortfalls &amp; Auto-Backlog Synchronization (
                      {kpiEngineResult.shortfallAlerts.length})
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2.5 px-3">KPI / Plan Metric</th>
                            <th className="py-2.5 px-3">Period &amp; Source</th>
                            <th className="py-2.5 px-3 text-right">Target</th>
                            <th className="py-2.5 px-3 text-right">Actual</th>
                            <th className="py-2.5 px-3 text-right">Shortfall Deficit</th>
                            <th className="py-2.5 px-3">Severity</th>
                            <th className="py-2.5 px-3">Backlog Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {kpiEngineResult.shortfallAlerts.map((alert) => (
                            <tr key={alert.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {alert.kpiName}
                                <span className="block text-[10px] font-normal text-slate-400">
                                  {alert.category}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600 font-mono">
                                {alert.periodName} ({alert.source})
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {alert.target.toLocaleString()} {alert.metricUnit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {alert.actual.toLocaleString()} {alert.metricUnit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                -{alert.deficit.toLocaleString()} {alert.metricUnit}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    alert.severity === 'High'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {alert.severity}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {alert.backlogGenerated ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                    Synced to Backlog
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                    Audited
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              Click <strong>Run Server KPI &amp; Backlog Engine Now</strong> above to execute the
              server-side calculation engine and record an immutable audit snapshot.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: MULTI-DEVICE LAN & QR WORKSTATION SETUP */}
      {/* =================================================================== */}
      {consoleView === 'lan-networking' && (
        <div className="space-y-6">
          {/* Real-time Connectivity Status Strip */}
          <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sync & Database Engine
                </div>
                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Express Server + WebSocket + Cloud Firestore + Offline IndexedDB</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Real-Time Sync Latency</div>
                <div className="text-sm font-bold font-mono text-slate-700">
                  {pingResult ? `${pingResult.latencyMs} ms` : 'Checking...'}
                </div>
              </div>

              <button
                onClick={runPingTest}
                disabled={isPinging}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {isPinging ? 'Testing...' : 'Test Sync Ping'}
              </button>
            </div>
          </div>

          {/* Primary Connection Cards & QR Code Generator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      1. Shared Cloud URL (Recommended)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Every workstation and mobile device in your organization can open this URL
                      instantly.
                    </p>
                  </div>
                  <button
                    onClick={() => setQrType('cloud')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      qrType === 'cloud'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    QR Selected
                  </button>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2 mt-4">
                  <span className="font-mono text-xs text-slate-700 truncate select-all">
                    {cloudUrl}
                  </span>
                  <button
                    onClick={() => handleCopy(cloudUrl, 'cloud')}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'cloud' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      2. Office Local LAN Host Server
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Host on a dedicated desktop PC or server using your local router IPv4 address.
                    </p>
                  </div>
                  <button
                    onClick={() => setQrType('lan')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      qrType === 'lan'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    QR Selected
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4">
                  <div className="sm:col-span-8">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Host Machine IPv4 Address:
                    </label>
                    <input
                      type="text"
                      value={lanIp}
                      onChange={(e) => setLanIp(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Port:
                    </label>
                    <input
                      type="text"
                      value={lanPort}
                      onChange={(e) => setLanPort(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2 mt-4">
                  <span className="font-mono text-xs text-indigo-700 font-bold truncate select-all">
                    {getFullUrl(activeLanUrl, selectedRoute)}
                  </span>
                  <button
                    onClick={() => handleCopy(getFullUrl(activeLanUrl, selectedRoute), 'lan')}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'lan' ? '✓ Copied' : 'Copy LAN Link'}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 text-center flex flex-col items-center">
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Instant Device QR Code
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      onClick={() => setQrType('cloud')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        qrType === 'cloud'
                          ? 'bg-white text-sky-700 shadow-xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Cloud
                    </button>
                    <button
                      onClick={() => setQrType('lan')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        qrType === 'lan'
                          ? 'bg-white text-indigo-700 shadow-xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Local LAN
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm my-1">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Branch LAN QR Code"
                      className="w-52 h-52 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 w-full">
                  <button
                    onClick={downloadQrCode}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Download QR Image
                  </button>
                  <button
                    onClick={() => setShowPrintPoster(true)}
                    className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Desk Poster View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Interactive Guide Tabs */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-6 pt-4">
              <div className="flex gap-2 overflow-x-auto pb-px">
                {[
                  { id: 'windows', label: '1. Windows Host PC Setup' },
                  { id: 'clients', label: '2. Client Workstations' },
                  { id: 'mobile', label: '3. Mobile & Tablet Setup' },
                  { id: 'airgap', label: '4. Air-Gapped / USB Snapshot Transfer' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
                      activeTab === tab.id
                        ? 'border-sky-600 text-sky-600 bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 text-xs text-slate-700">
              {activeTab === 'windows' && (
                <div className="space-y-3">
                  <p>
                    1. Run <code className="font-mono font-bold">ipconfig</code> in Command Prompt to
                    locate your IPv4 address.
                  </p>
                  <p>
                    2. Start the full-stack Express + WebSocket server with{' '}
                    <code className="font-mono font-bold">npm run start</code> on port 3000.
                  </p>
                </div>
              )}
              {activeTab === 'clients' && (
                <div className="space-y-2">
                  <p>
                    Open <code className="font-mono font-bold">{cloudUrl}</code> or{' '}
                    <code className="font-mono font-bold">{activeLanUrl}</code> in any browser and
                    sign in with your Username + Password or 4-digit PIN.
                  </p>
                </div>
              )}
              {activeTab === 'mobile' && (
                <div className="space-y-2">
                  <p>
                    Scan the QR code above with your mobile camera and tap{' '}
                    <strong>Add to Home Screen</strong> to install the PWA.
                  </p>
                </div>
              )}
              {activeTab === 'airgap' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-2">Export Branch Snapshot</h4>
                    <button
                      onClick={handleExportData}
                      className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
                    >
                      Download Database JSON
                    </button>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-2">Import Branch Snapshot</h4>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="w-full py-2 rounded-xl bg-sky-600 text-white font-bold cursor-pointer"
                    >
                      {isImporting ? 'Importing...' : 'Select Snapshot JSON File'}
                    </button>
                    {importStatus && <p className="mt-2 font-semibold">{importStatus}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Branch Desk Poster Modal */}
      {showPrintPoster && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <span className="text-sm font-bold text-slate-800">
                Organization Noticeboard Poster Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
                >
                  Print Poster Now
                </button>
                <button
                  onClick={() => setShowPrintPoster(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="text-center border-4 border-sky-800 rounded-2xl p-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {activeOrganization.name}
              </h2>
              <div className="text-xs font-bold text-sky-700 uppercase tracking-widest mt-0.5">
                {activeBranch.name} · Performance Tracker
              </div>

              <div className="my-6 flex flex-col items-center justify-center">
                <div className="p-3 bg-white border-2 border-slate-300 rounded-2xl shadow-md inline-block">
                  {qrCodeDataUrl && (
                    <img
                      src={qrCodeDataUrl}
                      alt="Branch Poster QR"
                      className="w-48 h-48 rounded-lg object-contain"
                    />
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 border border-slate-200 text-left space-y-1 mb-4">
                <div className="text-[11px] text-slate-500 font-semibold uppercase">
                  Direct Web Address:
                </div>
                <div className="font-mono text-xs font-bold text-sky-800 break-all">
                  {qrType === 'cloud' ? cloudUrl : activeLanUrl}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchNetworkPage;
