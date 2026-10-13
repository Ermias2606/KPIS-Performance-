import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { Role } from '../types';
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
  const { branches, activeBranchId, refreshData } = useContext(DataContext);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0] || {
    id: 1,
    name: 'Raitu Branch',
    code: 'RAI-001',
    address: 'Main St., Raitu',
  };

  // Detected origin info
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const currentPort = typeof window !== 'undefined' && window.location.port ? window.location.port : '3000';
  const isCloudHost = currentHost.includes('run.app') || currentHost.includes('web.app') || currentHost.includes('firebaseapp');

  // State
  const [lanIp, setLanIp] = useState<string>(() => {
    return isCloudHost ? '192.168.1.100' : (currentHost === 'localhost' || currentHost === '127.0.0.1' ? '192.168.1.100' : currentHost);
  });
  const [lanPort, setLanPort] = useState<string>(currentPort || '3000');
  const [selectedRoute, setSelectedRoute] = useState<'root' | 'login' | 'dashboard'>('root');
  const [activeTab, setActiveTab] = useState<'windows' | 'clients' | 'mobile' | 'airgap'>('windows');

  // QR Code State
  const [qrType, setQrType] = useState<'cloud' | 'lan'>('cloud');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Network & Sync Health
  const [pingResult, setPingResult] = useState<{ connected: boolean; latencyMs: number } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [activeDevices, setActiveDevices] = useState<NetworkDeviceInfo[]>([]);
  const [showPrintPoster, setShowPrintPoster] = useState(false);

  // Air gap backup
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculated URLs
  const cloudUrl = 'https://ais-pre-7kx3nyozctfeisf3f6er4c-355420735883.europe-west2.run.app';
  
  const getFullUrl = (base: string, route: 'root' | 'login' | 'dashboard') => {
    const routeHash = route === 'login' ? '#/login' : route === 'dashboard' ? '#/dashboard' : '#/';
    // Clean trailing slashes
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/${routeHash}`;
  };

  const activeLanUrl = `http://${lanIp.trim()}:${lanPort.trim()}`;
  const effectiveUrl = qrType === 'cloud' 
    ? getFullUrl(cloudUrl, selectedRoute)
    : getFullUrl(activeLanUrl, selectedRoute);

  // Generate QR Code whenever URL changes
  useEffect(() => {
    let isMounted = true;
    generateQrCodeUrl(effectiveUrl).then((url) => {
      if (isMounted) setQrCodeDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [effectiveUrl, qrType, selectedRoute]);

  // Ping Firestore test on mount
  const runPingTest = async () => {
    setIsPinging(true);
    const res = await measureFirestorePing();
    setPingResult(res);
    setIsPinging(false);
  };

  useEffect(() => {
    runPingTest();
  }, []);

  // Register device presence
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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const downloadQrCode = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `raitu-branch-lan-qrcode-${qrType}.png`;
    link.click();
  };

  const handleExportData = async () => {
    try {
      const jsonStr = await exportBranchDatabaseSnapshot();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Raitu_Branch_Database_Snapshot_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <svg className="w-80 h-80 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/30 text-sky-200 text-xs font-semibold mb-2 border border-sky-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Multi-Device LAN & Cloud Connectivity Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {activeBranch.name} Device Networking
            </h1>
            <p className="text-sky-100 text-sm mt-1 max-w-2xl">
              Connect tellers, customer service representatives, managers, and mobile branch staff across computers, laptops, tablets, and phones on your office LAN network.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPrintPoster(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-sky-900 hover:bg-sky-50 font-bold text-xs shadow-md transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Branch Poster
            </button>
            <button
              onClick={handleExportData}
              title="Download full database snapshot for air-gapped backup"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600/60 hover:bg-sky-600 border border-sky-400/30 text-white font-semibold text-xs transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Air-Gap Backup (JSON)
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Connectivity Status Strip */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sync & Database Engine</div>
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Google Cloud Firestore + Offline IndexedDB</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Peer Sync Active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">Real-Time Sync Latency</div>
            <div className="text-sm font-bold text-slate-700">
              {pingResult ? (
                <span className={pingResult.latencyMs < 100 ? 'text-emerald-600' : 'text-amber-600'}>
                  {pingResult.latencyMs} ms
                </span>
              ) : (
                'Checking...'
              )}
            </div>
          </div>

          <button
            onClick={runPingTest}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isPinging ? 'Testing...' : 'Test Sync Ping'}
          </button>
        </div>
      </div>

      {/* Primary Connection Cards & QR Code Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connection Options */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Cloud Shared URL */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border-2 border-sky-100 hover:border-sky-300 transition">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">1. Branch Cloud URL (Recommended)</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                      Zero Configuration
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every computer and device in your branch can open this URL instantly without hosting a local server.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQrType('cloud')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  qrType === 'cloud' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                QR Selected
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2 mt-4">
              <span className="font-mono text-xs text-slate-700 truncate select-all">
                {cloudUrl}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(cloudUrl, 'cloud')}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'cloud' ? (
                    <span className="text-emerald-600 font-bold">✓ Copied</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                <a
                  href={cloudUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white transition flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                ✓ Full real-time synchronization
              </span>
              <span className="flex items-center gap-1">
                ✓ Works on all computers & mobile phones
              </span>
              <span className="flex items-center gap-1">
                ✓ Auto-caches for offline use
              </span>
            </div>
          </div>

          {/* Card 2: Local Office LAN Host */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border-2 border-slate-200 hover:border-indigo-300 transition">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">2. Branch Office Local LAN Server</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      Local Subnet
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Host on a dedicated branch desktop PC or server using your local router/switch IP address.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQrType('lan')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  qrType === 'lan' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                QR Selected
              </button>
            </div>

            {/* IP and Port Configurator */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Host Machine IPv4 Address (e.g. from ipconfig):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={lanIp}
                    onChange={(e) => setLanIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Port:
                </label>
                <input
                  type="text"
                  value={lanPort}
                  onChange={(e) => setLanPort(e.target.value)}
                  placeholder="3000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-medium">Quick IP presets:</span>
              {['192.168.1.50', '192.168.1.100', '192.168.0.100', '10.0.0.50', 'localhost'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setLanIp(preset)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Generated LAN URL bar */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2 mt-4">
              <span className="font-mono text-xs text-indigo-700 font-bold truncate select-all">
                {getFullUrl(activeLanUrl, selectedRoute)}
              </span>
              <button
                onClick={() => handleCopy(getFullUrl(activeLanUrl, selectedRoute), 'lan')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'lan' ? (
                  <span className="text-emerald-600 font-bold">✓ Copied</span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy LAN Link
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Note: In <code className="font-mono font-bold">vite.config.ts</code> the host is set to <code className="font-mono font-bold">0.0.0.0</code>, allowing any workstation in your office subnet to connect directly.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Scannable QR Code & Quick Action Box */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 text-center flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Instant Device QR Code
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setQrType('cloud')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    qrType === 'cloud' ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Cloud
                </button>
                <button
                  onClick={() => setQrType('lan')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    qrType === 'lan' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Local LAN
                </button>
              </div>
            </div>

            {/* Target Destination Switcher */}
            <div className="w-full flex items-center justify-center gap-1.5 mb-4 text-xs">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Open at:</span>
              <button
                onClick={() => setSelectedRoute('root')}
                className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedRoute === 'root' ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Portal Home
              </button>
              <button
                onClick={() => setSelectedRoute('login')}
                className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedRoute === 'login' ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                PIN Login
              </button>
              <button
                onClick={() => setSelectedRoute('dashboard')}
                className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedRoute === 'dashboard' ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </button>
            </div>

            {/* The QR Code Canvas/Image */}
            <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm my-1">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Branch LAN QR Code"
                  className="w-56 h-56 rounded-xl object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium mt-3 max-w-xs">
              Branch staff can scan this with any iPhone, Android phone, or tablet camera to open the application instantly.
            </p>

            <div className="mt-4 flex items-center gap-2 w-full">
              <button
                onClick={downloadQrCode}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download QR Image
              </button>
              <button
                onClick={() => setShowPrintPoster(true)}
                className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Desk Poster View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Interactive Guide Tabs */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Branch IT & Manager Deployment Guide
            </h2>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Step-by-step instructions for connecting multiple workstations
            </span>
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto pb-px">
            {[
              { id: 'windows', label: '1. Windows Host PC Setup' },
              { id: 'clients', label: '2. Client Desktops (Tellers/Back Office)' },
              { id: 'mobile', label: '3. Mobile & Tablet Setup' },
              { id: 'airgap', label: '4. Air-Gapped / No-Internet Backup' },
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

        <div className="p-6">
          {activeTab === 'windows' && (
            <div className="space-y-4 max-w-4xl text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Find the Host Machine IP Address</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    On the desktop computer that will host the app, open Command Prompt (<kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-300">cmd</kbd>) and run:
                  </p>
                  <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-xl mt-2 flex items-center justify-between">
                    <span>ipconfig</span>
                    <button
                      onClick={() => handleCopy('ipconfig', 'cmd-ip')}
                      className="text-xs text-sky-300 hover:text-white"
                    >
                      {copiedKey === 'cmd-ip' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Look for <strong>IPv4 Address</strong> (e.g., <code className="font-mono text-sky-600">192.168.1.100</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Allow Inbound Traffic on Port 3000 in Windows Firewall</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Open PowerShell as Administrator and run this command once to let other computers reach the server:
                  </p>
                  <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-xl mt-2 flex items-center justify-between overflow-x-auto">
                    <span className="truncate pr-2">
                      netsh advfirewall firewall add rule name="Raitu_Branch_BSC" dir=in action=allow protocol=TCP localport=3000
                    </span>
                    <button
                      onClick={() => handleCopy('netsh advfirewall firewall add rule name="Raitu_Branch_BSC" dir=in action=allow protocol=TCP localport=3000', 'cmd-fw')}
                      className="text-xs text-sky-300 hover:text-white shrink-0"
                    >
                      {copiedKey === 'cmd-fw' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Start the Server with LAN Hosting</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Run the pre-configured production server command:
                  </p>
                  <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-xl mt-2 flex items-center justify-between">
                    <span>npm run serve</span>
                    <button
                      onClick={() => handleCopy('npm run serve', 'cmd-run')}
                      className="text-xs text-sky-300 hover:text-white"
                    >
                      {copiedKey === 'cmd-run' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium mt-1">
                    ✓ The application will bind to <code className="font-mono">0.0.0.0:3000</code> and listen to all branch network requests.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-4 max-w-4xl text-sm text-slate-700">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                <h4 className="font-bold text-sky-900 mb-1">Zero-Installation Client Access</h4>
                <p className="text-xs text-sky-800">
                  Staff computers do <strong>not</strong> need Node.js, Python, or any software installed. They just need a web browser (Google Chrome, Microsoft Edge, or Firefox) connected to the branch LAN network.
                </p>
              </div>

              <ul className="space-y-3 mt-4 text-xs">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</span>
                  <div>
                    <strong>Step 1:</strong> Open Chrome or Edge on any teller or loan officer desk.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</span>
                  <div>
                    <strong>Step 2:</strong> In the URL address bar, type either:
                    <div className="mt-1 font-mono text-slate-900 bg-slate-100 p-2 rounded-lg border border-slate-200">
                      {cloudUrl} <span className="text-slate-400">(Cloud URL)</span>
                      <br />
                      or
                      <br />
                      {activeLanUrl} <span className="text-slate-400">(Local LAN URL)</span>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</span>
                  <div>
                    <strong>Step 3: Staff Login:</strong> Each employee logs in with their designated 4-digit PIN (e.g. Ermiyas Getachew PIN: <code className="font-bold font-mono">1002</code>, Branch Manager: <code className="font-bold font-mono">1001</code>).
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</span>
                  <div>
                    <strong>Step 4: Desktop App Shortcut:</strong> Click the "Install App" button in the top right header to pin the Raitu BSC Tracker directly to the Windows Taskbar or Desktop!
                  </div>
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'mobile' && (
            <div className="space-y-4 max-w-4xl text-sm text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Mobile Phone Camera Scan
                  </h4>
                  <p className="text-xs text-slate-500 mt-2">
                    1. Connect the smartphone to the branch office Wi-Fi network.
                    <br />
                    2. Open the standard Camera app and point it at the on-screen QR Code.
                    <br />
                    3. Tap the yellow/blue pop-up link to open Raitu BSC Tracker.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Add to Mobile Home Screen (PWA)
                  </h4>
                  <p className="text-xs text-slate-500 mt-2">
                    On Safari (iOS): Tap <strong>Share</strong> &gt; <strong>Add to Home Screen</strong>.
                    <br />
                    On Chrome (Android): Tap the three dots menu &gt; <strong>Install App</strong>.
                    <br />
                    The app will run full screen like a native banking enterprise application!
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'airgap' && (
            <div className="space-y-4 max-w-4xl text-sm text-slate-700">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <strong>Air-Gapped / Isolated Branch Office Support:</strong>
                <p className="mt-1 text-amber-800">
                  If your branch office has an internet blackout or operates in a completely isolated LAN with no external connectivity, you can still sync scorecards and plan targets between computers using local snapshot transfers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="font-bold text-slate-900 mb-1">Export Branch Snapshot</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Exports all employees, targets, actuals, KPIs, and deposit metrics into an encrypted JSON file.
                  </p>
                  <button
                    onClick={handleExportData}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Database JSON
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="font-bold text-slate-900 mb-1">Import Branch Snapshot</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Loads and syncs database snapshot from another branch computer or USB flash drive.
                  </p>
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
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    {isImporting ? 'Importing Data...' : 'Select Snapshot File to Import'}
                  </button>

                  {importStatus && (
                    <div className="mt-2 text-xs font-semibold text-slate-700 bg-slate-100 p-2 rounded-lg">
                      {importStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active LAN Devices Presence Table */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Active Branch Workstations & Connected Devices
            </h3>
            <p className="text-xs text-slate-500">
              Real-time peer presence across the branch network
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            {activeDevices.length || 1} Connected Now
          </span>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {activeDevices.length > 0 ? (
            activeDevices.map((dev) => (
              <div key={dev.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                    {dev.deviceType === 'Mobile' ? (
                      <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : dev.deviceType === 'Tablet' ? (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>{dev.name}</span>
                      {dev.isHost && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          HOST PC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Endpoint: {dev.ipOrHost} • {dev.deviceType}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-emerald-700">Online & Synced</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800">
                  {user?.name || 'Current Workstation'} ({detectDeviceType()})
                </span>
                <span className="font-mono text-slate-400">({currentHost}:{currentPort})</span>
              </div>
              <span className="text-emerald-600 font-bold">Active Station</span>
            </div>
          )}
        </div>
      </div>

      {/* Printable Branch Desk Poster Modal */}
      {showPrintPoster && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 relative print:p-0 print:shadow-none print:max-w-none">
            {/* Modal Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
              <span className="text-sm font-bold text-slate-800">Branch Noticeboard Poster Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Poster Now
                </button>
                <button
                  onClick={() => setShowPrintPoster(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Poster Content (Print friendly) */}
            <div className="text-center border-4 border-sky-800 rounded-2xl p-6 bg-gradient-to-b from-white to-sky-50/40">
              <div className="inline-block p-3 rounded-2xl bg-sky-800 text-white mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3m6-6h3m-21 0h3m12 0a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {activeBranch.name}
              </h2>
              <div className="text-xs font-bold text-sky-700 uppercase tracking-widest mt-0.5">
                Balanced Scorecard Performance Tracker
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
                <span className="text-xs font-bold text-slate-800 mt-2">
                  Scan to Connect Phone or Tablet
                </span>
              </div>

              <div className="bg-white rounded-xl p-3 border border-slate-200 text-left space-y-2 mb-4">
                <div className="text-[11px] text-slate-500 font-semibold uppercase">
                  Direct Web Address for Workstations:
                </div>
                <div className="font-mono text-xs font-bold text-sky-800 break-all select-all">
                  {qrType === 'cloud' ? cloudUrl : activeLanUrl}
                </div>
              </div>

              <div className="text-left bg-sky-100/60 rounded-xl p-3 text-xs text-sky-950 space-y-1">
                <div className="font-bold text-sky-900">How to Log In:</div>
                <div>1. Connect your device to Branch Office Wi-Fi / LAN.</div>
                <div>2. Scan QR or type URL above in Google Chrome / Edge.</div>
                <div>3. Enter your designated 4-digit Staff PIN.</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400">
                Official Raitu Branch Performance Management System • Fiscal Year 2026
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchNetworkPage;
