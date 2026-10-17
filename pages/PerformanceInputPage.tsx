import React, { useState, useContext, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Role, isAdminRole } from '../types';

interface PerformanceLogEntry {
  id: string;
  targetType: 'branch' | 'employee' | 'backlog';
  targetId: number;
  targetName: string;
  category: string;
  unit: string;
  date: string;
  incrementValue: number;
  totalRecordedActual: number;
  notes: string;
  loggedBy: string;
}

interface PerformanceRequest {
  id: string;
  employeeId: number;
  employeeName: string;
  targetType: 'employee' | 'backlog';
  targetId: number;
  targetName: string;
  category: string;
  unit: string;
  date: string;
  incrementValue: number;
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
}

export const PerformanceInputPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    employees,
    periodicPlans,
    employeePlans,
    backlogPlans,
    recordActualPerformance,
    recordEmployeePerformance,
    updateBacklogPlan,
    loading,
  } = useData();

  const isAdmin = isAdminRole(user?.role);
  const [activeTab, setActiveTab] = useState<'branch' | 'employee' | 'backlog' | 'requests' | 'history'>('branch');
  const [selectedTargetType, setSelectedTargetType] = useState<'branch' | 'employee' | 'backlog'>(isAdmin ? 'branch' : 'employee');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<number | 'ALL'>(isAdmin ? 'ALL' : (user?.id || 'ALL'));
  const [selectedTargetId, setSelectedTargetId] = useState<number>(periodicPlans[0]?.id || 1);
  const [inputDate, setInputDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inputValue, setInputValue] = useState<number | ''>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local storage audit logs
  const [auditLogs, setAuditLogs] = useState<PerformanceLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('raitu_perf_audit_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Local storage employee performance requests
  const [requests, setRequests] = useState<PerformanceRequest[]>(() => {
    try {
      const saved = localStorage.getItem('raitu_perf_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Staff members list
  const staffMembers = useMemo(() => {
    return employees.filter(e => !isAdminRole(e.role));
  }, [employees]);

  // Filtered employee plans based on selected employee dropdown
  const filteredEmployeePlans = useMemo(() => {
    if (selectedEmployeeFilter === 'ALL') return employeePlans;
    return employeePlans.filter(ep => ep.employeeId === selectedEmployeeFilter);
  }, [employeePlans, selectedEmployeeFilter]);

  const filteredBacklogs = useMemo(() => {
    if (selectedEmployeeFilter === 'ALL') return backlogPlans;
    return backlogPlans.filter(b => b.assignedEmployeeId === selectedEmployeeFilter);
  }, [backlogPlans, selectedEmployeeFilter]);

  // Handle Log / Request Submission
  const handleLogPerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue === '' || isNaN(Number(inputValue))) return;
    setIsSubmitting(true);
    setSuccessMessage(null);

    const val = Number(inputValue);

    try {
      let targetName = '';
      let category = '';
      let unit = '';
      let newTotalActual = 0;

      if (!isAdmin && selectedTargetType !== 'branch') {
        // Employee submitting actual input request for admin approval
        const targetEp = selectedTargetType === 'employee' ? employeePlans.find(ep => ep.id === selectedTargetId) : null;
        const targetB = selectedTargetType === 'backlog' ? backlogPlans.find(b => b.id === selectedTargetId) : null;

        const newReq: PerformanceRequest = {
          id: 'req-' + Date.now(),
          employeeId: user?.id || 2,
          employeeName: user?.name || 'Staff Member',
          targetType: selectedTargetType as 'employee' | 'backlog',
          targetId: selectedTargetId,
          targetName: targetEp?.title || targetB?.title || 'Assigned Plan',
          category: targetEp?.category || targetB?.category || 'Deposit',
          unit: targetEp?.metricUnit || targetB?.metricUnit || 'ETB',
          date: inputDate,
          incrementValue: val,
          notes: inputNotes.trim() || 'Day-to-day performance update request',
          status: 'Pending',
          submittedAt: new Date().toISOString(),
        };

        const updatedReqs = [newReq, ...requests];
        setRequests(updatedReqs);
        localStorage.setItem('raitu_perf_requests', JSON.stringify(updatedReqs));

        setSuccessMessage(`Performance update request of +${val.toLocaleString()} submitted successfully for Admin approval.`);
        setInputValue('');
        setInputNotes('');
        setIsSubmitting(false);
        return;
      }

      // Admin direct update
      if (selectedTargetType === 'branch') {
        const plan = periodicPlans.find(p => p.id === selectedTargetId);
        if (plan) {
          targetName = plan.name;
          category = plan.category;
          unit = plan.metricUnit;
          newTotalActual = plan.annualActual + val;
          await recordActualPerformance({
            planId: plan.id,
            periodType: 'annual',
            newActual: newTotalActual,
          });
        }
      } else if (selectedTargetType === 'employee') {
        const ep = employeePlans.find(item => item.id === selectedTargetId);
        if (ep) {
          targetName = ep.title;
          category = ep.category;
          unit = ep.metricUnit;
          newTotalActual = ep.annualActual + val;
          await recordEmployeePerformance({
            assignmentId: ep.id,
            periodType: 'annual',
            newActual: newTotalActual,
          });

          // Roll up into branch periodic plan
          const matchingBranchPlan = periodicPlans.find(p => p.category === ep.category);
          if (matchingBranchPlan) {
            await recordActualPerformance({
              planId: matchingBranchPlan.id,
              periodType: 'annual',
              newActual: matchingBranchPlan.annualActual + val,
            });
          }
        }
      } else if (selectedTargetType === 'backlog') {
        const bItem = backlogPlans.find(b => b.id === selectedTargetId);
        if (bItem) {
          targetName = bItem.title;
          category = bItem.category;
          unit = bItem.metricUnit;
          newTotalActual = bItem.backlogActual + val;
          await updateBacklogPlan({
            ...bItem,
            backlogActual: newTotalActual,
            status: newTotalActual >= bItem.backlogTarget ? 'Cleared' : bItem.status,
          });
        }
      }

      // Record audit history log
      const newLog: PerformanceLogEntry = {
        id: 'log-' + Date.now(),
        targetType: selectedTargetType,
        targetId: selectedTargetId,
        targetName,
        category,
        unit,
        date: inputDate,
        incrementValue: val,
        totalRecordedActual: newTotalActual,
        notes: inputNotes.trim() || 'Daily performance update',
        loggedBy: user?.name || 'Admin',
      };

      const updatedLogs = [newLog, ...auditLogs];
      setAuditLogs(updatedLogs);
      localStorage.setItem('raitu_perf_audit_logs', JSON.stringify(updatedLogs));

      setSuccessMessage(`Successfully logged daily performance of +${val.toLocaleString()} ${unit} for "${targetName}".`);
      setInputValue('');
      setInputNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Performance Input Portal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              Day-to-Day Performance & Audit
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {isAdmin ? 'Admin Management & Review' : 'Employee Actual Input Portal'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            {isAdmin ? 'Admin Performance Input & Employee Selection' : 'Record My Day-to-Day Actual Performance'}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Select specific employees from the dropdown, record or review day-to-day actual performance, and track roll-ups.'
              : 'Submit day-to-day performance updates for your assigned employee plans and backlogs for admin approval.'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('branch')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'branch' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Branch Master Plans ({periodicPlans.length})
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'employee' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Employee Assigned Plans ({employeePlans.length})
        </button>
        <button
          onClick={() => setActiveTab('backlog')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'backlog' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Backlog & Arrears ({backlogPlans.length})
        </button>
        {!isAdmin && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'requests' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Submitted Requests ({requests.filter(r => r.employeeId === user?.id).length})
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'history' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Audit History ({auditLogs.length})
          </button>
        )}
      </div>

      {/* QUICK DAY-TO-DAY PERFORMANCE INPUT CARD */}
      <Card className="border-emerald-200 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30">
        <div className="pb-3 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAdmin ? 'Record / Update Daily Performance (Admin Direct)' : 'Submit Day-to-Day Daily Performance Input'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'Select target stream, filter by employee name, and input daily increments'
                  : 'Submit daily output increments for your assigned scorecard plans'}
              </p>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="my-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-900 hover:text-emerald-950">&times;</button>
          </div>
        )}

        <form onSubmit={handleLogPerformance} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Stream</label>
            <select
              value={selectedTargetType}
              onChange={(e) => {
                const t = e.target.value as 'branch' | 'employee' | 'backlog';
                setSelectedTargetType(t);
                if (t === 'branch' && periodicPlans.length > 0) setSelectedTargetId(periodicPlans[0].id);
                if (t === 'employee' && employeePlans.length > 0) setSelectedTargetId(employeePlans[0].id);
                if (t === 'backlog' && backlogPlans.length > 0) setSelectedTargetId(backlogPlans[0].id);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {isAdmin && <option value="branch">Branch Master Plan</option>}
              <option value="employee">Employee Assigned Plan</option>
              <option value="backlog">Backlog / Arrears Recovery</option>
            </select>
          </div>

          {/* Admin Employee Name Selector Dropdown */}
          {isAdmin && selectedTargetType === 'employee' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Employee Name</label>
              <select
                value={selectedEmployeeFilter}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setSelectedEmployeeFilter(val);
                  const matching = employeePlans.filter(ep => val === 'ALL' || ep.employeeId === val);
                  if (matching.length > 0) setSelectedTargetId(matching[0].id);
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="ALL">All Employees ({staffMembers.length})</option>
                {staffMembers.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                ))}
              </select>
            </div>
          )}

          <div className={isAdmin && selectedTargetType === 'employee' ? 'lg:col-span-1' : 'lg:col-span-2'}>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Specific Plan / KPI</label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {selectedTargetType === 'branch' && periodicPlans.map(p => (
                <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>
              ))}
              {selectedTargetType === 'employee' && filteredEmployeePlans.map(ep => {
                const emp = employees.find(e => e.id === ep.employeeId);
                return (
                  <option key={ep.id} value={ep.id}>{emp?.name || 'Staff'}: {ep.title}</option>
                );
              })}
              {selectedTargetType === 'backlog' && filteredBacklogs.map(b => (
                <option key={b.id} value={b.id}>[Backlog] {b.title} ({b.backlogTarget.toLocaleString()} {b.metricUnit})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Date</label>
            <input
              type="date"
              required
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Daily Increment Value</label>
            <input
              type="number"
              required
              min={0}
              placeholder="e.g. 50000"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || inputValue === ''}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? 'Logging...' : isAdmin ? 'Log Direct Actual' : 'Submit for Approval'}
            </button>
          </div>
        </form>

        <div className="mt-3">
          <input
            type="text"
            placeholder="Remarks or notes (e.g. Daily deposit mobilization from agricultural union)..."
            value={inputNotes}
            onChange={(e) => setInputNotes(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
          />
        </div>
      </Card>

      {/* TAB VIEWS */}
      {activeTab === 'branch' && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Branch Master Plans (Up-to-Date Status)</h3>
            <span className="text-xs text-slate-500 font-semibold">{periodicPlans.length} Master Plans</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Plan Title</th>
                  <th className="p-3 text-right">Annual Target</th>
                  <th className="p-3 text-right">Current Actual</th>
                  <th className="p-3 text-center">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {periodicPlans.map(p => {
                  const rate = p.annualTarget > 0 ? Math.round((p.annualActual / p.annualTarget) * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-800">{p.category}</td>
                      <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="p-3 text-right font-mono">{p.annualTarget.toLocaleString()} {p.metricUnit}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{p.annualActual.toLocaleString()} {p.metricUnit}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'employee' && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Employee Assigned Plans (Up-to-Date Status)</h3>
            <span className="text-xs text-slate-500 font-semibold">{employeePlans.length} Staff Assignments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Assigned Plan Title</th>
                  <th className="p-3 text-right">Target</th>
                  <th className="p-3 text-right">Actual</th>
                  <th className="p-3 text-center">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {employeePlans.map(ep => {
                  const emp = employees.find(e => e.id === ep.employeeId);
                  const rate = ep.annualTarget > 0 ? Math.round((ep.annualActual / ep.annualTarget) * 100) : 0;
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900">{emp?.name || 'Staff Member'}</td>
                      <td className="p-3 text-sky-700 font-semibold">{ep.category}</td>
                      <td className="p-3">{ep.title}</td>
                      <td className="p-3 text-right font-mono">{ep.annualTarget.toLocaleString()} {ep.metricUnit}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700">{ep.annualActual.toLocaleString()} {ep.metricUnit}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'backlog' && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Backlog & Arrears Recovery (Up-to-Date Status)</h3>
            <span className="text-xs text-slate-500 font-semibold">{backlogPlans.length} Backlog Items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Backlog Title</th>
                  <th className="p-3">Assigned Staff</th>
                  <th className="p-3 text-right">Target</th>
                  <th className="p-3 text-right">Recovered Actual</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {backlogPlans.map(b => {
                  const assignedEmp = employees.find(e => e.id === b.assignedEmployeeId);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-800">{b.category}</td>
                      <td className="p-3 font-semibold text-slate-900">{b.title}</td>
                      <td className="p-3">{assignedEmp?.name || 'Unassigned Pool'}</td>
                      <td className="p-3 text-right font-mono">{b.backlogTarget.toLocaleString()} {b.metricUnit}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{b.backlogActual.toLocaleString()} {b.metricUnit}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'Cleared' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'requests' && !isAdmin && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">My Submitted Performance Input Requests</h3>
            <span className="text-xs text-slate-500 font-semibold">Awaiting Admin Approval</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Plan Title</th>
                  <th className="p-3 text-right">Increment</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-center">Approval Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {requests.filter(r => r.employeeId === user?.id).map(req => (
                  <tr key={req.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-slate-500">{req.date}</td>
                    <td className="p-3 font-bold text-slate-900">{req.targetName}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">+{req.incrementValue.toLocaleString()} {req.unit}</td>
                    <td className="p-3 text-slate-500">{req.notes}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'history' && isAdmin && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Performance Audit History</h3>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">{auditLogs.length} Entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Target Name</th>
                  <th className="p-3 text-right">Increment</th>
                  <th className="p-3 text-right">New Total</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-slate-500">{log.date}</td>
                    <td className="p-3 font-bold text-slate-900">{log.targetName}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">+{log.incrementValue.toLocaleString()} {log.unit}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">{log.totalRecordedActual.toLocaleString()} {log.unit}</td>
                    <td className="p-3 text-slate-500">{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PerformanceInputPage;
