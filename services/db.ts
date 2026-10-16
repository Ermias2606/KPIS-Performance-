import { openDB, IDBPDatabase } from 'idb';
import {
  Employee,
  Branch,
  AnnualPlanObjective,
  Kpi,
  PeriodicPlanItem,
  BacklogPlanItem,
  EmployeePlanAssignment,
  KpiCategoryItem,
} from '../types';
import {
  EMPLOYEES,
  BRANCHES,
  ANNUAL_PLAN_2026,
  KPIS,
  PERIODIC_PLANS_2026,
  INITIAL_BACKLOG_PLANS,
  INITIAL_EMPLOYEE_ASSIGNMENTS,
  INITIAL_KPI_CATEGORIES,
} from '../constants';

const DB_NAME = 'RaituBSC-DB';
const DB_VERSION = 7;

const initDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('employees')) {
        db.createObjectStore('employees', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('branches')) {
        db.createObjectStore('branches', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('annualPlan')) {
        db.createObjectStore('annualPlan', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('kpis')) {
        const kpiStore = db.createObjectStore('kpis', { keyPath: 'id', autoIncrement: true });
        kpiStore.createIndex('byEmployee', 'employeeId');
      }
      if (!db.objectStoreNames.contains('plans')) {
        db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('backlogPlans')) {
        db.createObjectStore('backlogPlans', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('employeePlans')) {
        const epStore = db.createObjectStore('employeePlans', { keyPath: 'id', autoIncrement: true });
        epStore.createIndex('byEmployee', 'employeeId');
      }
      if (!db.objectStoreNames.contains('kpiCategories')) {
        db.createObjectStore('kpiCategories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('performanceSubmissions')) {
        db.createObjectStore('performanceSubmissions', { keyPath: 'id', autoIncrement: true });
      }
    },
  });

  // Ensure employees store only has Admin and Ermiyas Getachew
  const empTx = db.transaction('employees', 'readwrite');
  const empStore = empTx.objectStore('employees');
  await empStore.clear();
  for (const emp of EMPLOYEES) {
    await empStore.put(emp);
  }
  await empTx.done;

  // Refresh branches
  const brTx = db.transaction('branches', 'readwrite');
  const brStore = brTx.objectStore('branches');
  for (const br of BRANCHES) {
    const existing = await brStore.get(br.id);
    if (!existing) {
      await brStore.put(br);
    } else {
      await brStore.put({
        ...br,
        ...existing,
        juneClosingDepositBalance: existing.juneClosingDepositBalance ?? br.juneClosingDepositBalance,
        fiscalYear: existing.fiscalYear ?? br.fiscalYear,
        code: existing.code ?? br.code,
      });
    }
  }
  await brTx.done;

  // Refresh annualPlan
  const apTx = db.transaction('annualPlan', 'readwrite');
  const apStore = apTx.objectStore('annualPlan');
  await apStore.clear();
  for (const ap of ANNUAL_PLAN_2026) {
    await apStore.put(ap);
  }
  await apTx.done;

  // Refresh KPIs for Ermiyas
  const kpiTx = db.transaction('kpis', 'readwrite');
  const kpiStore = kpiTx.objectStore('kpis');
  await kpiStore.clear();
  for (const kpi of KPIS) {
    await kpiStore.put(kpi);
  }
  await kpiTx.done;

  // Seed plans store
  const pTx = db.transaction('plans', 'readwrite');
  const pStore = pTx.objectStore('plans');
  const pCount = await pStore.count();
  if (pCount === 0) {
    for (const item of PERIODIC_PLANS_2026) {
      await pStore.put(item);
    }
  }
  await pTx.done;

  // Seed backlogPlans store
  const bTx = db.transaction('backlogPlans', 'readwrite');
  const bStore = bTx.objectStore('backlogPlans');
  await bStore.clear();
  for (const item of INITIAL_BACKLOG_PLANS) {
    await bStore.put(item);
  }
  await bTx.done;

  // Seed employeePlans store
  const epTx = db.transaction('employeePlans', 'readwrite');
  const epStore = epTx.objectStore('employeePlans');
  const epCount = await epStore.count();
  if (epCount === 0) {
    for (const item of INITIAL_EMPLOYEE_ASSIGNMENTS) {
      await epStore.put(item);
    }
  }
  await epTx.done;

  // Seed kpiCategories store
  const catTx = db.transaction('kpiCategories', 'readwrite');
  const catStore = catTx.objectStore('kpiCategories');
  const catCount = await catStore.count();
  if (catCount === 0) {
    for (const cat of INITIAL_KPI_CATEGORIES) {
      await catStore.put(cat);
    }
  }
  await catTx.done;

  return db;
};

export const getDb = (() => {
  let dbInstance: Promise<IDBPDatabase> | null = null;
  return () => {
    if (!dbInstance) {
      dbInstance = initDB();
    }
    return dbInstance;
  };
})();

// Generic CRUD operations
export const getAll = async <T,>(storeName: string): Promise<T[]> => {
  const db = await getDb();
  return db.getAll(storeName);
};

export const getById = async <T,>(storeName: string, id: number | string): Promise<T | undefined> => {
  const db = await getDb();
  return db.get(storeName, id);
};

export const add = async <T,>(storeName: string, item: Omit<T, 'id'> | T): Promise<number | string> => {
  const db = await getDb();
  const key = await db.add(storeName, item);
  return key as number | string;
};

export const update = async <T extends { id: number | string },>(storeName: string, item: T): Promise<number | string> => {
  const db = await getDb();
  const key = await db.put(storeName, item);
  return key as number | string;
};

export const deleteById = async (storeName: string, id: number | string): Promise<void> => {
  const db = await getDb();
  return db.delete(storeName, id);
};

export const getKpisByEmployeeId = async (employeeId: number): Promise<Kpi[]> => {
  const db = await getDb();
  return db.getAllFromIndex('kpis', 'byEmployee', employeeId);
};

export const getEmployeePlansByEmployeeId = async (employeeId: number): Promise<EmployeePlanAssignment[]> => {
  const db = await getDb();
  return db.getAllFromIndex('employeePlans', 'byEmployee', employeeId);
};
