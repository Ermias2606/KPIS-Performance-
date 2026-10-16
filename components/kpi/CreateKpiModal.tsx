import React, { useState, useMemo, useContext } from 'react';
import { PerspectiveCategory, KpiCategoryItem, Role } from '../../types';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import { getCategoryMeta } from './CategoryHelpers';
import CreateCategoryModal from './CreateCategoryModal';

interface CreateKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
  initialEmployeeId?: number;
}

const COMMON_UNITS = ['ETB', 'Accounts', 'Users', 'Cards', 'Transactions', 'USD', '%'];

export const CreateKpiModal: React.FC<CreateKpiModalProps> = ({
  isOpen,
  onClose,
  initialCategory,
  initialEmployeeId,
}) => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === Role.ADMIN;
  const { kpiCategories, employees, createFullKpi } = useData();

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || kpiCategories[0]?.id || 'DEPOSIT'
  );
  const [name, setName] = useState('');
  const [perspective, setPerspective] = useState<PerspectiveCategory>(PerspectiveCategory.FINANCIAL);
  const [unit, setUnit] = useState('ETB');
  const [customUnit, setCustomUnit] = useState('');
  const [annualTarget, setAnnualTarget] = useState<number | ''>(500000);
  const [annualActual, setAnnualActual] = useState<number | ''>(0);
  const [weight, setWeight] = useState<number | ''>(15);

  // Assignment Options
  const [assignToStaff, setAssignToStaff] = useState<boolean>(true);
  const [targetEmployeeId, setTargetEmployeeId] = useState<number>(
    initialEmployeeId || employees.find(e => e.role !== 'Admin (HQ)')?.id || 2
  );
  const [addToPeriodicPlan, setAddToPeriodicPlan] = useState<boolean>(true);
  const [addToAnnualPlan, setAddToAnnualPlan] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Synchronize when category changes
  const activeCategoryObj = useMemo(() => {
    return kpiCategories.find(c => c.id === selectedCategory || c.name === selectedCategory) || kpiCategories[0];
  }, [kpiCategories, selectedCategory]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    const cat = kpiCategories.find(c => c.id === catId);
    if (cat) {
      setPerspective(cat.perspective);
      if (cat.defaultUnit) {
        setUnit(cat.defaultUnit);
      }
    }
  };

  const handleCategoryCreated = (newCat: KpiCategoryItem) => {
    setSelectedCategory(newCat.id);
    setPerspective(newCat.perspective);
    setUnit(newCat.defaultUnit || 'Units');
  };

  if (!isOpen) return null;

  const effectiveUnit = unit === 'CUSTOM' ? (customUnit.trim() || 'Units') : unit;
  const numTarget = typeof annualTarget === 'number' ? annualTarget : 0;
  const numActual = typeof annualActual === 'number' ? annualActual : 0;
  const numWeight = typeof weight === 'number' ? weight : 10;
  const achievementRate = numTarget > 0 ? Math.round((numActual / numTarget) * 100) : 0;

  const categoryMeta = getCategoryMeta(activeCategoryObj?.name || selectedCategory, kpiCategories);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('Only Admin users can create new KPIs.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter a KPI name.');
      return;
    }

    if (numTarget <= 0) {
      setError('Annual Target must be greater than 0.');
      return;
    }

    if (numWeight <= 0) {
      setError('Weight must be greater than 0%.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFullKpi({
        name: name.trim(),
        category: activeCategoryObj?.name || selectedCategory,
        perspective,
        metricUnit: effectiveUnit,
        annualTarget: numTarget,
        annualActual: numActual,
        weight: numWeight,
        assignToEmployeeId: assignToStaff ? targetEmployeeId : undefined,
        addToPeriodicPlan,
        addToAnnualPlan,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create KPI. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffMembers = employees.filter(e => e.role !== 'Admin (HQ)');

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 px-6 py-5 text-white flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                <h3 className="text-xl font-bold">Create New Performance KPI</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Define a branch Key Performance Indicator under any category with annual, quarterly, monthly, and staff allocations
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Category Selector + Add Category Button */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  KPI Category *
                </label>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Create New Category</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kpiCategories.map(cat => {
                  const meta = getCategoryMeta(cat.name, kpiCategories);
                  const isSelected = selectedCategory === cat.id || selectedCategory === cat.name;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                        isSelected
                          ? `${meta.bgClass} ${meta.borderClass} ring-2 ring-sky-500 shadow-xs`
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="scale-80 shrink-0">{meta.icon}</span>
                      <div className="overflow-hidden">
                        <p className={`text-xs font-bold truncate ${isSelected ? meta.textClass : 'text-slate-700'}`}>
                          {cat.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{cat.defaultUnit}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                KPI Name / Strategic Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Special High-Yield Savings Campaign, Inward Remittance Volume"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-medium"
              />
            </div>

            {/* Perspective & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  BSC Perspective
                </label>
                <select
                  value={perspective}
                  onChange={e => setPerspective(e.target.value as PerspectiveCategory)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-medium"
                >
                  <option value={PerspectiveCategory.FINANCIAL}>Financial</option>
                  <option value={PerspectiveCategory.CUSTOMER}>Customer</option>
                  <option value={PerspectiveCategory.INTERNAL_PROCESS}>Internal Process</option>
                  <option value={PerspectiveCategory.LEARNING_GROWTH}>Learning & Growth</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metric Unit
                </label>
                <div className="flex gap-2">
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-medium"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="CUSTOM">Custom...</option>
                  </select>
                  {unit === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="e.g. Points"
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value)}
                      className="w-32 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Target, Actual, Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Annual Target ({effectiveUnit}) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={annualTarget}
                  onChange={e => setAnnualTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Baseline / Actual ({effectiveUnit})
                </label>
                <input
                  type="number"
                  min={0}
                  value={annualActual}
                  onChange={e => setAnnualActual(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Scorecard Weight (%) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={weight}
                  onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Assignment & Strategic Deployment Options */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Deployment & Allocation Options
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignToStaff}
                    onChange={e => setAssignToStaff(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    Assign this KPI directly to employee scorecard
                  </span>
                </label>

                {assignToStaff && (
                  <div className="ml-6.5 pt-1">
                    <select
                      value={targetEmployeeId}
                      onChange={e => setTargetEmployeeId(Number(e.target.value))}
                      className="px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-semibold text-slate-700"
                    >
                      {staffMembers.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-500 ml-2">
                      (Will map to employee scorecard & quarterly plan)
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToPeriodicPlan}
                      onChange={e => setAddToPeriodicPlan(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Include in Branch Periodic Plan (Q1–Q4 & Monthly tracking)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToAnnualPlan}
                      onChange={e => setAddToAnnualPlan(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Include in Branch BSC Objectives
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Live KPI Card Preview */}
            <div className="p-3.5 bg-gradient-to-br from-slate-50 to-sky-50/50 rounded-xl border border-sky-100 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryMeta.bgClass} ${categoryMeta.textClass}`}>
                    {categoryMeta.displayName}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Weight: {numWeight}%
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-sm mt-1">
                  {name.trim() || 'Untitled KPI'}
                </p>
                <p className="text-xs text-slate-500">
                  Target: {numTarget.toLocaleString()} {effectiveUnit} • Actual: {numActual.toLocaleString()} {effectiveUnit}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-xl font-black ${achievementRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {achievementRate}%
                </span>
                <p className="text-[10px] text-slate-400">Current Pace</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold text-sm rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl shadow-md shadow-sky-200 transition flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Saving KPI...</span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Create & Deploy KPI</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-modal: Create Category */}
      <CreateCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
      />
    </>
  );
};
export default CreateKpiModal;
