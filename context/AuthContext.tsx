import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Employee, Role } from '../types';
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
  User as FirebaseUser,
} from 'firebase/auth';
import { saveDocumentToFirestore } from '../services/firestoreSync';

interface AuthContextType {
  user: Employee | null;
  users: Employee[];
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  isGoogleLoading: boolean;
  isOnline: boolean;
  login: (pin: string) => Employee | null;
  loginWithGoogle: () => Promise<Employee | null>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  switchUser: (employeeId: number) => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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
      const allUsers = await getAll<Employee>('employees');
      setUsers(allUsers);
      return allUsers;
    } catch (error) {
      console.error('Failed to load users:', error);
      return [];
    }
  }, []);

  // Initialize and load users
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allUsers = await fetchUsers();

      // Check stored session
      const storedUserId = sessionStorage.getItem('userId');
      if (storedUserId) {
        const found = allUsers.find((u) => u.id === parseInt(storedUserId, 10));
        if (found) {
          setUser(found);
        }
      }

      // Check test connection
      testFirestoreConnection().catch(() => {});
      setLoading(false);
    };

    init();
  }, [fetchUsers]);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        const currentUsers = await fetchUsers();
        // Match user by email
        let matched = currentUsers.find(
          (u) => u.email && u.email.toLowerCase() === fbUser.email!.toLowerCase()
        );

        // If not found, check if bootstrapped admin
        if (!matched) {
          const isBootstrappedAdmin = fbUser.email.toLowerCase() === 'ermikeab@gmail.com';
          const newEmp: Employee = {
            id: currentUsers.length > 0 ? Math.max(...currentUsers.map((u) => u.id)) + 1 : 100,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            pin: '1234',
            role: isBootstrappedAdmin ? Role.ADMIN : Role.STAFF,
            branchId: 1,
            email: fbUser.email,
            avatarUrl: fbUser.photoURL || undefined,
          };

          try {
            await add('employees', newEmp);
            await saveDocumentToFirestore('employees', newEmp);
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
            });
            matched = newEmp;
            setUsers((prev) => [...prev, newEmp]);
          } catch (err) {
            console.error('Error saving new employee for Google user:', err);
          }
        }

        if (matched) {
          setUser(matched);
          sessionStorage.setItem('userId', String(matched.id));
        }
      }
    });

    return () => unsubscribe();
  }, [fetchUsers]);

  const loginWithGoogle = async (): Promise<Employee | null> => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      const allUsers = await fetchUsers();
      let matched = allUsers.find(
        (u) => u.email && u.email.toLowerCase() === fbUser.email?.toLowerCase()
      );

      const isBootstrappedAdmin = fbUser.email?.toLowerCase() === 'ermikeab@gmail.com';

      if (!matched) {
        // Create user
        const newEmp: Employee = {
          id: allUsers.length > 0 ? Math.max(...allUsers.map((u) => u.id)) + 1 : 100,
          name: fbUser.displayName || 'Authorized Google User',
          pin: '1234',
          role: isBootstrappedAdmin ? Role.ADMIN : Role.STAFF,
          branchId: 1,
          email: fbUser.email || undefined,
          avatarUrl: fbUser.photoURL || undefined,
        };

        await add('employees', newEmp);
        await saveDocumentToFirestore('employees', newEmp);
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
        });
        matched = newEmp;
        setUsers((prev) => [...prev, newEmp]);
      } else if (isBootstrappedAdmin && matched.role !== Role.ADMIN) {
        // Upgrade bootstrapped admin if needed
        const updatedUser = { ...matched, role: Role.ADMIN };
        await update('employees', updatedUser);
        matched = updatedUser;
      }

      setUser(matched);
      sessionStorage.setItem('userId', String(matched.id));
      return matched;
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const login = (pin: string): Employee | null => {
    const foundUser = users.find((u) => u.pin.trim() === pin.trim());
    if (foundUser) {
      setUser(foundUser);
      sessionStorage.setItem('userId', String(foundUser.id));
      return foundUser;
    }
    return null;
  };

  const switchUser = (employeeId: number) => {
    const found = users.find((u) => u.id === employeeId);
    if (found) {
      setUser(found);
      sessionStorage.setItem('userId', String(found.id));
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setFirebaseUser(null);
    setUser(null);
    sessionStorage.removeItem('userId');
  };

  const value = {
    user,
    users,
    loading,
    firebaseUser,
    isGoogleLoading,
    isOnline,
    login,
    loginWithGoogle,
    logout,
    refreshUsers: fetchUsers,
    switchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext);
