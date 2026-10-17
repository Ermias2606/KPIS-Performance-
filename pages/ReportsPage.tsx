import React, { useContext, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useData, calculateKpiMetrics } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Employee, Role, PerspectiveCategory, PeriodicPlanItem, EmployeePlanAssignment } from '../types';

export const ReportsPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    activeOrganization,
    employees,
    branches,
    activeBranchId,
    fiscalYear,
    annualPlan,
    kpis,
    periodicPlans,
    backlogPlans,
    employeePlans,
    kpiCategories,
    loading,
    getDepositMobilizationMetrics,
  } = useData();

  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<number | 'ALL'>('ALL');
  const [activeReportTab, setActiveReportTab] = useState<'backlog' | 'kpis' | 'deposit' | 'scorecards' | 'periodicSummary' | 'myReport'>('periodicSummary');
  const [periodTab, setPeriodTab] = useState<'all' | 'quarterly' | 'monthly'>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 'q1' | 'q2' | 'q3' | 'q4'>('all');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === (user?.branchId || activeBranchId)) || branches[0];
  }, [branches, user, activeBranchId]);

  const branchName = activeBranch?.name || 'Main Operations Branch';
  const branchCode = activeBranch?.code || 'MOB-01';

  const depositMetrics = useMemo(() => {
    return getDepositMobilizationMetrics(activeBranch?.id);
  }, [getDepositMobilizationMetrics, activeBranch]);

  // Branch employees
  const branchEmployees = useMemo(() => {
    if (!user) return [];
    return user.role === Role.ADMIN
      ? employees.filter(e => e.role !== Role.ADMIN)
      : employees.filter(e => e.branchId === user.branchId && e.role !== Role.ADMIN);
  }, [user, employees]);

  // Backlog and variation calculations across periodic plans and employee plans
  const calculatedVariations = useMemo(() => {
    const list: Array<{
      id: string;
      source: 'branch' | 'employee';
      employeeName?: string;
      planTitle: string;
      category: string;
      unit: string;
      periodType: 'quarter' | 'month' | 'annual';
      periodKey: string;
      periodLabel: string;
      target: number;
      actual: number;
      variance: number; // actual - target
      deficit: number;  // target - actual when target > actual
      achievement: number;
      status: 'Surplus' | 'On Track' | 'Minor Lag' | 'Critical Shortfall';
    }> = [];

    // Periodic Plans (Branch Level)
    periodicPlans.forEach(plan => {
      // Annual
      if (plan.annualTarget > 0) {
        const variance = plan.annualActual - plan.annualTarget;
        const deficit = plan.annualTarget > plan.annualActual ? plan.annualTarget - plan.annualActual : 0;
        const achievement = Math.round((plan.annualActual / plan.annualTarget) * 100);
        list.push({
          id: `var-ann-${plan.id}`,
          source: 'branch',
          planTitle: plan.name,
          category: plan.category,
          unit: plan.metricUnit,
          periodType: 'annual',
          periodKey: 'annual',
          periodLabel: 'Full Fiscal Year',
          target: plan.annualTarget,
          actual: plan.annualActual,
          variance,
          deficit,
          achievement,
          status: achievement >= 100 ? 'Surplus' : achievement >= 80 ? 'On Track' : achievement >= 60 ? 'Minor Lag' : 'Critical Shortfall',
        });
      }

      // Quarters
      const quarters = ['q1', 'q2', 'q3', 'q4'] as const;
      quarters.forEach(q => {
        const qData = plan.quarterly[q];
        if (qData && qData.target > 0) {
          const variance = qData.actual - qData.target;
          const deficit = qData.target > qData.actual ? qData.target - qData.actual : 0;
          const achievement = Math.round((qData.actual / qData.target) * 100);
          list.push({
            id: `var-q-${plan.id}-${q}`,
            source: 'branch',
            planTitle: plan.name,
            category: plan.category,
            unit: plan.metricUnit,
            periodType: 'quarter',
            periodKey: q,
            periodLabel: q.toUpperCase(),
            target: qData.target,
            actual: qData.actual,
            variance,
            deficit,
            achievement,
            status: achievement >= 100 ? 'Surplus' : achievement >= 80 ? 'On Track' : achievement >= 60 ? 'Minor Lag' : 'Critical Shortfall',
          });
        }
      });

      // Months 1 to 12
      const monthNames = [
        'Month 1 (July)', 'Month 2 (August)', 'Month 3 (September)',
        'Month 4 (October)', 'Month 5 (November)', 'Month 6 (December)',
        'Month 7 (January)', 'Month 8 (February)', 'Month 9 (March)',
        'Month 10 (April)', 'Month 11 (May)', 'Month 12 (June)',
      ];
      for (let m = 1; m <= 12; m++) {
        const mData = plan.monthly[m];
        if (mData && mData.target > 0) {
          const variance = mData.actual - mData.target;
          const deficit = mData.target > mData.actual ? mData.target - mData.actual : 0;
          const achievement = Math.round((mData.actual / mData.target) * 100);
          list.push({
            id: `var-m-${plan.id}-${m}`,
            source: 'branch',
            planTitle: plan.name,
            category: plan.category,
            unit: plan.metricUnit,
            periodType: 'month',
            periodKey: `m${m}`,
            periodLabel: monthNames[m - 1] || `Month ${m}`,
            target: mData.target,
            actual: mData.actual,
            variance,
            deficit,
            achievement,
            status: achievement >= 100 ? 'Surplus' : achievement >= 80 ? 'On Track' : achievement >= 60 ? 'Minor Lag' : 'Critical Shortfall',
          });
        }
      }
    });

    // Employee Plan Assignments
    employeePlans.forEach(ep => {
      const emp = employees.find(e => e.id === ep.employeeId);
      const quarters = ['q1', 'q2', 'q3', 'q4'] as const;
      quarters.forEach(q => {
        const qData = ep.quarterly[q];
        if (qData && qData.target > 0) {
          const variance = qData.actual - qData.target;
          const deficit = qData.target > qData.actual ? qData.target - qData.actual : 0;
          const achievement = Math.round((qData.actual / qData.target) * 100);
          list.push({
            id: `var-emp-${ep.id}-${q}`,
            source: 'employee',
            employeeName: emp?.name,
            planTitle: ep.title,
            category: ep.category,
            unit: ep.metricUnit,
            periodType: 'quarter',
            periodKey: q,
            periodLabel: `${q.toUpperCase()} (${emp?.name || 'Staff'})`,
            target: qData.target,
            actual: qData.actual,
            variance,
            deficit,
            achievement,
            status: achievement >= 100 ? 'Surplus' : achievement >= 80 ? 'On Track' : achievement >= 60 ? 'Minor Lag' : 'Critical Shortfall',
          });
        }
      });
    });

    return list;
  }, [periodicPlans, employeePlans, employees]);

  // Filtered Variations (for Backlog Summary)
  const filteredShortfalls = useMemo(() => {
    return calculatedVariations.filter(v => {
      if (v.deficit <= 0) return false;
      if (periodTab === 'quarterly' && v.periodType !== 'quarter') return false;
      if (periodTab === 'monthly' && v.periodType !== 'month') return false;
      if (selectedQuarter !== 'all' && v.periodType === 'quarter' && v.periodKey !== selectedQuarter) return false;
      return true;
    });
  }, [calculatedVariations, periodTab, selectedQuarter]);

  // Aggregate stats for Backlog Shortfalls
  const shortfallStats = useMemo(() => {
    const totalDeficits = filteredShortfalls.reduce((acc, v) => acc + v.deficit, 0);
    const criticalCount = filteredShortfalls.filter(v => v.status === 'Critical Shortfall').length;
    const quarterlyShortfalls = calculatedVariations.filter(v => v.periodType === 'quarter' && v.deficit > 0).length;
    const monthlyShortfalls = calculatedVariations.filter(v => v.periodType === 'month' && v.deficit > 0).length;
    return { totalDeficits, criticalCount, quarterlyShortfalls, monthlyShortfalls };
  }, [filteredShortfalls, calculatedVariations]);

  // Analytical Detailed KPI list
  const detailedKpisList = useMemo(() => {
    return annualPlan.map(obj => {
      const matchingPeriodic = periodicPlans.find(p => p.category === obj.kpiCategory) || {
        annualTarget: obj.target || 0,
        annualActual: obj.actual || 0,
        metricUnit: obj.unit || 'Units',
        quarterly: {
          q1: { target: Math.round((obj.target || 0) / 4), actual: Math.round((obj.actual || 0) / 4) },
          q2: { target: Math.round((obj.target || 0) / 4), actual: Math.round((obj.actual || 0) / 4) },
          q3: { target: Math.round((obj.target || 0) / 4), actual: Math.round((obj.actual || 0) / 4) },
          q4: { target: Math.round((obj.target || 0) / 4), actual: Math.max(0, (obj.actual || 0) - Math.round((obj.actual || 0) / 4) * 3) },
        },
      };

      const target = obj.target || matchingPeriodic.annualTarget || 1;
      const actual = obj.actual || matchingPeriodic.annualActual || 0;
      const achievement = Math.min(120, Math.round((actual / target) * 100));
      const variance = actual - target;
      const weight = obj.weight || 20;
      const score = parseFloat(((achievement / 100) * weight).toFixed(2));

      return {
        id: obj.id,
        category: obj.category,
        kpiCategory: obj.kpiCategory || 'General',
        name: obj.objective,
        unit: obj.unit || matchingPeriodic.metricUnit,
        weight,
        target,
        actual,
        variance,
        achievement,
        score,
        quarterly: matchingPeriodic.quarterly,
      };
    });
  }, [annualPlan, periodicPlans]);

  // Export to Excel with full sheets
  const exportToExcelFull = () => {
    const wb = XLSX.utils.book_new();

    // 1. Branch Summary Sheet
    const branchSummaryData = branchEmployees.map(emp => {
      const empKpis = kpis.filter(k => k.employeeId === emp.id);
      const totalScore = empKpis.reduce((acc, kpi) => {
        const obj = annualPlan.find(p => p.id === kpi.objectiveId);
        return acc + (obj ? calculateKpiMetrics(kpi, obj).score : 0);
      }, 0);

      return {
        'Employee ID': emp.id,
        'Name': emp.name,
        'Position Title': emp.positionTitle || 'Staff Member',
        'Role': emp.role,
        'Branch': branchName,
        'KPI Count': empKpis.length,
        'Total BSC Score (%)': totalScore.toFixed(2),
        'Performance Grade': totalScore >= 90 ? 'Outstanding' : totalScore >= 80 ? 'On Track' : 'Needs Focus',
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(branchSummaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Staff Scorecards');

    // 2. Backlog & Period Variances Sheet
    const backlogData = filteredShortfalls.map(item => ({
      'Period Level': item.periodType.toUpperCase(),
      'Period': item.periodLabel,
      'Metric / Plan': item.planTitle,
      'Category': item.category,
      'Target': item.target,
      'Actual': item.actual,
      'Deficit (Shortfall)': item.deficit,
      'Unit': item.unit,
      'Achievement (%)': `${item.achievement}%`,
      'Severity': item.status,
      'Responsible Assignee': item.employeeName || 'Branch Team',
    }));
    const ws2 = XLSX.utils.json_to_sheet(backlogData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Period Shortfalls & Backlog');

    // 3. Deposit Mobilization June Baseline Sheet
    const depositSheetData = [
      { Metric: 'Branch Name', Value: branchName },
      { Metric: 'Branch Code', Value: branchCode },
      { Metric: 'Fiscal Year', Value: activeBranch?.fiscalYear || fiscalYear },
      { Metric: 'Audited June Baseline Deposit Balance (ETB)', Value: depositMetrics.juneBaseline },
      { Metric: 'Annual Mobilization Increment Target (ETB)', Value: depositMetrics.annualTargetIncrement },
      { Metric: 'Actual Mobilized Increment (ETB)', Value: depositMetrics.actualNetIncrement },
      { Metric: 'Current Total Deposit Closing Balance (ETB)', Value: depositMetrics.currentDepositBalance },
      { Metric: 'Net Variance vs Target Increment (ETB)', Value: depositMetrics.netVariance },
      { Metric: 'Achievement vs Target (%)', Value: `${depositMetrics.incrementAchievement}%` },
      { Metric: 'Status vs June Baseline', Value: depositMetrics.isUnderJuneBalance ? 'Under June Balance' : 'Above June Baseline' },
    ];
    const ws3 = XLSX.utils.json_to_sheet(depositSheetData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Deposit June Baseline');

    XLSX.writeFile(wb, `Performance_Tracker_Comprehensive_BSC_Audit_${new Date().getFullYear()}.xlsx`);
  };

  // Export Executive PDF Summary
  const exportExecutivePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199);
    doc.text(`${activeOrganization?.name || 'Performance Tracker'} — Balanced Scorecard & Audit Report`, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Sector: ${activeOrganization?.sector || 'Enterprise'} | Branch: ${branchName} (${branchCode}) | Fiscal Year: ${activeBranch?.fiscalYear || fiscalYear} | Date: ${new Date().toLocaleDateString()}`,
      14,
      27
    );

    // June Deposit Summary Callout
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Deposit Mobilization & Previous June Baseline:', 14, 37);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `• June Baseline Balance: ${(depositMetrics.juneBaseline / 1000000).toFixed(2)}M ETB   • Current Balance: ${(depositMetrics.currentDepositBalance / 1000000).toFixed(2)}M ETB`,
      14,
      43
    );
    doc.text(
      `• Target Increment: +${(depositMetrics.annualTargetIncrement / 1000000).toFixed(2)}M ETB   • Net Growth: +${(depositMetrics.actualNetIncrement / 1000000).toFixed(2)}M ETB (${depositMetrics.incrementAchievement}% Achieved)`,
      14,
      48
    );

    // Employee scorecard table
    const tableData = branchEmployees.map(emp => {
      const empKpis = kpis.filter(k => k.employeeId === emp.id);
      const total = empKpis.reduce((acc, k) => {
        const obj = annualPlan.find(p => p.id === k.objectiveId);
        return acc + (obj ? calculateKpiMetrics(k, obj).score : 0);
      }, 0);
      return [
        emp.name,
        emp.positionTitle || emp.role,
        empKpis.length.toString(),
        `${total.toFixed(2)}%`,
        total >= 90 ? 'Outstanding' : total >= 80 ? 'On Track' : 'Needs Focus',
      ];
    });

    const options = {
      startY: 55,
      head: [['Employee Name', 'Position Title', 'KPI Count', 'Overall Score', 'Status']],
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

    // Shortfalls Table
    const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 120;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Key Period Shortfalls & Backlog Deficits:', 14, lastY);

    const shortfallRows = filteredShortfalls.slice(0, 10).map(s => [
      s.periodLabel,
      s.planTitle,
      s.target.toLocaleString(),
      s.actual.toLocaleString(),
      `-${s.deficit.toLocaleString()} ${s.unit}`,
      `${s.achievement}%`,
    ]);

    const shortfallOptions = {
      startY: lastY + 5,
      head: [['Period', 'Metric / Plan', 'Target', 'Actual', 'Shortfall', 'Achievement']],
      body: shortfallRows,
      theme: 'grid' as const,
      headStyles: {
        fillColor: [217, 119, 6] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
      },
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(shortfallOptions);
    } else {
      autoTable(doc, shortfallOptions);
    }

    doc.save(`Performance_Tracker_BSC_Audit_${new Date().getFullYear()}.pdf`);
  };

  const exportEmployeePDF = (employee: Employee) => {
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
      doc.text('Balanced Scorecard Performance Audit', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Employee: ${employee.name}`, 14, 32);
      doc.text(`Position Title: ${employee.positionTitle || employee.role}`, 14, 38);
      doc.text(`Branch: ${branchName} (${branchCode})`, 14, 44);

      doc.setFontSize(14);
      doc.setTextColor(totalScore >= 80 ? 16 : 217, totalScore >= 80 ? 185 : 119, totalScore >= 80 ? 129 : 6);
      doc.text(`Overall BSC Score: ${totalScore.toFixed(2)}%`, 130, 32);

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
        <div className="text-xl font-semibold text-slate-600">Loading Comprehensive Reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-800 rounded-full border border-sky-200">
              BSC Audit & Reports
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {branchName} ({branchCode}) • FY {activeBranch?.fiscalYear || fiscalYear}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Performance Reports & Backlog Analytics
          </h1>
          <p className="text-sm text-slate-500">
            Comprehensive variance tracking across quarterly and monthly periods, June baseline deposit increments, and staff scorecards.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={exportToExcelFull}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            onClick={exportExecutivePDF}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Export Branch PDF</span>
          </button>
        </div>
      </div>

      {/* June Closing Deposit Baseline & Increment Analysis Card */}
      <Card className="border-sky-200 bg-gradient-to-br from-white via-sky-50/20 to-sky-100/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-sky-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">
                  End of Previous Year (June) Closing Balance & Deposit Increment
                </h3>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  depositMetrics.isUnderJuneBalance ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {depositMetrics.isUnderJuneBalance ? 'Under June Baseline (Deficit)' : 'Above June Baseline (Net Expansion)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Benchmark against audited June 30 closing balance to evaluate true net branch growth and annual increment targets.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">
              June Audited Baseline
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono mt-1">
              {(depositMetrics.juneBaseline / 1000000).toFixed(2)}M ETB
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Starting balance at fiscal year open</p>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-sky-700 uppercase">
              Target Annual Increment
            </span>
            <div className="text-xl font-bold text-sky-700 font-mono mt-1">
              +{(depositMetrics.annualTargetIncrement / 1000000).toFixed(2)}M ETB
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Planned net mobilization growth</p>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase">
              Actual Net Mobilization
            </span>
            <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
              +{(depositMetrics.actualNetIncrement / 1000000).toFixed(2)}M ETB
            </div>
            <p className="text-[10px] text-emerald-600 mt-1">
              {depositMetrics.incrementAchievement}% of target increment mobilized
            </p>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-700 uppercase">
              Current Total Closing Balance
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono mt-1">
              {(depositMetrics.currentDepositBalance / 1000000).toFixed(2)}M ETB
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Baseline + Net mobilized actual
            </p>
          </div>
        </div>

        {/* Quarterly Increment Table */}
        <div className="mt-4 pt-4 border-t border-sky-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
            Quarterly Deposit Increment Progression Over June Baseline
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['q1', 'q2', 'q3', 'q4'] as const).map(q => {
              const qData = depositMetrics.quarterlyIncrements[q];
              const isAhead = qData.variance >= 0;
              return (
                <div key={q} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800">{q.toUpperCase()}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isAhead ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {qData.achievement}%
                    </span>
                  </div>
                  <div className="text-slate-600">Target: <strong className="font-mono">{(qData.target / 1000000).toFixed(2)}M</strong></div>
                  <div className="text-slate-600">Actual: <strong className="font-mono">{(qData.actual / 1000000).toFixed(2)}M</strong></div>
                  <div className={`mt-1 font-semibold ${isAhead ? 'text-emerald-700' : 'text-red-600'}`}>
                    Var: {isAhead ? '+' : ''}{(qData.variance / 1000000).toFixed(2)}M ETB
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveReportTab('periodicSummary')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeReportTab === 'periodicSummary'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Periodic Branch & Employee Plans
        </button>
        <button
          onClick={() => setActiveReportTab('backlog')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeReportTab === 'backlog'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Backlog & Period Shortfall Summary ({filteredShortfalls.length})
        </button>
        <button
          onClick={() => setActiveReportTab('kpis')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeReportTab === 'kpis'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Detailed KPI Analytical Performance ({detailedKpisList.length})
        </button>
        <button
          onClick={() => setActiveReportTab('scorecards')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeReportTab === 'scorecards'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Staff Performance Scorecards ({branchEmployees.length})
        </button>
        {user?.role === Role.STAFF && (
          <button
            onClick={() => setActiveReportTab('myReport')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeReportTab === 'myReport'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Comprehensive Performance Report
          </button>
        )}
      </div>

      {/* TAB 0: PERIODIC BRANCH & EMPLOYEE PLANS */}
      {activeReportTab === 'periodicSummary' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Branch Periodic Plans vs. Employee Plan Assignments
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periodic comparison (Annual & Quarterly) showing actual performance, backlogs (deficits), progress achieved percentage, and employee contributions against total branch plans.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {periodicPlans.map(bPlan => {
                const branchTarget = bPlan.annualTarget || 1;
                const branchActual = bPlan.annualActual || 0;
                const branchRate = Math.round((branchActual / branchTarget) * 100);
                const assignedEmpsForPlan = employeePlans.filter(ep => ep.category === bPlan.category);

                return (
                  <div key={bPlan.id} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                    {/* Branch Master Plan Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800">
                            {bPlan.category}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{bPlan.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Branch Master Target: <strong className="font-mono text-slate-800">{bPlan.annualTarget.toLocaleString()} {bPlan.metricUnit}</strong> | Actual Achieved: <strong className="font-mono text-emerald-700">{bPlan.annualActual.toLocaleString()} {bPlan.metricUnit}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Branch Progress</p>
                          <p className={`text-base font-black ${branchRate >= 90 ? 'text-emerald-600' : 'text-sky-600'}`}>{branchRate}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Quarterly Breakdown for Branch Plan */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['q1', 'q2', 'q3', 'q4'] as const).map(q => {
                        const qData = bPlan.quarterly[q];
                        const qTarget = qData?.target || 0;
                        const qActual = qData?.actual || 0;
                        const qRate = qTarget > 0 ? Math.round((qActual / qTarget) * 100) : 0;
                        const qDeficit = Math.max(0, qTarget - qActual);

                        return (
                          <div key={q} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex justify-between items-center font-bold text-slate-800">
                              <span>{q.toUpperCase()} Period</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${qRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {qRate}%
                              </span>
                            </div>
                            <div className="text-slate-600">Target: <span className="font-mono">{qTarget.toLocaleString()}</span></div>
                            <div className="text-slate-600">Actual: <span className="font-mono text-emerald-600">{qActual.toLocaleString()}</span></div>
                            {qDeficit > 0 && (
                              <div className="text-red-600 font-semibold text-[11px]">Shortfall / Backlog: -{qDeficit.toLocaleString()}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Assigned Employees Contributions Table */}
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        Assigned Employee Contributions to {bPlan.category} ({assignedEmpsForPlan.length} Staff Assigned)
                      </h5>

                      {assignedEmpsForPlan.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                              <tr>
                                <th className="p-2.5">Employee Name</th>
                                <th className="p-2.5">Assigned Plan Title</th>
                                <th className="p-2.5 text-right">Target</th>
                                <th className="p-2.5 text-right">Actual</th>
                                <th className="p-2.5 text-center">Progress %</th>
                                <th className="p-2.5 text-center">Branch Share Contribution %</th>
                                <th className="p-2.5 text-right">Backlog / Deficit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                              {assignedEmpsForPlan.map(ep => {
                                const emp = employees.find(e => e.id === ep.employeeId);
                                const empTarget = ep.annualTarget || 1;
                                const empActual = ep.annualActual || 0;
                                const empRate = empTarget > 0 ? Math.round((empActual / empTarget) * 100) : 0;
                                const contribShare = branchTarget > 0 ? Math.round((empTarget / branchTarget) * 100) : 0;
                                const empDeficit = Math.max(0, empTarget - empActual);

                                return (
                                  <tr key={ep.id} className="hover:bg-slate-50 transition">
                                    <td className="p-2.5 font-bold text-slate-900">{emp?.name || 'Staff'}</td>
                                    <td className="p-2.5">{ep.title}</td>
                                    <td className="p-2.5 text-right font-mono font-bold">{empTarget.toLocaleString()}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{empActual.toLocaleString()}</td>
                                    <td className="p-2.5 text-center font-bold">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${empRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                                        {empRate}%
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-center font-bold text-sky-700 font-mono">
                                      {contribShare}% of Branch Plan
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-slate-600">
                                      {empDeficit > 0 ? `-${empDeficit.toLocaleString()} ${ep.metricUnit}` : 'On Track'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic bg-white p-3 rounded-xl border border-slate-200 text-center">
                          No specific employee plan assignments in this category yet.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 1: BACKLOG & PERIOD SHORTFALL SUMMARY */}
      {activeReportTab === 'backlog' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-500 uppercase">Period Breakdown:</span>
              <button
                onClick={() => setPeriodTab('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  periodTab === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Periods
              </button>
              <button
                onClick={() => setPeriodTab('quarterly')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  periodTab === 'quarterly' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Quarterly (Q1-Q4)
              </button>
              <button
                onClick={() => setPeriodTab('monthly')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  periodTab === 'monthly' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Monthly (Months 1-12)
              </button>
            </div>

            {periodTab === 'quarterly' && (
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Quarter:</span>
                {(['all', 'q1', 'q2', 'q3', 'q4'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setSelectedQuarter(q)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      selectedQuarter === q ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metric Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 font-medium">Detected Shortfalls</span>
              <p className="text-lg font-bold text-slate-800">{filteredShortfalls.length}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 font-medium">Critical Lags (&lt;60%)</span>
              <p className="text-lg font-bold text-red-600">{shortfallStats.criticalCount}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 font-medium">Quarter Shortfall Incidents</span>
              <p className="text-lg font-bold text-amber-600">{shortfallStats.quarterlyShortfalls}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 font-medium">Monthly Shortfalls</span>
              <p className="text-lg font-bold text-slate-800">{shortfallStats.monthlyShortfalls}</p>
            </div>
          </div>

          {/* Backlog Summary Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Period Occurred</th>
                    <th className="py-3 px-3">Plan / Metric Title</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Target</th>
                    <th className="py-3 px-3 text-right">Actual</th>
                    <th className="py-3 px-3 text-right">Deficit / Backlog</th>
                    <th className="py-3 px-3 text-center">Achieved</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShortfalls.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No performance variations or deficits found in this selection.
                      </td>
                    </tr>
                  ) : (
                    filteredShortfalls.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            {item.periodLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {item.planTitle}
                          {item.employeeName && (
                            <span className="block text-[10px] text-sky-600 font-normal">
                              Assigned: {item.employeeName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {item.target.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          {item.actual.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">
                          -{item.deficit.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold">{item.achievement}%</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'Critical Shortfall'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: DETAILED KPI ANALYTICAL PERFORMANCE */}
      {activeReportTab === 'kpis' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Comprehensive Balanced Scorecard KPI Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed weights, achievements, weighted performance scores, and quarterly targets.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Perspective</th>
                    <th className="py-3 px-3">Strategic Objective / KPI</th>
                    <th className="py-3 px-2 text-center">Weight</th>
                    <th className="py-3 px-3 text-right">Annual Target</th>
                    <th className="py-3 px-3 text-right">Annual Actual</th>
                    <th className="py-3 px-3 text-right">Variance</th>
                    <th className="py-3 px-3 text-center">Achievement</th>
                    <th className="py-3 px-3 text-right">Score Contribution</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailedKpisList.map(kpi => {
                    const isPositive = kpi.variance >= 0;
                    return (
                      <tr key={kpi.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {kpi.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {kpi.name}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Category: {kpi.kpiCategory}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                          {kpi.weight}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {kpi.target.toLocaleString()} {kpi.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {kpi.actual.toLocaleString()} {kpi.unit}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{kpi.variance.toLocaleString()} {kpi.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {kpi.achievement}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-700">
                          {kpi.score.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            kpi.achievement >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : kpi.achievement >= 80
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {kpi.achievement >= 100 ? 'Outstanding' : kpi.achievement >= 80 ? 'On Track' : 'Needs Focus'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: STAFF PERFORMANCE SCORECARDS */}
      {activeReportTab === 'scorecards' && (
        <Card>
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Individual Staff Scorecards</h3>
              <p className="text-xs text-slate-500">Official individual Balanced Scorecard documents for review meetings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branchEmployees.map(employee => {
              const employeeKpis = kpis.filter(k => k.employeeId === employee.id);
              const total = employeeKpis.reduce((acc, k) => {
                const obj = annualPlan.find(p => p.id === k.objectiveId);
                return acc + (obj ? calculateKpiMetrics(k, obj).score : 0);
              }, 0);

              return (
                <div
                  key={employee.id}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{employee.name}</h4>
                      <p className="text-xs text-sky-700 font-medium">
                        {employee.positionTitle || employee.role}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Branch: {branchName} • PIN: {employee.pin}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Total Score</span>
                      <span className={`text-lg font-bold font-mono ${total >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {total.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
                    <span>{employeeKpis.length} KPIs assigned</span>
                    <button
                      onClick={() => exportEmployeePDF(employee)}
                      disabled={exportingId === employee.id}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1"
                    >
                      <span>{exportingId === employee.id ? 'Generating...' : 'Export PDF'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB FOR MY COMPREHENSIVE PERFORMANCE REPORT */}
      {activeReportTab === 'myReport' && user && (
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-100 text-sky-800">
                  Staff Personal Report & Audit
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Employee: {user.name} ({user.positionTitle || user.role})
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Detailed Overall Performance Report & Branch Plan Contribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your assigned plans, actual progress, contribution percentage against your specific targets, and share compared to total branch targets.
              </p>
            </div>

            <button
              onClick={() => {
                const empRecord = employees.find(e => e.id === user.id);
                if (empRecord) exportEmployeePDF(empRecord);
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>📄 Export My Report PDF</span>
            </button>
          </div>

          {/* Personal KPIs / Plans assigned */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Assigned Plans & Actual Progress vs Branch Targets
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employeePlans.filter(ep => ep.employeeId === user.id).map(ep => {
                const branchPlan = periodicPlans.find(bp => bp.category === ep.category);
                const bTarget = branchPlan?.annualTarget || 1;
                const myTarget = ep.annualTarget || 1;
                const myActual = ep.annualActual || 0;
                const myRate = myTarget > 0 ? Math.round((myActual / myTarget) * 100) : 0;
                const branchShare = bTarget > 0 ? ((myTarget / bTarget) * 100).toFixed(1) : '0';

                return (
                  <div key={ep.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 uppercase">
                        {ep.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${myRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {myRate}% Achieved
                      </span>
                    </div>

                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{ep.title}</h5>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Branch Target Share: <strong className="text-slate-800">{branchShare}%</strong> of total branch {ep.category} plan
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-100 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">My Assigned Target</p>
                        <p className="font-bold text-slate-800 font-mono mt-0.5">{myTarget.toLocaleString()} {ep.metricUnit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">My Actual Progress</p>
                        <p className="font-bold text-emerald-700 font-mono mt-0.5">{myActual.toLocaleString()} {ep.metricUnit}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;