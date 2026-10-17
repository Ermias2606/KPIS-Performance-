import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { isAdminRole } from './types';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SystemDashboardPage from './pages/SystemDashboardPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import AnnualPlanPage from './pages/AnnualPlanPage';
import ReportsPage from './pages/ReportsPage';
import PerformanceInputPage from './pages/PerformanceInputPage';
import ApprovalWorkflowPage from './pages/ApprovalWorkflowPage';
import BranchAdminPage from './pages/BranchAdminPage';
import BranchNetworkPage from './pages/BranchNetworkPage';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <OfflineIndicator />
          <Main />
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
};

const Main: React.FC = () => {
  const { user, loading, isSystemOwner } = React.useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-semibold text-slate-600">Initializing Performance Tracker...</div>
        </div>
      </div>
    );
  }

  // Public Dual-Gateway Landing Portal
  if (location.pathname === '/') {
    return <LandingPage />;
  }

  // Service Provider / Owner Main System Control Dashboard
  if (location.pathname === '/system-dashboard') {
    return <SystemDashboardPage />;
  }

  // Login Page route
  if (location.pathname === '/login') {
    if (user) {
      return <Navigate to="/dashboard" replace />;
    }
    return <LoginPage />;
  }

  // If not authenticated and trying to access an app route, redirect to landing portal
  if (!user && !isSystemOwner) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = user ? isAdminRole(user.role) : isSystemOwner;

  return (
    <div className="flex h-screen bg-slate-100">
      {user && <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-4 sm:p-6 md:p-8">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/system-dashboard" element={<SystemDashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/plan" element={<AnnualPlanPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/performance-input" element={<PerformanceInputPage />} />
            <Route path="/admin/branch-setup" element={<BranchAdminPage />} />
            <Route
              path="/admin/approvals"
              element={isAdmin ? <ApprovalWorkflowPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="/network" element={<BranchNetworkPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;