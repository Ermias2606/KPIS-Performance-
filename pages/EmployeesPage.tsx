import React, { useMemo, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData, calculateKpiMetrics } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Role, Employee, CalculatedKpi } from '../types';

export const EmployeesPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    employees,
    branches,
    kpis,
    annualPlan,
    backlogPlans,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'name' | 'kpis'>('score-desc');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);

  // New Employee Form fields
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeePosition, setNewEmployeePosition] = useState('Senior Customer Service Officer (CSO)');
  const [newEmployeeRole, setNewEmployeeRole] = useState<Role>(Role.STAFF);
  const [newEmployeePin, setNewEmployeePin] = useState('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newEmployeeBranchId, setNewEmployeeBranchId] = useState<number>(branches[0]?.id || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  // Filter & Sort Employees
  const managedEmployees = useMemo(() => {
    if (!user) return [];
    let list: Employee[] = [];
    if (user.role === Role.ADMIN) {
      list = employees.filter(e => e.role !== Role.ADMIN);
    } else {
      list = employees.filter(e => e.branchId === user.branchId && e.role !== Role.ADMIN);
    }

    if (roleFilter !== 'ALL') {
      list = list.filter(e => e.role === roleFilter);
    }

    if (positionFilter !== 'ALL') {
      list = list.filter(e => (e.positionTitle || '').toLowerCase().includes(positionFilter.toLowerCase()));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        e =>
          e.name.toLowerCase().includes(term) ||
          e.role.toLowerCase().includes(term) ||
          (e.positionTitle || '').toLowerCase().includes(term) ||
          (e.department || '').toLowerCase().includes(term)
      );
    }

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const scoreA = getEmployeeScore(a.id) ?? -1;
      const scoreB = getEmployeeScore(b.id) ?? -1;
      if (sortBy === 'score-desc') return scoreB - scoreA;
      if (sortBy === 'score-asc') return scoreA - scoreB;
      if (sortBy === 'kpis') {
        const kpisA = kpis.filter(k => k.employeeId === a.id).length;
        const kpisB = kpis.filter(k => k.employeeId === b.id).length;
        return kpisB - kpisA;
      }
      return 0;
    });

    return list;
  }, [user, employees, searchTerm, roleFilter, positionFilter, sortBy, kpis, annualPlan]);

  function getEmployeeScore(employeeId: number): number | null {
    const employeeKpis = kpis.filter(k => k.employeeId === employeeId);
    if (employeeKpis.length === 0) return null;
    const total = employeeKpis.reduce((acc, kpi) => {
      const objective = annualPlan.find(p => p.id === kpi.objectiveId);
      return acc + calculateKpiMetrics(kpi, objective).score;
    }, 0);
    return parseFloat(total.toFixed(1));
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim() || !newEmployeePin.trim()) return;
    setIsSubmitting(true);
    try {
      await addEmployee({
        name: newEmployeeName.trim(),
        role: newEmployeeRole,
        positionTitle: newEmployeePosition.trim(),
        pin: newEmployeePin.trim(),
        email: newEmployeeEmail.trim() || undefined,
        phone: newEmployeePhone.trim() || undefined,
        branchId: Number(newEmployeeBranchId),
        status: 'Active',
      });
      setNewEmployeeName('');
      setNewEmployeePin('');
      setNewEmployeeEmail('');
      setNewEmployeePhone('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add employee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsSubmitting(true);
    try {
      await updateEmployee(editingEmployee);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Failed to update employee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: number; name: string } | null>(null);

  const handleDelete = (id: number, name: string) => {
    setEmployeeToDelete({ id, name });
  };

  const confirmDeleteEmployee = async () => {
    if (employeeToDelete) {
      await deleteEmployee(employeeToDelete.id);
      setEmployeeToDelete(null);
    }
  };

  const exportEmployeeScorecardPDF = (employee: Employee) => {
    setExportingId(employee.id);
    try {
      const doc = new jsPDF();
      const employeeKpis = kpis.filter(k => k.employeeId === employee.id).map(kpi => {
        const objective = annualPlan.find(p => p.id === kpi.objectiveId);
        return calculateKpiMetrics(kpi, objective);
      });
      const totalScore = employeeKpis.reduce((sum, kpi) => sum + kpi.score, 0);

      doc.setFontSize(18);
      doc.setTextColor(2, 132, 199);
      doc.text('Performance Scorecard Document', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Employee: ${employee.name}`, 14, 32);
      doc.text(`Position Title: ${employee.positionTitle || employee.role}`, 14, 38);
      doc.text(`Branch: ${branches.find(b => b.id === employee.branchId)?.name || 'Raitu Branch'}`, 14, 44);

      doc.setFontSize(14);
      doc.setTextColor(totalScore >= 80 ? 16 : 217, totalScore >= 80 ? 185 : 119, totalScore >= 80 ? 129 : 6);
      doc.text(`Score: ${totalScore.toFixed(2)}%`, 140, 32);

      const tableData = employeeKpis.map(kpi => [
        kpi.objective?.category || 'General',
        kpi.name,
        `${kpi.weight}%`,
        kpi.target.toLocaleString(),
        kpi.actual.toLocaleString(),
        `${kpi.achievement}%`,
        kpi.score.toFixed(2),
      ]);

      const options = {
        startY: 52,
        head: [['Perspective', 'KPI Name', 'Weight', 'Target', 'Actual', 'Achievement', 'Score']],
        body: tableData,
        theme: 'grid' as const,
        headStyles: {
          fillColor: [2, 132, 199] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
        },
      };

      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(options);
      } else {
        autoTable(doc, options);
      }

      doc.save(`Scorecard_${employee.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Employees Directory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-800 rounded-full border border-sky-200">
                Staff Directory & Accountabilities
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {managedEmployees.length} Branch Members
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">Branch Employees & Positions</h2>
            <p className="text-xs text-slate-500">
              Manage employee professional position titles, Balanced Scorecard KPI profiles, and recovery assignments.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-sky-600 text-white px-4 py-2 rounded-xl hover:bg-sky-700 transition font-medium text-xs flex items-center gap-1.5 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Employee</span>
            </button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Search Staff</label>
            <input
              type="text"
              placeholder="Search by name, title, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Filter Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Roles</option>
              <option value={Role.STAFF}>Staff Members</option>
              <option value={Role.MANAGER}>Branch Managers</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Position Group</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Positions</option>
              <option value="Customer Service">Customer Service (CSO)</option>
              <option value="Digital">Digital Banking / E-Payment</option>
              <option value="Manager">Management</option>
              <option value="Auditor">Audit & Controller</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="score-desc">Highest Score First</option>
              <option value="score-asc">Lowest Score First</option>
              <option value="name">Alphabetical (A-Z)</option>
              <option value="kpis">Most KPIs Assigned</option>
            </select>
          </div>
        </div>

        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-3">
          {managedEmployees.map(employee => {
            const score = getEmployeeScore(employee.id);
            const employeeKpis = kpis.filter(k => k.employeeId === employee.id);
            const assignedBacklogs = backlogPlans.filter(b => b.assignedEmployeeId === employee.id);

            return (
              <div key={employee.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{employee.name}</h3>
                    <p className="text-xs font-semibold text-sky-700 mt-0.5">
                      {employee.positionTitle || 'Staff Member'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {employee.role} • {branches.find(b => b.id === employee.branchId)?.name}
                    </p>
                    {employee.phone && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{employee.phone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {score !== null ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                        score >= 90 ? 'bg-emerald-100 text-emerald-800' : score >= 80 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {score}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No KPIs</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{employeeKpis.length} KPIs</span>
                  <span>•</span>
                  <span>{assignedBacklogs.length} Backlogs</span>
                  {canManage && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-slate-400">PIN: {employee.pin}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setPreviewEmployee(employee)}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700"
                  >
                    Quick Preview
                  </button>
                  <Link
                    to={`/employees/${employee.id}`}
                    className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 transition"
                  >
                    Scorecard &rarr;
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => setEditingEmployee(employee)}
                      className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {managedEmployees.length === 0 && (
            <p className="text-center text-slate-400 py-6 text-sm">No employees match criteria.</p>
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-semibold">Employee & Position Title</th>
                <th className="p-3.5 font-semibold">Role & Branch</th>
                <th className="p-3.5 font-semibold text-center">Scorecard KPIs</th>
                <th className="p-3.5 font-semibold text-center">Backlogs</th>
                {canManage && <th className="p-3.5 font-semibold">Access PIN</th>}
                <th className="p-3.5 font-semibold text-center">Current Score</th>
                <th className="p-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-200">
              {managedEmployees.map(employee => {
                const score = getEmployeeScore(employee.id);
                const employeeKpis = kpis.filter(k => k.employeeId === employee.id);
                const assignedBacklogs = backlogPlans.filter(b => b.assignedEmployeeId === employee.id);

                return (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{employee.name}</div>
                      <div className="text-xs text-sky-700 font-medium">
                        {employee.positionTitle || 'Staff Member'}
                      </div>
                      {employee.email && (
                        <div className="text-[11px] text-slate-400">{employee.email}</div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium block w-max">
                        {employee.role}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        {branches.find(b => b.id === employee.branchId)?.name}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-mono text-xs font-semibold text-slate-700">
                      {employeeKpis.length} assigned
                    </td>

                    <td className="p-3.5 text-center">
                      {assignedBacklogs.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          {assignedBacklogs.length} Active
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>

                    {canManage && (
                      <td className="p-3.5 font-mono text-xs text-slate-500">
                        {employee.pin}
                      </td>
                    )}

                    <td className="p-3.5 text-center">
                      {score !== null ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                          score >= 90 ? 'bg-emerald-100 text-emerald-800' : score >= 80 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {score}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No KPIs</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setPreviewEmployee(employee)}
                        className="text-slate-600 hover:text-slate-900 font-medium text-xs hover:underline"
                      >
                        Preview
                      </button>
                      <Link
                        to={`/employees/${employee.id}`}
                        className="text-sky-600 hover:text-sky-800 font-semibold hover:underline text-xs"
                      >
                        Scorecard
                      </Link>
                      {canManage && (
                        <button
                          onClick={() => setEditingEmployee(employee)}
                          className="text-slate-600 hover:text-slate-900 text-xs hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {user?.role === Role.ADMIN && (
                        <button
                          onClick={() => handleDelete(employee.id, employee.name)}
                          className="text-red-500 hover:text-red-700 text-xs hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {managedEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 text-sm">
                    No employees found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Add New Branch Employee</h3>
            <p className="text-xs text-slate-500 mb-4">Create profile with professional position title and credentials.</p>
            <form onSubmit={handleAddEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tolasa Dibaba"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Position Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Customer Service Officer (CSO)"
                  value={newEmployeePosition}
                  onChange={(e) => setNewEmployeePosition(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-500">
                  <span className="cursor-pointer text-sky-600 hover:underline" onClick={() => setNewEmployeePosition('Senior Customer Service Officer (CSO)')}>
                    + Senior CSO
                  </span>
                  <span className="cursor-pointer text-sky-600 hover:underline ml-1" onClick={() => setNewEmployeePosition('Relationship Officer - Digital Banking')}>
                    + Digital Banking Officer
                  </span>
                  <span className="cursor-pointer text-sky-600 hover:underline ml-1" onClick={() => setNewEmployeePosition('Branch Cashier & Operations Officer')}>
                    + Cashier
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role</label>
                  <select
                    value={newEmployeeRole}
                    onChange={(e) => setNewEmployeeRole(e.target.value as Role)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={Role.STAFF}>Staff Member</option>
                    <option value={Role.MANAGER}>Branch Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Login PIN</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 8888"
                    value={newEmployeePin}
                    onChange={(e) => setNewEmployeePin(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="name@cbe.com.et"
                    value={newEmployeeEmail}
                    onChange={(e) => setNewEmployeeEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+251 911..."
                    value={newEmployeePhone}
                    onChange={(e) => setNewEmployeePhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Branch</label>
                <select
                  value={newEmployeeBranchId}
                  onChange={(e) => setNewEmployeeBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Edit Employee Profile</h3>
            <p className="text-xs text-slate-500 mb-4">Update position title, role, branch, and contact information.</p>
            <form onSubmit={handleUpdateEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Position Title</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.positionTitle || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, positionTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role</label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as Role })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={Role.STAFF}>Staff Member</option>
                    <option value={Role.MANAGER}>Branch Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Login PIN</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.pin}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, pin: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={editingEmployee.email || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingEmployee.phone || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Branch</label>
                <select
                  value={editingEmployee.branchId}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, branchId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium shadow-sm transition"
                >
                  {isSubmitting ? 'Saving...' : 'Update Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Scorecard Preview Modal */}
      {previewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{previewEmployee.name}</h3>
                <p className="text-xs text-sky-700 font-semibold">{previewEmployee.positionTitle || previewEmployee.role}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {branches.find(b => b.id === previewEmployee.branchId)?.name}
                </p>
              </div>
              <button
                onClick={() => setPreviewEmployee(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Overall Scorecard Achievement</span>
                <span className="text-xl font-bold font-mono text-sky-700">
                  {getEmployeeScore(previewEmployee.id) ?? 0}%
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Assigned Scorecard KPIs</h4>
                <div className="space-y-2">
                  {kpis.filter(k => k.employeeId === previewEmployee.id).map(kpi => {
                    const obj = annualPlan.find(p => p.id === kpi.objectiveId);
                    const metrics = calculateKpiMetrics(kpi, obj);
                    return (
                      <div key={kpi.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-800">{kpi.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Target: {kpi.target.toLocaleString()} • Actual: {kpi.actual.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">{metrics.achievement}%</span>
                          <span className="block text-[10px] text-sky-600 font-mono">Score: {metrics.score}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {kpis.filter(k => k.employeeId === previewEmployee.id).length === 0 && (
                    <p className="text-xs text-slate-400 italic">No KPIs assigned to this employee yet.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => exportEmployeeScorecardPDF(previewEmployee)}
                  disabled={exportingId === previewEmployee.id}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  {exportingId === previewEmployee.id ? 'Exporting...' : 'Export Scorecard PDF'}
                </button>
                <Link
                  to={`/employees/${previewEmployee.id}`}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Full Scorecard Details &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">Remove Employee?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <span className="font-semibold text-slate-700">{employeeToDelete.name}</span>? Their assigned KPIs will be unassigned.
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="flex-1 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEmployee}
                className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium shadow-sm transition cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;