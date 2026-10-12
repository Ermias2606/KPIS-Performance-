import React, { useMemo, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, calculateKpiMetrics } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Role, Employee } from '../types';

const EmployeesPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { employees, branches, kpis, annualPlan, loading, addEmployee, deleteEmployee } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState<Role>(Role.STAFF);
  const [newEmployeePin, setNewEmployeePin] = useState('');
  const [newEmployeeBranchId, setNewEmployeeBranchId] = useState<number>(branches[0]?.id || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const managedEmployees = useMemo(() => {
    if (!user) return [];
    let list: Employee[] = [];
    if (user.role === Role.ADMIN) {
      list = employees.filter(e => e.role !== Role.ADMIN);
    } else {
      list = employees.filter(e => e.branchId === user.branchId && e.role !== Role.ADMIN);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(term) || e.role.toLowerCase().includes(term));
    }
    return list;
  }, [user, employees, searchTerm]);

  const getEmployeeScore = (employeeId: number) => {
    const employeeKpis = kpis.filter(k => k.employeeId === employeeId);
    if (employeeKpis.length === 0) return null;
    const total = employeeKpis.reduce((acc, kpi) => {
      const objective = annualPlan.find(p => p.id === kpi.objectiveId);
      return acc + calculateKpiMetrics(kpi, objective).score;
    }, 0);
    return parseFloat(total.toFixed(1));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim() || !newEmployeePin.trim()) return;
    setIsSubmitting(true);
    try {
      await addEmployee({
        name: newEmployeeName.trim(),
        role: newEmployeeRole,
        pin: newEmployeePin.trim(),
        branchId: Number(newEmployeeBranchId),
      });
      setNewEmployeeName('');
      setNewEmployeePin('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add employee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name}?`)) {
      await deleteEmployee(id);
    }
  };

  const canManage = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Employees...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Branch Employees</h2>
            <p className="text-xs text-slate-500 mt-1">Manage team members, Balanced Scorecard profiles, and access PINs</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition font-medium text-sm flex items-center gap-1.5 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Employee</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-3">
          {managedEmployees.map(employee => {
            const score = getEmployeeScore(employee.id);
            return (
              <div key={employee.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{employee.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{employee.role}</p>
                    <p className="text-xs text-slate-400">{branches.find(b => b.id === employee.branchId)?.name}</p>
                    {canManage && (
                      <p className="text-xs text-slate-400 font-mono mt-1">PIN: {employee.pin}</p>
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
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 transition"
                  >
                    View Scorecard
                  </Link>
                  {user?.role === Role.ADMIN && (
                    <button
                      onClick={() => handleDelete(employee.id, employee.name)}
                      className="text-xs text-red-600 hover:text-red-700 px-2 py-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {managedEmployees.length === 0 && (
            <p className="text-center text-slate-400 py-6 text-sm">No employees found.</p>
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3.5 font-semibold">Name</th>
                <th className="p-3.5 font-semibold">Role</th>
                <th className="p-3.5 font-semibold">Branch</th>
                {canManage && <th className="p-3.5 font-semibold">PIN</th>}
                <th className="p-3.5 font-semibold text-center">Current Score</th>
                <th className="p-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-200">
              {managedEmployees.map(employee => {
                const score = getEmployeeScore(employee.id);
                return (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-medium text-slate-800">{employee.name}</td>
                    <td className="p-3.5 text-slate-600">{employee.role}</td>
                    <td className="p-3.5 text-slate-500">{branches.find(b => b.id === employee.branchId)?.name}</td>
                    {canManage && <td className="p-3.5 font-mono text-xs text-slate-500">{employee.pin}</td>}
                    <td className="p-3.5 text-center">
                      {score !== null ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          score >= 90 ? 'bg-emerald-100 text-emerald-800' : score >= 80 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {score}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No KPIs</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-3">
                      <Link
                        to={`/employees/${employee.id}`}
                        className="text-sky-600 hover:text-sky-800 font-medium hover:underline text-xs"
                      >
                        View Scorecard
                      </Link>
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
                  <td colSpan={6} className="p-6 text-center text-slate-400 text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Employee</h3>
            <form onSubmit={handleAddEmployee} className="space-y-4">
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
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Login PIN (4 digits)</label>
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Branch</label>
                <select
                  value={newEmployeeBranchId}
                  onChange={(e) => setNewEmployeeBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
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
    </div>
  );
};

export default EmployeesPage;