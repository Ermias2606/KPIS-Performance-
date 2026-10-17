import React from 'react';

export interface KpiProgressBarProps {
  label: string;
  actual: number;
  target: number;
  annualPlanTarget?: number;
  annualPlanObjectiveTitle?: string;
  unit?: string;
  weight?: number;
  score?: number;
  perspective?: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg';
  showAnnualComparison?: boolean;
  onQuickUpdate?: () => void;
}

export const KpiProgressBar: React.FC<KpiProgressBarProps> = ({
  label,
  actual,
  target,
  annualPlanTarget,
  annualPlanObjectiveTitle,
  unit = '',
  weight,
  score,
  perspective,
  accentColor,
  size = 'md',
  showAnnualComparison = true,
  onQuickUpdate,
}) => {
  const rawPercentage = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0;
  const completionPct = Math.max(0, Math.round(rawPercentage));
  const clampedWidth = Math.min(100, Math.max(0, rawPercentage));

  const annualBenchmarkTarget = annualPlanTarget && annualPlanTarget > 0 ? annualPlanTarget : target;
  const annualSharePct =
    annualBenchmarkTarget > 0 ? Math.min(100, Math.max(0, Math.round((actual / annualBenchmarkTarget) * 100))) : 0;

  const getStatusConfig = (pct: number) => {
    if (pct >= 100) {
      return {
        barClass: 'bg-emerald-500',
        textClass: 'text-emerald-700',
        bgBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        statusText: 'Target Met',
      };
    }
    if (pct >= 80) {
      return {
        barClass: 'bg-sky-600',
        textClass: 'text-sky-700',
        bgBadge: 'bg-sky-50 text-sky-700 border-sky-200',
        statusText: 'On Track',
      };
    }
    if (pct >= 50) {
      return {
        barClass: 'bg-amber-500',
        textClass: 'text-amber-700',
        bgBadge: 'bg-amber-50 text-amber-700 border-amber-200',
        statusText: 'In Progress',
      };
    }
    return {
      barClass: 'bg-rose-500',
      textClass: 'text-rose-700',
      bgBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      statusText: 'Needs Focus',
    };
  };

  const status = getStatusConfig(completionPct);
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2.5';

  return (
    <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 transition-all shadow-2xs space-y-2.5">
      {/* Top Row: KPI Title, Perspective/Objective & Completion Percentage */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{label}</h4>
            {perspective && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {perspective}
              </span>
            )}
            {weight !== undefined && (
              <span className="text-[10px] font-mono font-semibold text-slate-500">
                Weight: {weight}%
              </span>
            )}
          </div>
          {annualPlanObjectiveTitle && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              Annual Plan Objective: <span className="font-medium text-slate-700">{annualPlanObjectiveTitle}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className={`text-sm font-black font-mono tabular-nums ${status.textClass}`}>
                {completionPct}%
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${status.bgBadge}`}>
                {status.statusText}
              </span>
            </div>
            {score !== undefined && (
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                Weighted Score: <strong className="text-slate-700">{score.toFixed(2)} pts</strong>
              </p>
            )}
          </div>

          {onQuickUpdate && (
            <button
              type="button"
              onClick={onQuickUpdate}
              title="Update KPI Actual Progress"
              className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Primary Progress Bar: Employee KPI Completion */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Actual: <strong className="font-mono text-slate-800">{actual.toLocaleString()}</strong> {unit}
          </span>
          <span>
            KPI Target: <strong className="font-mono text-slate-700">{target.toLocaleString()}</strong> {unit}
          </span>
        </div>

        <div
          className={`w-full bg-slate-100 rounded-full ${heightClass} overflow-hidden relative`}
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* 80% On-Track Benchmark Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-300/80 z-10"
            style={{ left: '80%' }}
            title="80% On-Track Threshold"
          />
          <div
            className={`${heightClass} rounded-full transition-all duration-500 ease-out ${
              accentColor ? '' : status.barClass
            }`}
            style={{
              width: `${clampedWidth}%`,
              ...(accentColor ? { backgroundColor: accentColor } : {}),
            }}
          />
        </div>
      </div>

      {/* Secondary Comparison Bar: Performance Relative to Overall Annual Plan */}
      {showAnnualComparison && annualBenchmarkTarget > 0 && (
        <div className="pt-1.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-slate-400 font-medium shrink-0">vs. Annual Plan:</span>
            <div className="w-24 sm:w-32 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${annualSharePct}%` }}
              />
            </div>
            <span className="font-mono font-bold text-indigo-700 tabular-nums">
              {annualSharePct}%
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">
            Annual Plan Target: {annualBenchmarkTarget.toLocaleString()} {unit}
          </span>
        </div>
      )}
    </div>
  );
};

export default KpiProgressBar;
