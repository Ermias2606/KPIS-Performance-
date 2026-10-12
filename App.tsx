
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Role, Employee } from './types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import AnnualPlanPage from './pages/AnnualPlanPage';
import ReportsPage from './pages/ReportsPage';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <Main />
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
};

const Main: React.FC = () => {
  const { user, loading } = React.useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-xl font-semibold text-slate-600">Loading Application...</div>
      </div>
    );
  }
  
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-4 sm:p-6 md:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/plan" element={<AnnualPlanPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;