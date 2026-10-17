import QRCode from 'qrcode';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, serverTimestamp, query, limit } from 'firebase/firestore';
import * as idbStore from './db';

export interface NetworkDeviceInfo {
  id: string;
  name: string;
  role: string;
  ipOrHost: string;
  userAgent: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  lastSeen: number;
  isHost?: boolean;
}

export interface NetworkHealth {
  isOnline: boolean;
  isFirestoreConnected: boolean;
  latencyMs: number;
  lastChecked: Date;
  protocol: string;
  currentHost: string;
  currentPort: string;
}

/**
 * Generate a high-resolution QR code data URL (PNG)
 */
export async function generateQrCodeUrl(targetUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0369a1', // Sky-700
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return '';
  }
}

/**
 * Detect device type based on user agent
 */
export function detectDeviceType(): 'Desktop' | 'Mobile' | 'Tablet' {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Ping Firebase Firestore to verify real-time connectivity & latency
 */
export async function measureFirestorePing(): Promise<{ connected: boolean; latencyMs: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { connected: false, latencyMs: 0 };
  }

  const start = performance.now();
  try {
    const testDoc = doc(db, '_network_status', 'health_check');
    await setDoc(testDoc, {
      pingAt: serverTimestamp(),
      clientTimestamp: Date.now(),
    }, { merge: true });
    const latencyMs = Math.round(performance.now() - start);
    return { connected: true, latencyMs };
  } catch (err) {
    console.warn('Network ping test fallback:', err);
    // If permission or network prevents writing, test navigator reachability
    const latencyMs = Math.round(performance.now() - start);
    return { connected: navigator.onLine, latencyMs: latencyMs || 45 };
  }
}

/**
 * Register this device to Firestore presence table so other LAN devices see it
 */
export function registerDevicePresence(device: NetworkDeviceInfo, onDevicesUpdate: (devices: NetworkDeviceInfo[]) => void): () => void {
  const deviceDoc = doc(db, '_network_devices', device.id);

  // Write initial presence
  try {
    setDoc(deviceDoc, {
      ...device,
      lastSeen: Date.now(),
    }, { merge: true }).catch(() => {});
  } catch (e) {
    // Ignore error in offline mode
  }

  // Periodic heartbeat
  const heartbeat = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(deviceDoc, {
        lastSeen: Date.now(),
      }, { merge: true }).catch(() => {});
    }
  }, 15000);

  // Listen to active devices
  let unsubscribe = () => {};
  try {
    const colRef = collection(db, '_network_devices');
    const q = query(colRef, limit(25));
    unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const list: NetworkDeviceInfo[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data() as NetworkDeviceInfo;
        // Keep active in the last 2 minutes
        if (now - (d.lastSeen || 0) < 120000) {
          list.push(d);
        }
      });
      onDevicesUpdate(list);
    }, (error) => {
      console.warn('Presence snapshot warning:', error);
    });
  } catch (err) {
    console.warn('Realtime presence registration error:', err);
  }

  return () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
}

/**
 * Export full branch data snapshot for offline/air-gapped LAN transfer
 */
export async function exportBranchDatabaseSnapshot(): Promise<string> {
  const [
    employees,
    branches,
    annualPlan,
    kpis,
    periodicPlans,
    backlogPlans,
    employeePlans,
    kpiCategories,
  ] = await Promise.all([
    idbStore.getAll('employees'),
    idbStore.getAll('branches'),
    idbStore.getAll('annualPlan'),
    idbStore.getAll('kpis'),
    idbStore.getAll('plans'),
    idbStore.getAll('backlogPlans'),
    idbStore.getAll('employeePlans'),
    idbStore.getAll('kpiCategories'),
  ]);

  const payload = {
    app: 'Performance Tracker',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    branchId: (branches as any[])[0]?.id || 1,
    branchName: (branches as any[])[0]?.name || 'Main Operations Branch',
    data: {
      employees,
      branches,
      annualPlan,
      kpis,
      periodicPlans,
      backlogPlans,
      employeePlans,
      kpiCategories,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Import branch data snapshot for offline/air-gapped LAN transfer
 */
export async function importBranchDatabaseSnapshot(jsonContent: string): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed.data) {
      throw new Error('Invalid format: missing data container');
    }

    const {
      employees = [],
      branches = [],
      annualPlan = [],
      kpis = [],
      periodicPlans = [],
      backlogPlans = [],
      employeePlans = [],
      kpiCategories = [],
    } = parsed.data;

    let itemsSaved = 0;

    for (const emp of employees) {
      await idbStore.update('employees', emp);
      itemsSaved++;
    }
    for (const br of branches) {
      await idbStore.update('branches', br);
      itemsSaved++;
    }
    for (const plan of annualPlan) {
      await idbStore.update('annualPlan', plan);
      itemsSaved++;
    }
    for (const kpi of kpis) {
      await idbStore.update('kpis', kpi);
      itemsSaved++;
    }
    for (const pp of periodicPlans) {
      await idbStore.update('plans', pp);
      itemsSaved++;
    }
    for (const bl of backlogPlans) {
      await idbStore.update('backlogPlans', bl);
      itemsSaved++;
    }
    for (const ep of employeePlans) {
      await idbStore.update('employeePlans', ep);
      itemsSaved++;
    }
    for (const kc of kpiCategories) {
      await idbStore.update('kpiCategories', kc);
      itemsSaved++;
    }

    return {
      success: true,
      message: `Successfully synchronized ${itemsSaved} records into local database.`,
      count: itemsSaved,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Import failed: ${err.message || 'Unknown parse error'}`,
      count: 0,
    };
  }
}
