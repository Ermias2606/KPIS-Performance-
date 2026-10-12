import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { Employee, PerspectiveCategory, CalculatedKpi, Role, Kpi } from '../types';
import Card from '../components/ui/Card';

const PerspectiveIcon: React.FC<{ category: PerspectiveCategory }> = ({ category }) => {
  const icons = {
    [PerspectiveCategory.FINANCIAL]: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" />
      </svg>
    ),
    [PerspectiveCategory.CUSTOMER]: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    [PerspectiveCategory.INTERNAL_PROCESS]: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    [PerspectiveCategory.LEARNING_GROWTH]: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      </svg>
    ),
  };
  return icons[category] || null;
};

const KpiRow: React.FC<{ kpi: CalculatedKpi; isEditable: boolean; onDelete?: (id: number) => void }> = ({ kpi, isEditable, onDelete }) => {
  const { updateKpi } = useData();
  const [actual, setActual] = useState(kpi.actual);
  const [target, setTarget] = useState(kpi.target);
  const [weight, setWeight] = useState(kpi.weight);
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setActual(kpi.actual);
    setTarget(kpi.target);
    setWeight(kpi.weight);
  }, [kpi.actual, kpi.target, kpi.weight]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateKpi({ ...kpi, actual, target, weight } as Kpi);
    setIsSaving(false);
    setIsEditingFull(false);
  };

  const hasChanged = actual !== kpi.actual || target !== kpi.target || weight !== kpi.weight;

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
      <td className="p-3 align-middle">
        <p className="font-semibold text-slate-800 text-sm">{kpi.name}</p>
        <p className="text-xs text-slate-500">{kpi.objective?.objective || 'General Objective'}</p>
      </td>
      <td className="p-3 text-center align-middle">
        {isEditingFull ? (
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-16 text-center p-1 text-xs border rounded border-slate-300"
          />
        ) : (
          <span className="text-sm font-medium">{kpi.weight}%</span>
        )}
      </td>
      <td className="p-3 text-center align-middle">
        {isEditingFull ? (
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-24 text-center p-1 text-xs border rounded border-slate-300"
          />
        ) : (
          <span className="text-sm">{kpi.target.toLocaleString()}</span>
        )}
      </td>
      <td className="p-3 text-center align-middle">
        {isEditable ? (
          <div className="flex items-center justify-center space-x-1.5">
            <input
              type="number"
              value={actual}
              onChange={(e) => setActual(Number(e.target.value))}
              className="w-24 text-center p-1 text-xs border rounded-md border-slate-300 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-medium"
            />
            {hasChanged && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-sky-600 text-white text-xs px-2 py-1 rounded hover:bg-sky-700 disabled:bg-slate-400 transition"
              >
                {isSaving ? '...' : 'Save'}
              </button>
            )}
          </div>
        ) : (
          <span className="text-sm">{kpi.actual.toLocaleString()}</span>
        )}
      </td>
      <td className={`p-3 text-center font-bold text-sm align-middle ${
        kpi.achievement >= 100 ? 'text-emerald-600' : kpi.achievement >= 80 ? 'text-sky-600' : 'text-amber-600'
      }`}>
        {kpi.achievement}%
      </td>
      <td className="p-3 text-center font-bold text-sky-700 text-sm align-middle">
        {kpi.score.toFixed(2)}
      </td>
      {isEditable && (
        <td className="p-3 text-right align-middle space-x-2">
          <button
            onClick={() => setIsEditingFull(!isEditingFull)}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {isEditingFull ? 'Done' : 'Edit'}
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(kpi.id)}
              className="text-xs text-red-500 hover:text-red-700"
              title="Delete KPI"
            >
              &times;
            </button>
          )}
        </td>
      )}
    </tr>
  );
};

