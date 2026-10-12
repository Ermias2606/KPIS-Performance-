import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Employee } from '../types';
import { getAll } from '../services/db';

interface AuthContextType {
  user: Employee | null;
  users: Employee[];
  loading: boolean;
  login: (pin: string) => Employee | null;
  logout: () => void;
  refreshUsers: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const allUsers = await getAll<Employee>('employees');
      setUsers(allUsers);
      const storedUserId = sessionStorage.getItem('userId');
      if (storedUserId) {
        const loggedInUser = allUsers.find(u => u.id === parseInt(storedUserId, 10));
        setUser(loggedInUser || null);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const login = (pin: string): Employee | null => {
    const foundUser = users.find(u => u.pin.trim() === pin.trim());
    if (foundUser) {
      setUser(foundUser);
      sessionStorage.setItem('userId', String(foundUser.id));
      return foundUser;
    }
    return null;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('userId');
  };

  const value = { user, users, loading, login, logout, refreshUsers: fetchUsers };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
