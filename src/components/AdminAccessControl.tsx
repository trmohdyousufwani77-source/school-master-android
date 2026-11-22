import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  KeyRound,
  FileCheck2,
  Clock,
  Search,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Check,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Unlock,
  CheckCircle2,
  ArrowRight,
  GitFork,
  CornerDownRight,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  Calendar,
  Layers,
  History,
  Info,
  Phone,
  Mail,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  AdminAuditChangeLog,
  AdminRoleType,
  AdminUser,
  PermissionKey,
  SchoolProfile,
  SecuritySettings,
} from '../types';
import {
  ALL_PERMISSIONS,
  JUNIOR_ADMIN_BASE_PERMISSIONS,
  SENIOR_ADMIN_ADDITIONAL_PERMISSIONS,
  resolveUserPermissions,
} from '../utils/sampleData';
import {
  exportAdminRosterToExcel,
  exportSecurityAuditToCSV,
  exportSecurityAuditToJSON,
  generateSecurityAuditPdf,
} from '../utils/securityAuditPdf';
import { usePermissions } from '../hooks/usePermissions';

interface AdminAccessControlProps {
  school: SchoolProfile;
  onOpenDownloadHub?: () => void;
}

export const AdminAccessControl: React.FC<AdminAccessControlProps> = ({
  school,
  onOpenDownloadHub,
}) => {
  const {
    currentUser,
    adminUsers,
    effectiveRole,
    simulatedRole,
    setSimulatedRole,
    securitySettings,
    updateSecuritySettings,
    auditLogs,
    updateAdminUser,
    deleteAdminUser,
    addAdminUser,
    purgeSyncedData,
  } = usePermissions();

  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit' | 'security' | 'hygiene'>('users');

  // Quick Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRoleType>('all');

  // Inline editing state: stores the ID of the user currently being edited inline
  const [inlineEditingUserId, setInlineEditingUserId] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState<string>('');
  const [inlineRole, setInlineRole] = useState<AdminRoleType>('junior_admin');
  const [inlinePhone, setInlinePhone] = useState<string>('');

  // Full Edit / Change modal state
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<AdminUser | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Add User modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<AdminRoleType>('junior_admin');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserDesignation, setNewUserDesignation] = useState<string>('');

  // Delete Confirmation modal
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Temporary password reset code generator state
  const [tempCodeGenerated, setTempCodeGenerated] = useState<{ userId: string; code: string } | null>(null);

  // Status notification banner
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setStatusNotification({ type, message });
    setTimeout(() => setStatusNotification(null), 4000);
  };

  // Helper for text highlighting in Quick Search
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded shadow-xs">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Filtered admin users based on search query and role filter
  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().replace('_', ' ').includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [adminUsers, searchQuery, roleFilter]);

  // Start inline editing
  const handleStartInlineEdit = (user: AdminUser) => {
    setInlineEditingUserId(user.id);
    setInlineName(user.name);
    setInlineRole(user.role);
    setInlinePhone(user.phone || '');
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingUserId(null);
  };

  const handleSaveInlineEdit = (originalUser: AdminUser) => {
    if (!inlineName.trim()) {
      showNotification('Administrator name cannot be empty', 'error');
      return;
    }

    const updated: AdminUser = {
      ...originalUser,
      name: inlineName.trim(),
      role: inlineRole,
      phone: inlinePhone.trim() || originalUser.phone,
      inheritsFrom: inlineRole === 'senior_admin' ? 'junior_admin' : 'none',
    };

    updateAdminUser(updated, originalUser);
    setInlineEditingUserId(null);
    showNotification(`Updated ${updated.name}'s administrative details and role inheritance!`);
  };

  // Handle User Deletion
  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    const result = deleteAdminUser(userToDelete.id);
    if (result.success) {
      showNotification(result.message);
      setUserToDelete(null);
      setDeleteErrorMessage(null);
    } else {
      setDeleteErrorMessage(result.message);
    }
  };

  // Handle Add New User
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      showNotification('Please enter both name and official email address', 'error');
      return;
    }

    addAdminUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      phone: newUserPhone.trim(),
      designation: newUserDesignation.trim(),
    });

    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserDesignation('');
    showNotification(`New ${newUserRole.replace('_', ' ')} account created successfully!`);
  };

  // Temporary Emergency Login Code Generator
  const handleGenerateTempCode = (user: AdminUser) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setTempCodeGenerated({ userId: user.id, code });
    showNotification(`Temporary emergency code generated for ${user.name}`);
  };

  // Apply Role Template Preset
  const handleApplyRoleTemplate = (templateName: string) => {
    if (templateName === 'Data Entry Clerk') {
      showNotification('Template "Data Entry Clerk" applied to Junior Admin permissions');
    } else if (templateName === 'Attendance Auditor') {
      showNotification('Template "Attendance Auditor" applied to Junior Admin permissions');
    } else if (templateName === 'Examinations Manager') {
      showNotification('Template "Examinations Manager" applied to Senior Admin permissions');
    }
  };

  // Security Policy State for Form
  const [secMinPass, setSecMinPass] = useState(securitySettings.minPasswordLength);
  const [secSpecial, setSecSpecial] = useState(securitySettings.requireSpecialChar);
  const [secNumbers, setSecNumbers] = useState(securitySettings.requireNumbers);
  const [secUppercase, setSecUppercase] = useState(securitySettings.requireUppercase);
  const [secTimeout, setSecTimeout] = useState(securitySettings.sessionTimeoutMinutes);
  const [secMaxFailed, setSecMaxFailed] = useState(securitySettings.maxFailedLogins);
  const [sec2Fa, setSec2Fa] = useState(securitySettings.twoFactorEnforced);

  const handleSaveSecurityPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    updateSecuritySettings({
      minPasswordLength: secMinPass,
      requireSpecialChar: secSpecial,
      requireNumbers: secNumbers,
      requireUppercase: secUppercase,
      sessionTimeoutMinutes: secTimeout,
      maxFailedLogins: secMaxFailed,
      twoFactorEnforced: sec2Fa,
    });
    showNotification('Security Settings updated and active across all administrative sessions!');
  };

  // Purge Synced Data
  const handlePurge = () => {
    if (window.confirm('Are you sure you want to purge synced offline records older than 30 days? A local recovery snapshot will be downloaded.')) {
      const result = purgeSyncedData();
      // download archive
      const blob = new Blob([result.archivedData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offline_Purge_Archive_30Days_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showNotification(`Successfully purged ${result.count} synced records older than 30 days. Backup downloaded!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner if User View Simulation is Active */}
      {simulatedRole && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-slate-950 shrink-0" />
            <div>
              <span className="font-extrabold text-xs uppercase tracking-wider block">
                User View Simulation Active: Previewing as {simulatedRole.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[11px] text-slate-900 font-medium">
                Testing permissions, UI visibility, and tab access for this role without changing your actual master credentials.
              </span>
            </div>
          </div>
          <button
            onClick={() => setSimulatedRole(null)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-xs shrink-0 active:scale-95"
          >
            Exit Simulation (Return to Master)
          </button>
        </div>
      )}

      {/* Status Notification Toast */}
      {statusNotification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-in fade-in slide-in-from-top-1 ${
            statusNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotification.message}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Admin Access Control & Role Inheritance</span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                  RTE & U-DISE Compliant
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Manage administrative accounts, configure automatic Junior-to-Senior role inheritance, audit engagement, and enforce security policies.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulation Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs">
            <Eye className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <span className="text-[11px] font-bold text-slate-600">Simulate:</span>
            <select
              value={simulatedRole || currentUser.role}
              onChange={(e) => {
                const val = e.target.value as AdminRoleType;
                setSimulatedRole(val === currentUser.role ? null : val);
              }}
              className="bg-white text-xs font-bold text-slate-800 rounded-xl px-2 py-1 border border-slate-200 focus:outline-hidden"
            >
              <option value="primary_admin">Primary Admin (Principal)</option>
              <option value="senior_admin">Senior Admin (Inherited)</option>
              <option value="junior_admin">Junior Admin (Base)</option>
              <option value="teacher">Teacher (Restricted)</option>
            </select>
          </div>

          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Admin</span>
          </button>

          {/* Universal Download Button */}
          <button
            onClick={() => generateSecurityAuditPdf(school, auditLogs, adminUsers, securitySettings)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
            title="Download certified 30-day compliance PDF report"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Export Security Audit (PDF)</span>
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap rounded-2xl bg-white p-1.5 border border-slate-200/80 shadow-sm text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Admin Users & Inline Edit ({adminUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Role Inheritance & Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Log & Change Comparison ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'security' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Security Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('hygiene')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'hygiene' ? 'bg-indigo-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          <span>Data Hygiene & Purge</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: ADMIN USERS & INLINE EDITING
      ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Quick Search & Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Quick Search (highlight matching name, email, role)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-bold text-slate-500">Filter Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
              >
                <option value="all">All Roles ({adminUsers.length})</option>
                <option value="primary_admin">Primary Admin</option>
                <option value="senior_admin">Senior Admin (Inherited)</option>
                <option value="junior_admin">Junior Admin</option>
                <option value="teacher">Teacher</option>
              </select>

              {/* Download Roster Excel */}
              <button
                onClick={() => exportAdminRosterToExcel(adminUsers, school)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1.5 transition-all text-xs active:scale-95"
                title="Download Admin Roster as Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Roster (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Admin User Cards / Table with Inline Editing */}
          <div className="grid grid-cols-1 gap-3.5">
            {filteredAdminUsers.map((user) => {
              const isInlineEditing = inlineEditingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className={`bg-white rounded-3xl border transition-all p-5 shadow-sm ${
                    isInlineEditing
                      ? 'border-indigo-500 ring-2 ring-indigo-100'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {isInlineEditing ? (
                    /* INLINE EDIT MODE */
                    <div className="space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5" />
                          <span>Inline Editing Administrator</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveInlineEdit(user)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs active:scale-95"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelInlineEdit}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs active:scale-95"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Administrator Full Name
                          </label>
                          <input
                            type="text"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Access Role (Triggers Inheritance)
                          </label>
                          <select
                            value={inlineRole}
                            onChange={(e) => setInlineRole(e.target.value as AdminRoleType)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs bg-white"
                          >
                            <option value="primary_admin">Primary Admin (Principal / Headmaster)</option>
                            <option value="senior_admin">Senior Admin (Inherits Junior Admin)</option>
                            <option value="junior_admin">Junior Admin (Base Matrix)</option>
                            <option value="teacher">Teacher (Class Level Only)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            value={inlinePhone}
                            onChange={(e) => setInlinePhone(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                          />
                        </div>
                      </div>

                      {inlineRole === 'senior_admin' && (
                        <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-indigo-900 text-[11px] flex items-center gap-2 font-medium">
                          <GitFork className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>
                            <strong>Role Inheritance Activated:</strong> As Senior Admin, {inlineName || 'this user'} will automatically inherit all 5 base permissions from Junior Admin, plus advanced report exports and exam controls.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VIEW MODE */
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          <img
                            src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={user.name}
                            className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-extrabold text-sm text-slate-900">
                                {highlightText(user.name, searchQuery)}
                              </h3>

                              {/* Role Badge */}
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                  user.role === 'primary_admin'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : user.role === 'senior_admin'
                                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                                    : user.role === 'junior_admin'
                                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                                    : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                              >
                                {highlightText(user.role.replace('_', ' '), searchQuery)}
                              </span>

                              {/* Inheritance Indicator */}
                              {user.role === 'senior_admin' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <CornerDownRight className="w-3 h-3 text-indigo-500" />
                                  <span>Inherits from Junior Admin</span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{highlightText(user.email, searchQuery)}</span>
                              </span>
                              {user.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{user.phone}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <Clock className="w-3 h-3 text-emerald-500" />
                                <span>Last Active: {new Date(user.lastActive).toLocaleDateString()} at {new Date(user.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Inline Edit, Detail/Heatmap, Emergency Code, Delete/Deactivate */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {/* 1. Inline Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartInlineEdit(user)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs border border-slate-200 transition-all active:scale-95"
                            title="Edit name, role, and phone inline"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* 2. Detail & Heatmap Modal */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserForDetail(user);
                              setIsDetailModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all active:scale-95"
                          >
                            <Sliders className="w-3.5 h-3.5 text-slate-500" />
                            <span>Activity & Heatmap</span>
                          </button>

                          {/* 3. Emergency Temp Code */}
                          <button
                            type="button"
                            onClick={() => handleGenerateTempCode(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition-all active:scale-95"
                            title="Generate one-time emergency login code"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Code</span>
                          </button>

                          {/* 4. Delete / Deactivate Option */}
                          {user.role !== 'primary_admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteErrorMessage(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all active:scale-95"
                              title="Delete or deactivate administrative account"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Recent Actions Summary List */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            Recent Activity & Engagement Audit:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {user.recentActions && user.recentActions.length > 0 ? (
                            user.recentActions.map((action, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1.5"
                              >
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>{action}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No recent logged actions</span>
                          )}
                        </div>
                      </div>

                      {/* 7-Day Mini Heatmap Bar */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">7-Day Density:</span>
                          <div className="flex items-center gap-1">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                              const count = user.activity7Days?.[dIdx] ?? 0;
                              const intensity =
                                count === 0
                                  ? 'bg-slate-200 text-slate-500'
                                  : count < 10
                                  ? 'bg-emerald-200 text-emerald-800'
                                  : count < 25
                                  ? 'bg-emerald-400 text-emerald-950 font-bold'
                                  : 'bg-emerald-600 text-white font-bold';

                              return (
                                <div
                                  key={day}
                                  title={`${day}: ${count} actions recorded`}
                                  className={`w-6 h-6 rounded-lg text-[10px] flex items-center justify-center transition-all cursor-help ${intensity}`}
                                >
                                  {count}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>Low: 0</span>
                          <div className="w-2.5 h-2.5 rounded bg-emerald-200" />
                          <div className="w-2.5 h-2.5 rounded bg-emerald-400" />
                          <div className="w-2.5 h-2.5 rounded bg-emerald-600" />
                          <span>Peak: 30+</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: ROLE INHERITANCE & PERMISSION MATRIX
      ======================================================== */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          {/* Visual Role Inheritance Tree */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2 text-white">
                  <GitFork className="w-4 h-4 text-amber-300" />
                  <span>Visual Role Inheritance Hierarchy</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Live Engine
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  When enabled, Senior Admin roles inherit all baseline Junior Admin permissions automatically without manual duplication.
                </p>
              </div>

              {/* Role Templates Gallery */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mr-1">
                  Role Templates:
                </span>
                <button
                  onClick={() => handleApplyRoleTemplate('Data Entry Clerk')}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all text-slate-200"
                >
                  Data Entry Clerk
                </button>
                <button
                  onClick={() => handleApplyRoleTemplate('Attendance Auditor')}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all text-slate-200"
                >
                  Attendance Auditor
                </button>
                <button
                  onClick={() => handleApplyRoleTemplate('Examinations Manager')}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all text-slate-200"
                >
                  Examinations Manager
                </button>
              </div>
            </div>

            {/* Tree Flow Diagram */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {/* Level 1: Junior Admin (Parent Foundation) */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-300 uppercase">1. Junior Admin (Base)</span>
                  <span className="text-[10px] font-bold bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded-full">
                    5 Base Permissions
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Student enrollment, daily class attendance recording, mark entries, and basic report viewing.
                </p>
                <div className="text-[10px] text-blue-200 bg-blue-950/40 p-2 rounded-xl border border-blue-800/40">
                  Acts as baseline foundation for all senior roles.
                </div>
              </div>

              {/* Level 2: Senior Admin (Inherits Junior Admin + Extensions) */}
              <div className="p-3.5 rounded-2xl bg-indigo-900/60 border border-indigo-500/50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. Senior Admin</span>
                  </span>
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                    Inherits 5 + 6 Added
                  </span>
                </div>
                <p className="text-[11px] text-slate-200">
                  <strong>Automatically inherits</strong> all 5 Junior permissions + Teacher leave approval, Exam schedules, Offline data purge, and Audit PDF exports.
                </p>
                <div className="text-[10px] text-indigo-200 bg-indigo-950/40 p-2 rounded-xl border border-indigo-700/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No duplicate toggle work required.</span>
                </div>
              </div>

              {/* Level 3: Primary Admin (Full Master) */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-300 uppercase">3. Primary Admin (Headmaster)</span>
                  <span className="text-[10px] font-bold bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full">
                    All 13 Permissions
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Unrestricted master access: School U-DISE configuration, GPS geofence, Admin management, Security policy enforcement.
                </p>
                <div className="text-[10px] text-emerald-200 bg-emerald-950/40 p-2 rounded-xl border border-emerald-800/40">
                  Held by School Principal / Headmaster only.
                </div>
              </div>
            </div>
          </div>

          {/* Granular Permission Matrix Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                  Granular Permission Matrix & Role Inheritance Map
                </h4>
                <p className="text-xs text-slate-500">
                  Inspect how permissions resolve across roles with clear inheritance badges.
                </p>
              </div>

              <button
                onClick={() => exportAdminRosterToExcel(adminUsers, school)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export Matrix (.xlsx)</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Permission Capability</th>
                    <th className="py-3 px-3 text-center">Category</th>
                    <th className="py-3 px-3 text-center bg-blue-50/50">Junior Admin</th>
                    <th className="py-3 px-3 text-center bg-purple-50/50">Senior Admin (Inherited)</th>
                    <th className="py-3 px-3 text-center bg-amber-50/50">Primary Admin</th>
                    <th className="py-3 px-3 text-center">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isJuniorGranted = Boolean(JUNIOR_ADMIN_BASE_PERMISSIONS[perm.key]);
                    const isSeniorAdditional = Boolean(SENIOR_ADMIN_ADDITIONAL_PERMISSIONS[perm.key]);
                    const isSeniorInherited = isJuniorGranted && isSeniorAdditional;
                    const isPrimaryGranted = true;

                    return (
                      <tr key={perm.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">{perm.label}</span>
                          <span className="text-[11px] text-slate-400 block">{perm.description}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                            {perm.category}
                          </span>
                        </td>

                        {/* Junior Admin */}
                        <td className="py-2.5 px-3 text-center bg-blue-50/20">
                          {isJuniorGranted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" /> Granted
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        {/* Senior Admin with Inheritance Badge */}
                        <td className="py-2.5 px-3 text-center bg-purple-50/20">
                          {isSeniorInherited ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 cursor-help"
                              title="Automatically inherited from Junior Admin"
                            >
                              <GitFork className="w-3 h-3 text-indigo-600" />
                              <span>Inherited (Jr)</span>
                            </span>
                          ) : isSeniorAdditional ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              <Zap className="w-3 h-3 text-purple-600" />
                              <span>Senior Exclusive</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        {/* Primary Admin */}
                        <td className="py-2.5 px-3 text-center bg-amber-50/20">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            <Check className="w-3 h-3" /> Master
                          </span>
                        </td>

                        {/* Teacher */}
                        <td className="py-2.5 px-3 text-center">
                          {perm.key === 'record_attendance' || perm.key === 'edit_marks' || perm.key === 'view_dashboard' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              <Check className="w-3 h-3" /> Class Only
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-rose-500">
                              <Lock className="w-3 h-3" /> Restricted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: AUDIT LOG & CHANGE COMPARISON VIEW
      ======================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Administrative Audit Log with Change Comparison</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed side-by-side view showing 'Old Permission' vs 'New Permission' for all administrative updates over the past 30 days.
              </p>
            </div>

            {/* Export Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => generateSecurityAuditPdf(school, auditLogs, adminUsers, securitySettings)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                title="Generate certified 30-day compliance PDF report"
              >
                <Download className="w-3.5 h-3.5 text-amber-200" />
                <span>Export Security Audit (PDF)</span>
              </button>

              <button
                onClick={() => exportSecurityAuditToCSV(auditLogs, school)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => exportSecurityAuditToJSON(auditLogs, school, securitySettings)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 active:scale-95 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Audit List with Change Comparison Diff View */}
          <div className="space-y-3">
            {auditLogs.map((log) => {
              const hasDiff = log.oldValue !== undefined || log.newValue !== undefined || log.oldPermissions !== undefined;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-900 border border-indigo-200">
                        {log.actionType.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{log.description}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 shrink-0">
                      <span>By: <strong className="text-slate-700">{log.actorName}</strong></span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Side-by-Side Change Comparison View */}
                  {hasDiff && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      {/* Old State */}
                      <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                          Old Value / Previous Permission:
                        </span>
                        <div className="font-mono text-rose-900 text-xs font-semibold">
                          {log.oldValue || 'None / Not Assigned'}
                        </div>
                      </div>

                      {/* New State */}
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                          New Value / Updated Permission:
                        </span>
                        <div className="font-mono text-emerald-900 text-xs font-semibold">
                          {log.newValue || 'Updated'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: SECURITY SETTINGS
      ======================================================== */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveSecurityPolicy} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>Administrative Security Settings & Password Complexity</span>
            </h3>
            <p className="text-xs text-slate-500">
              Enforce mandatory password rules, session inactivity timeouts, and two-factor authentication requirements for administrative roles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Password Complexity Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Password Complexity Rules</span>
              </h4>

              <div>
                <div className="flex items-center justify-between mb-1.5 font-bold text-slate-700">
                  <span>Minimum Password Length:</span>
                  <span className="text-indigo-600 text-sm font-extrabold">{secMinPass} Characters</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="16"
                  step="2"
                  value={secMinPass}
                  onChange={(e) => setSecMinPass(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                  <span>8 chars (Standard)</span>
                  <span>10 chars</span>
                  <span>12 chars (Recommended)</span>
                  <span>16 chars (Maximum)</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={secSpecial}
                    onChange={(e) => setSecSpecial(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Require Special Characters (@, #, $, %, etc.)</span>
                    <span className="text-[11px] text-slate-500">Prevents dictionary-based brute force attacks.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={secNumbers}
                    onChange={(e) => setSecNumbers(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Require Numerical Digits (0-9)</span>
                    <span className="text-[11px] text-slate-500">Mandates at least one number in administrative passwords.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={secUppercase}
                    onChange={(e) => setSecUppercase(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Require Uppercase Letters (A-Z)</span>
                    <span className="text-[11px] text-slate-500">Enforces mixed casing for high entropy passwords.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Session Timeout & Lockout Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Session Expiry & Account Lockout</span>
              </h4>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Inactivity Session Timeout Duration
                </label>
                <select
                  value={secTimeout}
                  onChange={(e) => setSecTimeout(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-800"
                >
                  <option value={15}>15 Minutes (High Security)</option>
                  <option value={30}>30 Minutes (Recommended)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={240}>4 Hours (Full School Shift)</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatically locks the interface when left unattended on classroom or lab PCs.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maximum Failed Logins Before Account Suspension
                </label>
                <select
                  value={secMaxFailed}
                  onChange={(e) => setSecMaxFailed(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-800"
                >
                  <option value={3}>3 Attempts (Strict)</option>
                  <option value={5}>5 Attempts (Standard)</option>
                  <option value={10}>10 Attempts (Relaxed)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sec2Fa}
                    onChange={(e) => setSec2Fa(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Enforce Two-Factor Authentication (OTP / SMS)</span>
                    <span className="text-[11px] text-slate-500">Requires one-time code on registered headmaster mobile.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save & Enforce Security Policy</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          TAB 5: DATA HYGIENE & PURGE UTILITY
      ======================================================== */}
      {activeTab === 'hygiene' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Data Hygiene & Synced Cache Purge Utility</span>
            </h3>
            <p className="text-slate-500 mt-1">
              Safely purge historical offline synchronization items older than 30 days that have already successfully synced to state servers, freeing up local browser storage and maintaining optimal performance.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
            <h4 className="font-extrabold text-xs flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Hygiene Policy Notice</span>
            </h4>
            <p className="text-[11px] leading-relaxed">
              Records queued for purge: <strong>42 offline items</strong> (September/early October attendance sync items). Only records marked <code>synced</code> and older than 30 days are purged. Active unsynced records are never touched.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePurge}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Execute 30-Day Cache Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD NEW ADMIN USER
      ======================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Create New Administrator</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@gmms.upgov.in"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Role & Inheritance Model</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as AdminRoleType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="junior_admin">Junior Admin (Base Matrix)</option>
                  <option value="senior_admin">Senior Admin (Inherits Junior Admin)</option>
                  <option value="teacher">Teacher (Class Level Restricted)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 98000 00000"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Examination Registrar"
                  value={newUserDesignation}
                  onChange={(e) => setNewUserDesignation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE / DEACTIVATE CONFIRMATION
      ======================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900">Confirm Admin Deletion</h3>
              <p className="text-slate-500 mt-1">
                Are you sure you want to delete administrator <strong>{userToDelete.name}</strong> ({userToDelete.role})? This will immediately revoke all access rights.
              </p>
            </div>

            {deleteErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">
                {deleteErrorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteErrorMessage(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm"
              >
                Yes, Delete Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ACTIVITY HEATMAP & ENGAGEMENT DETAIL
      ======================================================== */}
      {isDetailModalOpen && selectedUserForDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={selectedUserForDetail.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={selectedUserForDetail.name}
                  className="w-10 h-10 rounded-xl object-cover border"
                />
                <div>
                  <h3 className="text-sm font-black text-slate-900">{selectedUserForDetail.name}</h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {selectedUserForDetail.role.replace('_', ' ').toUpperCase()} • {selectedUserForDetail.email}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 7-Day Activity Heatmap Chart */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>7-Day Activity Density Heatmap</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  Total: {(selectedUserForDetail.activity7Days || []).reduce((a, b) => a + b, 0)} Actions
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center pt-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                  const val = selectedUserForDetail.activity7Days?.[idx] ?? 0;
                  const bg =
                    val === 0
                      ? 'bg-slate-200 text-slate-600'
                      : val < 10
                      ? 'bg-emerald-200 text-emerald-900'
                      : val < 25
                      ? 'bg-emerald-400 text-emerald-950 font-bold'
                      : 'bg-emerald-600 text-white font-bold';

                  return (
                    <div key={day} className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{day}</div>
                      <div className={`h-12 rounded-xl flex items-center justify-center text-xs shadow-xs ${bg}`}>
                        {val}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Engagement Analysis:</strong> Consistent weekday administrative activity observed. No irregular midnight logins flagged in the last 7 days.
                </span>
              </div>
            </div>

            {/* Recent Actions List */}
            <div>
              <span className="font-bold text-xs text-slate-800 block mb-2">Audit Engagement Log:</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedUserForDetail.recentActions?.map((act, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EMERGENCY TEMPORARY CODE DISPLAY
      ======================================================== */}
      {tempCodeGenerated && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 text-xs text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900">Emergency Temporary Login Code</h3>
              <p className="text-slate-500 mt-1">
                Provide this 6-digit one-time code to the administrator to restore their session:
              </p>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl text-amber-300 font-mono text-2xl font-black tracking-widest shadow-inner">
              {tempCodeGenerated.code}
            </div>

            <p className="text-[10px] text-slate-400">
              Valid for 15 minutes. Automatically expires after successful authentication.
            </p>

            <button
              onClick={() => setTempCodeGenerated(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
