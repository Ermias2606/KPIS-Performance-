import React, { useState, useContext } from 'react';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import { Role } from '../../types';
import { getCategoryMeta } from './CategoryHelpers';
import CreateCategoryModal from './CreateCategoryModal';
import CreateKpiModal from './CreateKpiModal';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose }) => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === Role.ADMIN;
  const { kpiCategories, periodicPlans, employeePlans, backlogPlans, deleteKpiCategory } = useData();

  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [selectedCatForKpi, setSelectedCatForKpi] = useState<string>('');
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-6 py-5 text-white flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
                <h3 className="text-xl font-bold">KPI Categories & Strategic Domains</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Manage branch banking categories, indicators, and balanced scorecard perspectives
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin ? (
                <button
                  onClick={() => setShowAddCat(true)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ New Category</span>
                </button>
              ) : (
                <span className="px-2.5 py-1 bg-white/10 rounded-xl text-xs text-slate-300 font-medium">
                  Read-Only Mode (Admin Only)
                </span>
              )}

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* List of categories */}
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpiCategories.map(cat => {
                const meta = getCategoryMeta(cat.name, kpiCategories);
                const matchingPlans = periodicPlans.filter(
                  p => p.category === cat.name || p.category === cat.id
                );
                const matchingEpPlans = employeePlans.filter(
                  p => p.category === cat.name || p.category === cat.id
                );
                const matchingBacklogs = backlogPlans.filter(
                  b => b.category === cat.name || b.category === cat.id
                );

                const totalTarget = matchingPlans.reduce((acc, p) => acc + p.annualTarget, 0);
                const totalActual = matchingPlans.reduce((acc, p) => acc + p.annualActual, 0);
                const achieveRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

                return (
                  <div
                    key={cat.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-2 rounded-xl ${meta.bgClass} ${meta.textClass}`}>
                            {meta.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-800 text-sm">{cat.name}</h4>
                              {cat.isSystem && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded">
                                  Core
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-slate-400">
                              {cat.perspective} • Unit: {cat.defaultUnit}
                            </span>
                          </div>
                        </div>

                        {isAdmin && !cat.isSystem && (
                          confirmDeleteCatId === cat.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  deleteKpiCategory(cat.id);
                                  setConfirmDeleteCatId(null);
                                }}
                                className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700 transition cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteCatId(null)}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteCatId(cat.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                              title="Delete custom category"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
                        )}
                      </div>

                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    {/* Stats & Progress */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">Linked: </span>
                        <span className="font-bold text-slate-700">
                          {matchingPlans.length} plans, {matchingEpPlans.length} assigned, {matchingBacklogs.length} backlogs
                        </span>
                      </div>
                      <span className={`font-black ${achieveRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {achieveRate}% Pace
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-1 flex items-center justify-between">
                      {isAdmin ? (
                        <button
                          onClick={() => {
                            setSelectedCatForKpi(cat.id);
                            setShowAddKpi(true);
                          }}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>+ Add KPI in this Category</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Admin role required to configure KPIs</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500 font-medium">
              Total Categories: {kpiCategories.length}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <CreateCategoryModal
        isOpen={showAddCat}
        onClose={() => setShowAddCat(false)}
      />

      <CreateKpiModal
        isOpen={showAddKpi}
        onClose={() => setShowAddKpi(false)}
        initialCategory={selectedCatForKpi}
      />
    </>
  );
};
export default ManageCategoriesModal;
