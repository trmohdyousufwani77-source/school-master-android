import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  UserCheck,
  History,
  X,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { AdminAuditChangeLog, AdminUser } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { AndroidAppDownloadCard } from './AndroidAppDownloadCard';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAdminName: string;
  onAdminSwitch?: (adminName: string) => void;
}

const PASSWORD_STORAGE_PREFIX = 'sm_admin_pwd_hash_';

// Simple web crypto hash helper for local security without hardcoding
async function hashPassword(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain + '_schoolmaster_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  activeAdminName,
  onAdminSwitch,
}) => {
  const { adminUsers, auditLogs, addAuditLog, setCurrentUserById } = usePermissions();

  const [activeTab, setActiveTab] = useState<'switch' | 'change_password' | 'history'>('switch');

  // Filter for the two named administrators
  const theTwoAdmins = [
    {
      id: 'user-admin-wani',
      name: 'Mohd Yousuf Wani',
      role: 'Administrator 1 (Primary)',
      email: 'mohdyousufwani1977@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      id: 'user-admin-nazir',
      name: 'Nazir Ahmad Dar',
      role: 'Administrator 2 (Senior)',
      email: 'nazir.dar@school.edu.in',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  ];

  // Active admin detection
  const currentAdmin =
    theTwoAdmins.find((a) => a.name === activeAdminName) || theTwoAdmins[0];

  // Password Setup / Login State for Switch
  const [selectedTargetAdmin, setSelectedTargetAdmin] = useState<typeof theTwoAdmins[0]>(currentAdmin);
  const [targetHasPassword, setTargetHasPassword] = useState<boolean>(false);
  const [inputPassword, setInputPassword] = useState<string>('');
  const [setupNewPassword, setSetupNewPassword] = useState<string>('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<string | null>(null);

  // Change Password State
  const [currentOldPassword, setCurrentOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [changePwdError, setChangePwdError] = useState<string | null>(null);
  const [changePwdSuccess, setChangePwdSuccess] = useState<string | null>(null);

  // Check if selected target has an initialized password
  useEffect(() => {
    const existing = localStorage.getItem(`${PASSWORD_STORAGE_PREFIX}${selectedTargetAdmin.id}`);
    setTargetHasPassword(!!existing);
    setInputPassword('');
    setSetupNewPassword('');
    setSetupConfirmPassword('');
    setSwitchError(null);
    setSwitchSuccess(null);
  }, [selectedTargetAdmin]);

  if (!isOpen) return null;

  // Handle Switching or Initial Setup
  const handleSwitchAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitchError(null);
    setSwitchSuccess(null);

    const storageKey = `${PASSWORD_STORAGE_PREFIX}${selectedTargetAdmin.id}`;
    const storedHash = localStorage.getItem(storageKey);

    if (!storedHash) {
      // First-time password setup for this admin
      if (setupNewPassword.length < 6) {
        setSwitchError('Password must be at least 6 characters long.');
        return;
      }
      if (setupNewPassword !== setupConfirmPassword) {
        setSwitchError('New passwords do not match. Please re-enter.');
        return;
      }

      const hashed = await hashPassword(setupNewPassword);
      localStorage.setItem(storageKey, hashed);

      // Save active profile name
      localStorage.setItem('sm_admin_profile_name', selectedTargetAdmin.name);
      setCurrentUserById(selectedTargetAdmin.id);
      onAdminSwitch?.(selectedTargetAdmin.name);

      addAuditLog({
        actorId: selectedTargetAdmin.id,
        actorName: `${selectedTargetAdmin.name} (Admin)`,
        actionType: 'CREDENTIAL_RESET',
        description: `Administrator ${selectedTargetAdmin.name} successfully initialized their master security credentials`,
        newValue: 'Password Initialized',
        status: 'SUCCESS',
      });

      setSwitchSuccess(`Password configured! Logged in as ${selectedTargetAdmin.name}.`);
      setTimeout(() => {
        onClose();
      }, 1200);
      return;
    }

    // Existing password verification
    const enteredHash = await hashPassword(inputPassword);
    if (enteredHash !== storedHash) {
      setSwitchError('Incorrect password entered. Please try again.');
      return;
    }

    localStorage.setItem('sm_admin_profile_name', selectedTargetAdmin.name);
    setCurrentUserById(selectedTargetAdmin.id);
    onAdminSwitch?.(selectedTargetAdmin.name);

    addAuditLog({
      actorId: selectedTargetAdmin.id,
      actorName: `${selectedTargetAdmin.name} (Admin)`,
      actionType: 'ROLE_CHANGE',
      description: `Active administrator session switched to ${selectedTargetAdmin.name}`,
      newValue: selectedTargetAdmin.role,
      status: 'SUCCESS',
    });

    setSwitchSuccess(`Authenticated successfully as ${selectedTargetAdmin.name}!`);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  // Handle Changing Current Administrator's Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdError(null);
    setChangePwdSuccess(null);

    const storageKey = `${PASSWORD_STORAGE_PREFIX}${currentAdmin.id}`;
    const storedHash = localStorage.getItem(storageKey);

    // If there is an existing password, check old password
    if (storedHash) {
      const enteredOldHash = await hashPassword(currentOldPassword);
      if (enteredOldHash !== storedHash) {
        setChangePwdError('Current password does not match our records.');
        return;
      }
    }

    if (newPassword.length < 6) {
      setChangePwdError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangePwdError('New passwords do not match.');
      return;
    }

    const newHash = await hashPassword(newPassword);
    localStorage.setItem(storageKey, newHash);

    addAuditLog({
      actorId: currentAdmin.id,
      actorName: `${currentAdmin.name} (Admin)`,
      actionType: 'CREDENTIAL_RESET',
      description: `Administrator ${currentAdmin.name} changed their security password`,
      newValue: 'Password Updated',
      status: 'SUCCESS',
    });

    setChangePwdSuccess(`Password for ${currentAdmin.name} updated successfully!`);
    setCurrentOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setTimeout(() => {
      setActiveTab('switch');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Authorized Administrator Access</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Active: {activeAdminName}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Secure dual-administrator authentication for Mohd Yousuf Wani & Nazir Ahmad Dar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl mt-4 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('switch')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'switch'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Switch / Login</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('change_password')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'change_password'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity History</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto py-4 space-y-4">
          {/* TAB 1: SWITCH / LOGIN ADMINISTRATOR */}
          {activeTab === 'switch' && (
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Select Authorized Administrator
              </span>

              {/* 2 Admin Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {theTwoAdmins.map((admin) => {
                  const isSelected = selectedTargetAdmin.id === admin.id;
                  const isCurrentActive = activeAdminName.includes(admin.name);
                  const hasPwd = !!localStorage.getItem(`${PASSWORD_STORAGE_PREFIX}${admin.id}`);

                  return (
                    <div
                      key={admin.id}
                      onClick={() => setSelectedTargetAdmin(admin)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={admin.avatar}
                          alt={admin.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-300 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {admin.name}
                            </span>
                            {isCurrentActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                            {admin.role}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                            {admin.email}
                          </p>
                          <div className="mt-2 flex items-center gap-1 text-[10px]">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span className={hasPwd ? 'text-slate-600' : 'text-amber-600 font-bold'}>
                              {hasPwd ? 'Password Set' : 'Setup Required'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Authentication Form for Selected Admin */}
              <form onSubmit={handleSwitchAdmin} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {targetHasPassword
                        ? `Authenticate as ${selectedTargetAdmin.name}`
                        : `First-Time Setup for ${selectedTargetAdmin.name}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">No hard-coded passwords</span>
                </div>

                {targetHasPassword ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Enter Security Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        placeholder="Enter your administrator password"
                        className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Welcome! Please create a secure personal password for <strong>{selectedTargetAdmin.name}</strong> to initialize access.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        New Password (Min 6 Characters)
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={setupNewPassword}
                        onChange={(e) => setSetupNewPassword(e.target.value)}
                        placeholder="Create your secure password"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={setupConfirmPassword}
                        onChange={(e) => setSetupConfirmPassword(e.target.value)}
                        placeholder="Re-enter password to confirm"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {switchError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{switchError}</span>
                  </div>
                )}

                {switchSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{switchSuccess}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{targetHasPassword ? 'Authenticate & Switch' : 'Save Password & Login'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'change_password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">
                    Updating Credentials For
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{currentAdmin.name}</p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">{currentAdmin.email}</span>
              </div>

              {localStorage.getItem(`${PASSWORD_STORAGE_PREFIX}${currentAdmin.id}`) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentOldPassword}
                    onChange={(e) => setCurrentOldPassword(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password (Min 6 Characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new master password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password to verify"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {changePwdError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{changePwdError}</span>
                </div>
              )}

              {changePwdSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{changePwdSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('switch')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Save New Password</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ACTIVITY HISTORY (AUDIT LOG) */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Chronological Administrator Activity Log
                </span>
                <span className="text-[10px] font-mono text-slate-500">{auditLogs.length} Events Logged</span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {auditLogs.map((log) => {
                  const isWani = log.actorName.includes('Wani');
                  const isNazir = log.actorName.includes('Nazir');

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-indigo-300 transition-all text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              isWani
                                ? 'bg-indigo-100 text-indigo-800'
                                : isNazir
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {log.actorName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {log.actionType.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">{log.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Direct Android App Download Option */}
        <AndroidAppDownloadCard variant="compact" className="mt-3 shrink-0" />

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Dual Administrator Access • RTE & U-DISE Compliant</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
