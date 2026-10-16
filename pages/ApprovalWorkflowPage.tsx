import React, { useState, useEffect, useContext } from 'react';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { Role } from '../types';

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

export const ApprovalWorkflowPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const {
    employeePlans,
    backlogPlans,
    periodicPlans,
    recordEmployeePerformance,
    updateBacklogPlan,
    recordActualPerformance,
    loading,
  } = useData();

  const [requests, setRequests] = useState<PerformanceRequest[]>(() => {
    try {
      const saved = localStorage.getItem('raitu_perf_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');

  const isAdmin = user?.role === Role.ADMIN;

  const saveRequests = (updated: PerformanceRequest[]) => {
    setRequests(updated);
    localStorage.setItem('raitu_perf_requests', JSON.stringify(updated));
  };

  const handleApprove = async (req: PerformanceRequest) => {
    try {
      // 1. Apply performance update to employee plan or backlog
      if (req.targetType === 'employee') {
        const ep = employeePlans.find(item => item.id === req.targetId);
        if (ep) {
          const newActual = ep.annualActual + req.incrementValue;
          await recordEmployeePerformance({
            assignmentId: ep.id,
            periodType: 'annual',
            newActual,
          });

          // Also roll up into branch periodic plan if category matches
          const matchingBranchPlan = periodicPlans.find(p => p.category === ep.category);
          if (matchingBranchPlan) {
            await recordActualPerformance({
              planId: matchingBranchPlan.id,
              periodType: 'annual',
              newActual: matchingBranchPlan.annualActual + req.incrementValue,
            });
          }
        }
      } else if (req.targetType === 'backlog') {
        const bItem = backlogPlans.find(b => b.id === req.targetId);
        if (bItem) {
          const newActual = bItem.backlogActual + req.incrementValue;
          await updateBacklogPlan({
            ...bItem,
            backlogActual: newActual,
            status: newActual >= bItem.backlogTarget ? 'Cleared' : bItem.status,
          });
        }
      }

      // 2. Mark request as Approved
      const updated = requests.map(r => r.id === req.id ? { ...r, status: 'Approved' as const } : r);
      saveRequests(updated);
    } catch (err) {
      console.error('Failed to approve request:', err);
    }
  };

  const handleReject = (reqId: string) => {
    const updated = requests.map(r => r.id === reqId ? { ...r, status: 'Rejected' as const } : r);
    saveRequests(updated);
  };

  const filteredRequests = requests.filter(r => filterStatus === 'All' || r.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Approval Workflow...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="p-8 bg-white rounded-2xl border border-red-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Administrator Access Required</h2>
          <p className="text-sm text-slate-500 mt-1">This workflow page is restricted to Admin review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              Admin Workflow
            </span>
            <span className="text-xs text-slate-500 font-medium">Employee Performance Approvals</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Employee Performance Input Request Approvals
          </h1>
          <p className="text-sm text-slate-500">
            Review day-to-day actual performance updates submitted by branch staff, approve roll-ups to branch targets, or reject with remarks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterStatus === st ? 'bg-sky-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {st} ({requests.filter(r => st === 'All' || r.status === st).length})
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Submitted Performance Requests</h3>
          <span className="text-xs text-slate-500 font-semibold">{filteredRequests.length} Requests Listed</span>
        </div>

        {filteredRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Stream & Title</th>
                  <th className="p-3 text-right">Day Increment</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Notes / Remarks</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredRequests.map(req => {
                  const isPending = req.status === 'Pending';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900">{req.employeeName}</td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800">{req.targetName}</span>
                        <span className="block text-[10px] text-slate-400 uppercase">{req.category}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        +{req.incrementValue.toLocaleString()} {req.unit}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{req.date}</td>
                      <td className="p-3 text-slate-500 italic max-w-xs">{req.notes}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(req)}
                              className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition shadow-2xs cursor-pointer"
                            >
                              Approve & Roll Up
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl text-xs transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs">
            <p className="font-semibold text-slate-600 mb-1">No performance input requests found matching filter.</p>
            <p>Employee submissions will appear here for admin review and approval.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ApprovalWorkflowPage;
