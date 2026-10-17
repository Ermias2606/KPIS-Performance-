import React, { useMemo, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData, calculateKpiMetrics } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/ui/Card';
import KpiProgressBar from '../components/ui/KpiProgressBar';
import {
  Role,
  isAdminRole,
  getRoleHierarchyLevel,
  Employee,
  EmploymentType,
  EmployeeStatus,
  OrganizationPositionRole,
} from '../types';
import { getDefaultPositionsForSector } from '../constants';

const getRoleBadgeClasses = (role: Role) => {
  switch (role) {
    case Role.SUPER_ADMIN:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case Role.ADMIN:
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case Role.MANAGER:
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case Role.OFFICER:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getStatusBadgeClasses = (status?: EmployeeStatus) => {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'On Leave':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Transferred':
      return 'bg-slate-100 text-slate-600 border-slate-300';
    case 'Probation':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

const HIERARCHY_TIERS = [
  {
    role: Role.SUPER_ADMIN,
    level: 'Tier 1 · System Sovereign',
    color: 'border-purple-300 bg-purple-50/50',
    badge: 'bg-purple-600 text-white',
    description:
      'Full multi-organization control, system architecture, admin credential resets, and global audit.',
  },
  {
    role: Role.ADMIN,
    level: 'Tier 2 · Organization HQ Admin',
    color: 'border-orange-300 bg-orange-50/50',
    badge: 'bg-orange-600 text-white',
    description:
      'Manages organization branches, fiscal baselines, employee onboarding, password resets, and approvals.',
  },
  {
    role: Role.MANAGER,
    level: 'Tier 3 · Operational / Branch Manager',
    color: 'border-sky-300 bg-sky-50/50',
    badge: 'bg-sky-600 text-white',
    description:
      'Supervises operational unit execution, periodic target delivery, and team scorecard evaluations.',
  },
  {
    role: Role.OFFICER,
    level: 'Tier 4 · System & Operations Officer',
    color: 'border-emerald-300 bg-emerald-50/50',
    badge: 'bg-emerald-600 text-white',
    description:
      'Executes specialized compliance, quality assurance, client portfolio management, and KPI verification.',
  },
  {
    role: Role.STAFF,
    level: 'Tier 5 · Frontline Staff Member',
    color: 'border-slate-300 bg-slate-50/70',
    badge: 'bg-slate-700 text-white',
    description:
      'Executes assigned individual KPIs, frontline customer/production operations, and backlog recovery.',
  },
];

export const EmployeesPage: React.FC = () => {
  const {
    user,
    unlockUserAccount,
    adminResetUserPassword,
    changeOwnPassword,
    refreshUsers,
  } = useContext(AuthContext);

  const {
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    updateOrganization,
    employees,
    branches,
    kpis,
    annualPlan,
    backlogPlans,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    refreshData,
  } = useData();

  // Main Page Sub-Navigation Tab
  const [activeTab, setActiveTab] = useState<'directory' | 'org-positions' | 'hierarchy-auth'>(
    'directory'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [includeAdminsInDirectory, setIncludeAdminsInDirectory] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'hierarchy' | 'score-desc' | 'score-asc' | 'name' | 'kpis'>(
    'hierarchy'
  );

  // Banner Feedback
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackBanner({ type, message });
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: number; name: string } | null>(
    null
  );

  // Admin Reset Password Modal State
  const [resetTargetEmployee, setResetTargetEmployee] = useState<Employee | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('Reset@2026');
  const [adminNewPin, setAdminNewPin] = useState('');
  const [adminMustChangeFlag, setAdminMustChangeFlag] = useState(true);

  // Self Change Password Modal State
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);
  const [selfCurrentSecret, setSelfCurrentSecret] = useState('');
  const [selfNewPassword, setSelfNewPassword] = useState('');
  const [selfConfirmPassword, setSelfConfirmPassword] = useState('');
  const [selfNewEmail, setSelfNewEmail] = useState('');
  const [selfNewUsername, setSelfNewUsername] = useState('');

  // Organization Position Modal State
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<OrganizationPositionRole | null>(null);
  const [posTitle, setPosTitle] = useState('');
  const [posDepartment, setPosDepartment] = useState('');
  const [posSystemRole, setPosSystemRole] = useState<Role>(Role.OFFICER);
  const [posResponsibilities, setPosResponsibilities] = useState('');
  const [posRequiredCount, setPosRequiredCount] = useState<number>(1);

  // New Employee Form State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpCode, setNewEmpCode] = useState('');
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('Password@123');
  const [newEmpPin, setNewEmpPin] = useState('1234');
  const [newEmpMustChangePwd, setNewEmpMustChangePwd] = useState(true);
  const [newEmpRole, setNewEmpRole] = useState<Role>(Role.OFFICER);
  const [newEmpOrgId, setNewEmpOrgId] = useState<number>(activeOrganization?.id || 1);
  const [newEmpOrgRoleId, setNewEmpOrgRoleId] = useState<string>('');
  const [newEmpPosition, setNewEmpPosition] = useState('');
  const [newEmpDepartment, setNewEmpDepartment] = useState('Operations & Service Delivery');
  const [newEmpBranchId, setNewEmpBranchId] = useState<number>(branches[0]?.id || 1);
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpEmploymentType, setNewEmpEmploymentType] = useState<EmploymentType>('Full-Time');
  const [newEmpStatus, setNewEmpStatus] = useState<EmployeeStatus>('Active');
  const [newEmpHireDate, setNewEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEmpQualification, setNewEmpQualification] = useState('');
  const [newEmpSpecialization, setNewEmpSpecialization] = useState('');
  const [newEmpSupervisorId, setNewEmpSupervisorId] = useState<number | ''>('');
  const [newEmpLocation, setNewEmpLocation] = useState('Main Operations Floor');
  const [newEmpEmergencyContact, setNewEmpEmergencyContact] = useState('');
  const [newEmpSkills, setNewEmpSkills] = useState('KPI Execution, Quality Compliance');
  const [newEmpNotes, setNewEmpNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const isAdmin = isAdminRole(user?.role);

  // Active organization's required positions
  const orgPositions: OrganizationPositionRole[] = useMemo(() => {
    if (!activeOrganization) return [];
    if (
      activeOrganization.requiredPositions &&
      activeOrganization.requiredPositions.length > 0
    ) {
      return activeOrganization.requiredPositions;
    }
    return getDefaultPositionsForSector(activeOrganization.sector);
  }, [activeOrganization]);

  function getEmployeeScore(employeeId: number): number | null {
    const employeeKpis = kpis.filter((k) => k.employeeId === employeeId);
    if (employeeKpis.length === 0) return null;
    const total = employeeKpis.reduce((acc, kpi) => {
      const objective = annualPlan.find((p) => p.id === kpi.objectiveId);
      return acc + calculateKpiMetrics(kpi, objective).score;
    }, 0);
    return parseFloat(total.toFixed(1));
  }

  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    orgPositions.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set);
  }, [employees, orgPositions]);

  // Filter & Sort Employees
  const managedEmployees = useMemo(() => {
    if (!user) return [];
    let list = [...employees];

    if (!includeAdminsInDirectory) {
      list = list.filter((e) => !isAdminRole(e.role));
    }

    if (roleFilter !== 'ALL') {
      list = list.filter((e) => e.role === roleFilter);
    }

    if (departmentFilter !== 'ALL') {
      list = list.filter(
        (e) => (e.department || '').toLowerCase() === departmentFilter.toLowerCase()
      );
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((e) => (e.status || 'Active') === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.role.toLowerCase().includes(term) ||
          (e.username || '').toLowerCase().includes(term) ||
          (e.employeeCode || '').toLowerCase().includes(term) ||
          (e.email || '').toLowerCase().includes(term) ||
          (e.positionTitle || '').toLowerCase().includes(term) ||
          (e.department || '').toLowerCase().includes(term) ||
          (e.qualification || '').toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'hierarchy') {
        const diff = getRoleHierarchyLevel(b.role) - getRoleHierarchyLevel(a.role);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const scoreA = getEmployeeScore(a.id) ?? -1;
      const scoreB = getEmployeeScore(b.id) ?? -1;
      if (sortBy === 'score-desc') return scoreB - scoreA;
      if (sortBy === 'score-asc') return scoreA - scoreB;
      if (sortBy === 'kpis') {
        const kpisA = kpis.filter((k) => k.employeeId === a.id).length;
        const kpisB = kpis.filter((k) => k.employeeId === b.id).length;
        return kpisB - kpisA;
      }
      return 0;
    });

    return list;
  }, [
    user,
    employees,
    includeAdminsInDirectory,
    roleFilter,
    departmentFilter,
    statusFilter,
    searchTerm,
    sortBy,
    kpis,
    annualPlan,
  ]);

  // Open Add Employee Modal (optionally pre-filled from an Organization Position Role)
  const openAddEmployeeModal = (prefillPos?: OrganizationPositionRole) => {
    const nextCode = `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    setNewEmpCode(nextCode);
    setNewEmpName('');
    setNewEmpUsername('');
    setNewEmpPassword('Password@123');
    setNewEmpPin(String(Math.floor(1000 + Math.random() * 9000)));
    setNewEmpMustChangePwd(true);
    setNewEmpOrgId(activeOrganization?.id || 1);

    if (prefillPos) {
      setNewEmpOrgRoleId(prefillPos.id);
      setNewEmpPosition(prefillPos.title);
      setNewEmpDepartment(prefillPos.department);
      setNewEmpRole(prefillPos.systemRole);
    } else {
      const firstPos = orgPositions[0];
      setNewEmpOrgRoleId(firstPos?.id || '');
      setNewEmpPosition(firstPos?.title || 'Operations & Service Specialist');
      setNewEmpDepartment(firstPos?.department || 'Operations & Service Delivery');
      setNewEmpRole(firstPos?.systemRole || Role.OFFICER);
    }

    setNewEmpEmail('');
    setNewEmpPhone('');
    setNewEmpQualification('BA / BSc Degree');
    setNewEmpSpecialization('Operational Excellence & KPI Management');
    setNewEmpSupervisorId(employees.find((e) => e.role === Role.MANAGER)?.id || 1);
    setShowAddModal(true);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newEmpName.trim()) return;
    setIsSubmitting(true);
    try {
      const derivedUname =
        newEmpUsername.trim().toLowerCase() ||
        newEmpName.trim().toLowerCase().replace(/\s+/g, '.');
      const derivedEmail =
        newEmpEmail.trim() || `${derivedUname}@org-tracker.com`;

      await addEmployee({
        name: newEmpName.trim(),
        employeeCode:
          newEmpCode.trim().toUpperCase() ||
          `EMP-${String(employees.length + 1).padStart(3, '0')}`,
        username: derivedUname,
        password: newEmpPassword.trim() || 'Password@123',
        pin: newEmpPin.trim() || '1234',
        mustChangePassword: newEmpMustChangePwd,
        role: newEmpRole,
        organizationId: Number(newEmpOrgId) || activeOrganization?.id || 1,
        organizationRoleId: newEmpOrgRoleId || undefined,
        positionTitle: newEmpPosition.trim() || newEmpRole,
        department: newEmpDepartment.trim() || 'Operations',
        branchId: Number(newEmpBranchId) || 1,
        email: derivedEmail,
        phone: newEmpPhone.trim() || undefined,
        employmentType: newEmpEmploymentType,
        status: newEmpStatus,
        hireDate: newEmpHireDate,
        qualification: newEmpQualification.trim() || undefined,
        specialization: newEmpSpecialization.trim() || undefined,
        supervisorId: newEmpSupervisorId ? Number(newEmpSupervisorId) : undefined,
        location: newEmpLocation.trim() || undefined,
        emergencyContact: newEmpEmergencyContact.trim() || undefined,
        skills: newEmpSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: newEmpNotes.trim() || undefined,
      });

      await refreshUsers();
      setShowAddModal(false);
      showNotice(
        `Employee "${newEmpName.trim()}" (@${derivedUname}) created under ${newEmpRole} hierarchy.`
      );
    } catch (err) {
      console.error('Failed to add employee:', err);
      showNotice('Failed to create employee record.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingEmployee) return;
    setIsSubmitting(true);
    try {
      await updateEmployee(editingEmployee);
      await refreshUsers();
      setEditingEmployee(null);
      showNotice(`Profile & credentials updated for ${editingEmployee.name}.`);
    } catch (err) {
      console.error('Failed to update employee:', err);
      showNotice('Failed to update employee.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!isAdmin || !employeeToDelete) return;
    await deleteEmployee(employeeToDelete.id);
    await refreshUsers();
    showNotice(`Removed employee ${employeeToDelete.name}.`);
    setEmployeeToDelete(null);
  };

  // Admin Password Reset Handler
  const handleAdminPasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !resetTargetEmployee) return;
    setIsSubmitting(true);
    try {
      const ok = await adminResetUserPassword(
        resetTargetEmployee.id,
        adminNewPassword,
        adminNewPin,
        adminMustChangeFlag
      );
      await refreshData();
      if (ok) {
        showNotice(
          `Password reset for ${resetTargetEmployee.name} (@${
            resetTargetEmployee.username || 'user'
          }). Temporary password: ${adminNewPassword}`
        );
        setResetTargetEmployee(null);
      } else {
        showNotice('Could not reset password.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Self Password Change Handler
  const handleSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selfNewPassword !== selfConfirmPassword) {
      showNotice('New password and confirmation do not match.', 'error');
      return;
    }
    const res = await changeOwnPassword(
      selfCurrentSecret,
      selfNewPassword,
      selfNewEmail,
      selfNewUsername
    );
    if (!res.success) {
      showNotice(res.message, 'error');
      return;
    }
    await refreshData();
    setShowSelfPasswordModal(false);
    showNotice(res.message, 'success');
  };

  // Save or Update Organization Position Role
  const handleSaveOrgPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !activeOrganization || !posTitle.trim()) return;
    const currentList = [...orgPositions];

    if (editingPosition) {
      const updatedList = currentList.map((item) =>
        item.id === editingPosition.id
          ? {
              ...item,
              title: posTitle.trim(),
              department: posDepartment.trim() || 'Operations',
              systemRole: posSystemRole,
              responsibilities: posResponsibilities.trim(),
              requiredCount: Number(posRequiredCount) || 1,
            }
          : item
      );
      await updateOrganization({
        ...activeOrganization,
        requiredPositions: updatedList,
      });
      showNotice(`Updated organization position "${posTitle.trim()}".`);
    } else {
      const newPos: OrganizationPositionRole = {
        id: 'pos-' + Date.now(),
        title: posTitle.trim(),
        department: posDepartment.trim() || 'Operations',
        systemRole: posSystemRole,
        responsibilities:
          posResponsibilities.trim() ||
          `Key position required to maintain ${activeOrganization.name} (${activeOrganization.sector}).`,
        requiredCount: Number(posRequiredCount) || 1,
        isRequired: true,
      };
      await updateOrganization({
        ...activeOrganization,
        requiredPositions: [...currentList, newPos],
      });
      showNotice(
        `Added required position "${newPos.title}" to ${activeOrganization.name}.`
      );
    }

    setShowAddPositionModal(false);
    setEditingPosition(null);
    setPosTitle('');
    setPosDepartment('');
    setPosResponsibilities('');
  };

  const handleDeleteOrgPosition = async (posId: string) => {
    if (!isAdmin || !activeOrganization) return;
    const updatedList = orgPositions.filter((p) => p.id !== posId);
    await updateOrganization({
      ...activeOrganization,
      requiredPositions: updatedList,
    });
    showNotice('Removed position from organization requirements.');
  };

  const exportEmployeeScorecardPDF = (employee: Employee) => {
    setExportingId(employee.id);
    try {
      const doc = new jsPDF();
      const employeeKpis = kpis
        .filter((k) => k.employeeId === employee.id)
        .map((kpi) => {
          const objective = annualPlan.find((p) => p.id === kpi.objectiveId);
          return calculateKpiMetrics(kpi, objective);
        });
      const totalScore = employeeKpis.reduce((sum, kpi) => sum + kpi.score, 0);

      doc.setFontSize(18);
      doc.setTextColor(2, 132, 199);
      doc.text(`${activeOrganization?.name || 'Performance Tracker'} — Employee Dossier`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Employee: ${employee.name} (${employee.employeeCode || `#${employee.id}`}) | Username: @${
          employee.username || 'user'
        }`,
        14,
        30
      );
      doc.text(
        `System Hierarchy Role: ${employee.role} | Organization Position: ${
          employee.positionTitle || employee.role
        }`,
        14,
        36
      );
      doc.text(
        `Department: ${employee.department || 'Operations'} | Branch: ${
          branches.find((b) => b.id === employee.branchId)?.name || 'Main Operations Branch'
        }`,
        14,
        42
      );
      doc.text(
        `Qualification: ${employee.qualification || 'N/A'} | Email: ${employee.email || 'N/A'}`,
        14,
        48
      );

      doc.setFontSize(13);
      doc.setTextColor(
        totalScore >= 80 ? 16 : 217,
        totalScore >= 80 ? 185 : 119,
        totalScore >= 80 ? 129 : 6
      );
      doc.text(`BSC Score: ${totalScore.toFixed(2)}%`, 145, 30);

      const tableData = employeeKpis.map((kpi) => [
        kpi.objective?.category || 'General',
        kpi.name,
        `${kpi.weight}%`,
        kpi.target.toLocaleString(),
        kpi.actual.toLocaleString(),
        `${kpi.achievement}%`,
        kpi.score.toFixed(2),
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Perspective', 'KPI Name', 'Weight', 'Target', 'Actual', 'Achievement', 'Score']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [2, 132, 199],
          textColor: [255, 255, 255],
        },
      });

      doc.save(`${employee.name.replace(/\s+/g, '_')}_Scorecard_Dossier.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setExportingId(null);
    }
  };

  // Summary metrics
  const hierarchyCounts = useMemo(() => {
    return {
      superAdmin: employees.filter((e) => e.role === Role.SUPER_ADMIN).length,
      admin: employees.filter((e) => e.role === Role.ADMIN).length,
      manager: employees.filter((e) => e.role === Role.MANAGER).length,
      officer: employees.filter((e) => e.role === Role.OFFICER).length,
      staff: employees.filter((e) => e.role === Role.STAFF).length,
    };
  }, [employees]);

  const positionFulfillmentStats = useMemo(() => {
    let totalRequiredSlots = 0;
    let filledSlots = 0;
    orgPositions.forEach((pos) => {
      const req = pos.requiredCount || 1;
      totalRequiredSlots += req;
      const matchingCount = employees.filter(
        (e) =>
          e.organizationRoleId === pos.id ||
          (e.positionTitle || '').toLowerCase() === pos.title.toLowerCase()
      ).length;
      filledSlots += Math.min(matchingCount, req);
    });
    const pct =
      totalRequiredSlots > 0 ? Math.round((filledSlots / totalRequiredSlots) * 100) : 100;
    return { totalRequiredSlots, filledSlots, pct };
  }, [orgPositions, employees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg font-semibold text-slate-600">
          Loading Workforce Directory & Role Architecture...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* EXECUTIVE HEADER & ORGANIZATION ROLE / AUTH SUMMARY */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-700/80">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-4">
            {activeOrganization?.logoUrl ? (
              <img
                src={activeOrganization.logoUrl}
                alt={activeOrganization.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center font-black text-xl shrink-0">
                {activeOrganization?.name?.charAt(0) || 'P'}
              </div>
            )}
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  {activeOrganization?.name} · {activeOrganization?.sector}
                </span>
                <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded font-mono text-slate-300">
                  Your Role: {user?.role}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">
                Workforce Directory, Organization Roles & Access Control
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                Manage comprehensive employee dossiers, 5-tier system control hierarchy (Super Admin,
                Admin, Branch Manager, Officer, Staff), organization-specific required positions, and
                username/password authentication protocols.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setSelfCurrentSecret('');
                setSelfNewPassword('');
                setSelfConfirmPassword('');
                setSelfNewEmail(user?.email || '');
                setSelfNewUsername(user?.username || '');
                setShowSelfPasswordModal(true);
              }}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              My Password & Recovery Email
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setEditingPosition(null);
                    setPosTitle('');
                    setPosDepartment('');
                    setPosSystemRole(Role.OFFICER);
                    setPosResponsibilities('');
                    setPosRequiredCount(1);
                    setShowAddPositionModal(true);
                  }}
                  className="px-3.5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  + Add Org Required Position
                </button>
                <button
                  onClick={() => openAddEmployeeModal()}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
                >
                  + Onboard New Employee
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Workforce
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {employees.length} Users
            </span>
            <span className="text-[11px] text-emerald-400">
              {employees.filter((e) => (e.status || 'Active') === 'Active').length} Active
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
              Super Admin & Admin
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {hierarchyCounts.superAdmin + hierarchyCounts.admin}
            </span>
            <span className="text-[11px] text-slate-300">
              {hierarchyCounts.superAdmin} Super · {hierarchyCounts.admin} Admin
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block">
              Managers & Officers
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {hierarchyCounts.manager + hierarchyCounts.officer}
            </span>
            <span className="text-[11px] text-slate-300">
              {hierarchyCounts.manager} Mgr · {hierarchyCounts.officer} Officer
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
              Frontline Staff
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {hierarchyCounts.staff}
            </span>
            <span className="text-[11px] text-slate-400">Operational Execution</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 block">
              Org Required Positions
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {orgPositions.length} Roles
            </span>
            <span className="text-[11px] text-orange-300">
              {positionFulfillmentStats.filledSlots}/{positionFulfillmentStats.totalRequiredSlots}{' '}
              Slots ({positionFulfillmentStats.pct}%)
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
              Auth & Email Recovery
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {employees.filter((e) => e.email).length}/{employees.length}
            </span>
            <span className="text-[11px] text-emerald-400">Verified Recovery Emails</span>
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedbackBanner.message}</span>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-NAVIGATION TABS */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            1. Employee Directory & Dossiers ({managedEmployees.length})
          </button>
          <button
            onClick={() => setActiveTab('org-positions')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'org-positions'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            2. Organization Positions & Required Roles ({orgPositions.length})
          </button>
          <button
            onClick={() => setActiveTab('hierarchy-auth')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'hierarchy-auth'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            3. System Hierarchy & Login Credentials ({employees.length})
          </button>
        </div>

        {/* Organization Switcher pill */}
        {organizations.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-semibold">Organization:</span>
            <select
              value={activeOrganization?.id}
              onChange={(e) => setActiveOrganizationId(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.sector})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EMPLOYEE DIRECTORY & DOSSIERS */}
      {/* ===================================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-5">
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Search Name, @Username, Code, Position, Qualification
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  System Hierarchy Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="ALL">All Hierarchy Roles</option>
                  <option value={Role.SUPER_ADMIN}>{Role.SUPER_ADMIN}</option>
                  <option value={Role.ADMIN}>{Role.ADMIN}</option>
                  <option value={Role.MANAGER}>{Role.MANAGER}</option>
                  <option value={Role.OFFICER}>{Role.OFFICER}</option>
                  <option value={Role.STAFF}>{Role.STAFF}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Sort Order
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="hierarchy">System Hierarchy Level</option>
                  <option value="score-desc">BSC Score (High to Low)</option>
                  <option value="score-asc">BSC Score (Low to High)</option>
                  <option value="name">Alphabetical (Name)</option>
                  <option value="kpis">Assigned KPI Count</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAdminsInDirectory}
                    onChange={(e) => setIncludeAdminsInDirectory(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-semibold">
                    Show Super Admin & Admin Accounts in Directory
                  </span>
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">Status: All</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Probation">Probation</option>
                  <option value="Transferred">Transferred</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dossier Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Workforce Table
                </button>
              </div>
            </div>
          </Card>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {managedEmployees.map((emp) => {
                const empScore = getEmployeeScore(emp.id);
                const empKpiCount = kpis.filter((k) => k.employeeId === emp.id).length;
                const empBacklogs = backlogPlans.filter(
                  (b) => b.assignedEmployeeId === emp.id && b.status !== 'Cleared'
                ).length;
                const branchName =
                  branches.find((b) => b.id === emp.branchId)?.name || 'Main Operations Branch';
                const supervisor = employees.find((s) => s.id === emp.supervisorId);

                return (
                  <Card
                    key={emp.id}
                    className="flex flex-col justify-between border border-slate-200/90 hover:border-sky-300 transition-all"
                  >
                    <div className="space-y-3.5">
                      {/* Top Header: Avatar, Name, Hierarchy Role & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                            {emp.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                to={`/employees/${emp.id}`}
                                className="text-base font-bold text-slate-900 hover:text-sky-600 truncate"
                              >
                                {emp.name}
                              </Link>
                              <span className="text-[10px] font-mono text-slate-400">
                                {emp.employeeCode || `EMP-00${emp.id}`}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-orange-700 truncate mt-0.5">
                              {emp.positionTitle || emp.role}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRoleBadgeClasses(
                                  emp.role
                                )}`}
                              >
                                {emp.role}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getStatusBadgeClasses(
                                  emp.status
                                )}`}
                              >
                                {emp.status || 'Active'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {empScore !== null && (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              BSC Score
                            </span>
                            <span
                              className={`text-lg font-black font-mono ${
                                empScore >= 80
                                  ? 'text-emerald-600'
                                  : empScore >= 50
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {empScore}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Extended Employee Details Grid */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Department:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[190px]">
                            {emp.department || 'Operations & Strategy'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Branch / Unit:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[190px]">
                            {branchName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Login Username:</span>
                          <span className="font-mono font-bold text-sky-700">
                            @{emp.username || emp.name.toLowerCase().replace(/\s+/g, '.')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Recovery Email:</span>
                          <span className="font-mono text-slate-700 truncate max-w-[190px]">
                            {emp.email || 'Not configured'}
                          </span>
                        </div>
                        {emp.qualification && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Qualification:</span>
                            <span className="font-medium text-slate-700 truncate max-w-[190px]">
                              {emp.qualification}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tenure / Type:</span>
                          <span className="font-medium text-slate-700">
                            {emp.employmentType || 'Full-Time'} · Since {emp.hireDate || '2021'}
                          </span>
                        </div>
                        {supervisor && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Reports To:</span>
                            <span className="font-medium text-slate-700">
                              {supervisor.name} ({supervisor.role})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Skills Tags */}
                      {emp.skills && emp.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {emp.skills.slice(0, 4).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* KPI & Security Footer Status */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>
                          <strong>{empKpiCount}</strong> KPIs ·{' '}
                          <strong className={empBacklogs > 0 ? 'text-amber-600' : ''}>
                            {empBacklogs}
                          </strong>{' '}
                          Backlogs
                        </span>
                        {emp.mustChangePassword ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Password Reset Pending
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            Auth Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPreviewEmployee(emp)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Dossier
                        </button>
                        <Link
                          to={`/employees/${emp.id}`}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold transition"
                        >
                          Scorecard
                        </Link>
                        <button
                          onClick={() => exportEmployeeScorecardPDF(emp)}
                          disabled={exportingId === emp.id}
                          className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                          title="Export PDF Dossier"
                        >
                          PDF
                        </button>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setResetTargetEmployee(emp);
                              setAdminNewPassword('Reset@2026');
                              setAdminNewPin(emp.pin || '1234');
                              setAdminMustChangeFlag(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Admin Reset User Password"
                          >
                            Reset Pwd
                          </button>
                          <button
                            onClick={() => setEditingEmployee({ ...emp })}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          {emp.id !== user?.id && (
                            <button
                              onClick={() => setEmployeeToDelete({ id: emp.id, name: emp.name })}
                              className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold cursor-pointer"
                              title="Delete Employee"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase bg-slate-50">
                    <th className="py-3 px-3">Employee & Code</th>
                    <th className="py-3 px-3">System Role</th>
                    <th className="py-3 px-3">Organization Position & Dept</th>
                    <th className="py-3 px-3">Login & Recovery Email</th>
                    <th className="py-3 px-3">Qualification & Tenure</th>
                    <th className="py-3 px-3 text-center">BSC Score</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {managedEmployees.map((emp) => {
                    const score = getEmployeeScore(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <Link
                            to={`/employees/${emp.id}`}
                            className="font-bold text-slate-900 hover:text-sky-600 block"
                          >
                            {emp.name}
                          </Link>
                          <span className="text-[11px] font-mono text-slate-400">
                            {emp.employeeCode || `EMP-00${emp.id}`} · {emp.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRoleBadgeClasses(
                              emp.role
                            )}`}
                          >
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">
                            {emp.positionTitle || emp.role}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {emp.department || 'Operations'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-sky-700 block">
                            @{emp.username || 'user'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {emp.email || 'No email'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-700 block">
                            {emp.qualification || 'Professional'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {emp.employmentType || 'Full-Time'} · {emp.hireDate || '2021'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {score !== null ? `${score}%` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <button
                            onClick={() => setPreviewEmployee(emp)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold cursor-pointer"
                          >
                            Dossier
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setResetTargetEmployee(emp);
                                  setAdminNewPassword('Reset@2026');
                                  setAdminNewPin(emp.pin || '1234');
                                  setAdminMustChangeFlag(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold cursor-pointer"
                              >
                                Reset Pwd
                              </button>
                              <button
                                onClick={() => setEditingEmployee({ ...emp })}
                                className="px-2 py-1 border border-slate-300 text-slate-700 rounded font-semibold cursor-pointer"
                              >
                                Edit
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ORGANIZATION POSITIONS & REQUIRED ROLES */}
      {/* ===================================================================== */}
      {activeTab === 'org-positions' && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Required Positions & Roles for {activeOrganization?.name}
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-orange-100 text-orange-800 rounded-lg">
                    {activeOrganization?.sector}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Specific employee titles, operational departments, and mapped system control roles
                  required to maintain and operate {activeOrganization?.name}.
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      if (!activeOrganization) return;
                      const defaults = getDefaultPositionsForSector(activeOrganization.sector);
                      await updateOrganization({
                        ...activeOrganization,
                        requiredPositions: defaults,
                      });
                      showNotice(
                        `Loaded recommended ${activeOrganization.sector} positions for ${activeOrganization.name}.`
                      );
                    }}
                    className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Load Sector Defaults
                  </button>
                  <button
                    onClick={() => {
                      setEditingPosition(null);
                      setPosTitle('');
                      setPosDepartment('');
                      setPosSystemRole(Role.OFFICER);
                      setPosResponsibilities('');
                      setPosRequiredCount(1);
                      setShowAddPositionModal(true);
                    }}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    + Add Required Position
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {orgPositions.map((pos) => {
                const assignedList = employees.filter(
                  (e) =>
                    e.organizationRoleId === pos.id ||
                    (e.positionTitle || '').toLowerCase() === pos.title.toLowerCase()
                );
                const reqCount = pos.requiredCount || 1;
                const isFulfilled = assignedList.length >= reqCount;

                return (
                  <div
                    key={pos.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                      isFulfilled
                        ? 'bg-white border-slate-200'
                        : 'bg-amber-50/30 border-amber-300/80'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">{pos.title}</h3>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRoleBadgeClasses(
                                pos.systemRole
                              )}`}
                            >
                              System Role: {pos.systemRole}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Department: {pos.department}
                          </p>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                            isFulfilled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {assignedList.length}/{reqCount} Filled
                        </span>
                      </div>

                      {pos.responsibilities && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {pos.responsibilities}
                        </p>
                      )}

                      {/* Current Incumbents */}
                      <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Assigned Personnel ({assignedList.length}):
                        </span>
                        {assignedList.length === 0 ? (
                          <span className="text-xs text-amber-700 italic">
                            Position currently vacant — assign an employee to maintain this role.
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedList.map((inc) => (
                              <Link
                                key={inc.id}
                                to={`/employees/${inc.id}`}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                              >
                                <span>{inc.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  (@{inc.username || 'user'})
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="space-x-2">
                          <button
                            onClick={() => {
                              setEditingPosition(pos);
                              setPosTitle(pos.title);
                              setPosDepartment(pos.department);
                              setPosSystemRole(pos.systemRole);
                              setPosResponsibilities(pos.responsibilities || '');
                              setPosRequiredCount(pos.requiredCount || 1);
                              setShowAddPositionModal(true);
                            }}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Edit Position
                          </button>
                          <button
                            onClick={() => handleDeleteOrgPosition(pos.id)}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        <button
                          onClick={() => openAddEmployeeModal(pos)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          + Assign / Recruit to Position
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SYSTEM HIERARCHY & LOGIN CREDENTIALS MATRIX */}
      {/* ===================================================================== */}
      {activeTab === 'hierarchy-auth' && (
        <div className="space-y-6">
          {/* 5-Tier System Control Hierarchy Architecture */}
          <Card>
            <h2 className="text-lg font-bold text-slate-900">
              5-Tier System Control Hierarchy & Governance Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Defines system-wide permissions across Super Admin, Admin (HQ), Branch Manager,
              Officer, and Staff Member roles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {HIERARCHY_TIERS.map((tier) => {
                const tierMembers = employees.filter((e) => e.role === tier.role);
                return (
                  <div
                    key={tier.role}
                    className={`p-3.5 rounded-2xl border ${tier.color} flex flex-col justify-between space-y-3`}
                  >
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${tier.badge}`}
                      >
                        {tier.level}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 mt-2">{tier.role}</h3>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {tier.description}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-700">
                        {tierMembers.length} Assigned{' '}
                        {tierMembers.length === 1 ? 'Account' : 'Accounts'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Login Authentication & Admin Password Reset Table */}
          <Card className="overflow-x-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  User Login Credentials, Recovery Emails & Password Control
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administrators can reset user passwords or PINs; users can change their own
                  password or recover forgotten passwords via their registered email.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelfCurrentSecret('');
                  setSelfNewPassword('');
                  setSelfConfirmPassword('');
                  setSelfNewEmail(user?.email || '');
                  setSelfNewUsername(user?.username || '');
                  setShowSelfPasswordModal(true);
                }}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
              >
                Change My Own Password
              </button>
            </div>

            <table className="w-full text-left border-collapse text-xs mt-3">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase bg-slate-50">
                  <th className="py-3 px-3">User & Employee Code</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">System Hierarchy Role</th>
                  <th className="py-3 px-3">Organization Position</th>
                  <th className="py-3 px-3">Recovery Email (Forgot Pwd)</th>
                  <th className="py-3 px-3">Auth & Reset Audit</th>
                  <th className="py-3 px-3 text-right">Security Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{emp.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {emp.employeeCode || `EMP-00${emp.id}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-sky-700">
                      @{emp.username || emp.name.toLowerCase().replace(/\s+/g, '.')}
                    </td>
                    <td className="py-3 px-3">
                      {isAdmin ? (
                        <select
                          value={emp.role}
                          onChange={async (e) => {
                            const updated = { ...emp, role: e.target.value as Role };
                            await updateEmployee(updated);
                            await refreshUsers();
                            showNotice(`Updated ${emp.name}'s system role to ${updated.role}.`);
                          }}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border outline-none cursor-pointer ${getRoleBadgeClasses(
                            emp.role
                          )}`}
                        >
                          <option value={Role.SUPER_ADMIN}>{Role.SUPER_ADMIN}</option>
                          <option value={Role.ADMIN}>{Role.ADMIN}</option>
                          <option value={Role.MANAGER}>{Role.MANAGER}</option>
                          <option value={Role.OFFICER}>{Role.OFFICER}</option>
                          <option value={Role.STAFF}>{Role.STAFF}</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRoleBadgeClasses(
                            emp.role
                          )}`}
                        >
                          {emp.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">
                        {emp.positionTitle || emp.role}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {emp.department || 'Operations'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {emp.email || 'Not set'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {emp.lockedUntil && new Date(emp.lockedUntil).getTime() > Date.now() ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded text-[10px] font-bold">
                            Locked ({emp.failedLoginAttempts || 5} Failed)
                          </span>
                        ) : emp.mustChangePassword ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            Reset by {emp.lastPasswordResetBy || 'Admin'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">
                            Active · scrypt Hash
                          </span>
                        )}
                        {(emp.failedLoginAttempts || 0) > 0 &&
                          (!emp.lockedUntil || new Date(emp.lockedUntil).getTime() <= Date.now()) && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono text-[10px]">
                              {emp.failedLoginAttempts}/5 attempts
                            </span>
                          )}
                      </div>
                      {emp.lastPasswordResetAt && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">
                          Updated: {emp.lastPasswordResetAt.slice(0, 10)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      {isAdmin &&
                        ((emp.lockedUntil && new Date(emp.lockedUntil).getTime() > Date.now()) ||
                          (emp.failedLoginAttempts || 0) > 0) && (
                          <button
                            onClick={async () => {
                              const ok = await unlockUserAccount(emp.id);
                              if (ok) {
                                refreshData();
                                showNotice(
                                  `Unlocked account and cleared failed login attempts for ${emp.name} (@${emp.username}).`
                                );
                              }
                            }}
                            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold cursor-pointer"
                          >
                            Unlock Account
                          </button>
                        )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setResetTargetEmployee(emp);
                            setAdminNewPassword('Reset@2026');
                            setAdminNewPin(emp.pin || '1234');
                            setAdminMustChangeFlag(true);
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold cursor-pointer"
                        >
                          Admin Reset Password
                        </button>
                      )}
                      {user?.id === emp.id && (
                        <button
                          onClick={() => {
                            setSelfCurrentSecret('');
                            setSelfNewPassword('');
                            setSelfConfirmPassword('');
                            setSelfNewEmail(user.email || '');
                            setSelfNewUsername(user.username || '');
                            setShowSelfPasswordModal(true);
                          }}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-bold cursor-pointer"
                        >
                          Change Password
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: ONBOARD / ADD NEW EMPLOYEE */}
      {/* ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Onboard New Employee & Configure Credentials
                </h3>
                <p className="text-xs text-slate-500">
                  Assign system hierarchy role, organization-specific position, personal details, and
                  login authentication
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 mt-4">
              {/* Section 1: Identity & Contact */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Identity & Recovery Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      placeholder="e.g. Yohannes Mekonnen"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Employee Code
                    </label>
                    <input
                      type="text"
                      value={newEmpCode}
                      onChange={(e) => setNewEmpCode(e.target.value)}
                      placeholder="EMP-006"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Email (For Forgot Password) *
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmpEmail}
                      onChange={(e) => setNewEmpEmail(e.target.value)}
                      placeholder="user@org-tracker.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newEmpPhone}
                      onChange={(e) => setNewEmpPhone(e.target.value)}
                      placeholder="+251 911 000 000"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      value={newEmpEmergencyContact}
                      onChange={(e) => setNewEmpEmergencyContact(e.target.value)}
                      placeholder="Name & Phone"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: System Hierarchy & Organization-Specific Position */}
              <div className="p-3.5 bg-orange-50/40 rounded-xl border border-orange-200/80 space-y-3">
                <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                  2. Organization Position & System Hierarchy Role
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Select Required Organization Position
                    </label>
                    <select
                      value={newEmpOrgRoleId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewEmpOrgRoleId(val);
                        const found = orgPositions.find((p) => p.id === val);
                        if (found) {
                          setNewEmpPosition(found.title);
                          setNewEmpDepartment(found.department);
                          setNewEmpRole(found.systemRole);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="">-- Custom Position Title --</option>
                      {orgPositions.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.title} ({pos.systemRole})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      System Control Hierarchy Role *
                    </label>
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value as Role)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                    >
                      <option value={Role.SUPER_ADMIN}>{Role.SUPER_ADMIN} (Tier 1)</option>
                      <option value={Role.ADMIN}>{Role.ADMIN} (Tier 2)</option>
                      <option value={Role.MANAGER}>{Role.MANAGER} (Tier 3)</option>
                      <option value={Role.OFFICER}>{Role.OFFICER} (Tier 4)</option>
                      <option value={Role.STAFF}>{Role.STAFF} (Tier 5)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Specific Position / Job Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmpPosition}
                      onChange={(e) => setNewEmpPosition(e.target.value)}
                      placeholder="e.g. Senior Quality Officer"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={newEmpDepartment}
                      onChange={(e) => setNewEmpDepartment(e.target.value)}
                      placeholder="Department"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Branch / Operational Unit
                    </label>
                    <select
                      value={newEmpBranchId}
                      onChange={(e) => setNewEmpBranchId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Professional Qualifications & Reporting */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  3. Professional Profile, Qualifications & Reporting Line
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Academic Qualification
                    </label>
                    <input
                      type="text"
                      value={newEmpQualification}
                      onChange={(e) => setNewEmpQualification(e.target.value)}
                      placeholder="e.g. MSc in Operations"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={newEmpSpecialization}
                      onChange={(e) => setNewEmpSpecialization(e.target.value)}
                      placeholder="Core domain expertise"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Direct Supervisor
                    </label>
                    <select
                      value={newEmpSupervisorId}
                      onChange={(e) =>
                        setNewEmpSupervisorId(e.target.value ? Number(e.target.value) : '')
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    >
                      <option value="">None / Executive Board</option>
                      {employees.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Employment Type
                    </label>
                    <select
                      value={newEmpEmploymentType}
                      onChange={(e) => setNewEmpEmploymentType(e.target.value as EmploymentType)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Seconded">Seconded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Status
                    </label>
                    <select
                      value={newEmpStatus}
                      onChange={(e) => setNewEmpStatus(e.target.value as EmployeeStatus)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Probation">Probation</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Transferred">Transferred</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Hire Date
                    </label>
                    <input
                      type="date"
                      value={newEmpHireDate}
                      onChange={(e) => setNewEmpHireDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Skills (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={newEmpSkills}
                      onChange={(e) => setNewEmpSkills(e.target.value)}
                      placeholder="KPIs, Audit, Quality"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Login Authentication Protocols */}
              <div className="p-3.5 bg-sky-50/50 rounded-xl border border-sky-200 space-y-3">
                <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
                  4. Login Authentication Protocols (Username, Initial Password & PIN)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Login Username
                    </label>
                    <input
                      type="text"
                      value={newEmpUsername}
                      onChange={(e) => setNewEmpUsername(e.target.value)}
                      placeholder="Auto-generated if blank"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmpPassword}
                      onChange={(e) => setNewEmpPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      4-Digit Quick PIN *
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmpPin}
                      onChange={(e) => setNewEmpPin(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEmpMustChangePwd}
                    onChange={(e) => setNewEmpMustChangePwd(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>
                    Require employee to change initial password upon their first login
                  </span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Saving Employee...' : 'Create Employee & Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: EDIT EMPLOYEE DETAILS & ROLES */}
      {/* ===================================================================== */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Edit Employee Dossier & Role Assignment
                </h3>
                <p className="text-xs text-slate-500">
                  {editingEmployee.name} ({editingEmployee.employeeCode || `#${editingEmployee.id}`})
                </p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.name}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.employeeCode || ''}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        employeeCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    System Hierarchy Role
                  </label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, role: e.target.value as Role })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value={Role.SUPER_ADMIN}>{Role.SUPER_ADMIN}</option>
                    <option value={Role.ADMIN}>{Role.ADMIN}</option>
                    <option value={Role.MANAGER}>{Role.MANAGER}</option>
                    <option value={Role.OFFICER}>{Role.OFFICER}</option>
                    <option value={Role.STAFF}>{Role.STAFF}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Match Organization Required Position
                  </label>
                  <select
                    value={editingEmployee.organizationRoleId || ''}
                    onChange={(e) => {
                      const pos = orgPositions.find((p) => p.id === e.target.value);
                      setEditingEmployee({
                        ...editingEmployee,
                        organizationRoleId: e.target.value || undefined,
                        positionTitle: pos ? pos.title : editingEmployee.positionTitle,
                        department: pos ? pos.department : editingEmployee.department,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="">-- Custom / Unlinked Position --</option>
                    {orgPositions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.title} ({pos.systemRole})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Position Title
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.positionTitle || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, positionTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.department || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, department: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editingEmployee.status || 'Active'}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        status: e.target.value as EmployeeStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Probation">Probation</option>
                    <option value="Transferred">Transferred</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.username || ''}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        username: e.target.value.toLowerCase(),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Recovery Email
                  </label>
                  <input
                    type="email"
                    value={editingEmployee.email || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.phone || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.qualification || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, qualification: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.specialization || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, specialization: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.emergencyContact || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, emergencyContact: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Employee Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ADMIN RESET USER PASSWORD */}
      {/* ===================================================================== */}
      {resetTargetEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Admin Reset Employee Password
                </h3>
                <p className="text-xs text-slate-500">
                  Target: <strong>{resetTargetEmployee.name}</strong> (@
                  {resetTargetEmployee.username || 'user'})
                </p>
              </div>
              <button
                onClick={() => setResetTargetEmployee(null)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdminPasswordResetSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    New / Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminNewPassword(
                        `Org@${Math.floor(1000 + Math.random() * 9000)}`
                      )
                    }
                    className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    Generate Random Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  4-Digit Quick PIN
                </label>
                <input
                  type="text"
                  required
                  value={adminNewPin}
                  onChange={(e) => setAdminNewPin(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono outline-none"
                />
              </div>

              <label className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={adminMustChangeFlag}
                  onChange={(e) => setAdminMustChangeFlag(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-amber-600"
                />
                <span>
                  Prompt employee to set a new personal password on their next sign-in
                </span>
              </label>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetTargetEmployee(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Confirm Password Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: SELF-SERVICE CHANGE PASSWORD & RECOVERY EMAIL */}
      {/* ===================================================================== */}
      {showSelfPasswordModal && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Change My Password & Recovery Email
                </h3>
                <p className="text-xs text-slate-500">
                  {user.name} ({user.role})
                </p>
              </div>
              <button
                onClick={() => setShowSelfPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSelfPasswordSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    My Username
                  </label>
                  <input
                    type="text"
                    required
                    value={selfNewUsername}
                    onChange={(e) => setSelfNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Recovery Email
                  </label>
                  <input
                    type="email"
                    required
                    value={selfNewEmail}
                    onChange={(e) => setSelfNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Current Password or PIN
                </label>
                <input
                  type="password"
                  required
                  value={selfCurrentSecret}
                  onChange={(e) => setSelfCurrentSecret(e.target.value)}
                  placeholder="Enter current password or PIN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={selfNewPassword}
                    onChange={(e) => setSelfNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={selfConfirmPassword}
                    onChange={(e) => setSelfConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSelfPasswordModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: ADD / EDIT REQUIRED ORGANIZATION POSITION */}
      {/* ===================================================================== */}
      {showAddPositionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPosition
                    ? 'Edit Organization Position & Role'
                    : 'Add Required Organization Position'}
                </h3>
                <p className="text-xs text-slate-500">
                  Organization: {activeOrganization?.name} ({activeOrganization?.sector})
                </p>
              </div>
              <button
                onClick={() => setShowAddPositionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveOrgPosition} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Position / Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={posTitle}
                  onChange={(e) => setPosTitle(e.target.value)}
                  placeholder="e.g. Plant Quality Assurance Director"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={posDepartment}
                    onChange={(e) => setPosDepartment(e.target.value)}
                    placeholder="e.g. Quality Control"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Required Headcount
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={posRequiredCount}
                    onChange={(e) => setPosRequiredCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mapped System Control Hierarchy Role
                </label>
                <select
                  value={posSystemRole}
                  onChange={(e) => setPosSystemRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value={Role.SUPER_ADMIN}>{Role.SUPER_ADMIN}</option>
                  <option value={Role.ADMIN}>{Role.ADMIN}</option>
                  <option value={Role.MANAGER}>{Role.MANAGER}</option>
                  <option value={Role.OFFICER}>{Role.OFFICER}</option>
                  <option value={Role.STAFF}>{Role.STAFF}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Core Responsibilities to Maintain Organization
                </label>
                <textarea
                  rows={2}
                  value={posResponsibilities}
                  onChange={(e) => setPosResponsibilities(e.target.value)}
                  placeholder="Describe why this position is required to maintain the organization..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPositionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: FULL EMPLOYEE DOSSIER & SCORECARD PREVIEW */}
      {/* ===================================================================== */}
      {previewEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{previewEmployee.name}</h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRoleBadgeClasses(
                      previewEmployee.role
                    )}`}
                  >
                    {previewEmployee.role}
                  </span>
                </div>
                <p className="text-xs font-semibold text-orange-700 mt-0.5">
                  {previewEmployee.positionTitle || previewEmployee.role} ·{' '}
                  {previewEmployee.department || 'Operations'}
                </p>
              </div>
              <button
                onClick={() => setPreviewEmployee(null)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Employee Code
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {previewEmployee.employeeCode || `EMP-00${previewEmployee.id}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Login Username
                </span>
                <span className="font-mono font-bold text-sky-700">
                  @{previewEmployee.username || 'user'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Recovery Email
                </span>
                <span className="font-mono text-slate-700">{previewEmployee.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Qualification
                </span>
                <span className="font-medium text-slate-800">
                  {previewEmployee.qualification || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Specialization
                </span>
                <span className="font-medium text-slate-800">
                  {previewEmployee.specialization || 'General Operations'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Emergency Contact
                </span>
                <span className="font-medium text-slate-800">
                  {previewEmployee.emergencyContact || previewEmployee.phone || 'N/A'}
                </span>
              </div>
            </div>

            {/* Assigned KPIs with Reusable KpiProgressBar */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned KPI Progress Relative to Annual Plan
              </h4>
              {kpis.filter((k) => k.employeeId === previewEmployee.id).length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No individual KPIs currently assigned to this account.
                </p>
              ) : (
                kpis
                  .filter((k) => k.employeeId === previewEmployee.id)
                  .map((k) => {
                    const obj = annualPlan.find((o) => o.id === k.objectiveId);
                    const calc = calculateKpiMetrics(k, obj);
                    return (
                      <KpiProgressBar
                        key={k.id}
                        label={k.name}
                        actual={k.actual}
                        target={k.target}
                        annualPlanTarget={obj?.target}
                        annualPlanObjectiveTitle={obj?.objective}
                        unit={obj?.unit || 'Units'}
                        weight={k.weight}
                        score={calc.score}
                        perspective={obj?.category}
                        compact
                      />
                    );
                  })
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setPreviewEmployee(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/employees/${previewEmployee.id}`}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
              >
                Open Full Profile &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 7: CONFIRM DELETE EMPLOYEE */}
      {/* ===================================================================== */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Employee Removal</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove <strong>{employeeToDelete.name}</strong> and their
              associated KPI assignments?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEmployeeToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEmployee}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Delete Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;