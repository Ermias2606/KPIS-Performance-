import React, { useContext, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Employee, Role } from '../types';
import { calculateKpiMetrics } from '../context/DataContext';

const ReportsPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { employees, branches, annualPlan, kpis, loading } = useData();
  const [exportingId, setExportingId] = useState<number | null>(null);

  const getBranchEmployees = () => {
    if (!user) return [];
    return user.role === Role.ADMIN
      ? employees.filter(e => e.role !== Role.ADMIN)
      : employees.filter(e => e.branchId === user.branchId && e.role !== Role.ADMIN);
  };

  const branchName = branches.find(b => b.id === user?.branchId)?.name || 'Raitu Branch';

  const exportToCSV = () => {
    const reportData = getBranchEmployees().map(employee => {
      const employeeKpis = kpis.filter(k => k.employeeId === employee.id);
      const totalScore = employeeKpis.reduce((acc, kpi) => {
        const objective = annualPlan.find(p => p.id === kpi.objectiveId);
        return acc + (objective ? calculateKpiMetrics(kpi, objective).score : 0);
      }, 0);

      return {
        'Employee ID': employee.id,
        'Name': employee.name,
        'Role': employee.role,
        'Branch': branches.find(b => b.id === employee.branchId)?.name || 'N/A',
        'KPI Count': employeeKpis.length,
        'Total Score (%)': totalScore.toFixed(2),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Branch Summary');
    XLSX.writeFile(workbook, `Raitu_Branch_Performance_${new Date().getFullYear()}.xlsx`);
  };

  const exportBranchSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199);
    doc.text('Raitu Branch Balanced Scorecard Summary', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Branch: ${branchName}`, 14, 28);

    const tableData = getBranchEmployees().map(emp => {
      const empKpis = kpis.filter(k => k.employeeId === emp.id);
      const total = empKpis.reduce((acc, k) => {
        const obj = annualPlan.find(p => p.id === k.objectiveId);
        return acc + (obj ? calculateKpiMetrics(k, obj).score : 0);
      }, 0);
      return [
        emp.name,
        emp.role,
        empKpis.length.toString(),
        `${total.toFixed(2)}%`,
        total >= 90 ? 'Outstanding' : total >= 80 ? 'On Track' : 'Needs Focus',
      ];
    });

    const options = {
      startY: 36,
      head: [['Employee Name', 'Role', 'KPI Count', 'Overall Score', 'Status']],
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

    doc.save(`Raitu_Branch_Summary_${new Date().getFullYear()}.pdf`);
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
      doc.text('Performance Scorecard', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Employee: ${employee.name}`, 14, 32);
      doc.text(`Role: ${employee.role}`, 14, 38);
      doc.text(`Branch: ${branchName}`, 14, 44);

      doc.setFontSize(14);
      doc.setTextColor(totalScore >= 80 ? 16 : 217, totalScore >= 80 ? 185 : 119, totalScore >= 80 ? 129 : 6);
      doc.text(`Total Score: ${totalScore.toFixed(2)}%`, 140, 32);

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
        head: [['Perspective', 'KPI', 'Weight', 'Target', 'Actual', 'Achievement', 'Score']],
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
      console.error('Failed to export PDF:', err);
    } finally {
      setExportingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Reports...</div>
      </div>
    );
  }

  const branchEmployees = getBranchEmployees();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Reports & Exports</h2>
        <p className="text-sm text-slate-500 mt-1">Generate Balanced Scorecard audit reports and individual performance documents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Branch Summary (Excel)</h3>
              <p className="text-xs text-slate-500">Spreadsheet with full employee metrics</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-5">
            Download comprehensive spreadsheet listing all employees, roles, KPI counts, and overall scores for {branchName}.
          </p>
          <button
            onClick={exportToCSV}
            className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Download Excel Sheet (.xlsx)</span>
          </button>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Branch Report (PDF)</h3>
              <p className="text-xs text-slate-500">Printable overview scorecard</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-5">
            Generate official executive summary report in PDF format suitable for branch submission or printing.
          </p>
          <button
            onClick={exportBranchSummaryPDF}
            className="w-full bg-sky-600 text-white px-4 py-2.5 rounded-xl hover:bg-sky-700 transition font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Generate Branch PDF Summary</span>
          </button>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Individual Employee Scorecards</h3>
        <p className="text-xs text-slate-500 mb-4">Export official scorecard PDFs for review meetings and records</p>
        <div className="space-y-2.5">
          {branchEmployees.map(employee => {
            const employeeKpis = kpis.filter(k => k.employeeId === employee.id);
            const total = employeeKpis.reduce((acc, k) => {
              const obj = annualPlan.find(p => p.id === k.objectiveId);
              return acc + (obj ? calculateKpiMetrics(k, obj).score : 0);
            }, 0);

            return (
              <div
                key={employee.id}
                className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{employee.name}</p>
                    <span className="text-xs text-slate-400">({employee.role})</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {employeeKpis.length} KPIs assigned • Overall: <span className="font-bold text-slate-700">{total.toFixed(1)}%</span>
                  </p>
                </div>
                <button
                  onClick={() => exportEmployeePDF(employee)}
                  disabled={exportingId === employee.id}
                  className="bg-white border border-slate-300 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 px-3.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-medium self-start sm:self-center shadow-sm disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{exportingId === employee.id ? 'Generating...' : 'Export PDF'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default ReportsPage;