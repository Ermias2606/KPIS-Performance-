import React, { useState, useContext } from 'react';
import { PerspectiveCategory, KpiCategoryItem, Role } from '../../types';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import { COLOR_OPTIONS } from './CategoryHelpers';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (newCategory: KpiCategoryItem) => void;
}

const PRESET_CATEGORIES = [
  {
    name: 'Foreign Remittance & Forex',
    perspective: PerspectiveCategory.FINANCIAL,
    unit: 'USD',
    color: '#14b8a6',
    desc: 'Inward diaspora remittance mobilization, Western Union, MoneyGram and FX trade',
  },
  {
    name: 'Agent Banking & POS Terminals',
    perspective: PerspectiveCategory.INTERNAL_PROCESS,
    unit: 'Transactions',
    color: '#f97316',
    desc: 'Branch agent points of presence, merchant POS deployments and transaction throughput',
  },
  {
    name: 'Loans & Micro-Advances',
    perspective: PerspectiveCategory.FINANCIAL,
    unit: 'ETB',
    color: '#6366f1',
    desc: 'Consumer loans, digital overdrafts and SME working capital portfolio',
  },
  {
    name: 'Non-Interest (IFB) Banking',
    perspective: PerspectiveCategory.CUSTOMER,
    unit: 'Accounts',
    color: '#10b981',
    desc: 'Interest-free banking customer deposits and Sharia-compliant product mobilization',
  },
  {
    name: 'Women & Youth Digital Banking',
    perspective: PerspectiveCategory.CUSTOMER,
    unit: 'Users',
    color: '#ec4899',
    desc: 'Targeted demographic onboarding and financial inclusion initiatives',
  },
];

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
}) => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === Role.ADMIN;
  const { addKpiCategory, kpiCategories } = useData();

  const [name, setName] = useState('');
  const [perspective, setPerspective] = useState<PerspectiveCategory>(PerspectiveCategory.FINANCIAL);
  const [defaultUnit, setDefaultUnit] = useState('ETB');
  const [color, setColor] = useState('#14b8a6');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_CATEGORIES[0]) => {
    setName(preset.name);
    setPerspective(preset.perspective);
    setDefaultUnit(preset.unit);
    setColor(preset.color);
    setDescription(preset.desc);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('Only Admin users can create new categories.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Category name is required.');
      return;
    }

    // Check duplicate
    const exists = kpiCategories.some(
      c => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setError('A category with this name already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addKpiCategory({
        name: trimmedName,
        perspective,
        defaultUnit: defaultUnit.trim() || 'Units',
        color,
        description: description.trim() || `${trimmedName} strategic bank category`,
      });

      if (onCategoryCreated) {
        onCategoryCreated(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create KPI category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-sky-950 px-6 py-5 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <h3 className="text-lg font-bold">Create New KPI Category</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Add a new strategic category to group performance indicators, annual plans, and staff targets
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Quick Banking Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CATEGORIES.map(preset => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition text-slate-700 cursor-pointer"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Foreign Remittance & Forex"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition font-medium"
            />
          </div>

          {/* Perspective & Default Unit */}
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
                Default Metric Unit
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ETB, Users, USD"
                  value={defaultUnit}
                  onChange={e => setDefaultUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition font-medium"
                />
              </div>
            </div>
          </div>

          {/* Color Accent Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Color Theme Badge
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={`w-7 h-7 rounded-full ${c.bgClass} transition-transform flex items-center justify-center cursor-pointer ${
                    color === c.hex ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105'
                  }`}
                >
                  {color === c.hex && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Strategic Description / Scope
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of what indicators and performance are grouped in this category"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition"
            />
          </div>

          {/* Modal Footer */}
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
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl shadow-md shadow-sky-200 transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Save Category</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default CreateCategoryModal;