const KpiCard: React.FC<{ kpi: CalculatedKpi; isEditable: boolean; onDelete?: (id: number) => void }> = ({ kpi, isEditable, onDelete }) => {
  const { updateKpi } = useData();
  const [actual, setActual] = useState(kpi.actual);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setActual(kpi.actual);
  }, [kpi.actual]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateKpi({ ...kpi, actual } as Kpi);
    setIsSaving(false);
  };

  const hasChanged = actual !== kpi.actual;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-slate-800 text-sm">{kpi.name}</p>
          <p className="text-xs text-slate-500">{kpi.objective?.objective || 'General Objective'}</p>
        </div>
        {isEditable && onDelete && (
          <button
            onClick={() => onDelete(kpi.id)}
            className="text-xs text-red-500 hover:text-red-700 p-1"
          >
            Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="text-slate-500">Weight:</div>
        <div className="font-semibold text-right">{kpi.weight}%</div>
        <div className="text-slate-500">Target:</div>
        <div className="font-semibold text-right">{kpi.target.toLocaleString()}</div>
        <div className="text-slate-500 self-center">Actual:</div>
        <div className="text-right">
          {isEditable ? (
            <div className="flex items-center justify-end space-x-1.5">
              <input
                type="number"
                value={actual}
                onChange={(e) => setActual(Number(e.target.value))}
                className="w-20 text-right p-1 text-xs border rounded-md border-slate-300 focus:ring-sky-500 focus:border-sky-500"
              />
              {hasChanged && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-sky-600 text-white text-xs px-2 py-1 rounded hover:bg-sky-700 disabled:bg-slate-400"
                >
                  {isSaving ? '...' : 'Save'}
                </button>
              )}
            </div>
          ) : (
            <span className="font-semibold">{kpi.actual.toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-xs">
        <div>
          <span className="text-slate-500">Achievement: </span>
          <span className={`font-bold ${kpi.achievement >= 100 ? 'text-emerald-600' : kpi.achievement >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
            {kpi.achievement}%
          </span>
        </div>
        <div>
          <span className="text-slate-500">Score: </span>
          <span className="font-bold text-sky-700">{kpi.score.toFixed(2)} pts</span>
        </div>
      </div>
    </div>
  );
};

const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useContext(AuthContext);
  const { employees, getEmployeeKpis, annualPlan, loading, branches, addKpi, deleteKpi } = useData();
  const [employee, setEmployee] = useState<Employee | null>(null);

  // New KPI modal state
  const [showAddKpiModal, setShowAddKpiModal] = useState(false);
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiObjectiveId, setNewKpiObjectiveId] = useState<number>(annualPlan[0]?.id || 1);
  const [newKpiWeight, setNewKpiWeight] = useState<number>(20);
  const [newKpiTarget, setNewKpiTarget] = useState<number>(100);
  const [newKpiActual, setNewKpiActual] = useState<number>(0);
  const [isSubmittingKpi, setIsSubmittingKpi] = useState(false);

  useEffect(() => {
    if (id) {
      const foundEmployee = employees.find(e => e.id === parseInt(id, 10));
      setEmployee(foundEmployee || null);
    }
  }, [id, employees]);

  const employeeKpis = useMemo(() => {
    return employee ? getEmployeeKpis(employee.id) : [];
  }, [employee, getEmployeeKpis]);

  const kpisByPerspective = useMemo(() => {
    const grouped: { [key in PerspectiveCategory]?: CalculatedKpi[] } = {};
    employeeKpis.forEach(kpi => {
      const category = kpi.objective?.category || PerspectiveCategory.FINANCIAL;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category]?.push(kpi);
    });
    return grouped;
  }, [employeeKpis]);

  const totalScore = useMemo(() => {
    return employeeKpis.reduce((sum, kpi) => sum + kpi.score, 0);
  }, [employeeKpis]);

  const totalWeight = useMemo(() => {
    return employeeKpis.reduce((sum, kpi) => sum + kpi.weight, 0);
  }, [employeeKpis]);

  if (loading || !employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Employee Details...</div>
      </div>
    );
  }

  // Admin or Manager of that branch can edit
  const isEditable = currentUser?.role === Role.ADMIN || (currentUser?.role === Role.MANAGER && currentUser.branchId === employee.branchId);

  const perspectiveOrder: PerspectiveCategory[] = [
    PerspectiveCategory.FINANCIAL,
    PerspectiveCategory.CUSTOMER,
    PerspectiveCategory.INTERNAL_PROCESS,
    PerspectiveCategory.LEARNING_GROWTH,
  ];

  const handleAddKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKpiName.trim() || !employee) return;
    setIsSubmittingKpi(true);
    try {
      const selectedObj = annualPlan.find(p => p.id === Number(newKpiObjectiveId));
      await addKpi({
        employeeId: employee.id,
        objectiveId: Number(newKpiObjectiveId),
        name: newKpiName.trim(),
        weight: Number(newKpiWeight),
        target: Number(newKpiTarget),
        actual: Number(newKpiActual),
        kpiCategory: selectedObj?.kpiCategory,
      });
      setNewKpiName('');
      setShowAddKpiModal(false);
    } catch (err) {
      console.error('Failed to add KPI:', err);
    } finally {
      setIsSubmittingKpi(false);
    }
  };

  const handleDeleteKpi = async (kpiId: number) => {
    if (window.confirm('Are you sure you want to delete this KPI?')) {
      await deleteKpi(kpiId);
    }
  };

  const branchName = branches.find(b => b.id === employee.branchId)?.name || 'Branch';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link to="/employees" className="hover:text-sky-600">Employees</Link>
        <span>&gt;</span>
        <span className="text-slate-800 font-semibold">{employee.name}</span>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{employee.name}</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                {employee.role}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{branchName} • PIN: <span className="font-mono">{employee.pin}</span></p>
          </div>

          <div className="flex items-center gap-4">
            {isEditable && (
              <button
                onClick={() => setShowAddKpiModal(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add KPI</span>
              </button>
            )}

            <div className="text-left md:text-right bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-[140px]">
              <p className="text-xs text-slate-500 font-medium">Total Score</p>
              <p className={`text-3xl font-extrabold ${totalScore >= 90 ? 'text-emerald-600' : totalScore >= 80 ? 'text-sky-600' : 'text-amber-600'}`}>
                {totalScore.toFixed(2)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Total Weight: {totalWeight}%</p>
            </div>
          </div>
        </div>
      </Card>

      {perspectiveOrder.map((category) => {
        const kpis = kpisByPerspective[category];
        if (!kpis || kpis.length === 0) return null;

        const categoryScore = kpis.reduce((acc, k) => acc + k.score, 0);

        return (
          <Card key={category}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <PerspectiveIcon category={category} />
                <h3 className="text-lg font-bold text-slate-800">{category}</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Subtotal: {categoryScore.toFixed(2)} pts
              </span>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3">
              {kpis.map(kpi => (
                <KpiCard key={kpi.id} kpi={kpi} isEditable={isEditable} onDelete={handleDeleteKpi} />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3 font-semibold w-2/5">KPI & Annual Objective</th>
                    <th className="p-3 font-semibold text-center">Weight</th>
                    <th className="p-3 font-semibold text-center">Target</th>
                    <th className="p-3 font-semibold text-center">Actual</th>
                    <th className="p-3 font-semibold text-center">Achievement</th>
                    <th className="p-3 font-semibold text-center">Score</th>
                    {isEditable && <th className="p-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpis.map(kpi => (
                    <KpiRow key={kpi.id} kpi={kpi} isEditable={isEditable} onDelete={handleDeleteKpi} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {employeeKpis.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4 text-sm">No KPIs assigned to this employee yet.</p>
            {isEditable && (
              <button
                onClick={() => setShowAddKpiModal(true)}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 transition"
              >
                Assign First KPI
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Add KPI Modal */}
      {showAddKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add KPI for {employee.name}</h3>
            <form onSubmit={handleAddKpi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">KPI Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deposit Mobilization"
                  value={newKpiName}
                  onChange={(e) => setNewKpiName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Annual Plan Objective</label>
                <select
                  value={newKpiObjectiveId}
                  onChange={(e) => setNewKpiObjectiveId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {annualPlan.map(obj => (
                    <option key={obj.id} value={obj.id}>
                      [{obj.category}] {obj.objective}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Weight (%)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={newKpiWeight}
                    onChange={(e) => setNewKpiWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Target</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newKpiTarget}
                    onChange={(e) => setNewKpiTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Actual</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newKpiActual}
                    onChange={(e) => setNewKpiActual(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddKpiModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingKpi}
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium shadow-sm transition disabled:opacity-50"
                >
                  {isSubmittingKpi ? 'Saving...' : 'Add KPI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetailPage;