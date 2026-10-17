import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Employee, Role, SystemProviderConfig, isAdminRole } from '../types';
import { EMPLOYEES, DEFAULT_SYSTEM_PROVIDER_CONFIG } from '../constants';
import { getAll, add, update } from '../services/db';
import {
  auth,
  googleProvider,
  testFirestoreConnection,
} from '../services/firebase';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { saveDocumentToFirestore } from '../services/firestoreSync';
import {
  apiLogin,
  apiUnlockAccount,
  apiAdminResetPassword,
  apiChangeOwnPassword,
  apiRequestEmailRecovery,
  apiCompleteEmailRecovery,
  apiSystemProviderLogin,
  apiUpdateSystemProviderCredentials,
  pushMutationToServerOrQueue,
  setStoredAuthToken,
} from '../services/backendApi';

interface AuthContextType {
  user: Employee | null;
  users: Employee[];
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  isGoogleLoading: boolean;
  isOnline: boolean;
  login: (pin: string) => Employee | null;
  loginWithCredentials: (
    identifier: string,
    secret: string
  ) => Promise<{
    user: Employee | null;
    error?: string;
    lockedUntil?: string;
    failedLoginAttempts?: number;
  }>;
  loginWithGoogle: () => Promise<Employee | null>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<Employee[]>;
  switchUser: (employeeId: number) => void;
  unlockUserAccount: (targetEmployeeId: number) => Promise<boolean>;
  adminResetUserPassword: (
    targetEmployeeId: number,
    newPassword: string,
    newPin?: string,
    mustChange?: boolean
  ) => Promise<boolean>;
  changeOwnPassword: (
    currentSecret: string,
    newPassword: string,
    newEmail?: string,
    newUsername?: string
  ) => Promise<{ success: boolean; message: string }>;
  requestPasswordRecoveryByEmail: (
    email: string
  ) => Promise<{
    success: boolean;
    verificationCode?: string;
    employeeName?: string;
    username?: string;
    message: string;
  }>;
  completePasswordRecoveryByEmail: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<{ success: boolean; user?: Employee; message: string }>;
  isSystemOwner: boolean;
  systemProviderConfig: SystemProviderConfig;
  loginAsSystemOwner: (
    passkeyOrPin: string
  ) => Promise<{ success: boolean; error?: string }>;
  logoutSystemOwner: () => void;
  updateSystemOwnerCredentials: (params: {
    currentSecret?: string;
    newMasterPasskey?: string;
    newMasterPin?: string;
    serviceTitle?: string;
    ownerName?: string;
    ownerEmail?: string;
  }) => Promise<{ success: boolean; message: string }>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const deriveDefaultUsername = (emp: Employee): string => {
  if (emp.username && emp.username.trim()) return emp.username.trim().toLowerCase();
  if (emp.id === 1) return 'superadmin';
  if (emp.email && emp.email.includes('@')) {
    return emp.email.split('@')[0].toLowerCase();
  }
  const parts = emp.name.trim().toLowerCase().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1].charAt(0)}`;
  }
  return parts[0] || `user${emp.id}`;
};

const dedupeEmployees = (list: Employee[]): Employee[] => {
  const byId = new Map<number, Employee>();
  const seenEmails = new Set<string>();
  for (const emp of list) {
    if (!emp || typeof emp.id !== 'number') continue;
    const emailKey = emp.email?.trim().toLowerCase();
    // If another record with a different ID already claimed this email, skip the duplicate
    if (emailKey && seenEmails.has(emailKey) && !byId.has(emp.id)) {
      continue;
    }
    byId.set(emp.id, emp);
    if (emailKey) seenEmails.add(emailKey);
  }
  return Array.from(byId.values());
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [recoveryTokens, setRecoveryTokens] = useState<
    Record<string, { code: string; employeeId: number; expiresAt: number }>
  >({});
  const [isSystemOwner, setIsSystemOwner] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('pt_system_owner_active') === 'true';
    } catch {
      return false;
    }
  });
  const [systemProviderConfig, setSystemProviderConfig] = useState<SystemProviderConfig>(() => {
    try {
      const saved = localStorage.getItem('pt_system_provider_config');
      if (saved) return { ...DEFAULT_SYSTEM_PROVIDER_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return { ...DEFAULT_SYSTEM_PROVIDER_CONFIG };
  });
  const googleSyncLockRef = useRef<Promise<Employee | null> | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchUsers = useCallback(async (): Promise<Employee[]> => {
    try {
      let allUsers = await getAll<Employee>('employees');

      // Also sync with backend server state if online so lockouts & hashes are up to date
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/state');
          if (res.ok) {
            const serverState = await res.json();
            if (serverState.systemProviderConfig) {
              setSystemProviderConfig((prev) => {
                const merged = { ...prev, ...serverState.systemProviderConfig };
                try {
                  localStorage.setItem('pt_system_provider_config', JSON.stringify(merged));
                } catch {
                  // ignore
                }
                return merged;
              });
            }
            if (Array.isArray(serverState.employees) && serverState.employees.length > 0) {
              for (const sEmp of serverState.employees) {
                await update('employees', sEmp).catch(() => {});
              }
              allUsers = await getAll<Employee>('employees');
            }
          }
        } catch {
          // Offline fallback
        }
      }

      let updatedAny = false;
      const normalizedUsers: Employee[] = [];

      for (const u of allUsers) {
        const seedMatch = EMPLOYEES.find((s) => s.id === u.id);
        const derivedUsername = u.username || seedMatch?.username || deriveDefaultUsername(u);
        const derivedPassword = u.password || seedMatch?.password || 'Password@123';
        const derivedCode =
          u.employeeCode || seedMatch?.employeeCode || `EMP-${String(u.id).padStart(3, '0')}`;
        const derivedRole =
          u.id === 1 && u.role === Role.ADMIN
            ? Role.SUPER_ADMIN
            : u.id === 2 && u.role === Role.STAFF && !u.username
            ? Role.OFFICER
            : u.role;

        if (
          !u.username ||
          !u.password ||
          !u.employeeCode ||
          derivedRole !== u.role
        ) {
          const enriched: Employee = {
            ...(seedMatch || {}),
            ...u,
            role: derivedRole,
            username: derivedUsername,
            password: derivedPassword,
            employeeCode: derivedCode,
            email: u.email || seedMatch?.email || `${derivedUsername}@org-tracker.com`,
          };
          await update('employees', enriched).catch(() => {});
          normalizedUsers.push(enriched);
          updatedAny = true;
        } else {
          normalizedUsers.push(u);
        }
      }

      const seedAdminHq = EMPLOYEES.find((s) => s.id === 5);
      if (seedAdminHq && !normalizedUsers.some((u) => u.id === 5)) {
        try {
          await add('employees', seedAdminHq);
          normalizedUsers.push(seedAdminHq);
          updatedAny = true;
        } catch {
          // ignore if already present
        }
      }

      const rawFinalUsers = updatedAny ? await getAll<Employee>('employees') : normalizedUsers;
      const finalUsers = dedupeEmployees(rawFinalUsers);
      setUsers(finalUsers);
      return finalUsers;
    } catch (error) {
      console.error('Failed to load users:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allUsers = await fetchUsers();

      const storedUserId = sessionStorage.getItem('userId');
      if (storedUserId) {
        const found = allUsers.find((u) => u.id === parseInt(storedUserId, 10));
        if (found) {
          setUser(found);
        }
      }

      testFirestoreConnection().catch(() => {});
      setLoading(false);
    };

    init();
  }, [fetchUsers]);

  const ensureGoogleEmployee = useCallback(
    async (fbUser: FirebaseUser): Promise<Employee | null> => {
      if (!fbUser || !fbUser.email) return null;
      if (googleSyncLockRef.current) {
        return googleSyncLockRef.current;
      }

      const task = (async (): Promise<Employee | null> => {
        try {
          const currentUsers = await fetchUsers();
          const cleanEmail = fbUser.email!.toLowerCase();
          let matched = currentUsers.find(
            (u) => u.email && u.email.toLowerCase() === cleanEmail
          );

          const isBootstrappedAdmin = cleanEmail === 'ermikeab@gmail.com';

          if (!matched) {
            const nextId =
              currentUsers.length > 0
                ? Math.max(...currentUsers.map((u) => u.id)) + 1
                : 100;
            const uname = cleanEmail.split('@')[0];
            const newEmp: Employee = {
              id: nextId,
              name: fbUser.displayName || uname,
              username: uname,
              password: 'Password@123',
              employeeCode: `EMP-${String(nextId).padStart(3, '0')}`,
              pin: '1234',
              role: isBootstrappedAdmin ? Role.SUPER_ADMIN : Role.STAFF,
              branchId: 1,
              organizationId: 1,
              email: fbUser.email!,
              avatarUrl: fbUser.photoURL || undefined,
              status: 'Active',
            };

            await update('employees', newEmp);
            await pushMutationToServerOrQueue('employees', 'create', newEmp, 1, newEmp.id);
            await saveDocumentToFirestore('employees', newEmp).catch(() => {});
            await saveDocumentToFirestore('users', {
              id: fbUser.uid,
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: newEmp.name,
              role: newEmp.role,
              branchId: 1,
              employeeId: newEmp.id,
              photoURL: fbUser.photoURL || '',
              updatedAt: new Date().toISOString(),
            }).catch(() => {});

            matched = newEmp;
            setUsers((prev) => dedupeEmployees([...prev, newEmp]));
          } else if (isBootstrappedAdmin && !isAdminRole(matched.role)) {
            const updatedUser = { ...matched, role: Role.SUPER_ADMIN };
            await update('employees', updatedUser);
            await pushMutationToServerOrQueue('employees', 'update', updatedUser, 1, updatedUser.id);
            matched = updatedUser;
            setUsers((prev) =>
              dedupeEmployees(prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
            );
          }

          if (matched) {
            setUser(matched);
            sessionStorage.setItem('userId', String(matched.id));
          }
          return matched || null;
        } catch (err) {
          console.error('Error syncing Google employee:', err);
          return null;
        } finally {
          googleSyncLockRef.current = null;
        }
      })();

      googleSyncLockRef.current = task;
      return task;
    },
    [fetchUsers]
  );

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        await ensureGoogleEmployee(fbUser);
      }
    });

    return () => unsubscribe();
  }, [ensureGoogleEmployee]);

  const loginWithGoogle = async (): Promise<Employee | null> => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setFirebaseUser(fbUser);
      return await ensureGoogleEmployee(fbUser);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const login = (pin: string): Employee | null => {
    const cleanPin = pin.trim();
    const foundUser = users.find(
      (u) => u.pin.trim() === cleanPin || (u.password && u.password === cleanPin)
    );
    if (foundUser) {
      if (foundUser.lockedUntil && new Date(foundUser.lockedUntil).getTime() > Date.now()) {
        return null;
      }
      // Fire background server login to issue token & audit log
      apiLogin({ secret: cleanPin, mode: 'pin' })
        .then((res) => {
          if (res.ok && res.token) {
            setStoredAuthToken(res.token);
          }
        })
        .catch(() => {});

      const updatedUser: Employee = {
        ...foundUser,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
      };
      update('employees', updatedUser).catch(() => {});
      setUser(updatedUser);
      sessionStorage.setItem('userId', String(updatedUser.id));
      return updatedUser;
    }
    return null;
  };

  const loginWithCredentials = async (
    identifier: string,
    secret: string
  ): Promise<{
    user: Employee | null;
    error?: string;
    lockedUntil?: string;
    failedLoginAttempts?: number;
  }> => {
    const cleanId = identifier.trim();
    const cleanSecret = secret.trim();

    if (!cleanId || !cleanSecret) {
      return { user: null, error: 'Please enter both your username/email and password.' };
    }

    // 1. Primary path: Verify via Express Backend API (salted scrypt hash + lockout rate limiting + audit log)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await apiLogin({
          identifier: cleanId,
          secret: cleanSecret,
          mode: 'credentials',
        });

        if (res.ok && res.user) {
          if (res.token) {
            setStoredAuthToken(res.token);
          }
          await update('employees', res.user).catch(() => {});
          saveDocumentToFirestore('employees', res.user).catch(() => {});
          setUser(res.user);
          setUsers((prev) =>
            prev.map((item) => (item.id === res.user!.id ? res.user! : item))
          );
          sessionStorage.setItem('userId', String(res.user.id));
          return { user: res.user };
        } else {
          // Sync updated failedLoginAttempts / lockedUntil locally
          await fetchUsers();
          return {
            user: null,
            error: res.error || 'Authentication failed.',
            lockedUntil: res.lockedUntil,
            failedLoginAttempts: res.failedLoginAttempts,
          };
        }
      } catch {
        // Fallback to local offline verification below
      }
    }

    // 2. Offline Fallback Verification with Local Rate-Limiting
    const currentUsers = users.length > 0 ? users : await fetchUsers();
    const lowerId = cleanId.toLowerCase();
    const matched = currentUsers.find((u) => {
      const uname = (u.username || deriveDefaultUsername(u)).toLowerCase();
      const email = (u.email || '').toLowerCase();
      const empCode = (u.employeeCode || '').toLowerCase();
      const fullName = u.name.toLowerCase();
      return (
        uname === lowerId ||
        email === lowerId ||
        empCode === lowerId ||
        fullName === lowerId
      );
    });

    if (!matched) {
      return {
        user: null,
        error: 'No account found with that username, email, or employee code.',
      };
    }

    if (matched.lockedUntil) {
      const lockTime = new Date(matched.lockedUntil).getTime();
      if (Date.now() < lockTime) {
        const mins = Math.ceil((lockTime - Date.now()) / 60000);
        return {
          user: null,
          error: `Account is locked due to 5 failed attempts. Try again in ${mins} min or ask Super Admin/Admin to unlock.`,
          lockedUntil: matched.lockedUntil,
          failedLoginAttempts: matched.failedLoginAttempts || 5,
        };
      }
    }

    const validPassword = matched.password || 'Password@123';
    const isPasswordMatch = cleanSecret === validPassword || cleanSecret === matched.pin.trim();

    if (!isPasswordMatch) {
      const attempts = (matched.failedLoginAttempts || 0) + 1;
      const lockedUntil =
        attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      const updatedFailed: Employee = {
        ...matched,
        failedLoginAttempts: attempts,
        lockedUntil,
      };
      await update('employees', updatedFailed).catch(() => {});
      setUsers((prev) =>
        prev.map((item) => (item.id === updatedFailed.id ? updatedFailed : item))
      );
      return {
        user: null,
        error: lockedUntil
          ? 'Account locked for 15 minutes after 5 failed login attempts.'
          : `Incorrect password. ${5 - attempts} attempt(s) remaining before lockout.`,
        lockedUntil: lockedUntil || undefined,
        failedLoginAttempts: attempts,
      };
    }

    const updatedUser: Employee = {
      ...matched,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
    };

    await update('employees', updatedUser).catch(() => {});
    setUser(updatedUser);
    setUsers((prev) => prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
    sessionStorage.setItem('userId', String(updatedUser.id));
    return { user: updatedUser };
  };

  const unlockUserAccount = async (targetEmployeeId: number): Promise<boolean> => {
    if (!user || !isAdminRole(user.role)) return false;

    if (navigator.onLine) {
      try {
        const res = await apiUnlockAccount(targetEmployeeId, user.id);
        if (res.success && res.employee) {
          await update('employees', res.employee).catch(() => {});
          saveDocumentToFirestore('employees', res.employee).catch(() => {});
          await fetchUsers();
          return true;
        }
      } catch {
        // Fallback offline
      }
    }

    const allUsers = users.length > 0 ? users : await fetchUsers();
    const target = allUsers.find((u) => u.id === targetEmployeeId);
    if (!target) return false;

    const unlocked: Employee = {
      ...target,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    await update('employees', unlocked);
    await fetchUsers();
    return true;
  };

  const adminResetUserPassword = async (
    targetEmployeeId: number,
    newPassword: string,
    newPin?: string,
    mustChange: boolean = true
  ): Promise<boolean> => {
    if (!user || !isAdminRole(user.role)) return false;

    if (navigator.onLine) {
      try {
        const res = await apiAdminResetPassword({
          targetEmployeeId,
          newPassword,
          newPin,
          mustChange,
          actorId: user.id,
        });
        if (res.success && res.employee) {
          await update('employees', res.employee);
          saveDocumentToFirestore('employees', res.employee).catch(() => {});
          await fetchUsers();
          if (user.id === res.employee.id) {
            setUser(res.employee);
          }
          return true;
        }
      } catch {
        // Fallback offline
      }
    }

    const allUsers = users.length > 0 ? users : await fetchUsers();
    const target = allUsers.find((u) => u.id === targetEmployeeId);
    if (!target) return false;

    const updatedEmp: Employee = {
      ...target,
      password: newPassword.trim(),
      pin: newPin && newPin.trim() ? newPin.trim() : target.pin,
      mustChangePassword: mustChange,
      passwordResetRequested: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastPasswordResetAt: new Date().toISOString(),
      lastPasswordResetBy: user.name,
    };

    await update('employees', updatedEmp);
    if (navigator.onLine) {
      saveDocumentToFirestore('employees', updatedEmp).catch(() => {});
    }
    await fetchUsers();
    if (user.id === updatedEmp.id) {
      setUser(updatedEmp);
    }
    return true;
  };

  const changeOwnPassword = async (
    currentSecret: string,
    newPassword: string,
    newEmail?: string,
    newUsername?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'You must be signed in to change your password.' };
    }

    if (newPassword.trim().length < 4) {
      return {
        success: false,
        message: 'New password must be at least 4 characters long.',
      };
    }

    if (navigator.onLine) {
      try {
        const res = await apiChangeOwnPassword({
          employeeId: user.id,
          currentSecret,
          newPassword,
          newEmail,
          newUsername,
        });
        if (res.success && res.employee) {
          await update('employees', res.employee);
          saveDocumentToFirestore('employees', res.employee).catch(() => {});
          setUser(res.employee);
          await fetchUsers();
          return {
            success: true,
            message: 'Your password hash and security credentials have been updated on the server.',
          };
        } else if (res.error) {
          return { success: false, message: res.error };
        }
      } catch {
        // Fallback offline
      }
    }

    const validPassword = user.password || 'Password@123';
    if (
      currentSecret.trim() !== validPassword &&
      currentSecret.trim() !== user.pin.trim()
    ) {
      return {
        success: false,
        message: 'Current password or PIN does not match our records.',
      };
    }

    const updatedEmp: Employee = {
      ...user,
      password: newPassword.trim(),
      email: newEmail !== undefined && newEmail.trim() ? newEmail.trim() : user.email,
      username:
        newUsername !== undefined && newUsername.trim()
          ? newUsername.trim().toLowerCase()
          : user.username,
      mustChangePassword: false,
      passwordResetRequested: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastPasswordResetAt: new Date().toISOString(),
      lastPasswordResetBy: 'Self (User)',
    };

    await update('employees', updatedEmp);
    setUser(updatedEmp);
    await fetchUsers();
    return {
      success: true,
      message: 'Your password and security credentials have been updated.',
    };
  };

  const requestPasswordRecoveryByEmail = async (
    email: string
  ): Promise<{
    success: boolean;
    verificationCode?: string;
    employeeName?: string;
    username?: string;
    message: string;
  }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        success: false,
        message: 'Please enter a valid registered email address.',
      };
    }

    if (navigator.onLine) {
      try {
        const res = await apiRequestEmailRecovery(cleanEmail);
        if (res.success) {
          sendPasswordResetEmail(auth, cleanEmail).catch(() => {});
          return res;
        }
      } catch {
        // Fallback offline
      }
    }

    const currentUsers = users.length > 0 ? users : await fetchUsers();
    const matched = currentUsers.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );

    if (!matched) {
      return {
        success: false,
        message: 'No employee account found matching that email address.',
      };
    }

    const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
    setRecoveryTokens((prev) => ({
      ...prev,
      [cleanEmail]: {
        code: generatedCode,
        employeeId: matched.id,
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
    }));

    const flagged: Employee = {
      ...matched,
      passwordResetRequested: true,
    };
    await update('employees', flagged).catch(() => {});

    return {
      success: true,
      verificationCode: generatedCode,
      employeeName: matched.name,
      username: matched.username || deriveDefaultUsername(matched),
      message: `Password recovery verification code dispatched to ${matched.email}.`,
    };
  };

  const completePasswordRecoveryByEmail = async (
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; user?: Employee; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (newPassword.trim().length < 4) {
      return {
        success: false,
        message: 'New password must be at least 4 characters long.',
      };
    }

    if (navigator.onLine) {
      try {
        const res = await apiCompleteEmailRecovery({
          email: cleanEmail,
          code: code.trim(),
          newPassword: newPassword.trim(),
        });
        if (res.success && res.user) {
          if (res.token) setStoredAuthToken(res.token);
          await update('employees', res.user);
          saveDocumentToFirestore('employees', res.user).catch(() => {});
          await fetchUsers();
          setUser(res.user);
          sessionStorage.setItem('userId', String(res.user.id));
          return {
            success: true,
            user: res.user,
            message: res.message,
          };
        } else if (!res.success && res.message && !recoveryTokens[cleanEmail]) {
          return { success: false, message: res.message };
        }
      } catch {
        // Fallback offline
      }
    }

    const token = recoveryTokens[cleanEmail];
    if (!token) {
      return {
        success: false,
        message: 'No active recovery session found for this email. Please request a new code.',
      };
    }

    if (Date.now() > token.expiresAt) {
      return {
        success: false,
        message: 'Recovery verification code has expired. Please request a new code.',
      };
    }

    if (token.code !== code.trim()) {
      return {
        success: false,
        message: 'Invalid 6-digit verification code. Please check the code and try again.',
      };
    }

    const currentUsers = users.length > 0 ? users : await fetchUsers();
    const matched = currentUsers.find((u) => u.id === token.employeeId);
    if (!matched) {
      return {
        success: false,
        message: 'Employee record could not be found.',
      };
    }

    const updatedEmp: Employee = {
      ...matched,
      password: newPassword.trim(),
      mustChangePassword: false,
      passwordResetRequested: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastPasswordResetAt: new Date().toISOString(),
      lastPasswordResetBy: 'Email Recovery Protocol',
      lastLoginAt: new Date().toISOString(),
    };

    await update('employees', updatedEmp);
    if (navigator.onLine) {
      saveDocumentToFirestore('employees', updatedEmp).catch(() => {});
    }

    setRecoveryTokens((prev) => {
      const next = { ...prev };
      delete next[cleanEmail];
      return next;
    });

    await fetchUsers();
    setUser(updatedEmp);
    sessionStorage.setItem('userId', String(updatedEmp.id));

    return {
      success: true,
      user: updatedEmp,
      message: 'Password reset complete! Signing you in...',
    };
  };

  const switchUser = (employeeId: number) => {
    const found = users.find((u) => u.id === employeeId);
    if (found) {
      setUser(found);
      sessionStorage.setItem('userId', String(found.id));
    }
  };

  const loginAsSystemOwner = async (
    passkeyOrPin: string
  ): Promise<{ success: boolean; error?: string }> => {
    const clean = (passkeyOrPin || '').trim();
    if (!clean) {
      return {
        success: false,
        error: 'Please enter the System Owner Master Passkey or Secret PIN.',
      };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await apiSystemProviderLogin(clean);
        if (res.success) {
          if (res.config) {
            setSystemProviderConfig(res.config);
            try {
              localStorage.setItem('pt_system_provider_config', JSON.stringify(res.config));
            } catch {
              // ignore
            }
          }
          setIsSystemOwner(true);
          sessionStorage.setItem('pt_system_owner_active', 'true');
          // Ensure an active Super Admin employee context is also ready if jumping into orgs
          const adminEmp = users.find((u) => u.id === 1) || EMPLOYEES[0];
          if (!user && adminEmp) {
            setUser(adminEmp);
            sessionStorage.setItem('userId', String(adminEmp.id));
          }
          return { success: true };
        }
        return {
          success: false,
          error: res.error || 'Invalid System Master Passkey or Secret PIN.',
        };
      } catch {
        // Fallback to local verification below if offline
      }
    }

    const isMatch =
      clean === systemProviderConfig.masterPasskey ||
      clean === systemProviderConfig.masterPin ||
      clean.toLowerCase() === systemProviderConfig.masterPasskey.toLowerCase();

    if (!isMatch) {
      return {
        success: false,
        error: 'Invalid System Master Passkey or Secret PIN.',
      };
    }

    setIsSystemOwner(true);
    sessionStorage.setItem('pt_system_owner_active', 'true');
    const adminEmp = users.find((u) => u.id === 1) || EMPLOYEES[0];
    if (!user && adminEmp) {
      setUser(adminEmp);
      sessionStorage.setItem('userId', String(adminEmp.id));
    }
    return { success: true };
  };

  const logoutSystemOwner = () => {
    setIsSystemOwner(false);
    sessionStorage.removeItem('pt_system_owner_active');
  };

  const updateSystemOwnerCredentials = async (params: {
    currentSecret?: string;
    newMasterPasskey?: string;
    newMasterPin?: string;
    serviceTitle?: string;
    ownerName?: string;
    ownerEmail?: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await apiUpdateSystemProviderCredentials(params);
        if (res.success && res.config) {
          setSystemProviderConfig(res.config);
          try {
            localStorage.setItem('pt_system_provider_config', JSON.stringify(res.config));
          } catch {
            // ignore
          }
          return {
            success: true,
            message: 'System Owner Master Passkey and Secret PIN updated.',
          };
        }
        if (!res.success && res.error) {
          return { success: false, message: res.error };
        }
      } catch {
        // Fallback to local update
      }
    }

    const updated: SystemProviderConfig = {
      ...systemProviderConfig,
      serviceTitle: params.serviceTitle?.trim() || systemProviderConfig.serviceTitle,
      ownerName: params.ownerName?.trim() || systemProviderConfig.ownerName,
      ownerEmail: params.ownerEmail?.trim() || systemProviderConfig.ownerEmail,
      masterPasskey: params.newMasterPasskey?.trim() || systemProviderConfig.masterPasskey,
      masterPin: params.newMasterPin?.trim() || systemProviderConfig.masterPin,
      updatedAt: new Date().toISOString(),
    };
    setSystemProviderConfig(updated);
    try {
      localStorage.setItem('pt_system_provider_config', JSON.stringify(updated));
    } catch {
      // ignore
    }
    return {
      success: true,
      message: 'System Owner Master Passkey and Secret PIN updated.',
    };
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setStoredAuthToken(null);
    setFirebaseUser(null);
    setUser(null);
    setIsSystemOwner(false);
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('pt_system_owner_active');
  };

  const value: AuthContextType = {
    user,
    users,
    loading,
    firebaseUser,
    isGoogleLoading,
    isOnline,
    login,
    loginWithCredentials,
    loginWithGoogle,
    logout,
    refreshUsers: fetchUsers,
    switchUser,
    unlockUserAccount,
    adminResetUserPassword,
    changeOwnPassword,
    requestPasswordRecoveryByEmail,
    completePasswordRecoveryByEmail,
    isSystemOwner,
    systemProviderConfig,
    loginAsSystemOwner,
    logoutSystemOwner,
    updateSystemOwnerCredentials,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext);
